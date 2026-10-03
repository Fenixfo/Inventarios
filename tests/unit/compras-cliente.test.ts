import { describe, it, expect } from 'vitest'
import {
  calcularLineas,
  cambiosDeLinea,
  construirCuerpo,
  extraVacio,
  lineaVacia,
  motivoNoLista,
  numero,
  resumenDeCompra,
  skusRepetidos,
  totalExtras,
  type ExtraEditable,
  type LineaEditable,
} from '@/lib/compras-cliente'
import { compraNueva } from '@/lib/esquemas'
import type { ProductoParaCompra } from '@/lib/compras-clasificar'

const PRODUCTO: ProductoParaCompra = {
  id: '4fdb5356-4b10-4120-a183-c2a59979878f',
  sku: 'BAL-2',
  nombre: 'Baldosa 2',
  categoria: 'Pisos',
  dimensiones: '60x60',
  color: 'Gris',
  acabado: null,
  espesorMm: null,
  m2PorCaja: null,
  precioUnitario: 25000,
  precioBodega: null,
  costo: 1000,
  stockActual: 5,
  stockMinimo: 0,
  proveedor: null,
  descripcion: null,
  imagenUrl: null,
}

function linea(parche: Partial<LineaEditable> = {}): LineaEditable {
  return { ...lineaVacia(), ...parche }
}

const nueva = (parche: Partial<LineaEditable> = {}) =>
  linea({
    sku: 'NUE-1',
    nombre: 'Producto nuevo',
    categoria: 'Pisos',
    precioUnitario: '9000',
    cantidad: '4',
    precioFactura: '3000',
    estado: 'nuevo',
    skuVerificado: 'NUE-1',
    ...parche,
  })

const existente = (parche: Partial<LineaEditable> = {}) =>
  linea({
    sku: 'BAL-2',
    cantidad: '10',
    precioFactura: '2000',
    estado: 'existente',
    producto: PRODUCTO,
    skuVerificado: 'BAL-2',
    ...parche,
  })

const extra = (concepto: string, valor: string): ExtraEditable => ({ ...extraVacio(), concepto, valor })

describe('numero', () => {
  it('convierte texto en número y trata lo vacío o inválido como null', () => {
    expect(numero(' 12.5 ')).toBe(12.5)
    expect(numero('')).toBeNull()
    expect(numero('   ')).toBeNull()
    expect(numero('abc')).toBeNull()
    expect(numero('0')).toBe(0)
  })
})

describe('calcularLineas y resumenDeCompra', () => {
  it('reparte los extras por valor y calcula el costo final por unidad', () => {
    const lineas = [existente(), nueva()]
    const calculos = calcularLineas(lineas, [extra('Flete', '1400')], 'valor')

    // Valores de línea 20.000 y 12.000 → 875 y 525 de los 1.400.
    expect(calculos.map((c) => c.valorLinea)).toEqual([20000, 12000])
    expect(calculos.map((c) => c.costoExtra)).toEqual([875, 525])
    expect(calculos.map((c) => c.costoFinal)).toEqual([2087.5, 3131.25])
  })

  it('cambiar el método de reparto recalcula', () => {
    const lineas = [existente(), nueva()]
    const porCantidad = calcularLineas(lineas, [extra('Flete', '1400')], 'cantidad')
    // Cantidades 10 y 4 → 1.000 y 400.
    expect(porCantidad.map((c) => c.costoExtra)).toEqual([1000, 400])
  })

  it('un costo escrito a mano no cambia al variar los extras ni el método', () => {
    const lineas = [existente({ costoManual: '5555.55' })]
    const a = calcularLineas(lineas, [extra('Flete', '100')], 'valor')[0]
    const b = calcularLineas(lineas, [extra('Flete', '99999')], 'cantidad')[0]
    expect(a.costoFinal).toBe(5555.55)
    expect(b.costoFinal).toBe(5555.55)
    expect(a.costoEditado).toBe(true)
  })

  it('ignora los extras sin valor o con valor no válido', () => {
    expect(totalExtras([extra('Flete', ''), extra('X', '0'), extra('Y', 'abc'), extra('Z', '-5'), extra('Descargue', '300')])).toBe(300)
  })

  it('el resumen suma subtotal, extras, total, unidades y cuenta nuevos y existentes', () => {
    const r = resumenDeCompra([existente(), nueva()], [extra('Flete', '1400')], 'valor')
    expect(r).toEqual({
      subtotal: 32000,
      totalExtras: 1400,
      total: 33400,
      unidades: 14,
      productosNuevos: 1,
      productosExistentes: 1,
    })
  })

  it('una línea a medio escribir no rompe el cálculo', () => {
    const r = resumenDeCompra([linea(), existente({ cantidad: '', precioFactura: 'x' })], [], 'valor')
    expect(r.total).toBe(0)
    expect(r.unidades).toBe(0)
  })
})

describe('motivoNoLista', () => {
  const sinRepetidos = new Set<string>()

  it('una línea completa de producto nuevo o existente está lista', () => {
    expect(motivoNoLista(nueva(), sinRepetidos)).toBeNull()
    expect(motivoNoLista(existente(), sinRepetidos)).toBeNull()
  })

  it('exige el SKU y que esté verificado', () => {
    expect(motivoNoLista(linea(), sinRepetidos)).toMatch(/SKU/)
    expect(motivoNoLista(nueva({ estado: 'sin_verificar' }), sinRepetidos)).toMatch(/Verificando/)
    expect(motivoNoLista(nueva({ estado: 'verificando' }), sinRepetidos)).toMatch(/Verificando/)
  })

  it('una línea con nombres parecidos sin resolver no está lista', () => {
    expect(motivoNoLista(nueva({ estado: 'parecidos' }), sinRepetidos)).toMatch(/parecidos/)
  })

  it('exige cantidad mayor que cero y precio de factura', () => {
    expect(motivoNoLista(nueva({ cantidad: '0' }), sinRepetidos)).toMatch(/cantidad/)
    expect(motivoNoLista(nueva({ cantidad: '' }), sinRepetidos)).toMatch(/cantidad/)
    expect(motivoNoLista(nueva({ precioFactura: '' }), sinRepetidos)).toMatch(/precio de factura/)
    expect(motivoNoLista(nueva({ precioFactura: '0' }), sinRepetidos)).toBeNull()
  })

  it('un producto nuevo exige nombre, categoría y precio de venta; uno existente no', () => {
    expect(motivoNoLista(nueva({ nombre: '  ' }), sinRepetidos)).toMatch(/nombre/)
    expect(motivoNoLista(nueva({ categoria: '' }), sinRepetidos)).toMatch(/categoría/)
    expect(motivoNoLista(nueva({ precioUnitario: '' }), sinRepetidos)).toMatch(/precio de venta/)
    expect(motivoNoLista(nueva({ precioUnitario: '0' }), sinRepetidos)).toMatch(/precio de venta/)
    expect(motivoNoLista(existente({ nombre: '', categoria: '', precioUnitario: '' }), sinRepetidos)).toBeNull()
  })

  it('un costo final manual negativo no es válido', () => {
    expect(motivoNoLista(nueva({ costoManual: '-1' }), sinRepetidos)).toMatch(/costo final/)
    expect(motivoNoLista(nueva({ costoManual: '0' }), sinRepetidos)).toBeNull()
  })

  it('detecta los SKU repetidos ignorando mayúsculas y espacios', () => {
    const lineas = [nueva({ sku: 'ABC' }), nueva({ sku: ' abc ' }), nueva({ sku: 'otro' })]
    const repetidos = skusRepetidos(lineas)
    expect([...repetidos]).toEqual(['ABC'])
    expect(motivoNoLista(lineas[1], repetidos)).toMatch(/repetido/)
    expect(motivoNoLista(lineas[2], repetidos)).toBeNull()
  })
})

describe('cambiosDeLinea', () => {
  it('muestra qué se completaría y qué difiere, sin tocar lo que el producto ya tiene', () => {
    const l = existente({ color: 'Blanco', acabado: 'Mate' })
    const { completar, diferencias } = cambiosDeLinea(l)
    expect(completar).toEqual({ acabado: 'Mate' })
    expect(diferencias).toEqual([{ campo: 'color', actual: 'Gris', escrito: 'Blanco' }])
  })

  it('una línea de producto nuevo no tiene cambios que mostrar', () => {
    expect(cambiosDeLinea(nueva())).toEqual({ completar: {}, diferencias: [] })
  })
})

describe('construirCuerpo', () => {
  const base = {
    proveedorId: '9b2a3c1d-1111-4222-8333-444455556666',
    fecha: '2026-10-03',
    numeroFacturaProveedor: 'F-100',
    observaciones: '',
    metodoReparto: 'valor' as const,
    extras: [extra('Flete', '1400'), extra('', '')],
    lineas: [existente({ color: 'Blanco', costoManual: '2100' }), nueva({ stockMinimo: '5', imagenUrl: 'https://x.co/a.png' })],
  }

  it('arma un cuerpo que el servidor acepta', () => {
    const r = compraNueva.safeParse(construirCuerpo(base))
    expect(r.success).toBe(true)
  })

  it('un producto existente manda su id y el SKU del producto, y no sus datos básicos', () => {
    const [item] = construirCuerpo(base).items
    expect(item).toMatchObject({ productoId: PRODUCTO.id, sku: 'BAL-2', color: 'Blanco', costoFinalManual: '2100' })
    expect(item).not.toHaveProperty('nombre')
    expect(item).not.toHaveProperty('categoria')
    expect(item).not.toHaveProperty('precioUnitario')
  })

  it('un producto nuevo manda todo lo necesario para crearlo y no manda productoId', () => {
    const item = construirCuerpo(base).items[1]
    expect(item).toMatchObject({
      sku: 'NUE-1',
      nombre: 'Producto nuevo',
      categoria: 'Pisos',
      precioUnitario: '9000',
      stockMinimo: '5',
      imagenUrl: 'https://x.co/a.png',
      confirmadoNuevo: false,
    })
    expect(item).not.toHaveProperty('productoId')
  })

  it('marca confirmadoNuevo cuando se descartó el aviso de parecidos', () => {
    const cuerpo = construirCuerpo({ ...base, lineas: [nueva({ confirmadoNuevo: true })] })
    expect(cuerpo.items[0]).toMatchObject({ confirmadoNuevo: true })
  })

  it('no manda los campos vacíos ni los extras en blanco', () => {
    const cuerpo = construirCuerpo({ ...base, lineas: [nueva()] })
    expect(cuerpo.items[0]).not.toHaveProperty('color')
    expect(cuerpo.items[0]).not.toHaveProperty('costoFinalManual')
    expect(cuerpo.costosExtra).toEqual([{ concepto: 'Flete', valor: '1400' }])
  })
})
