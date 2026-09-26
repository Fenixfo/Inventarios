import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'

/**
 * Las categorías que usa la tienda, para el campo de categoría del
 * formulario de producto.
 *
 * Antes el formulario bajaba la lista completa de productos, con todas sus
 * columnas, solo para sacar de ahí los nombres de categoría.
 */
export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, [
      'productos.ver',
      'productos.crear',
      'productos.editar',
    ])
    if (sinPermiso) return sinPermiso

    const filas = await prisma.producto.findMany({
      where: { activo: true, tiendaId },
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' },
    })

    return NextResponse.json(filas.map((f) => f.categoria).filter(Boolean))
  } catch (error) {
    console.error('Error obteniendo categorías:', error)
    return NextResponse.json({ error: 'Error al obtener las categorías' }, { status: 500 })
  }
}
