import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { normalizarBusqueda } from '@/lib/paginacion'

/**
 * Búsqueda de productos mientras se escribe: la usan el formulario de
 * factura y cotización, el selector de inventario y "nuevo producto".
 *
 * Antes cada una de esas pantallas bajaba el catálogo entero al abrirse para
 * buscar en el navegador. Ahora se piden solo los que coinciden, como mucho
 * 10, con las columnas que esas pantallas usan.
 *
 * Busca cada palabra por separado, en el nombre (sin tildes) o en el SKU:
 * "gris 30" encuentra "Pared Mancha Gris 30*60" igual que antes en pantalla.
 */

const MAXIMO = 10

export async function GET(request: NextRequest) {
  try {
    // Los mismos permisos que la lista de productos: facturar y cotizar
    // necesitan el catálogo aunque no se administren productos.
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, [
      'productos.ver',
      'facturas.crear',
      'cotizaciones.crear',
    ])
    if (sinPermiso) return sinPermiso

    const texto = normalizarBusqueda(new URL(request.url).searchParams.get('q') || '')
    const palabras = texto.split(/\s+/).filter(Boolean).slice(0, 5)

    // Sin texto se devuelven los primeros 10 por nombre: el selector los
    // muestra al abrirse, para poder elegir sin escribir.
    const productos = await prisma.producto.findMany({
      where: {
        activo: true,
        tiendaId,
        AND: palabras.map((palabra) => ({
          OR: [
            { nombreBusqueda: { contains: palabra } },
            { sku: { contains: palabra, mode: 'insensitive' as const } },
          ],
        })),
      },
      select: {
        id: true,
        sku: true,
        nombre: true,
        precioUnitario: true,
        precioBodega: true,
        stockActual: true,
        m2PorCaja: true,
      },
      orderBy: { nombre: 'asc' },
      take: MAXIMO,
    })

    return NextResponse.json({
      productos: productos.map((p) => ({
        ...p,
        precioUnitario: Number(p.precioUnitario),
        precioBodega: p.precioBodega === null ? null : Number(p.precioBodega),
        stockActual: Number(p.stockActual),
        m2PorCaja: p.m2PorCaja === null ? null : Number(p.m2PorCaja),
      })),
    })
  } catch (error) {
    console.error('Error buscando productos:', error)
    return NextResponse.json({ error: 'No se pudieron buscar los productos' }, { status: 500 })
  }
}
