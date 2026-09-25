import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, ['clientes.ver', 'facturas.crear'])
    if (sinPermiso) return sinPermiso

    const clientes = await prisma.cliente.findMany({
      where: { activo: true, tiendaId },
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
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, ['clientes.crear', 'facturas.crear'])
    if (sinPermiso) return sinPermiso

    const data = await request.json()
    const cliente = await prisma.cliente.create({
      data: {
        // La tienda y el autor salen de la sesión, nunca del cuerpo.
        tiendaId,
        createdBy: usuario.id,
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
    // Choque de índice único: aquí solo puede ser la cédula, que es única
    // dentro de la tienda.
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Ya tienes un cliente con esa cédula en esta tienda' },
        { status: 409 }
      )
    }

    console.error('Error creando cliente:', error)
    return NextResponse.json(
      { error: error.message || 'Error creating cliente' },
      { status: 400 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'clientes.editar')
    if (sinPermiso) return sinPermiso

    const data = await request.json()
    const { id } = data

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    // El id viene en el cuerpo, así que hay que comprobar que el cliente
    // sea de esta tienda antes de modificarlo.
    const propio = await prisma.cliente.findFirst({
      where: { id, tiendaId },
      select: { id: true },
    })

    if (!propio) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
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
