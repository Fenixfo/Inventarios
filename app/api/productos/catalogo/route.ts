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

const SELECCION = {
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
} as const

/**
 * El catálogo es igual para todos los visitantes, así que se deja cachear un
 * minuto en el CDN. Sin esto, cada visita consulta la base: con el catálogo
 * en la portada eso son dos consultas por persona que entra.
 *
 * Un minuto es el retraso máximo con el que aparecería un producto nuevo o
 * desaparecería uno agotado; el pedido se confirma por WhatsApp de todos
 * modos.
 */
function respuestaCacheable(datos: unknown) {
  return NextResponse.json(datos, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const tienda = searchParams.get('tienda')
    const limitePorTienda = parseInt(searchParams.get('limitePorTienda') || '', 10)

    const where: any = {
      activo: true,
      stockActual: { gt: 0 },
      // Una tienda privada no aparece aquí aunque tenga productos activos.
      tienda: { activo: true, publica: true },

      // Solo con foto: una vitrina de cuadros grises no vende nada. El
      // producto sigue existiendo para facturar, simplemente no se expone
      // hasta que tenga imagen. La cadena vacía se descarta aparte porque
      // en SQL no es lo mismo que NULL.
      imagenUrl: { not: null },
      NOT: { imagenUrl: '' },
    }

    if (categoria) where.categoria = categoria
    if (tienda) where.tiendaId = tienda

    // La portada enseña una muestra de cada negocio en vez de volcar el
    // inventario completo de todos: lo más reciente primero.
    //
    // Se trae en una sola consulta y se recorta aquí. La versión anterior
    // hacía una consulta por tienda en paralelo, y con el pooler de Supabase
    // cerrando conexiones inactivas bastaba con que una fallara para tumbar
    // la respuesta entera. Se leen más filas de las que se muestran; con
    // catálogos de miles de productos por tienda habría que pasar a SQL con
    // ROW_NUMBER() para cortar en la base.
    if (Number.isFinite(limitePorTienda) && limitePorTienda > 0) {
      const productos = await prisma.producto.findMany({
        where,
        select: SELECCION,
        orderBy: [{ tiendaId: 'asc' }, { createdAt: 'desc' }],
      })

      const cuantos = new Map<string, number>()
      const muestra = productos.filter((p) => {
        const id = p.tienda?.id || 'sin-tienda'
        const llevados = cuantos.get(id) || 0

        if (llevados >= limitePorTienda) return false

        cuantos.set(id, llevados + 1)
        return true
      })

      return respuestaCacheable(muestra)
    }

    const productos = await prisma.producto.findMany({
      where,
      select: SELECCION,
      orderBy: { nombre: 'asc' },
    })

    return respuestaCacheable(productos)
  } catch (error) {
    console.error('Error fetching catálogo:', error)
    return NextResponse.json(
      { error: 'Error al obtener catálogo' },
      { status: 500 }
    )
  }
}
