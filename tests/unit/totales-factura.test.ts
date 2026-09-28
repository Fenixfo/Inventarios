import { describe, it, expect } from 'vitest'
import { calcularTotales, montoDePorcentaje, porcentajeDeMonto } from '@/lib/totales-factura'

const lineas = [{ subtotal: 60000 }, { subtotal: 40000 }]

describe('calcularTotales', () => {
  it('sin descuento ni impuesto, el total es la suma de las líneas', () => {
    expect(calcularTotales(lineas, { descuentoPorcentaje: 0, descuentoMonto: 0, impuestoPorcentaje: 0 }))
      .toEqual({ subtotal: 100000, descuento: 0, impuesto: 0, total: 100000 })
  })

  it('el descuento en pesos manda sobre el porcentaje', () => {
    const t = calcularTotales(lineas, { descuentoPorcentaje: 50, descuentoMonto: 10000, impuestoPorcentaje: 0 })
    expect(t.descuento).toBe(10000)
    expect(t.total).toBe(90000)
  })

  it('sin monto, el descuento sale del porcentaje', () => {
    const t = calcularTotales(lineas, { descuentoPorcentaje: 10, descuentoMonto: 0, impuestoPorcentaje: 0 })
    expect(t.descuento).toBe(10000)
  })

  it('el impuesto se aplica después del descuento', () => {
    // (100.000 − 10.000) × 19% = 17.100
    const t = calcularTotales(lineas, { descuentoPorcentaje: 0, descuentoMonto: 10000, impuestoPorcentaje: 19 })
    expect(t.impuesto).toBe(17100)
    expect(t.total).toBe(107100)
  })

  it('sin líneas todo es cero', () => {
    expect(calcularTotales([], { descuentoPorcentaje: 10, descuentoMonto: 0, impuestoPorcentaje: 19 }).total).toBe(0)
  })
})

describe('descuento: porcentaje y monto sincronizados', () => {
  it('convierte entre porcentaje y monto con dos decimales', () => {
    expect(montoDePorcentaje(100000, 12.5)).toBe(12500)
    expect(porcentajeDeMonto(30000, 1000)).toBe(3.33)
  })

  it('con subtotal cero el porcentaje es cero, no infinito', () => {
    expect(porcentajeDeMonto(0, 5000)).toBe(0)
  })
})
