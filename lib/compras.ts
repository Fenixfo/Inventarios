/**
 * Lógica de las compras a proveedores.
 *
 * Una compra reparte los costos adicionales (flete, descargue) entre sus
 * líneas, calcula el costo final de cada una y decide qué datos de un
 * producto existente se pueden completar.
 *
 * Aquí no hay base de datos, para poder probarlo aparte. Las rutas y las
 * pantallas usan estas mismas funciones, así lo que se ve al escribir la
 * compra es exactamente lo que calcula el servidor.
 */

import { normalizarBusqueda } from '@/lib/paginacion'

const redondear = (valor: number) => Math.round(valor * 100) / 100

export type MetodoReparto = 'valor' | 'cantidad'

// ---------------------------------------------------------------------------
// Costos adicionales
// ---------------------------------------------------------------------------

export interface LineaParaReparto {
  cantidad: number
  precioFactura: number
}

/**
 * Reparte `totalExtras` entre las líneas, por el valor de cada línea
 * (cantidad × precio) o por su cantidad.
 *
 * Se reparte en centavos enteros para que la suma sea EXACTAMENTE el total:
 * lo que sobra del redondeo va a la línea de mayor peso. Si todas las líneas
 * valen cero, el reparto por valor cae al de cantidad.
 *
 * Ej.: 100 de flete, líneas de valor 300 y 700 → [30, 70].
 */
export function repartirCostosExtra(
  lineas: LineaParaReparto[],
  totalExtras: number,
  metodo: MetodoReparto
): number[] {
  if (lineas.length === 0) return []

  const centavos = Math.max(0, Math.round((Number.isFinite(totalExtras) ? totalExtras : 0) * 100))
  if (centavos === 0) return lineas.map(() => 0)

  const pesoPorValor = (l: LineaParaReparto) => Math.max(0, l.cantidad) * Math.max(0, l.precioFactura)
  const pesoPorCantidad = (l: LineaParaReparto) => Math.max(0, l.cantidad)

  let pesos = lineas.map(metodo === 'valor' ? pesoPorValor : pesoPorCantidad)
  if (pesos.reduce((s, p) => s + p, 0) <= 0) pesos = lineas.map(pesoPorCantidad)
  if (pesos.reduce((s, p) => s + p, 0) <= 0) pesos = lineas.map(() => 1)

  const suma = pesos.reduce((s, p) => s + p, 0)
  const partes = pesos.map((p) => Math.floor((centavos * p) / suma))

  // Lo que sobra del redondeo hacia abajo va a la línea de mayor peso (la primera si empatan).
  const sobrante = centavos - partes.reduce((s, p) => s + p, 0)
  if (sobrante > 0) {
    const mayor = pesos.reduce((mejor, p, i) => (p > pesos[mejor] ? i : mejor), 0)
    partes[mayor] += sobrante
  }

  return partes.map((c) => c / 100)
}

/**
 * Costo final por unidad de una línea: el precio de factura más su parte de
 * los costos adicionales repartida entre la cantidad. Si la persona lo
 * escribió a mano (`manual`), ese valor manda y no se recalcula.
 *
 * Se redondea a dos decimales, que es la precisión con que se guarda el costo
 * del producto.
 */
export function costoFinalUnitario(
  precioFactura: number,
  cantidad: number,
  extraRepartido: number,
  manual?: number | null
): number {
  if (manual !== null && manual !== undefined && Number.isFinite(manual) && manual >= 0) {
    return redondear(manual)
  }
  if (!(cantidad > 0)) return redondear(precioFactura)
  return redondear(precioFactura + extraRepartido / cantidad)
}

// ---------------------------------------------------------------------------
// Completar un producto existente
// ---------------------------------------------------------------------------

type Valor = string | number | null | undefined

/**
 * Los campos que una compra puede completar en un producto existente, y solo
 * si están vacíos. Nombre, categoría, precio de venta y stock mínimo NO están
 * aquí: no pueden ser nulos, así que nunca están "vacíos" y la compra no los
 * toca.
 */
export const CAMPOS_COMPLETABLES = [
  'dimensiones',
  'color',
  'acabado',
  'espesorMm',
  'm2PorCaja',
  'precioBodega',
  'descripcion',
  'imagenUrl',
  'proveedor',
] as const

export type CampoCompletable = (typeof CAMPOS_COMPLETABLES)[number]

/** Los numéricos solo valen si son mayores que cero: un 0 no es un dato. */
const CAMPOS_NUMERICOS: CampoCompletable[] = ['espesorMm', 'm2PorCaja', 'precioBodega']

export type DatosProducto = Partial<Record<CampoCompletable, Valor>>

export interface Diferencia {
  campo: CampoCompletable
  actual: string | number
  escrito: string | number
}

/** Un valor "con contenido": ni nulo, ni vacío, ni un número no válido o cero. */
function tieneValor(campo: CampoCompletable, valor: Valor): valor is string | number {
  if (valor === null || valor === undefined) return false
  if (CAMPOS_NUMERICOS.includes(campo)) {
    const n = Number(valor)
    return valor !== '' && Number.isFinite(n) && n > 0
  }
  return String(valor).trim() !== ''
}

function iguales(campo: CampoCompletable, a: string | number, b: string | number): boolean {
  if (CAMPOS_NUMERICOS.includes(campo)) return Number(a) === Number(b)
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
}

/**
 * Qué se completa y qué difiere al meter una línea de compra en un producto
 * que ya existe.
 *
 * - `completar`: los campos que el producto tiene vacíos y la línea trae.
 * - `diferencias`: los campos que el producto ya tiene y la línea escribió
 *   distinto. No se aplican: el producto conserva su valor.
 */
export function camposACompletar(
  producto: DatosProducto,
  linea: DatosProducto
): { completar: DatosProducto; diferencias: Diferencia[] } {
  const completar: DatosProducto = {}
  const diferencias: Diferencia[] = []

  for (const campo of CAMPOS_COMPLETABLES) {
    const actual = producto[campo]
    const escrito = linea[campo]
    if (!tieneValor(campo, escrito)) continue

    if (!tieneValor(campo, actual)) {
      completar[campo] = CAMPOS_NUMERICOS.includes(campo) ? Number(escrito) : String(escrito).trim()
    } else if (!iguales(campo, actual, escrito)) {
      diferencias.push({ campo, actual, escrito })
    }
  }

  return { completar, diferencias }
}

// ---------------------------------------------------------------------------
// Nombres parecidos
// ---------------------------------------------------------------------------

/** Nombre sin tildes, en minúsculas y con los espacios normalizados. */
export function normalizarNombre(texto: string): string {
  return normalizarBusqueda(texto).replace(/\s+/g, ' ')
}

function palabras(texto: string): Set<string> {
  return new Set(
    normalizarNombre(texto)
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  )
}

/** Cuánto se parecen dos nombres, de 0 a 1. */
function similitud(a: string, b: string): number {
  const na = normalizarNombre(a)
  const nb = normalizarNombre(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  // Uno contenido en el otro ("Baldosa gris" y "Baldosa gris 60x60").
  if (Math.min(na.length, nb.length) >= 4 && (na.includes(nb) || nb.includes(na))) return 0.9

  const pa = palabras(a)
  const pb = palabras(b)
  let comunes = 0
  for (const p of pa) if (pb.has(p)) comunes++
  const union = pa.size + pb.size - comunes
  return union === 0 ? 0 : comunes / union
}

/** Desde qué parecido se avisa: "Baldosa 1" y "Baldosa 2" no deben avisarse entre sí. */
export const UMBRAL_PARECIDO = 0.6

/**
 * Los productos de la lista cuyo nombre se parece al escrito, del más al menos
 * parecido y como máximo `limite`. Sirve para avisar de un posible duplicado
 * cuando el SKU es nuevo pero el nombre ya existe con otro SKU.
 */
export function nombresParecidos<T extends { nombre: string }>(
  nombre: string,
  productos: T[],
  limite = 3
): T[] {
  return productos
    .map((producto) => ({ producto, puntaje: similitud(nombre, producto.nombre) }))
    .filter((r) => r.puntaje >= UMBRAL_PARECIDO)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, Math.max(0, limite))
    .map((r) => r.producto)
}
