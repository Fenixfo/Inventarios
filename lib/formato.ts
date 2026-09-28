/**
 * Formato de dinero de toda la aplicación.
 *
 * Estaba definido en 13 archivos, con 0 decimales en unos y 2 en otros, y
 * otras 5 pantallas mostraban `$55000.00` con toFixed: la misma factura se
 * veía con centavos en pantalla y sin ellos en su PDF. Ahora hay uno solo,
 * sin decimales, como se manejan los pesos y como ya salían el PDF y
 * WhatsApp: `$ 55.000`.
 */
const FORMATO_PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** `pesos(55000)` → `$ 55.000`. Acepta texto, como llegan los Decimal de la API. */
export function pesos(valor: number | string | null | undefined): string {
  const numero = Number(valor ?? 0)
  return FORMATO_PESOS.format(Number.isFinite(numero) ? numero : 0)
}

/** Identificador uuid, como los de la base. Uno inventado en la URL hacía fallar la consulta. */
export function esUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
}
