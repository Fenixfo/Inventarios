import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSesion, exigirTienda } from '@/lib/permisos'
import { codigoValido, normalizarCodigo } from '@/lib/codigo-tienda'

// POST: Crear nueva solicitud de acceso
export async function POST(request: NextRequest) {
  try {
    // Aquí solo se exige sesión: quien pide acceso todavía no tiene permisos,
    // que es justamente el motivo de la solicitud.
    const { usuario, error: sinSesion } = await exigirSesion(request)
    if (sinSesion) return sinSesion

    const { codigo, razon } = await request.json()

    // Quién pide sale del token. Antes venían `usuarioId` y `email` en el
    // cuerpo, así que se podía pedir acceso en nombre de otra persona.
    const usuarioId = usuario.id
    const email = usuario.email

    if (!codigo) {
      return NextResponse.json(
        { error: 'Indica el código de la tienda' },
        { status: 400 }
      )
    }

    const limpio = normalizarCodigo(String(codigo))

    if (!codigoValido(limpio)) {
      return NextResponse.json(
        { error: 'El código son 6 caracteres, sin la letra O ni el número 0' },
        { status: 400 }
      )
    }

    // La tienda se resuelve por el código, no por un identificador que
    // venga en la petición.
    const tienda = await prisma.tienda.findFirst({
      where: { codigo: limpio, activo: true },
      select: { id: true, nombre: true },
    })

    if (!tienda) {
      return NextResponse.json(
        { error: 'No hay ninguna tienda con ese código' },
        { status: 404 }
      )
    }

    const tiendaId = tienda.id

    const yaTieneAcceso = await prisma.usuarioTienda.findUnique({
      where: { usuarioId_tiendaId: { usuarioId, tiendaId } },
      select: { id: true },
    })

    if (yaTieneAcceso) {
      return NextResponse.json(
        { error: `Ya tienes acceso a ${tienda.nombre}` },
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
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'solicitudes-acceso')
    if (sinPermiso) return sinPermiso

    const estado = request.nextUrl.searchParams.get('estado') || 'pendiente'

    // La tienda sale de la sesión. Antes venía como parámetro, así que se
    // podían leer las solicitudes de cualquier otra tienda.
    const where: any = { tiendaId }
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
