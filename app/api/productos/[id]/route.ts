import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Antes la comprobación solo ocurría si el cliente enviaba ?email=,
    // así que omitirlo bastaba para saltársela.
    const { error: sinPermiso } = await exigirPermiso(request, [
      'productos.ver',
      'facturas.crear',
    ])
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    const producto = await prisma.producto.findUnique({
      where: { id },
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
    const { error: sinPermiso } = await exigirPermiso(request, 'productos.editar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    await prisma.producto.update({
      where: { id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error deleting producto' },
      { status: 400 }
    )
  }
}
