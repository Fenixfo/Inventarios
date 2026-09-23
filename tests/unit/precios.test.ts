import { describe, it, expect } from 'vitest'
import { precioAplicable, tienePrecioBodega } from '@/lib/precios'

describe('precioAplicable', () => {
  const producto = { precioUnitario: 36000, precioBodega: 31000 }

  it('cobra el precio al público cuando la factura es normal', () => {
    expect(precioAplicable(producto, false)).toBe(36000)
  })

  it('cobra el precio de bodega cuando la factura lo es', () => {
    expect(precioAplicable(producto, true)).toBe(31000)
  })

  // Lo importante del caso: sin precio de bodega no se factura en cero.
  it('cae en el precio al público si no hay precio de bodega', () => {
    expect(precioAplicable({ precioUnitario: 36000, precioBodega: null }, true)).toBe(36000)
    expect(precioAplicable({ precioUnitario: 36000 }, true)).toBe(36000)
  })

  it('trata un precio de bodega en cero como si no existiera', () => {
    expect(precioAplicable({ precioUnitario: 36000, precioBodega: 0 }, true)).toBe(36000)
  })

  // Prisma devuelve Decimal, que llega como cadena al serializar.
  it('acepta los precios como cadena', () => {
    expect(precioAplicable({ precioUnitario: '36000', precioBodega: '31000' }, true)).toBe(31000)
    expect(precioAplicable({ precioUnitario: '36000', precioBodega: '31000' }, false)).toBe(36000)
  })

  it('admite que el de bodega sea mayor, si así se configuró', () => {
    expect(precioAplicable({ precioUnitario: 10000, precioBodega: 12000 }, true)).toBe(12000)
  })
})

describe('tienePrecioBodega', () => {
  it('distingue el que tiene del que no', () => {
    expect(tienePrecioBodega({ precioUnitario: 1, precioBodega: 31000 })).toBe(true)
    expect(tienePrecioBodega({ precioUnitario: 1, precioBodega: null })).toBe(false)
    expect(tienePrecioBodega({ precioUnitario: 1, precioBodega: 0 })).toBe(false)
    expect(tienePrecioBodega({ precioUnitario: 1 })).toBe(false)
  })
})
