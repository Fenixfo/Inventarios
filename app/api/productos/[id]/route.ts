import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Antes la comprobación solo ocurría si el cliente enviaba ?email=,
    // así que omitirlo bastaba para saltársela.
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, [
      'productos.ver',
      'facturas.crear',
    ])
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    // findFirst con la tienda, no findUnique por id: así un producto de otra
    // tienda responde "no encontrado" en vez de mostrarse.
    const producto = await prisma.producto.findFirst({
      where: { id, tiendaId },
    })

    if (!producto) {
      return NextResponse.json(
        { error: 'Producto not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(producto)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching producto' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'productos.editar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    // updateMany con la tienda en el where: si el producto es de otra
    // tienda no coincide ninguna fila y no se desactiva nada.
    const { count } = await prisma.producto.updateMany({
      where: { id, tiendaId },
      data: { activo: false },
    })

    if (count === 0) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error deleting producto' },
      { status: 400 }
    )
  }
}
