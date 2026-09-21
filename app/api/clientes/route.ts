import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export async function GET() {
  try {
    const clientes = await prisma.cliente.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(clientes)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching clientes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const cliente = await prisma.cliente.create({
      data: {
        nombre: data.nombre,
        email: data.email || null,
        telefono: data.telefono || null,
        cedulaCc: data.cedulaCc || null,
        direccion: data.direccion || null,
        terminoPago: data.terminoPago || null,
        limiteCredito: data.limiteCredito ? parseFloat(data.limiteCredito) : 0,
        activo: true,
      },
    })
    return NextResponse.json(cliente, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error creating cliente' },
      { status: 400 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json()
    const { id } = data

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {
      nombre: data.nombre,
    }

    if (data.email) updateData.email = data.email
    if (data.telefono) updateData.telefono = data.telefono
    if (data.cedulaCc) updateData.cedulaCc = data.cedulaCc
    if (data.direccion) updateData.direccion = data.direccion
    if (data.terminoPago) updateData.terminoPago = data.terminoPago
    if (data.limiteCredito !== undefined) updateData.limiteCredito = parseFloat(data.limiteCredito || 0)

    const cliente = await prisma.cliente.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json(cliente)
  } catch (error: any) {
    console.error('PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating cliente' },
      { status: 400 }
    )
  }
}
