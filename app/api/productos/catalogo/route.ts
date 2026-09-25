import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Catálogo público: los productos de todas las tiendas que hayan elegido
 * ser visibles.
 *
 * Cada producto dice a qué tienda pertenece, porque en el catálogo conviven
 * varias y el cliente necesita saber a quién le está comprando. Los pedidos
 * se envían al WhatsApp de esa tienda, no a uno común.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const tienda = searchParams.get('tienda')

    const where: any = {
      activo: true,
      stockActual: { gt: 0 },
      // Una tienda privada no aparece aquí aunque tenga productos activos.
      tienda: { activo: true, publica: true },
    }

    if (categoria) where.categoria = categoria
    if (tienda) where.tiendaId = tienda

    const productos = await prisma.producto.findMany({
      where,
      select: {
        id: true,
        imagenUrl: true,
        nombre: true,
        sku: true,
        categoria: true,
        dimensiones: true,
        color: true,
        acabado: true,
        m2PorCaja: true,
        precioUnitario: true,
        tienda: { select: { id: true, nombre: true, ciudad: true } },
      },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json(productos)
  } catch (error) {
    console.error('Error fetching catálogo:', error)
    return NextResponse.json(
      { error: 'Error al obtener catálogo' },
      { status: 500 }
    )
  }
}
