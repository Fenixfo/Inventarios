import { describe, it, expect } from 'vitest'
import { normalizarTelefono, enlaceWhatsApp, mensajeFactura } from '@/lib/whatsapp'

describe('normalizarTelefono', () => {
  // Los clientes tienen el teléfono escrito de mil formas, según quien lo
  // haya cargado.
  it('añade el indicativo de Colombia a un número de diez dígitos', () => {
    expect(normalizarTelefono('3001234567')).toBe('573001234567')
    expect(normalizarTelefono('300 123 4567')).toBe('573001234567')
    expect(normalizarTelefono('(300) 123-4567')).toBe('573001234567')
  })

  it('respeta el número que ya trae indicativo', () => {
    expect(normalizarTelefono('573001234567')).toBe('573001234567')
    expect(normalizarTelefono('+57 300 123 4567')).toBe('573001234567')
    // De otro país: se deja como está en vez de anteponerle el 57.
    expect(normalizarTelefono('+1 415 555 2671')).toBe('14155552671')
  })

  it('descarta lo que no sirve como teléfono', () => {
    expect(normalizarTelefono('')).toBeNull()
    expect(normalizarTelefono(null)).toBeNull()
    expect(normalizarTelefono(undefined)).toBeNull()
    expect(normalizarTelefono('123')).toBeNull()
    expect(normalizarTelefono('sin teléfono')).toBeNull()
    // Demasiado largo para ser un número real.
    expect(normalizarTelefono('1234567890123456789')).toBeNull()
  })
})

describe('enlaceWhatsApp', () => {
  it('abre el chat del número indicado', () => {
    expect(enlaceWhatsApp('573001234567', 'hola')).toBe('https://wa.me/573001234567?text=hola')
  })

  // El caso de la factura sin teléfono: WhatsApp abre y pide el contacto.
  it('sin número deja elegir el destinatario', () => {
    expect(enlaceWhatsApp(null, 'hola')).toBe('https://wa.me/?text=hola')
  })

  it('escapa los saltos de línea y los símbolos del mensaje', () => {
    const url = enlaceWhatsApp(null, '*Factura*\nTotal: $36.000')

    expect(url).toContain('%0A')
    expect(url).not.toContain('\n')
    expect(url).toContain('%24') // el signo de pesos sí se escapa

    // Los asteriscos viajan tal cual, y son los que WhatsApp interpreta
    // como negrita al recibir el mensaje.
    expect(url).toContain('*Factura*')
  })
})

describe('mensajeFactura', () => {
  const factura = {
    numeroFactura: '20260923-001',
    fecha: '2026-09-23T15:00:00.000Z',
    total: 145000,
    cliente: { nombre: 'Ferretería El Sol' },
    items: [
      {
        productoNombre: 'Pared Mancha Gris',
        cantidadM2: 2,
        precioUnitario: 36000,
        subtotal: 72000,
      },
    ],
  }

  it('incluye número, cliente y total', () => {
    const mensaje = mensajeFactura(factura)

    expect(mensaje).toContain('20260923-001')
    expect(mensaje).toContain('Ferretería El Sol')
    expect(mensaje).toContain('Pared Mancha Gris')
    expect(mensaje).toMatch(/TOTAL/)
  })

  it('avisa del saldo pendiente cuando lo hay', () => {
    const mensaje = mensajeFactura(factura, { totalAbonado: 100000, saldoPendiente: 45000 })

    expect(mensaje).toMatch(/Abonado/)
    expect(mensaje).toMatch(/Saldo pendiente/)
  })

  it('dice que está cancelada cuando no queda saldo', () => {
    const mensaje = mensajeFactura(factura, { totalAbonado: 145000, saldoPendiente: 0 })

    expect(mensaje).toMatch(/cancelada en su totalidad/i)
    expect(mensaje).not.toMatch(/Saldo pendiente/)
  })

  it('funciona sin cliente ni items', () => {
    const mensaje = mensajeFactura({
      numeroFactura: '20260923-002',
      fecha: '2026-09-23T15:00:00.000Z',
      total: 10000,
    })

    expect(mensaje).toContain('20260923-002')
    expect(mensaje).not.toContain('Cliente:')
  })

  // Cotizaciones: el mismo resumen, sin nada de pagos.
  it('como cotización se titula así y no habla de abonos ni saldo', () => {
    const mensaje = mensajeFactura(
      { ...factura, numeroFactura: 'COT-20260925-001' },
      { tipo: 'cotizacion', totalAbonado: 100000, saldoPendiente: 45000 }
    )

    expect(mensaje).toContain('*Cotización COT-20260925-001*')
    expect(mensaje).toMatch(/TOTAL/)
    expect(mensaje).not.toMatch(/Abonado|Saldo pendiente|cancelada|Gracias por su compra/)
    expect(mensaje).toContain('Quedamos atentos a su confirmación.')
  })
})
