import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, veTodasLasFacturas } from '@/lib/permisos'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await params

    // Se filtra por la tienda de la factura, no por la del abono: así los
    // abonos siguen a su factura aunque se consulten por separado. Y con el
    // mismo alcance que la factura: sin 'facturas.ver_todas', los abonos de
    // una factura ajena no se ven.
    const abonos = await prisma.abono.findMany({
      where: {
        facturaId: id,
        factura: veTodasLasFacturas(usuario) ? { tiendaId } : { tiendaId, usuarioId: usuario.id },
      },
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
