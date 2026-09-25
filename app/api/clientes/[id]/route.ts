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
      'clientes.ver',
      'facturas.crear',
    ])
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    // Con la tienda en el where, un cliente de otra tienda responde
    // "no encontrado" en vez de mostrarse.
    const cliente = await prisma.cliente.findFirst({
      where: { id, tiendaId },
    })

    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(cliente)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching cliente' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'clientes.editar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    const { count } = await prisma.cliente.updateMany({
      where: { id, tiendaId },
      data: { activo: false },
    })

    if (count === 0) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error deleting cliente' },
      { status: 400 }
    )
  }
}
