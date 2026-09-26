/**
 * Listados por páginas en el panel.
 *
 * Los listados traían la tabla entera de una vez. Con el catálogo real eso
 * crece con cada producto, factura o cliente, y la pantalla tarda más cada
 * semana. Ahora se traen los 10 más recientes y el resto con "Ver más", o se
 * busca por nombre en el servidor.
 */

/** Cuántos se traen de primera y en cada "Ver más". */
export const POR_PAGINA = 10

/** Tope de lo que se puede pedir de una vez, para que nadie pida la tabla entera. */
export const MAXIMO_POR_PAGINA = 50

/** Menos letras que esto no se busca: casi cualquier nombre las contiene. */
export const MINIMO_BUSQUEDA = 3

/** Minúsculas y sin tildes, igual que la columna `nombre_busqueda`. */
export function normalizarBusqueda(texto: string): string {
  return texto
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Lee un número de la URL, con tope. */
export function entero(valor: string | null, porDefecto: number, maximo: number): number {
  const n = parseInt(valor || '', 10)
  if (!Number.isFinite(n) || n < 0) return porDefecto
  return Math.min(n, maximo)
}

/** `limite` y `desde` de la URL, listos para `take` y `skip`. */
export function leerPagina(searchParams: URLSearchParams) {
  return {
    limite: entero(searchParams.get('limite'), POR_PAGINA, MAXIMO_POR_PAGINA),
    desde: entero(searchParams.get('desde'), 0, 100_000),
  }
}

/**
 * El texto a buscar ya normalizado, o null si no hay búsqueda o es tan corta
 * que no filtraría nada.
 */
export function leerBusqueda(searchParams: URLSearchParams): string | null {
  const texto = normalizarBusqueda(searchParams.get('busqueda') || '')
  return texto.length >= MINIMO_BUSQUEDA ? texto : null
}
