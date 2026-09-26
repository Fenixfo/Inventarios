/**
 * Totales de una factura o cotización a partir de sus líneas.
 *
 * Estaba dentro del formulario; aparte se puede probar sin pantalla.
 */

export interface Totales {
  subtotal: number
  descuento: number
  impuesto: number
  total: number
}

/**
 * El descuento en pesos manda si está puesto; si no, se calcula del
 * porcentaje. El impuesto se aplica sobre lo que queda tras el descuento.
 */
export function calcularTotales(
  lineas: { subtotal: number }[],
  { descuentoPorcentaje, descuentoMonto, impuestoPorcentaje }: {
    descuentoPorcentaje: number
    descuentoMonto: number
    impuestoPorcentaje: number
  }
): Totales {
  const subtotal = lineas.reduce((suma, l) => suma + l.subtotal, 0)
  const descuento = descuentoMonto > 0 ? descuentoMonto : (subtotal * descuentoPorcentaje) / 100
  const base = subtotal - descuento
  const impuesto = (base * impuestoPorcentaje) / 100

  return { subtotal, descuento, impuesto, total: base + impuesto }
}

const dosDecimales = (valor: number) => Math.round(valor * 100) / 100

/** El descuento en pesos que corresponde a un porcentaje. */
export function montoDePorcentaje(subtotal: number, porcentaje: number): number {
  return dosDecimales((subtotal * porcentaje) / 100)
}

/** El porcentaje que corresponde a un descuento en pesos. */
export function porcentajeDeMonto(subtotal: number, monto: number): number {
  return subtotal > 0 ? dosDecimales((monto / subtotal) * 100) : 0
}
