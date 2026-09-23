/**
 * Qué precio se cobra según la lista activa.
 *
 * Hay tres precios por producto: el costo (lo que se paga al proveedor, no
 * se factura nunca), el de bodega o mayorista, y el del público, que es el
 * del catálogo.
 */

export interface ProductoConPrecios {
  precioUnitario: number | string
  precioBodega?: number | string | null
}

/**
 * Devuelve el precio aplicable.
 *
 * Un producto sin precio de bodega se cobra al del público: facturarlo en
 * cero por un dato que falta sería mucho peor que cobrar de más.
 */
export function precioAplicable(producto: ProductoConPrecios, esBodega: boolean): number {
  if (esBodega && producto.precioBodega !== null && producto.precioBodega !== undefined) {
    const bodega = Number(producto.precioBodega)
    // Un cero en la base tampoco es un precio válido de venta.
    if (bodega > 0) return bodega
  }

  return Number(producto.precioUnitario)
}

/** ¿Este producto tiene precio de bodega propio? */
export function tienePrecioBodega(producto: ProductoConPrecios): boolean {
  return (
    producto.precioBodega !== null &&
    producto.precioBodega !== undefined &&
    Number(producto.precioBodega) > 0
  )
}
