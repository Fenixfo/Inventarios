import { describe, it, expect } from 'vitest'
import {
  abonoNuevo,
  compraAnulacion,
  compraNueva,
  facturaEditada,
  facturaNueva,
  liquidacionNueva,
  primerError,
  proveedorNuevo,
} from '@/lib/esquemas'

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

describe('compraNueva', () => {
  const PROV = '9b2a3c1d-1111-4222-8333-444455556666'
  const nueva = { sku: 'BAL-1', nombre: 'Baldosa 1', categoria: 'Pisos', precioUnitario: 25000, cantidad: 10, precioFactura: 18000 }
  const existente = { productoId: ID, sku: 'BAL-2', cantidad: 5, precioFactura: 18000 }
  const base = { proveedorId: PROV, fecha: '2026-10-03', items: [nueva] }

  it('acepta una compra válida con un producto nuevo y uno existente', () => {
    const r = compraNueva.safeParse({ ...base, items: [nueva, existente] })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.metodoReparto).toBe('valor')
      expect(r.data.costosExtra).toEqual([])
      expect(r.data.items[1].confirmadoNuevo).toBe(false)
    }
  })

  it('una fecha sin hora se guarda a mediodía UTC, para no caer en el día anterior', () => {
    const r = compraNueva.parse({ ...base, fecha: '2026-10-03' })
    expect(r.fecha.toISOString()).toBe('2026-10-03T12:00:00.000Z')
    // Con hora explícita se respeta.
    expect(compraNueva.parse({ ...base, fecha: '2026-10-03T08:30:00Z' }).fecha.toISOString()).toBe('2026-10-03T08:30:00.000Z')
  })

  it('rechaza una compra sin proveedor, sin fecha o sin líneas', () => {
    expect(compraNueva.safeParse({ ...base, proveedorId: undefined }).success).toBe(false)
    expect(compraNueva.safeParse({ ...base, proveedorId: 'x' }).success).toBe(false)
    expect(compraNueva.safeParse({ ...base, fecha: undefined }).success).toBe(false)
    expect(compraNueva.safeParse({ ...base, fecha: 'ayer' }).success).toBe(false)
    expect(compraNueva.safeParse({ ...base, items: [] }).success).toBe(false)
  })

  it('rechaza más de 100 líneas', () => {
    const muchas = Array.from({ length: 101 }, (_, i) => ({ ...nueva, sku: `SKU-${i}` }))
    expect(compraNueva.safeParse({ ...base, items: muchas }).success).toBe(false)
    expect(compraNueva.safeParse({ ...base, items: muchas.slice(0, 100) }).success).toBe(true)
  })

  it('rechaza SKU repetido ignorando mayúsculas y espacios, e indica las líneas', () => {
    const r = compraNueva.safeParse({ ...base, items: [nueva, { ...nueva, sku: ' bal-1 ' }] })
    expect(r.success).toBe(false)
    if (!r.success) expect(primerError(r.error)).toContain('Línea 2')
  })

  it('rechaza cantidad cero y precio de factura negativo', () => {
    expect(compraNueva.safeParse({ ...base, items: [{ ...nueva, cantidad: 0 }] }).success).toBe(false)
    expect(compraNueva.safeParse({ ...base, items: [{ ...nueva, precioFactura: -1 }] }).success).toBe(false)
    expect(compraNueva.safeParse({ ...base, items: [{ ...nueva, precioFactura: 0 }] }).success).toBe(true)
  })

  it('una línea sin productoId exige nombre, categoría y precio de venta', () => {
    for (const falta of ['nombre', 'categoria', 'precioUnitario'] as const) {
      const linea: Record<string, unknown> = { ...nueva }
      delete linea[falta]
      expect(compraNueva.safeParse({ ...base, items: [linea] }).success).toBe(false)
    }
    expect(compraNueva.safeParse({ ...base, items: [{ ...nueva, precioUnitario: 0 }] }).success).toBe(false)
    // Con productoId no hace falta nada de eso.
    expect(compraNueva.safeParse({ ...base, items: [existente] }).success).toBe(true)
  })

  it('valida los costos adicionales', () => {
    const extra = (c: unknown) => compraNueva.safeParse({ ...base, costosExtra: c })
    expect(extra([{ concepto: 'Flete', valor: 30000 }]).success).toBe(true)
    expect(extra([{ concepto: 'Flete', valor: 0 }]).success).toBe(false)
    expect(extra([{ concepto: '  ', valor: 100 }]).success).toBe(false)
    expect(extra(Array.from({ length: 21 }, () => ({ concepto: 'x', valor: 1 }))).success).toBe(false)
  })

  it('el método de reparto es valor o cantidad', () => {
    expect(compraNueva.safeParse({ ...base, metodoReparto: 'cantidad' }).success).toBe(true)
    expect(compraNueva.safeParse({ ...base, metodoReparto: 'peso' }).success).toBe(false)
  })

  it('el costo final manual es opcional y no puede ser negativo', () => {
    expect(compraNueva.safeParse({ ...base, items: [{ ...nueva, costoFinalManual: '' }] }).success).toBe(true)
    expect(compraNueva.safeParse({ ...base, items: [{ ...nueva, costoFinalManual: 0 }] }).success).toBe(true)
    expect(compraNueva.safeParse({ ...base, items: [{ ...nueva, costoFinalManual: -1 }] }).success).toBe(false)
  })

  it('la imagen solo acepta direcciones https', () => {
    const imagen = (u: string) => compraNueva.safeParse({ ...base, items: [{ ...nueva, imagenUrl: u }] })
    expect(imagen('https://abc.supabase.co/storage/v1/object/public/x.png').success).toBe(true)
    expect(imagen('http://sitio.com/a.png').success).toBe(false)
    expect(imagen('javascript:alert(1)').success).toBe(false)
    expect(imagen('').success).toBe(true)
  })
})

describe('proveedorNuevo', () => {
  it('acepta solo el nombre y deja el resto en nulo', () => {
    const r = proveedorNuevo.parse({ nombre: '  Cerámicas del Norte ' })
    expect(r).toEqual({ nombre: 'Cerámicas del Norte', nit: null, telefono: null, email: null, direccion: null })
  })

  it('rechaza el nombre vacío y el correo inválido', () => {
    expect(proveedorNuevo.safeParse({ nombre: '   ' }).success).toBe(false)
    expect(proveedorNuevo.safeParse({ nombre: 'X', email: 'no-es-correo' }).success).toBe(false)
    expect(proveedorNuevo.safeParse({ nombre: 'X', email: 'ventas@norte.co' }).success).toBe(true)
  })

  it('un NIT vacío cuenta como ausente (nulo), no como texto vacío', () => {
    expect(proveedorNuevo.parse({ nombre: 'X', nit: '   ' }).nit).toBeNull()
  })
})

describe('compraAnulacion', () => {
  it('exige el motivo', () => {
    expect(compraAnulacion.safeParse({ motivo: 'Factura duplicada' }).success).toBe(true)
    expect(compraAnulacion.safeParse({ motivo: '   ' }).success).toBe(false)
    expect(compraAnulacion.safeParse({}).success).toBe(false)
  })
})

describe('primerError', () => {
  it('dice qué campo está mal', () => {
    const r = facturaNueva.safeParse({ items: [{ ...linea, cantidadM2: 0 }] })
    expect(r.success).toBe(false)
    if (!r.success) expect(primerError(r.error)).toBe('items.0.cantidadM2: debe ser mayor que cero')
  })
})
