import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSesion, olvidarCache } from '@/lib/permisos'
import { generarCodigo } from '@/lib/codigo-tienda'
import { identificarCliente } from '@/lib/rate-limit'
import { z } from 'zod'

/**
 * Crear una tienda.
 *
 * Solo exige sesión, no permisos: quien acaba de registrarse no tiene
 * ninguno, y esta es justamente la vía para empezar. Quien la crea queda
 * como dueño, con acceso a todo y sin que nadie se lo pueda retirar.
 */

/** Una tienda propia por persona. Varias quedan para los planes de pago. */
const TIENDAS_POR_PERSONA = 1

/**
 * Tope diario por IP. No es "una por IP para siempre" a propósito: en un
 * negocio, una casa o un café todos salen por la misma, y el segundo dueño
 * legítimo quedaría bloqueado sin poder hacer nada.
 */
const TIENDAS_POR_IP_AL_DIA = 10

const tiendaSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio').max(200),
  ciudad: z.string().trim().max(100).optional(),
  descripcion: z.string().trim().max(500).optional(),

  // Los mismos datos que pide la configuración. Solo el nombre es
  // obligatorio; el resto se completa después desde el panel.
  eslogan_empresa: z.string().trim().max(200).optional(),
  nit_empresa: z.string().trim().max(100).optional(),
  direccion_empresa: z.string().trim().max(300).optional(),
  telefono_empresa: z.string().trim().max(50).optional(),
  email_empresa: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, {
      message: 'El correo no tiene un formato válido',
    })
    .optional(),
  whatsapp_pedidos: z
    .string()
    .trim()
    .refine((v) => v === '' || v.replace(/\D/g, '').length >= 10, {
      message: 'El WhatsApp debe incluir indicativo (ej: 573001234567)',
    })
    .optional(),
})

const CLAVES_CONFIG: Record<string, string> = {
  eslogan_empresa: 'texto',
  nit_empresa: 'texto',
  direccion_empresa: 'texto',
  telefono_empresa: 'telefono',
  email_empresa: 'email',
  whatsapp_pedidos: 'telefono',
}

/**
 * Busca un código libre. La probabilidad de chocar es ínfima —887 millones
 * de combinaciones—, pero comprobarlo cuesta nada y evita un error feo el
 * día que ocurra.
 */
async function codigoDisponible(): Promise<string> {
  for (let intento = 0; intento < 10; intento++) {
    const codigo = generarCodigo()
    const ocupado = await prisma.tienda.findUnique({
      where: { codigo },
      select: { id: true },
    })
    if (!ocupado) return codigo
  }

  throw new Error('No se pudo generar un código de tienda')
}

export async function POST(request: NextRequest) {
  try {
    const { usuario, error: sinSesion } = await exigirSesion(request)
    if (sinSesion) return sinSesion

    const parsed = tiendaSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { nombre, ciudad, descripcion, ...configuracion } = parsed.data

    // Una tienda propia por persona. Ser dueño es lo que cuenta: se puede
    // trabajar en varias tiendas de otros sin que eso gaste el cupo.
    const propias = await prisma.usuarioTienda.count({
      where: { usuarioId: usuario.id, esOwner: true },
    })

    if (propias >= TIENDAS_POR_PERSONA) {
      return NextResponse.json(
        {
          error:
            'Ya tienes una tienda propia. Por ahora cada persona puede crear una sola.',
        },
        { status: 409 }
      )
    }

    const ip = identificarCliente(request.headers)
    const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const desdeEstaIp = await prisma.tienda.count({
      where: { creadaDesdeIp: ip, createdAt: { gte: hace24Horas } },
    })

    if (desdeEstaIp >= TIENDAS_POR_IP_AL_DIA) {
      return NextResponse.json(
        { error: 'Se crearon demasiadas tiendas desde aquí hoy. Inténtalo mañana.' },
        { status: 429 }
      )
    }

    const codigo = await codigoDisponible()

    // Todo junto: si algo falla, no queda una tienda sin dueño ni un dueño
    // sin tienda.
    const tienda = await prisma.$transaction(async (tx) => {
      const nueva = await tx.tienda.create({
        data: {
          nombre,
          codigo,
          ciudad: ciudad || null,
          descripcion: descripcion || null,
          creadaDesdeIp: ip,
          activo: true,
        },
      })

      await tx.usuarioTienda.create({
        data: { usuarioId: usuario.id, tiendaId: nueva.id, esOwner: true },
      })

      const filas = Object.entries(configuracion)
        .filter(([clave, valor]) => valor && CLAVES_CONFIG[clave])
        .map(([clave, valor]) => ({
          tiendaId: nueva.id,
          clave,
          valor: String(valor),
          tipo: CLAVES_CONFIG[clave],
          updatedBy: usuario.id,
        }))

      if (filas.length) await tx.configuracion.createMany({ data: filas })

      return nueva
    })

    // El caché guarda los accesos un minuto; sin esto la tienda recién
    // creada tardaría en aparecer.
    olvidarCache(usuario.email)

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          tiendaId: tienda.id,
          tablaAfectada: 'tiendas',
          registroId: tienda.id,
          accion: 'CREATE',
          datosDespues: { nombre, ciudad, codigo },
          ipAddress: ip !== 'desconocido' ? ip : null,
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json(
      {
        id: tienda.id,
        nombre: tienda.nombre,
        codigo: tienda.codigo,
        ciudad: tienda.ciudad,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creando tienda:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear la tienda' },
      { status: 500 }
    )
  }
}
