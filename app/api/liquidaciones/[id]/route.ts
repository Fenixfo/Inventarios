import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { cantidadPendiente, ventaSinImpuesto } from '@/lib/liquidacion'

/** Detalle de una liquidación: sus facturas, con venta, costo y ganancia de cada una. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'liquidaciones.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    // Con la tienda en el where: la de otro negocio responde "no encontrada".
    const liquidacion = await prisma.liquidacion.findFirst({
      where: { id, tiendaId },
      include: {
        vendedor: { select: { email: true } },
        autor: { select: { email: true } },
        facturas: {
          select: {
            id: true,
            numeroFactura: true,
            fecha: true,
            subtotal: true,
            descuentoMonto: true,
            cliente: { select: { nombre: true } },
            items: {
              select: {
                cantidadM2: true,
                cantidadConCosto: true,
                costoUnitario: true,
                costoLiquidacion: true,
              },
            },
          },
          orderBy: { fecha: 'asc' },
        },
      },
    })

    if (!liquidacion) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      id: liquidacion.id,
      fecha: liquidacion.fecha,
      vendedor: liquidacion.vendedor.email,
      autor: liquidacion.autor?.email || null,
      porcentaje: Number(liquidacion.porcentaje),
      totalVenta: Number(liquidacion.totalVenta),
      totalCosto: Number(liquidacion.totalCosto),
      totalGanancia: Number(liquidacion.totalGanancia),
      pagoVendedor: Number(liquidacion.pagoVendedor),
      observaciones: liquidacion.observaciones,
      facturas: liquidacion.facturas.map((f) => {
        const venta = ventaSinImpuesto({ subtotal: Number(f.subtotal), descuentoMonto: Number(f.descuentoMonto) })
        const costo = f.items.reduce((suma, item) => {
          const base = {
            cantidadM2: Number(item.cantidadM2),
            cantidadConCosto: Number(item.cantidadConCosto),
            costoUnitario: item.costoUnitario === null ? null : Number(item.costoUnitario),
          }
          return (
            suma +
            base.cantidadConCosto * (base.costoUnitario ?? 0) +
            cantidadPendiente(base) * Number(item.costoLiquidacion ?? 0)
          )
        }, 0)

        return {
          id: f.id,
          numeroFactura: f.numeroFactura,
          fecha: f.fecha,
          cliente: f.cliente?.nombre || null,
          venta,
          costo: Math.round(costo * 100) / 100,
          ganancia: Math.round((venta - costo) * 100) / 100,
        }
      }),
    })
  } catch (error) {
    console.error('Error obteniendo liquidación:', error)
    return NextResponse.json({ error: 'Error al obtener la liquidación' }, { status: 500 })
  }
}
