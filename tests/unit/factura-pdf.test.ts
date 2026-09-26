// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  generarPdfFactura,
  nombreArchivoFactura,
  nombreArchivoCotizacion,
  type FacturaPdf,
} from '@/lib/factura-pdf'

const FACTURA: FacturaPdf = {
  numeroFactura: '20260923-001',
  fecha: '2026-09-23T15:00:00.000Z',
  estado: 'pendiente',
  subtotal: 145000,
  descuentoMonto: 0,
  impuesto: 0,
  total: 145000,
  anticipo: 45000,
  cliente: {
    nombre: 'Ferretería El Sol',
    cedulaCc: '900123456',
    telefono: '3001234567',
  },
  items: [
    {
      productoNombre: 'Pared Mancha Gris',
      producto: { sku: 'BER-006' },
      cantidadM2: 2.5,
      precioUnitario: 36000,
      subtotal: 90000,
    },
    {
      productoNombre: 'Piso Carrara',
      producto: { sku: 'BER-045' },
      cantidadM2: 1.5,
      precioUnitario: 36666,
      subtotal: 55000,
    },
  ],
  abonos: [{ monto: 45000, fecha: '2026-09-23T16:00:00.000Z' }],
}

/** Los PDF empiezan siempre por esta marca. */
function esPdf(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.slice(0, 5)).toString() === '%PDF-'
}

describe('generarPdfFactura', () => {
  it('produce un archivo PDF válido', async () => {
    const bytes = await generarPdfFactura(FACTURA)

    expect(esPdf(bytes)).toBe(true)
    expect(bytes.length).toBeGreaterThan(1000)
  })

  it('funciona sin cliente, sin abonos y sin configuración de empresa', async () => {
    const bytes = await generarPdfFactura({
      ...FACTURA,
      cliente: null,
      abonos: [],
      anticipo: 0,
    })

    expect(esPdf(bytes)).toBe(true)
  })

  // Las fuentes estándar del PDF no aceptan cualquier carácter: si no se
  // limpiaran, un nombre con emoji o con m² reventaría la generación a
  // mitad del documento.
  it('no falla con caracteres fuera del alfabeto latino', async () => {
    const bytes = await generarPdfFactura({
      ...FACTURA,
      observaciones: 'Entrega 📦 en obra — 12 m² “urgente”',
      items: [
        {
          productoNombre: 'Baldosa 30×60 m² ✓',
          producto: { sku: 'BER-001' },
          cantidadM2: 1,
          precioUnitario: 1000,
          subtotal: 1000,
        },
      ],
    })

    expect(esPdf(bytes)).toBe(true)
  })

  it('aguanta una factura con muchos items, repartiéndola en varias páginas', async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      productoNombre: `Producto de prueba número ${i + 1}`,
      producto: { sku: `BER-${String(i + 1).padStart(3, '0')}` },
      cantidadM2: 1,
      precioUnitario: 1000,
      subtotal: 1000,
    }))

    const bytes = await generarPdfFactura({ ...FACTURA, items })

    expect(esPdf(bytes)).toBe(true)
  })

  it('no intenta descargar el logo si no hay URL', async () => {
    const bytes = await generarPdfFactura(FACTURA, { nombre_empresa: 'Beraca' })
    expect(esPdf(bytes)).toBe(true)
  })
})

describe('nombreArchivoFactura', () => {
  it('nombra el archivo con el número de la factura', () => {
    expect(nombreArchivoFactura('20260923-001')).toBe('Factura-20260923-001.pdf')
  })
})

// Cotizaciones: mismo generador, sin estado, abonos ni saldo.
describe('PDF de cotización', () => {
  it('produce un PDF válido sin estado ni abonos', async () => {
    const bytes = await generarPdfFactura(
      { ...FACTURA, numeroFactura: 'COT-20260925-001', estado: '', anticipo: 0, abonos: undefined },
      {},
      { tipo: 'cotizacion' }
    )

    expect(esPdf(bytes)).toBe(true)
  })

  it('sale distinto a la factura del mismo contenido', async () => {
    // El título, el pie y los totales cambian: si el tipo se ignorara,
    // los dos archivos serían iguales salvo por la fecha de creación.
    const base = { ...FACTURA, anticipo: 0, abonos: [] }
    const factura = await generarPdfFactura(base)
    const cotizacion = await generarPdfFactura(base, {}, { tipo: 'cotizacion' })

    expect(Math.abs(factura.length - cotizacion.length)).toBeGreaterThan(20)
  })

  it('nombra el archivo con el número de la cotización', () => {
    expect(nombreArchivoCotizacion('COT-20260925-001')).toBe('Cotizacion-COT-20260925-001.pdf')
  })
})
