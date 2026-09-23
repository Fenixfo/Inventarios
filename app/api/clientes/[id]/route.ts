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
      'clientes.ver',
      'facturas.crear',
    ])
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    const cliente = await prisma.cliente.findUnique({
      where: { id },
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
    const { error: sinPermiso } = await exigirPermiso(request, 'clientes.editar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    await prisma.cliente.update({
      where: { id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error deleting cliente' },
      { status: 400 }
    )
  }
}
