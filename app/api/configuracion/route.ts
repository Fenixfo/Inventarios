import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Claves permitidas y su tipo. Cualquier clave fuera de esta lista se ignora.
export const CLAVES_CONFIG = {
  whatsapp_pedidos: 'telefono',
  nombre_empresa: 'texto',
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
  nombre_empresa: z.string().trim().max(200).optional(),
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
  email: z.string().email().optional().nullable(),
})

async function verificarAdmin(email: string | null | undefined) {
  if (!email) return { autorizado: false, usuarioId: null }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      rolesPersonalizados: {
        include: { rol: { include: { permisos: { include: { modulo: true } } } } },
      },
    },
  })

  if (!usuario) return { autorizado: false, usuarioId: null }

  const esAdmin = usuario.rolesPersonalizados?.some((ur: any) =>
    ur.rol.permisos.some((p: any) => p.modulo.modulo === 'administrador')
  )

  return { autorizado: Boolean(esAdmin), usuarioId: usuario.id }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    const { autorizado } = await verificarAdmin(email)
    if (!autorizado) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver la configuración' },
        { status: 403 }
      )
    }

    const registros = await prisma.configuracion.findMany({
      where: { clave: { in: Object.keys(CLAVES_CONFIG) } },
      select: { clave: true, valor: true, updatedAt: true },
    })

    const config: Record<string, string> = {}
    for (const clave of Object.keys(CLAVES_CONFIG)) {
      config[clave] = registros.find((r) => r.clave === clave)?.valor || ''
    }

    const ultima = registros
      .map((r) => r.updatedAt)
      .sort((a, b) => b.getTime() - a.getTime())[0]

    return NextResponse.json({ config, actualizadoEn: ultima || null })
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
    const body = await request.json()
    const parsed = configSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email, ...valores } = parsed.data
    const { autorizado, usuarioId } = await verificarAdmin(email)

    if (!autorizado) {
      return NextResponse.json(
        { error: 'No tienes permiso para modificar la configuración' },
        { status: 403 }
      )
    }

    const claves = Object.keys(valores).filter(
      (k): k is ClaveConfig => k in CLAVES_CONFIG && valores[k as ClaveConfig] !== undefined
    )

    await prisma.$transaction(
      claves.map((clave) =>
        prisma.configuracion.upsert({
          where: { clave },
          create: {
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
    )

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId,
          tablaAfectada: 'configuracion',
          registroId: usuarioId || '00000000-0000-0000-0000-000000000000',
          accion: 'UPDATE',
          datosDespues: valores,
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json({ ok: true, actualizadas: claves.length })
  } catch (error: any) {
    console.error('Error guardando configuración:', error)
    return NextResponse.json(
      { error: error.message || 'Error al guardar configuración' },
      { status: 500 }
    )
  }
}
