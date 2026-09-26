/**
 * Cálculos de la liquidación de vendedores.
 *
 * Liquidar cierra facturas ya cobradas: ganancia = venta sin impuesto −
 * costo, y al vendedor se le paga un porcentaje de esa ganancia.
 *
 * Aquí no hay base de datos, para poder probarlo aparte. Las rutas cargan
 * los datos y usan estas funciones.
 */

/** El que se propone al liquidar; se puede cambiar en cada liquidación. */
export const PORCENTAJE_POR_DEFECTO = 30

/** Solo lo cobrado se liquida: sobre una venta sin pagar no hay comisión. */
export const ESTADOS_LIQUIDABLES = ['pagado', 'entregado']

const redondear = (valor: number) => Math.round(valor * 100) / 100

/**
 * Los reportes cuentan como vendidas las facturas pagadas y entregadas. Una
 * liquidada ya estaba cobrada, así que entra con ellas: si no, liquidar
 * haría bajar las ventas de los reportes.
 */
export function estadosDeVenta(estados: string[]): string[] {
  const conLiquidadas = estados.includes('pagado') || estados.includes('entregado')
  return conLiquidadas && !estados.includes('liquidado') ? [...estados, 'liquidado'] : estados
}

// ---------------------------------------------------------------------------
// Al facturar: cuánto de cada línea tiene costo conocido
// ---------------------------------------------------------------------------

export interface LineaAFacturar {
  productoId?: string | null
  cantidadM2: number
}

export interface ProductoConCosto {
  stockActual: number
  costo: number | null
}

/**
 * El costo de cada línea al facturar.
 *
 * Lo que había en inventario se vende al costo del producto en ese momento.
 * Lo que se vendió sin stock no tiene costo conocido: se pondrá al liquidar.
 * Si dos líneas son del mismo producto, la primera gasta el stock primero.
 *
 * Ej.: costo 5, stock 10, se venden 25 → 10 con costo 5 y 15 pendientes.
 *
 * Un producto sin costo cargado, o personalizado (sin productoId), deja toda
 * la línea pendiente.
 */
export function costoAlFacturar(
  lineas: LineaAFacturar[],
  productos: Map<string, ProductoConCosto>
): { costoUnitario: number | null; cantidadConCosto: number }[] {
  const stockRestante = new Map<string, number>()

  return lineas.map((linea) => {
    const producto = linea.productoId ? productos.get(linea.productoId) : undefined
    if (!producto || producto.costo === null || producto.costo === undefined) {
      return { costoUnitario: producto?.costo ?? null, cantidadConCosto: 0 }
    }

    const disponible = stockRestante.has(linea.productoId!)
      ? stockRestante.get(linea.productoId!)!
      : Math.max(0, producto.stockActual)

    const conCosto = Math.min(Math.max(0, linea.cantidadM2), disponible)
    stockRestante.set(linea.productoId!, disponible - conCosto)

    return { costoUnitario: producto.costo, cantidadConCosto: redondear(conCosto) }
  })
}

// ---------------------------------------------------------------------------
// Al liquidar: costo, ganancia y pago
// ---------------------------------------------------------------------------

export interface ItemALiquidar {
  cantidadM2: number
  cantidadConCosto: number
  costoUnitario: number | null
}

/** Lo que se vendió sin stock y todavía no tiene costo. */
export function cantidadPendiente(item: ItemALiquidar): number {
  return redondear(Math.max(0, item.cantidadM2 - item.cantidadConCosto))
}

/**
 * Costo total de una línea. `costoPendiente` es el que se pone al liquidar
 * para lo vendido sin stock. Devuelve null si falta ese costo: no se puede
 * liquidar una línea con costo desconocido.
 */
export function costoDeItem(item: ItemALiquidar, costoPendiente: number | null | undefined): number | null {
  const conocido = item.cantidadConCosto * (item.costoUnitario ?? 0)
  const pendiente = cantidadPendiente(item)

  if (pendiente > 0 && (costoPendiente === null || costoPendiente === undefined || !(costoPendiente >= 0))) {
    return null
  }

  return redondear(conocido + pendiente * (pendiente > 0 ? Number(costoPendiente) : 0))
}

export interface FacturaALiquidar {
  subtotal: number
  descuentoMonto: number
}

/** Venta sin impuesto: el impuesto no es de la tienda, no es ganancia. */
export function ventaSinImpuesto(factura: FacturaALiquidar): number {
  return redondear(factura.subtotal - factura.descuentoMonto)
}

export interface Totales {
  totalVenta: number
  totalCosto: number
  totalGanancia: number
  pagoVendedor: number
}

/**
 * Totales de una liquidación a partir de la venta y el costo de cada factura.
 *
 * El pago al vendedor es el porcentaje de la ganancia total, nunca negativo:
 * si en conjunto se vendió a pérdida, no hay comisión, pero tampoco se le
 * descuenta nada. Una factura con pérdida sí resta de las demás.
 */
export function totalesDeLiquidacion(
  facturas: { venta: number; costo: number }[],
  porcentaje: number
): Totales {
  const totalVenta = redondear(facturas.reduce((s, f) => s + f.venta, 0))
  const totalCosto = redondear(facturas.reduce((s, f) => s + f.costo, 0))
  const totalGanancia = redondear(totalVenta - totalCosto)

  return {
    totalVenta,
    totalCosto,
    totalGanancia,
    pagoVendedor: redondear(Math.max(0, totalGanancia) * (porcentaje / 100)),
  }
}

/** El porcentaje es válido si va de 0 a 100. */
export function porcentajeValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 100
}
