import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Categorías y tiendas que tienen algo que mostrar en el catálogo.
 *
 * Va aparte de la lista de productos porque la portada trae solo unos pocos
 * por tienda: si los filtros se armaran con eso, faltarían categorías que
 * sí existen y no habría forma de llegar a ellas.
 */
export async function GET() {
  try {
    const visibles = {
      activo: true,
      stockActual: { gt: 0 },
      tienda: { activo: true, publica: true },
      imagenUrl: { not: null },
      NOT: { imagenUrl: '' },
    }

    const [categorias, conProductos] = await Promise.all([
      prisma.producto.findMany({
        where: visibles,
        select: { categoria: true },
        distinct: ['categoria'],
        orderBy: { categoria: 'asc' },
      }),
      // Solo las tiendas que tienen productos a la vista: una tienda vacía
      // en el desplegable solo sirve para llevar a una pantalla en blanco.
      prisma.producto.findMany({
        where: visibles,
        select: { tienda: { select: { id: true, nombre: true, ciudad: true } } },
        distinct: ['tiendaId'],
      }),
    ])

    // Los filtros cambian mucho menos que los productos, así que aguantan
    // más caché: son las categorías y las tiendas que existen.
    return NextResponse.json({
      categorias: categorias.map((c) => c.categoria),
      tiendas: conProductos
        .map((p) => p.tienda)
        .filter(Boolean)
        .sort((a, b) => a!.nombre.localeCompare(b!.nombre, 'es')),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('Error obteniendo filtros del catálogo:', error)
    return NextResponse.json({ error: 'Error al obtener los filtros' }, { status: 500 })
  }
}
