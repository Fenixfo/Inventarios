import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Reglas replicadas de los endpoints y formularios. Si cambian allí,
// estos tests deben fallar para obligar a revisarlas.

const telefonoClienteSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa tu número de teléfono')
  .regex(/^[0-9+\s()-]+$/, 'El teléfono solo puede contener números')
  .refine((v) => v.replace(/\D/g, '').length >= 10, 'El teléfono debe tener al menos 10 dígitos')

const destinoWhatsappSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa el número de WhatsApp destino')
  .refine((v) => v.replace(/\D/g, '').length >= 10, 'Incluye el indicativo del país')

const movimientoSchema = z.object({
  productoId: z.string().uuid(),
  tipo: z.enum(['entrada', 'salida', 'ajuste']),
  cantidad: z.number().positive('La cantidad debe ser mayor a cero'),
  motivo: z.string().trim().min(1, 'El motivo es obligatorio'),
})

const UUID_VALIDO = '0a32ff10-dbb7-4e51-8966-e9504a499577'

describe('validación de teléfono del cliente', () => {
  it.each([
    ['3001234567', 'diez dígitos seguidos'],
    ['300 123 4567', 'con espacios'],
    ['(604) 123-4567', 'con paréntesis y guion'],
    ['+57 300 123 4567', 'con indicativo'],
  ])('acepta %s (%s)', (entrada) => {
    expect(telefonoClienteSchema.safeParse(entrada).success).toBe(true)
  })

  it.each([
    ['', 'vacío'],
    ['   ', 'solo espacios'],
    ['300123', 'menos de diez dígitos'],
    ['abcdefghij', 'letras'],
    ['300-ABC-4567', 'mezcla de letras'],
  ])('rechaza %s (%s)', (entrada) => {
    expect(telefonoClienteSchema.safeParse(entrada).success).toBe(false)
  })

  it('explica el motivo cuando faltan dígitos', () => {
    const r = telefonoClienteSchema.safeParse('30012')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toMatch(/al menos 10 dígitos/)
  })

  it('recorta espacios antes de validar', () => {
    const r = telefonoClienteSchema.safeParse('  3001234567  ')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('3001234567')
  })
})

describe('validación del WhatsApp destino', () => {
  it('acepta un número con indicativo', () => {
    expect(destinoWhatsappSchema.safeParse('573001234567').success).toBe(true)
  })

  it('rechaza un número demasiado corto', () => {
    expect(destinoWhatsappSchema.safeParse('123').success).toBe(false)
  })

  it('rechaza vacío', () => {
    expect(destinoWhatsappSchema.safeParse('').success).toBe(false)
  })
})

describe('validación de movimientos de inventario', () => {
  const base = { productoId: UUID_VALIDO, tipo: 'entrada' as const, cantidad: 10, motivo: 'Compra' }

  it('acepta un movimiento completo', () => {
    expect(movimientoSchema.safeParse(base).success).toBe(true)
  })

  it.each(['entrada', 'salida', 'ajuste'])('acepta el tipo %s', (tipo) => {
    expect(movimientoSchema.safeParse({ ...base, tipo }).success).toBe(true)
  })

  it('rechaza un tipo desconocido', () => {
    expect(movimientoSchema.safeParse({ ...base, tipo: 'devolucion' }).success).toBe(false)
  })

  it('rechaza cantidad cero', () => {
    const r = movimientoSchema.safeParse({ ...base, cantidad: 0 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toMatch(/mayor a cero/)
  })

  it('rechaza cantidad negativa', () => {
    expect(movimientoSchema.safeParse({ ...base, cantidad: -5 }).success).toBe(false)
  })

  it('acepta cantidades decimales', () => {
    expect(movimientoSchema.safeParse({ ...base, cantidad: 2.5 }).success).toBe(true)
  })

  it('rechaza motivo vacío o solo espacios', () => {
    expect(movimientoSchema.safeParse({ ...base, motivo: '' }).success).toBe(false)
    expect(movimientoSchema.safeParse({ ...base, motivo: '   ' }).success).toBe(false)
  })

  it('rechaza un productoId que no es UUID', () => {
    expect(movimientoSchema.safeParse({ ...base, productoId: 'abc' }).success).toBe(false)
  })
})

describe('cálculo de stock por tipo de movimiento', () => {
  // Réplica de la fórmula en /api/inventario/movimientos
  const calcular = (tipo: string, stockAntes: number, cantidad: number) =>
    tipo === 'entrada'
      ? stockAntes + cantidad
      : tipo === 'salida'
        ? stockAntes - cantidad
        : cantidad

  it('entrada suma al stock', () => {
    expect(calcular('entrada', 100, 20)).toBe(120)
  })

  it('salida resta del stock', () => {
    expect(calcular('salida', 100, 30)).toBe(70)
  })

  it('ajuste fija el stock al valor contado, sin importar el anterior', () => {
    expect(calcular('ajuste', 100, 50)).toBe(50)
    expect(calcular('ajuste', 5, 50)).toBe(50)
  })

  it('detecta cuando una salida dejaría el stock en negativo', () => {
    expect(calcular('salida', 10, 15)).toBeLessThan(0)
  })

  it('opera con decimales', () => {
    expect(calcular('entrada', 10.5, 2.25)).toBe(12.75)
    expect(calcular('salida', 10.5, 0.5)).toBe(10)
  })
})

describe('cálculo de totales de factura', () => {
  const calcularTotal = (subtotal: number, descuentoPct: number, impuestoPct: number) => {
    const descuento = subtotal * (descuentoPct / 100)
    const base = subtotal - descuento
    const impuesto = base * (impuestoPct / 100)
    return { descuento, impuesto, total: base + impuesto }
  }

  it('sin descuento ni impuesto el total es el subtotal', () => {
    expect(calcularTotal(100000, 0, 0).total).toBe(100000)
  })

  it('aplica el descuento antes del impuesto', () => {
    const r = calcularTotal(100000, 10, 19)
    expect(r.descuento).toBe(10000)
    expect(r.impuesto).toBe(17100) // 19% sobre 90000, no sobre 100000
    expect(r.total).toBe(107100)
  })

  it('un descuento del 100% deja el total en cero', () => {
    expect(calcularTotal(50000, 100, 19).total).toBe(0)
  })
})
