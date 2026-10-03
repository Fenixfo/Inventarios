import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'

/** Detalle de una compra: proveedor, líneas con precio de factura y costo final, extras y totales. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'compras.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    // Con la tienda en el where, la de otra tienda responde "no encontrada".
    const compra = await prisma.compra.findFirst({
      where: { id, tiendaId },
      include: {
        proveedor: { select: { id: true, nombre: true, nit: true } },
        autor: { select: { email: true } },
        anulador: { select: { email: true } },
        costosExtra: { select: { id: true, concepto: true, valor: true } },
        items: {
          select: {
            id: true,
            productoId: true,
            productoNombre: true,
            productoCreado: true,
            cantidad: true,
            precioFactura: true,
            costoExtra: true,
            costoFinal: true,
            costoEditado: true,
            producto: { select: { sku: true } },
          },
          orderBy: { productoNombre: 'asc' },
        },
      },
    })

    if (!compra) return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })

    return NextResponse.json({
      id: compra.id,
      fecha: compra.fecha,
      createdAt: compra.createdAt,
      numeroFacturaProveedor: compra.numeroFacturaProveedor,
      estado: compra.estado,
      metodoReparto: compra.metodoReparto,
      observaciones: compra.observaciones,
      proveedor: compra.proveedor,
      autor: compra.autor?.email ?? null,
      subtotal: Number(compra.subtotal),
      totalExtras: Number(compra.totalExtras),
      total: Number(compra.total),
      anuladaPor: compra.anulador?.email ?? null,
      anuladaEn: compra.anuladaEn,
      motivoAnulacion: compra.motivoAnulacion,
      costosExtra: compra.costosExtra.map((e) => ({ id: e.id, concepto: e.concepto, valor: Number(e.valor) })),
      items: compra.items.map((i) => ({
        id: i.id,
        productoId: i.productoId,
        sku: i.producto.sku,
        productoNombre: i.productoNombre,
        productoCreado: i.productoCreado,
        cantidad: Number(i.cantidad),
        precioFactura: Number(i.precioFactura),
        costoExtra: Number(i.costoExtra),
        costoFinal: Number(i.costoFinal),
        costoEditado: i.costoEditado,
      })),
    })
  } catch (error) {
    console.error('Error obteniendo compra:', error)
    return NextResponse.json({ error: 'No se pudo obtener la compra' }, { status: 500 })
  }
}
