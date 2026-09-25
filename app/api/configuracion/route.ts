import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { z } from 'zod'

/**
 * Claves permitidas y su tipo. Cualquier clave fuera de esta lista se ignora.
 *
 * El nombre no está aquí: vive en `tiendas.nombre`, que es el que usa todo
 * el sistema. Tenerlo también como configuración daba dos fuentes para el
 * mismo dato, y terminaron contradiciéndose.
 */
export const CLAVES_CONFIG = {
  whatsapp_pedidos: 'telefono',
  eslogan_empresa: 'texto',
  nit_empresa: 'texto',
  direccion_empresa: 'texto',
  telefono_empresa: 'telefono',
  email_empresa: 'email',
  logo_url: 'url',
} as const

type ClaveConfig = keyof typeof CLAVES_CONFIG

const configSchema = z.object({
  whatsapp_pedidos: z
    .string()
    .trim()
    .refine((v) => v === '' || v.replace(/\D/g, '').length >= 10, {
      message: 'El WhatsApp debe incluir indicativo (ej: 573001234567)',
    })
    .optional(),
  // El nombre de la tienda se guarda en `tiendas`, no en configuración.
  nombre_empresa: z.string().trim().min(1).max(200).optional(),
  // Si los productos salen en el catálogo público. También es de `tiendas`.
  publica: z.boolean().optional(),
  eslogan_empresa: z.string().trim().max(200).optional(),
  nit_empresa: z.string().trim().max(100).optional(),
  direccion_empresa: z.string().trim().max(300).optional(),
  telefono_empresa: z.string().trim().max(50).optional(),
  email_empresa: z
    .string()
    .trim()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, {
      message: 'Email inválido',
    })
    .optional(),
  logo_url: z
    .string()
    .trim()
    .refine((v) => v === '' || /^https?:\/\/.+/.test(v), {
      message: 'El logo debe ser una URL que empiece por http:// o https://',
    })
    .optional(),
  // Identifica a quien hace la petición. El permiso se resuelve buscando
  // el usuario en la BD, así que un formato inesperado simplemente no
  // encuentra a nadie y devuelve 403; no hace falta validarlo aquí.
  email: z.string().trim().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'configuracion.ver')
    if (sinPermiso) return sinPermiso

    const [registros, tienda] = await Promise.all([
      prisma.configuracion.findMany({
        where: { tiendaId, clave: { in: Object.keys(CLAVES_CONFIG) } },
        select: { clave: true, valor: true, updatedAt: true },
      }),
      prisma.tienda.findUnique({
        where: { id: tiendaId },
        select: { nombre: true, ciudad: true, publica: true, updatedAt: true },
      }),
    ])

    const config: Record<string, string> = {}
    for (const clave of Object.keys(CLAVES_CONFIG)) {
      config[clave] = registros.find((r) => r.clave === clave)?.valor || ''
    }

    // El nombre viaja junto al resto para que la pantalla lo trate como un
    // campo más, aunque por dentro se guarde en otra tabla.
    config.nombre_empresa = tienda?.nombre || ''

    const ultima = [...registros.map((r) => r.updatedAt), tienda?.updatedAt]
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0]

    return NextResponse.json({
      config,
      publica: tienda?.publica ?? true,
      actualizadoEn: ultima || null,
    })
  } catch (error: any) {
    console.error('Error obteniendo configuración:', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(
      request,
      'configuracion.editar'
    )
    if (sinPermiso) return sinPermiso

    const body = await request.json()
    const parsed = configSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, nombre_empresa, publica, ...valores } = parsed.data
    const usuarioId = usuario.id

    const claves = Object.keys(valores).filter(
      (k): k is ClaveConfig => k in CLAVES_CONFIG && valores[k as ClaveConfig] !== undefined
    )

    const operaciones: any[] = claves.map((clave) =>
      prisma.configuracion.upsert({
        where: { tiendaId_clave: { tiendaId, clave } },
        create: {
          tiendaId,
          clave,
          valor: valores[clave] || null,
          tipo: CLAVES_CONFIG[clave],
          updatedBy: usuarioId,
        },
        update: {
          valor: valores[clave] || null,
          updatedBy: usuarioId,
        },
      })
    )

    // El nombre y la visibilidad van a la tabla de tiendas, que es donde
    // los lee todo lo demás.
    if (nombre_empresa !== undefined || publica !== undefined) {
      operaciones.push(
        prisma.tienda.update({
          where: { id: tiendaId },
          data: {
            ...(nombre_empresa ? { nombre: nombre_empresa } : {}),
            ...(publica !== undefined ? { publica } : {}),
          },
        })
      )
    }

    await prisma.$transaction(operaciones)

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId,
          tiendaId,
          tablaAfectada: 'configuracion',
          registroId: tiendaId,
          accion: 'UPDATE',
          datosDespues: {
            ...valores,
            ...(nombre_empresa ? { nombre_empresa } : {}),
            ...(publica !== undefined ? { publica } : {}),
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json({
      ok: true,
      actualizadas:
        claves.length + (nombre_empresa ? 1 : 0) + (publica !== undefined ? 1 : 0),
    })
  } catch (error: any) {
    console.error('Error guardando configuración:', error)
    return NextResponse.json(
      { error: error.message || 'Error al guardar configuración' },
      { status: 500 }
    )
  }
}
