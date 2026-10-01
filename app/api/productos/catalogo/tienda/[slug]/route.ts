import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { claveImagenCategoria } from '@/lib/categoria-imagen'

/**
 * Portada de categorías de una sola tienda: `/catalogo/<slug>`.
 *
 * Todavía no hay una columna "slug" en las tiendas, así que se resuelve como
 * lo hace el catálogo principal: la tienda cuyo nombre contiene el texto
 * ("beraca" encuentra "Laminados y Cerámicas Beraca"). Entre varias, la más
 * antigua.
 *
 * Solo salen las categorías con productos que de verdad se muestran (activos,
 * con existencias y con foto), con la imagen que el dueño eligió para cada
 * una en Configuración.
 */
function respuestaCacheable(datos: unknown) {
  return NextResponse.json(datos, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const texto = decodeURIComponent(slug).trim().slice(0, 60)

    if (!texto) return respuestaCacheable({ tienda: null, categorias: [], whatsappPedidos: null })

    const tienda = await prisma.tienda.findFirst({
      where: { activo: true, publica: true, nombre: { contains: texto, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nombre: true },
    })

    if (!tienda) return respuestaCacheable({ tienda: null, categorias: [], whatsappPedidos: null })

    const [grupos, registros] = await Promise.all([
      prisma.producto.groupBy({
        by: ['categoria'],
        where: {
          tiendaId: tienda.id,
          activo: true,
          stockActual: { gt: 0 },
          imagenUrl: { not: null },
          NOT: { imagenUrl: '' },
        },
        _count: { _all: true },
        orderBy: { categoria: 'asc' },
      }),
      prisma.configuracion.findMany({
        where: {
          tiendaId: tienda.id,
          OR: [{ clave: 'whatsapp_pedidos' }, { clave: { startsWith: 'cat_img_' } }],
        },
        select: { clave: true, valor: true },
      }),
    ])

    const config = Object.fromEntries(registros.map((r) => [r.clave, r.valor]))

    return respuestaCacheable({
      tienda,
      whatsappPedidos: config.whatsapp_pedidos || null,
      categorias: grupos.map((g) => ({
        nombre: g.categoria,
        imagenUrl: config[claveImagenCategoria(g.categoria)] || null,
        total: g._count._all,
      })),
    })
  } catch (error) {
    console.error('Error fetching catálogo de tienda:', error)
    return NextResponse.json({ error: 'Error al obtener el catálogo' }, { status: 500 })
  }
}
