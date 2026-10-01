import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { cantidadPendiente, ESTADOS_VISIBLES } from '@/lib/liquidacion'
import { costosGuardar, leerCuerpo } from '@/lib/esquemas'
import { esUuid } from '@/lib/formato'

/**
 * Guarda los costos que se ajustaron en la pantalla de liquidar, sin liquidar.
 *
 * Sirve para cualquier factura de la tienda que aún no se liquidó
 * (pendiente, pagada o entregada): al volver a entrar, los costos siguen ahí.
 * Una factura ya liquidada no cambia.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'liquidaciones.crear')
    if (sinPermiso) return sinPermiso

    const { datos, error: invalido } = await leerCuerpo(request, costosGuardar)
    if (invalido) return invalido
    const { costos, costosFacturados } = datos

    const itemIds = [...new Set([...Object.keys(costos), ...Object.keys(costosFacturados)])]
    if (itemIds.length === 0) return NextResponse.json({ guardados: 0 })
    if (itemIds.length > 1000 || !itemIds.every(esUuid)) {
      return NextResponse.json({ error: 'Identificadores de línea no válidos' }, { status: 400 })
    }

    // Solo líneas de facturas de esta tienda, sin liquidar.
    const items = await prisma.facturaItem.findMany({
      where: {
        id: { in: itemIds },
        factura: { tiendaId, estado: { in: ESTADOS_VISIBLES }, liquidacionId: null },
      },
      select: { id: true, cantidadM2: true, cantidadConCosto: true },
    })

    if (items.length !== itemIds.length) {
      return NextResponse.json(
        { error: 'Alguna factura ya no se puede editar: es de otra tienda o ya se liquidó. Recarga la lista.' },
        { status: 409 }
      )
    }

    await prisma.$transaction(
      items.flatMap((item) => {
        const data: { costoUnitario?: number; costoLiquidacion?: number } = {}
        const conCosto = Number(item.cantidadConCosto)
        const pendiente = cantidadPendiente({
          cantidadM2: Number(item.cantidadM2),
          cantidadConCosto: conCosto,
          costoUnitario: null,
        })

        if (costosFacturados[item.id] !== undefined && conCosto > 0) data.costoUnitario = Number(costosFacturados[item.id])
        if (costos[item.id] !== undefined && pendiente > 0) data.costoLiquidacion = Number(costos[item.id])

        return Object.keys(data).length > 0
          ? [prisma.facturaItem.update({ where: { id: item.id }, data })]
          : []
      })
    )

    return NextResponse.json({ guardados: items.length })
  } catch (error) {
    console.error('Error guardando costos:', error)
    return NextResponse.json({ error: 'Error al guardar los costos' }, { status: 500 })
  }
}
