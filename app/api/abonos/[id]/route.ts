import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await params

    // Se filtra por la tienda de la factura, no por la del abono: así los
    // abonos siguen a su factura aunque se consulten por separado.
    const abonos = await prisma.abono.findMany({
      where: { facturaId: id, factura: { tiendaId } },
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
