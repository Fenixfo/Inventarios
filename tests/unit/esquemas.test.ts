import { describe, it, expect } from 'vitest'
import { abonoNuevo, facturaEditada, facturaNueva, liquidacionNueva, primerError } from '@/lib/esquemas'

const ID = '4fdb5356-4b10-4120-a183-c2a59979878f'
const linea = { productoId: ID, productoNombre: 'Cajas', cantidadM2: 2, precioUnitario: 15000, subtotal: 30000 }

describe('facturaNueva', () => {
  it('acepta la factura que manda el formulario', () => {
    const r = facturaNueva.safeParse({ clienteId: null, subtotal: 30000, total: 30000, items: [linea] })
    expect(r.success).toBe(true)
  })

  it('convierte los números que llegan como texto', () => {
    const r = facturaNueva.parse({ total: '30000', items: [{ ...linea, cantidadM2: '2.5' }] })
    expect(r.total).toBe(30000)
    expect(r.items[0].cantidadM2).toBe(2.5)
  })

  it('lo vacío queda en su valor por defecto', () => {
    const r = facturaNueva.parse({ clienteId: '', terminoPago: '  ', items: [{ ...linea, productoId: '' }] })
    expect(r.clienteId).toBeNull()
    expect(r.terminoPago).toBeNull()
    expect(r.anticipo).toBe(0)
    expect(r.items[0].productoId).toBeNull()
  })

  it('rechaza sin productos, montos negativos, texto donde va número e ids inventados', () => {
    expect(facturaNueva.safeParse({ items: [] }).success).toBe(false)
    expect(facturaNueva.safeParse({ total: -1, items: [linea] }).success).toBe(false)
    expect(facturaNueva.safeParse({ total: 'mucho', items: [linea] }).success).toBe(false)
    expect(facturaNueva.safeParse({ items: [{ ...linea, cantidadM2: 0 }] }).success).toBe(false)
    expect(facturaNueva.safeParse({ clienteId: 'abc', items: [linea] }).success).toBe(false)
    expect(facturaNueva.safeParse({ descuentoPorcentaje: 150, items: [linea] }).success).toBe(false)
  })

  it('descarta lo que no está en el esquema, como el autor', () => {
    const r = facturaNueva.parse({ usuarioId: 'otro', items: [linea] }) as Record<string, unknown>
    expect(r.usuarioId).toBeUndefined()
  })
})

describe('facturaEditada', () => {
  it('toma la factura entera de la pantalla y se queda con lo editable', () => {
    const r = facturaEditada.parse({
      id: ID,
      estado: 'pagado',
      total: '375.00',
      cliente: { nombre: 'X' },
      items: [linea],
    }) as Record<string, unknown>

    expect(r.total).toBe(375)
    expect(r.cliente).toBeUndefined()
    expect(r.items).toBeUndefined()
  })

  it('rechaza un estado que no existe', () => {
    expect(facturaEditada.safeParse({ id: ID, estado: 'regalado' }).success).toBe(false)
  })
})

describe('abonoNuevo', () => {
  it('exige una factura válida y un monto positivo', () => {
    expect(abonoNuevo.safeParse({ facturaId: ID, monto: '5000' }).success).toBe(true)
    expect(abonoNuevo.safeParse({ facturaId: ID, monto: 0 }).success).toBe(false)
    expect(abonoNuevo.safeParse({ facturaId: 'x', monto: 5000 }).success).toBe(false)
  })
})

describe('liquidacionNueva', () => {
  it('quita facturas repetidas y rechaza porcentajes fuera de 0–100', () => {
    const r = liquidacionNueva.parse({ vendedorId: ID, facturaIds: [ID, ID], porcentaje: 30 })
    expect(r.facturaIds).toEqual([ID])
    expect(r.costos).toEqual({})

    expect(liquidacionNueva.safeParse({ vendedorId: ID, facturaIds: [ID], porcentaje: 101 }).success).toBe(false)
    expect(liquidacionNueva.safeParse({ vendedorId: ID, facturaIds: [ID], porcentaje: 30, costos: { a: -5 } }).success).toBe(false)
  })
})

describe('primerError', () => {
  it('dice qué campo está mal', () => {
    const r = facturaNueva.safeParse({ items: [{ ...linea, cantidadM2: 0 }] })
    expect(r.success).toBe(false)
    if (!r.success) expect(primerError(r.error)).toBe('items.0.cantidadM2: debe ser mayor que cero')
  })
})
