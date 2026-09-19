import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function generateFacturaNumber(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  const datePrefix = `${year}${month}${day}`

  return datePrefix
}

async function getNextSequence(datePrefix: string): Promise<number> {
  const facturas = await prisma.factura.findMany({
    where: {
      numeroFactura: {
        startsWith: datePrefix,
      },
    },
  })

  return facturas.length + 1
}

export async function GET() {
  try {
    const facturas = await prisma.factura.findMany({
      include: {
        cliente: true,
        usuario: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    })
    return NextResponse.json(facturas)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching facturas' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const datePrefix = generateFacturaNumber()
    const sequence = await getNextSequence(datePrefix)
    const numeroFactura = `${datePrefix}-${String(sequence).padStart(3, '0')}`

    const factura = await prisma.factura.create({
      data: {
        numeroFactura,
        clienteId: data.clienteId || null,
        usuarioId: data.usuarioId || null,
        terminoPago: data.terminoPago || null,
        metodoPago: data.metodoPago || null,
        anticipo: data.anticipo ? parseFloat(data.anticipo) : 0,
        contraEntrega: data.contraEntrega ? parseFloat(data.contraEntrega) : 0,
        subtotal: parseFloat(data.subtotal || 0),
        descuentoPorcentaje: data.descuentoPorcentaje ? parseFloat(data.descuentoPorcentaje) : 0,
        descuentoMonto: data.descuentoMonto ? parseFloat(data.descuentoMonto) : 0,
        impuesto: parseFloat(data.impuesto || 0),
        total: parseFloat(data.total || 0),
        estado: 'pendiente',
        observaciones: data.observaciones || null,
        items: {
          create: data.items?.map((item: any) => ({
            productoId: item.productoId || null,
            cantidadM2: parseFloat(item.cantidadM2),
            precioUnitario: parseFloat(item.precioUnitario),
            subtotal: parseFloat(item.subtotal),
          })) || [],
        },
      },
      include: {
        cliente: true,
        usuario: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: data.usuarioId || null,
          tablaAfectada: 'facturas',
          registroId: factura.id,
          accion: 'CREATE',
          datosDespues: {
            numeroFactura: factura.numeroFactura,
            total: Number(factura.total),
            estado: factura.estado,
            clienteId: factura.clienteId,
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json(factura, { status: 201 })
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Error creating factura' },
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

    // Obtener factura anterior
    const facturaBefore = await prisma.factura.findUnique({
      where: { id },
    })

    const updateData: any = {
      terminoPago: data.terminoPago || null,
      metodoPago: data.metodoPago || null,
      anticipo: data.anticipo ? parseFloat(data.anticipo) : 0,
      contraEntrega: data.contraEntrega ? parseFloat(data.contraEntrega) : 0,
      subtotal: parseFloat(data.subtotal || 0),
      descuentoPorcentaje: data.descuentoPorcentaje ? parseFloat(data.descuentoPorcentaje) : 0,
      descuentoMonto: data.descuentoMonto ? parseFloat(data.descuentoMonto) : 0,
      impuesto: parseFloat(data.impuesto || 0),
      total: parseFloat(data.total || 0),
      estado: data.estado || 'pendiente',
      observaciones: data.observaciones || null,
    }

    if (data.estado === 'pagado') {
      updateData.fechaPago = new Date()
    }

    const factura = await prisma.factura.update({
      where: { id },
      data: updateData,
      include: {
        cliente: true,
        usuario: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: data.usuarioId || null,
          tablaAfectada: 'facturas',
          registroId: id,
          accion: 'UPDATE',
          datosAntes: {
            estado: facturaBefore?.estado,
            total: facturaBefore?.total ? Number(facturaBefore.total) : 0,
            anticipo: facturaBefore?.anticipo ? Number(facturaBefore.anticipo) : 0,
          },
          datosDespues: {
            estado: factura.estado,
            total: Number(factura.total),
            anticipo: Number(factura.anticipo),
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json(factura)
  } catch (error: any) {
    console.error('PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating factura' },
      { status: 400 }
    )
  }
}
