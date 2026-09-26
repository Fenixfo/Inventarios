import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { entero, normalizarBusqueda } from '@/lib/paginacion'

/** La portada enseña como mucho esto de cada tienda, lo pida quien lo pida. */
const MAXIMO_POR_TIENDA = 5

/** Lo más que devuelve una tanda al filtrar: la primera de la portada (9). */
const MAXIMO_POR_TANDA = 9

/** Y en total, por si algún día hay cientos de tiendas públicas. */
const MAXIMO_EN_PORTADA = 300

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

    // La tienda llega en la URL y la columna es uuid: un valor inventado
    // hacía fallar la consulta con un 500. Una tienda que no existe no tiene
    // productos, así que se responde vacío.
    if (tienda && !UUID.test(tienda)) {
      return respuestaCacheable({ productos: [], total: 0 })
    }

    // Se busca contra la columna que la base mantiene ya normalizada, así
    // que el término se normaliza igual: "Café" y "cafe" acaban siendo lo
    // mismo. Menos de tres letras no se busca, para no pasear el catálogo
    // entero por una tecla suelta.
    const busqueda = normalizarBusqueda(searchParams.get('busqueda') || '')
    const buscando = busqueda.length >= 3

    // Cuántos traer y desde dónde. La portada pide 9 al filtrar y 3 por
    // cada "Ver más", así que el tope es 9: con el de 60 que había, un
    // ?limite=9999 escrito a mano traía casi una tienda entera de una vez.
    const limite = entero(searchParams.get('limite'), MAXIMO_POR_TANDA, MAXIMO_POR_TANDA)
    const desde = entero(searchParams.get('desde'), 0, 100_000)

    const where: any = {
      activo: true,
      stockActual: { gt: 0 },
      // Una tienda privada no aparece aquí aunque tenga productos activos.
      tienda: { activo: true, publica: true },

    }

    // Solo con foto: una vitrina de cuadros grises no vende nada. El
    // producto sigue existiendo para facturar, simplemente no se expone
    // hasta que tenga imagen. La cadena vacía se descarta aparte porque
    // en SQL no es lo mismo que NULL.
    //
    // Al buscar por nombre sí salen todos: quien escribe el nombre ya sabe
    // lo que quiere, y ocultárselo porque le falta la foto no ayuda a nadie.
    if (!buscando) {
      where.imagenUrl = { not: null }
      where.NOT = { imagenUrl: '' }
    } else {
      where.nombreBusqueda = { contains: busqueda }
    }

    // La búsqueda no sustituye a los filtros, se suma a ellos: buscar "gris"
    // con la categoría Porcelanato puesta busca entre los porcelanatos.
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
    // Buscando no hay muestra por tienda: se busca en todo lo que cumpla,
    // por tandas como cualquier filtro.
    //
    // El corte por tienda se hace en la base con ROW_NUMBER(): antes se leían
    // todos los productos con foto de todas las tiendas públicas y se
    // recortaba aquí, así que cada visita a la portada pagaba el catálogo
    // entero. Y el número por tienda tiene tope: sin él, un
    // ?limitePorTienda=9999 escrito a mano devolvía todo de una vez.
    if (!buscando && Number.isFinite(limitePorTienda) && limitePorTienda > 0) {
      const porTienda = Math.min(limitePorTienda, MAXIMO_POR_TIENDA)

      const filas = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM (
          SELECT p.id, p.tienda_id,
                 ROW_NUMBER() OVER (
                   PARTITION BY p.tienda_id ORDER BY p.created_at DESC, p.id DESC
                 ) AS n
            FROM public.productos p
            JOIN public.tiendas t ON t.id = p.tienda_id
           WHERE p.activo
             AND p.stock_actual > 0
             AND t.activo
             AND t.publica
             AND p.imagen_url IS NOT NULL
             AND p.imagen_url <> ''
             ${categoria ? Prisma.sql`AND p.categoria = ${categoria}` : Prisma.empty}
             ${tienda ? Prisma.sql`AND p.tienda_id = ${tienda}::uuid` : Prisma.empty}
        ) muestra
        WHERE n <= ${porTienda}
        ORDER BY tienda_id, n
        LIMIT ${MAXIMO_EN_PORTADA}`

      const productos = await prisma.producto.findMany({
        where: { id: { in: filas.map((f) => f.id) } },
        select: SELECCION,
        orderBy: [{ tiendaId: 'asc' }, { createdAt: 'desc' }],
      })

      // En la portada no hay "ver más": el aviso invita a filtrar.
      return respuestaCacheable({ productos, total: productos.length })
    }

    // Por páginas: se traen `limite` productos y se informa del total, que es
    // lo que le dice a la pantalla si queda algo por mostrar. Antes se
    // devolvía todo lo que cumpliera el filtro: en una tienda con diez mil
    // productos, eso son diez mil por el cable y en memoria del navegador.
    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where,
        select: SELECCION,
        orderBy: { nombre: 'asc' },
        take: limite,
        skip: desde,
      }),
      prisma.producto.count({ where }),
    ])

    return respuestaCacheable({ productos, total })
  } catch (error) {
    console.error('Error fetching catálogo:', error)
    return NextResponse.json(
      { error: 'Error al obtener catálogo' },
      { status: 500 }
    )
  }
}
