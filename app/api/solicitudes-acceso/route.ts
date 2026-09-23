import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSesion, exigirPermiso } from '@/lib/permisos'

// POST: Crear nueva solicitud de acceso
export async function POST(request: NextRequest) {
  try {
    // Aquí solo se exige sesión: quien pide acceso todavía no tiene permisos,
    // que es justamente el motivo de la solicitud.
    const { error: sinSesion } = await exigirSesion(request)
    if (sinSesion) return sinSesion

    const { usuarioId, tiendaId, email, razon } = await request.json()

    if (!usuarioId || !tiendaId || !email) {
      return NextResponse.json(
        { error: 'usuarioId, tiendaId y email son requeridos' },
        { status: 400 }
      )
    }

    // Verificar si ya existe una solicitud
    const solicitudExistente = await prisma.solicitudAcceso.findFirst({
      where: {
        usuarioId,
        tiendaId,
      },
    })

    if (solicitudExistente) {
      if (solicitudExistente.estado === 'pendiente') {
        return NextResponse.json(
          { error: 'Ya existe una solicitud pendiente para esta tienda' },
          { status: 400 }
        )
      } else if (solicitudExistente.estado === 'aprobado') {
        return NextResponse.json(
          { error: 'Ya tienes acceso a esta tienda' },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'Ya existe una solicitud anterior para esta tienda' },
          { status: 400 }
        )
      }
    }

    // Crear solicitud
    const solicitud = await prisma.solicitudAcceso.create({
      data: {
        usuarioId,
        tiendaId,
        email,
        razon: razon || null,
        estado: 'pendiente',
      },
      include: {
        usuario: true,
        tienda: true,
      },
    })

    return NextResponse.json(solicitud, { status: 201 })
  } catch (error: any) {
    console.error('Error creando solicitud:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear solicitud' },
      { status: 500 }
    )
  }
}

// GET: Obtener solicitudes (filtradas por tienda si se pasa como query)
export async function GET(request: NextRequest) {
  try {
    // Ver las solicitudes de otros sí requiere el permiso del módulo.
    const { error: sinPermiso } = await exigirPermiso(request, 'solicitudes-acceso')
    if (sinPermiso) return sinPermiso

    const tiendaId = request.nextUrl.searchParams.get('tiendaId')
    const estado = request.nextUrl.searchParams.get('estado') || 'pendiente'

    const where: any = {}
    if (tiendaId) where.tiendaId = tiendaId
    if (estado) where.estado = estado

    const solicitudes = await prisma.solicitudAcceso.findMany({
      where,
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
          },
        },
        tienda: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(solicitudes)
  } catch (error: any) {
    console.error('Error obteniendo solicitudes:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener solicitudes' },
      { status: 500 }
    )
  }
}
