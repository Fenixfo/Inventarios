import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tabla = searchParams.get('tabla')
    const registroId = searchParams.get('registroId')
    const accion = searchParams.get('accion')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Construir filtros
    const where: any = {}
    if (tabla) where.tablaAfectada = tabla
    if (registroId) where.registroId = registroId
    if (accion) where.accion = accion

    // Obtener registros de auditoría
    const registros = await prisma.auditoria.findMany({
      where,
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        fechaAccion: 'desc',
      },
      take: limit,
      skip: offset,
    })

    // Contar total
    const total = await prisma.auditoria.count({ where })

    return NextResponse.json({
      registros: registros.map((r) => ({
        id: r.id,
        usuarioId: r.usuarioId,
        usuario: r.usuario,
        tablaAfectada: r.tablaAfectada,
        registroId: r.registroId,
        accion: r.accion,
        datosAntes: r.datosAntes,
        datosDespues: r.datosDespues,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        fechaAccion: r.fechaAccion,
      })),
      total,
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('Error en auditoría:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener auditoría' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      usuarioId,
      tablaAfectada,
      registroId,
      accion,
      datosAntes,
      datosDespues,
    } = body

    if (!tablaAfectada || !registroId || !accion) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    // Obtener IP
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.ip ||
      null

    // Obtener User-Agent
    const userAgent = request.headers.get('user-agent')

    const registro = await prisma.auditoria.create({
      data: {
        usuarioId: usuarioId || null,
        tablaAfectada,
        registroId,
        accion,
        datosAntes,
        datosDespues,
        ipAddress,
        userAgent,
      },
    })

    return NextResponse.json(registro)
  } catch (error: any) {
    console.error('Error creando registro de auditoría:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear registro' },
      { status: 500 }
    )
  }
}
