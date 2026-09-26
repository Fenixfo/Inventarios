import { describe, it, expect } from 'vitest'
import {
  cantidadPendiente,
  costoAlFacturar,
  costoDeItem,
  estadosDeVenta,
  porcentajeValido,
  totalesDeLiquidacion,
  ventaSinImpuesto,
} from '@/lib/liquidacion'

// TASK-67. El caso que se planteó: precio 15, costo 5, stock 10 y se venden 25.
const CAJAS = 'cajas'
const productos = new Map([[CAJAS, { stockActual: 10, costo: 5 }]])

describe('costoAlFacturar', () => {
  it('lo que había en stock va al costo de hoy; el resto queda pendiente', () => {
    const [linea] = costoAlFacturar([{ productoId: CAJAS, cantidadM2: 25 }], productos)

    expect(linea).toEqual({ costoUnitario: 5, cantidadConCosto: 10 })
    expect(cantidadPendiente({ cantidadM2: 25, ...linea })).toBe(15)
  })

  it('con stock de sobra, todo tiene costo', () => {
    const [linea] = costoAlFacturar([{ productoId: CAJAS, cantidadM2: 4 }], productos)
    expect(linea.cantidadConCosto).toBe(4)
  })

  it('dos líneas del mismo producto no cuentan dos veces el mismo stock', () => {
    const lineas = costoAlFacturar(
      [
        { productoId: CAJAS, cantidadM2: 7 },
        { productoId: CAJAS, cantidadM2: 7 },
      ],
      productos
    )

    expect(lineas.map((l) => l.cantidadConCosto)).toEqual([7, 3])
  })

  it('un producto personalizado queda todo pendiente', () => {
    const [linea] = costoAlFacturar([{ productoId: null, cantidadM2: 3 }], productos)
    expect(linea).toEqual({ costoUnitario: null, cantidadConCosto: 0 })
  })

  it('un producto sin costo cargado queda todo pendiente', () => {
    const [linea] = costoAlFacturar(
      [{ productoId: 'sin-costo', cantidadM2: 3 }],
      new Map([['sin-costo', { stockActual: 50, costo: null }]])
    )
    expect(linea.cantidadConCosto).toBe(0)
  })

  it('con stock negativo o en cero, todo queda pendiente', () => {
    const [linea] = costoAlFacturar(
      [{ productoId: 'agotado', cantidadM2: 2 }],
      new Map([['agotado', { stockActual: -3, costo: 5 }]])
    )
    expect(linea).toEqual({ costoUnitario: 5, cantidadConCosto: 0 })
  })
})

describe('costoDeItem', () => {
  const item = { cantidadM2: 25, cantidadConCosto: 10, costoUnitario: 5 }

  it('suma lo conocido y lo que se pone al liquidar', () => {
    // 10 × 5 + 15 × 6
    expect(costoDeItem(item, 6)).toBe(140)
  })

  it('sin el costo de lo pendiente no se puede calcular', () => {
    expect(costoDeItem(item, null)).toBeNull()
    expect(costoDeItem(item, undefined)).toBeNull()
    expect(costoDeItem(item, -1)).toBeNull()
  })

  it('una línea sin pendiente no necesita nada más', () => {
    expect(costoDeItem({ cantidadM2: 4, cantidadConCosto: 4, costoUnitario: 5 }, null)).toBe(20)
  })

  it('un costo de cero es válido (por ejemplo, un regalo)', () => {
    expect(costoDeItem({ cantidadM2: 2, cantidadConCosto: 0, costoUnitario: null }, 0)).toBe(0)
  })
})

describe('totalesDeLiquidacion', () => {
  it('ganancia = venta sin impuesto − costo, y el vendedor recibe su porcentaje', () => {
    // El ejemplo: 25 × 15 = 375 de venta; costo 10 × 5 + 15 × 5 = 125.
    const totales = totalesDeLiquidacion([{ venta: 375, costo: 125 }], 30)

    expect(totales).toEqual({ totalVenta: 375, totalCosto: 125, totalGanancia: 250, pagoVendedor: 75 })
  })

  it('una factura con pérdida resta de las demás', () => {
    const totales = totalesDeLiquidacion(
      [
        { venta: 1000, costo: 600 },
        { venta: 100, costo: 300 },
      ],
      30
    )
    expect(totales.totalGanancia).toBe(200)
    expect(totales.pagoVendedor).toBe(60)
  })

  it('si en conjunto hay pérdida, el pago es cero, nunca negativo', () => {
    const totales = totalesDeLiquidacion([{ venta: 100, costo: 300 }], 30)
    expect(totales.totalGanancia).toBe(-200)
    expect(totales.pagoVendedor).toBe(0)
  })
})

describe('ventaSinImpuesto', () => {
  it('es el subtotal menos el descuento; el impuesto no cuenta', () => {
    expect(ventaSinImpuesto({ subtotal: 1000, descuentoMonto: 100 })).toBe(900)
  })
})

describe('estadosDeVenta', () => {
  it('las liquidadas cuentan con las pagadas y entregadas', () => {
    expect(estadosDeVenta(['pagado', 'entregado'])).toEqual(['pagado', 'entregado', 'liquidado'])
    expect(estadosDeVenta(['pagado'])).toContain('liquidado')
  })

  it('mirando solo pendientes no se añaden', () => {
    expect(estadosDeVenta(['pendiente'])).toEqual(['pendiente'])
  })
})

describe('porcentajeValido', () => {
  it('acepta de 0 a 100', () => {
    expect(porcentajeValido(30)).toBe(true)
    expect(porcentajeValido(0)).toBe(true)
    expect(porcentajeValido(100)).toBe(true)
    expect(porcentajeValido(101)).toBe(false)
    expect(porcentajeValido(-1)).toBe(false)
    expect(porcentajeValido(NaN)).toBe(false)
  })
})
