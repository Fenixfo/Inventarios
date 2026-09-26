import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, puede } from '@/lib/permisos'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'cotizaciones.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    // Con la tienda en el where: una cotización de otro negocio responde
    // "no encontrada" en vez de mostrarse.
    const cotizacion = await prisma.cotizacion.findFirst({
      where: { id, tiendaId },
      include: {
        cliente: {
          select: { nombre: true, cedulaCc: true, telefono: true, email: true, direccion: true },
        },
        usuario: { select: { email: true } },
        items: {
          include: { producto: { select: { sku: true, nombre: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    // Sin 'cotizaciones.ver_todas' solo se abren las propias.
    if (!puede(usuario, 'cotizaciones.ver_todas') && cotizacion.usuarioId !== usuario.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver esta cotización' },
        { status: 403 }
      )
    }

    return NextResponse.json(cotizacion)
  } catch (error: any) {
    console.error('Error obteniendo cotización:', error)
    return NextResponse.json({ error: 'Error al obtener la cotización' }, { status: 500 })
  }
}
