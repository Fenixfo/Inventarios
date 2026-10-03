import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'

/** Historial de compras en las que aparece un producto, las más recientes primero. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'compras.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // El producto debe ser de esta tienda.
    const producto = await prisma.producto.findFirst({ where: { id, tiendaId }, select: { id: true } })
    if (!producto) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })

    const lineas = await prisma.compraItem.findMany({
      where: { productoId: id, compra: { tiendaId } },
      select: {
        cantidad: true,
        precioFactura: true,
        costoFinal: true,
        compra: {
          select: {
            id: true,
            fecha: true,
            numeroFacturaProveedor: true,
            estado: true,
            proveedor: { select: { nombre: true } },
          },
        },
      },
      orderBy: { compra: { fecha: 'desc' } },
      take: 50,
    })

    return NextResponse.json({
      compras: lineas.map((l) => ({
        compraId: l.compra.id,
        fecha: l.compra.fecha,
        numeroFacturaProveedor: l.compra.numeroFacturaProveedor,
        estado: l.compra.estado,
        proveedor: l.compra.proveedor.nombre,
        cantidad: Number(l.cantidad),
        precioFactura: Number(l.precioFactura),
        costoFinal: Number(l.costoFinal),
      })),
    })
  } catch (error) {
    console.error('Error obteniendo historial de compras del producto:', error)
    return NextResponse.json({ error: 'No se pudo obtener el historial de compras' }, { status: 500 })
  }
}
