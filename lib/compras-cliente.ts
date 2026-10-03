/**
 * Lógica de la pantalla de nueva compra, sin React ni red, para probarla aparte.
 *
 * Lo que se escribe en los campos es texto (así lo entrega un <input>); aquí se
 * convierte a número, se calculan los costos con las mismas funciones que usa
 * el servidor (lib/compras.ts) y se arma el cuerpo que recibe POST /api/compras.
 * Así lo que ve quien escribe la compra es lo que el servidor va a calcular.
 */

import {
  camposACompletar,
  costoFinalUnitario,
  repartirCostosExtra,
  type DatosProducto,
  type Diferencia,
  type MetodoReparto,
} from '@/lib/compras'
import type { Parecido, ProductoParaCompra } from '@/lib/compras-clasificar'

const redondear = (valor: number) => Math.round(valor * 100) / 100

/** Cómo va la clasificación de una línea (qué dijo /api/compras/verificar). */
export type EstadoLineaUI = 'sin_verificar' | 'verificando' | 'existente' | 'nuevo' | 'parecidos'

export interface LineaEditable {
  /** Identificador local, solo para React. */
  clave: string

  sku: string
  nombre: string
  categoria: string
  /** Precio de venta al público. */
  precioUnitario: string
  precioBodega: string
  dimensiones: string
  color: string
  acabado: string
  espesorMm: string
  m2PorCaja: string
  stockMinimo: string
  descripcion: string
  imagenUrl: string

  cantidad: string
  /** Lo que dice el papel, por unidad. */
  precioFactura: string
  /** Vacío mientras el costo final se calcula solo; con valor, lo escribió la persona. */
  costoManual: string

  estado: EstadoLineaUI
  /** El producto, si la línea es de uno que ya existe. */
  producto: ProductoParaCompra | null
  parecidos: Parecido[]
  /** true si se descartó el aviso de nombres parecidos y se quiere crear uno nuevo. */
  confirmadoNuevo: boolean
  /** El SKU al que corresponde la clasificación actual, para saber si se editó después. */
  skuVerificado: string
}

export interface ExtraEditable {
  clave: string
  concepto: string
  valor: string
}

let contador = 0
/** Un identificador local único, sin depender de crypto en el navegador. */
export function nuevaClave(): string {
  contador += 1
  return `l${Date.now().toString(36)}${contador}`
}

export function lineaVacia(): LineaEditable {
  return {
    clave: nuevaClave(),
    sku: '',
    nombre: '',
    categoria: '',
    precioUnitario: '',
    precioBodega: '',
    dimensiones: '',
    color: '',
    acabado: '',
    espesorMm: '',
    m2PorCaja: '',
    stockMinimo: '',
    descripcion: '',
    imagenUrl: '',
    cantidad: '',
    precioFactura: '',
    costoManual: '',
    estado: 'sin_verificar',
    producto: null,
    parecidos: [],
    confirmadoNuevo: false,
    skuVerificado: '',
  }
}

export function extraVacio(): ExtraEditable {
  return { clave: nuevaClave(), concepto: '', valor: '' }
}

/** El número de un campo de texto, o null si está vacío o no es un número. */
export function numero(texto: string): number | null {
  const limpio = texto.trim()
  if (limpio === '') return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

/** ¿La línea creará un producto nuevo? */
export function esNueva(l: LineaEditable): boolean {
  return l.estado === 'nuevo'
}

export function esExistente(l: LineaEditable): boolean {
  return l.estado === 'existente' && l.producto !== null
}

/** Las claves (SKU sin mayúsculas ni espacios) que aparecen en más de una línea. */
export function skusRepetidos(lineas: LineaEditable[]): Set<string> {
  const vistos = new Set<string>()
  const repetidos = new Set<string>()
  for (const l of lineas) {
    const clave = l.sku.trim().toUpperCase()
    if (!clave) continue
    if (vistos.has(clave)) repetidos.add(clave)
    vistos.add(clave)
  }
  return repetidos
}

// ---------------------------------------------------------------------------
// Costos y resumen
// ---------------------------------------------------------------------------

export interface CalculoLinea {
  /** cantidad × precio de factura */
  valorLinea: number
  /** La parte repartida de los costos adicionales (total de la línea). */
  costoExtra: number
  /** El costo por unidad que quedará en el producto. */
  costoFinal: number
  costoEditado: boolean
}

/** Los costos adicionales con valor válido (mayor que cero). */
function extrasValidos(extras: ExtraEditable[]): number[] {
  return extras.map((e) => numero(e.valor) ?? 0).filter((v) => v > 0)
}

export function totalExtras(extras: ExtraEditable[]): number {
  return redondear(extrasValidos(extras).reduce((s, v) => s + v, 0))
}

export function calcularLineas(
  lineas: LineaEditable[],
  extras: ExtraEditable[],
  metodo: MetodoReparto
): CalculoLinea[] {
  const base = lineas.map((l) => ({
    cantidad: Math.max(0, numero(l.cantidad) ?? 0),
    precioFactura: Math.max(0, numero(l.precioFactura) ?? 0),
  }))
  const repartos = repartirCostosExtra(base, totalExtras(extras), metodo)

  return lineas.map((l, i) => {
    const manual = numero(l.costoManual)
    return {
      valorLinea: redondear(base[i].cantidad * base[i].precioFactura),
      costoExtra: repartos[i],
      costoFinal: costoFinalUnitario(base[i].precioFactura, base[i].cantidad, repartos[i], manual),
      costoEditado: manual !== null,
    }
  })
}

export interface ResumenCompra {
  subtotal: number
  totalExtras: number
  total: number
  /** Suma de las cantidades: lo que entrará al inventario. */
  unidades: number
  productosNuevos: number
  productosExistentes: number
}

export function resumenDeCompra(
  lineas: LineaEditable[],
  extras: ExtraEditable[],
  metodo: MetodoReparto
): ResumenCompra {
  const calculos = calcularLineas(lineas, extras, metodo)
  const subtotal = redondear(calculos.reduce((s, c) => s + c.valorLinea, 0))
  const extra = totalExtras(extras)

  return {
    subtotal,
    totalExtras: extra,
    total: redondear(subtotal + extra),
    unidades: redondear(lineas.reduce((s, l) => s + Math.max(0, numero(l.cantidad) ?? 0), 0)),
    productosNuevos: lineas.filter(esNueva).length,
    productosExistentes: lineas.filter(esExistente).length,
  }
}

// ---------------------------------------------------------------------------
// Validación y envío
// ---------------------------------------------------------------------------

/**
 * Por qué una línea todavía no se puede guardar, o null si está lista.
 * El servidor vuelve a comprobarlo todo: esto solo guía a quien escribe.
 */
export function motivoNoLista(l: LineaEditable, repetidos: Set<string>): string | null {
  if (!l.sku.trim()) return 'Escribe el SKU'
  if (repetidos.has(l.sku.trim().toUpperCase())) return 'Este SKU está repetido en otra línea'

  if (l.estado === 'sin_verificar' || l.estado === 'verificando') return 'Verificando el SKU…'
  if (l.estado === 'parecidos') return 'Elige si es uno de los productos parecidos o uno nuevo'

  const cantidad = numero(l.cantidad)
  if (cantidad === null || cantidad <= 0) return 'La cantidad debe ser mayor que cero'
  const precio = numero(l.precioFactura)
  if (precio === null || precio < 0) return 'Escribe el precio de factura'
  const manual = numero(l.costoManual)
  if (l.costoManual.trim() !== '' && (manual === null || manual < 0)) return 'El costo final no es válido'

  if (esNueva(l)) {
    if (!l.nombre.trim()) return 'Escribe el nombre del producto nuevo'
    if (!l.categoria.trim()) return 'Elige la categoría del producto nuevo'
    const venta = numero(l.precioUnitario)
    if (venta === null || venta <= 0) return 'Escribe el precio de venta del producto nuevo'
  }

  return null
}

/** Lo que la línea trae para completar o contrastar con un producto existente. */
export function datosDeLinea(l: LineaEditable): DatosProducto {
  return {
    dimensiones: l.dimensiones,
    color: l.color,
    acabado: l.acabado,
    espesorMm: l.espesorMm,
    m2PorCaja: l.m2PorCaja,
    precioBodega: l.precioBodega,
    descripcion: l.descripcion,
    imagenUrl: l.imagenUrl,
  }
}

/** Lo que un producto existente ya tiene, en la forma que compara camposACompletar. */
export function datosDeProducto(p: ProductoParaCompra): DatosProducto {
  return {
    dimensiones: p.dimensiones,
    color: p.color,
    acabado: p.acabado,
    espesorMm: p.espesorMm,
    m2PorCaja: p.m2PorCaja,
    precioBodega: p.precioBodega,
    descripcion: p.descripcion,
    imagenUrl: p.imagenUrl,
  }
}

/**
 * Qué se completaría y qué difiere en una línea de un producto existente. Se
 * muestra mientras se escribe; el servidor aplica lo mismo al guardar.
 */
export function cambiosDeLinea(l: LineaEditable): { completar: DatosProducto; diferencias: Diferencia[] } {
  if (!l.producto) return { completar: {}, diferencias: [] }
  return camposACompletar(datosDeProducto(l.producto), datosDeLinea(l))
}

export interface DatosCompra {
  proveedorId: string
  fecha: string
  numeroFacturaProveedor: string
  observaciones: string
  metodoReparto: MetodoReparto
  extras: ExtraEditable[]
  lineas: LineaEditable[]
}

/** Solo los campos con contenido: lo vacío no se manda. */
function conContenido(valores: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(valores).filter(([, v]) => v.trim() !== ''))
}

/** El cuerpo de POST /api/compras. */
export function construirCuerpo(d: DatosCompra) {
  return {
    proveedorId: d.proveedorId,
    fecha: d.fecha,
    numeroFacturaProveedor: d.numeroFacturaProveedor,
    observaciones: d.observaciones,
    metodoReparto: d.metodoReparto,
    costosExtra: d.extras
      .filter((e) => (numero(e.valor) ?? 0) > 0 || e.concepto.trim() !== '')
      .map((e) => ({ concepto: e.concepto, valor: e.valor })),
    items: d.lineas.map((l) => {
      const campos = conContenido({
        dimensiones: l.dimensiones,
        color: l.color,
        acabado: l.acabado,
        espesorMm: l.espesorMm,
        m2PorCaja: l.m2PorCaja,
        precioBodega: l.precioBodega,
        descripcion: l.descripcion,
        imagenUrl: l.imagenUrl,
        costoFinalManual: l.costoManual,
      })
      const comunes = { sku: l.sku.trim(), cantidad: l.cantidad, precioFactura: l.precioFactura, ...campos }

      // Un producto existente solo manda su id y lo que se quiere completar.
      if (esExistente(l)) return { ...comunes, productoId: l.producto!.id, sku: l.producto!.sku }

      return {
        ...comunes,
        ...conContenido({ stockMinimo: l.stockMinimo }),
        nombre: l.nombre.trim(),
        categoria: l.categoria.trim(),
        precioUnitario: l.precioUnitario,
        confirmadoNuevo: l.confirmadoNuevo,
      }
    }),
  }
}
