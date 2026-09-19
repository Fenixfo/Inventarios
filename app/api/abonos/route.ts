import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { facturaId, monto } = await request.json()

    if (!facturaId || !monto || monto <= 0) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      )
    }

    const factura = await prisma.factura.findUnique({
      where: { id: facturaId },
    })

    if (!factura) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    const abono = await prisma.abono.create({
      data: {
        facturaId,
        monto,
        fecha: new Date(),
      },
    })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          tablaAfectada: 'abonos',
          registroId: abono.id,
          accion: 'CREATE',
          datosDespues: {
            facturaId,
            monto: Number(abono.monto),
            fecha: abono.fecha.toISOString(),
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json({
      monto: Number(abono.monto),
      fecha: abono.fecha.toISOString(),
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error al crear abono:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear abono' },
      { status: 500 }
    )
  }
}
