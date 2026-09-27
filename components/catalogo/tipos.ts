/**
 * Tipos del catálogo público (app/page.tsx y components/catalogo/*).
 */

/** Lo que devuelve /api/productos/catalogo por cada producto. */
export interface Producto {
  id: string
  imagenUrl?: string | null
  nombre: string
  sku: string
  categoria: string
  dimensiones?: string | null
  color?: string | null
  acabado?: string | null
  m2PorCaja?: number | null
  precioUnitario: number
  tienda?: { id: string; nombre: string; ciudad?: string | null } | null
}

/** Lo que devuelve /api/productos/catalogo/filtros por cada tienda. */
export interface TiendaCatalogo {
  id: string
  nombre: string
  ciudad?: string | null
}
