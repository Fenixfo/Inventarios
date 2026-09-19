import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const abonos = await prisma.abono.findMany({
      where: { facturaId: id },
      orderBy: { fecha: 'asc' },
    })

    return NextResponse.json(
      abonos.map(abono => ({
        monto: Number(abono.monto),
        fecha: abono.fecha.toISOString(),
      }))
    )
  } catch (error: any) {
    console.error('Error al obtener abonos:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener abonos' },
      { status: 500 }
    )
  }
}
