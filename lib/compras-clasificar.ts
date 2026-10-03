import { prisma } from '@/lib/prisma'
import { nombresParecidos, normalizarNombre } from '@/lib/compras'

/**
 * Clasifica las líneas de una compra contra los productos de la tienda.
 *
 * Lo comparten la ruta que avisa mientras se escribe la compra y la que la
 * guarda, para que el aviso y la comprobación final decidan igual.
 *
 * Un producto inactivo no cuenta como existente, igual que el índice único del
 * SKU, que solo mira los activos: su SKU está libre.
 */

export interface ProductoParaCompra {
  id: string
  sku: string
  nombre: string
  categoria: string
  dimensiones: string | null
  color: string | null
  acabado: string | null
  espesorMm: number | null
  m2PorCaja: number | null
  precioUnitario: number
  precioBodega: number | null
  costo: number | null
  stockActual: number
  stockMinimo: number
  proveedor: string | null
  descripcion: string | null
  imagenUrl: string | null
}

export interface Parecido {
  id: string
  sku: string
  nombre: string
}

export type EstadoLinea =
  | { estado: 'existente'; producto: ProductoParaCompra }
  | { estado: 'nuevo' }
  | { estado: 'nuevo_con_parecidos'; parecidos: Parecido[] }

const numero = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))

/** Un producto de la base, con los Decimal ya convertidos a número para el JSON. */
export function productoParaCompra(p: {
  id: string
  sku: string
  nombre: string
  categoria: string
  dimensiones: string | null
  color: string | null
  acabado: string | null
  espesorMm: unknown
  m2PorCaja: unknown
  precioUnitario: unknown
  precioBodega: unknown
  costo: unknown
  stockActual: unknown
  stockMinimo: unknown
  proveedor: string | null
  descripcion: string | null
  imagenUrl: string | null
}): ProductoParaCompra {
  return {
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    categoria: p.categoria,
    dimensiones: p.dimensiones,
    color: p.color,
    acabado: p.acabado,
    espesorMm: numero(p.espesorMm),
    m2PorCaja: numero(p.m2PorCaja),
    precioUnitario: Number(p.precioUnitario),
    precioBodega: numero(p.precioBodega),
    costo: numero(p.costo),
    stockActual: Number(p.stockActual),
    stockMinimo: Number(p.stockMinimo),
    proveedor: p.proveedor,
    descripcion: p.descripcion,
    imagenUrl: p.imagenUrl,
  }
}

/** Las palabras de un nombre por las que se preseleccionan candidatos en la base. */
function palabrasClave(nombre: string | null | undefined): string[] {
  if (!nombre) return []
  const palabras = normalizarNombre(nombre)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3)
  return [...new Set(palabras)].slice(0, 6)
}

// Tope de candidatos que se traen para comparar nombres: con un catálogo grande
// no se baja la tienda entera, solo lo que comparte alguna palabra.
const MAXIMO_CANDIDATOS = 1000

/**
 * Una consulta para los SKU y otra para los candidatos de nombres parecidos,
 * sin importar cuántas líneas haya (nada de una consulta por línea).
 */
export async function clasificarLineas(
  tiendaId: string,
  lineas: { sku: string; nombre?: string | null }[]
): Promise<EstadoLinea[]> {
  const skus = [...new Set(lineas.map((l) => l.sku.trim()).filter(Boolean))]

  const existentes = skus.length
    ? await prisma.producto.findMany({ where: { tiendaId, activo: true, sku: { in: skus } } })
    : []
  const porSku = new Map(existentes.map((p) => [p.sku, p]))

  const sinProducto = lineas.filter((l) => !porSku.has(l.sku.trim()))
  const claves = new Set(sinProducto.flatMap((l) => palabrasClave(l.nombre)))

  const candidatos: Parecido[] = claves.size
    ? await prisma.producto.findMany({
        where: {
          tiendaId,
          activo: true,
          OR: [...claves].map((c) => ({ nombreBusqueda: { contains: c } })),
        },
        select: { id: true, sku: true, nombre: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAXIMO_CANDIDATOS,
      })
    : []

  return lineas.map((linea): EstadoLinea => {
    const producto = porSku.get(linea.sku.trim())
    if (producto) return { estado: 'existente', producto: productoParaCompra(producto) }

    const parecidos = linea.nombre ? nombresParecidos(linea.nombre, candidatos, 3) : []
    return parecidos.length > 0 ? { estado: 'nuevo_con_parecidos', parecidos } : { estado: 'nuevo' }
  })
}
