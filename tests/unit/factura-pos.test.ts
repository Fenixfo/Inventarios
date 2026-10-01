// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { generarPdfFacturaPos, nombreArchivoFacturaPos } from '@/lib/factura-pos'
import type { FacturaPdf } from '@/lib/factura-pdf'

const FACTURA: FacturaPdf = {
  numeroFactura: '20260923-001',
  fecha: '2026-09-23T15:00:00.000Z',
  estado: 'pendiente',
  subtotal: 145000,
  descuentoMonto: 0,
  impuesto: 0,
  total: 145000,
  anticipo: 45000,
  cliente: { nombre: 'Ferretería El Sol', telefono: '3001234567' },
  items: [
    { productoNombre: 'Pared Mancha Gris', cantidadM2: 2.5, precioUnitario: 36000, subtotal: 90000 },
    { productoNombre: 'Piso Carrara', cantidadM2: 1.5, precioUnitario: 36666, subtotal: 55000 },
  ],
}

const MM = 72 / 25.4

describe('generarPdfFacturaPos', () => {
  it('produce una sola hoja de 80 mm de ancho', async () => {
    const bytes = await generarPdfFacturaPos(FACTURA, { nombre_empresa: 'Beraca' })
    const doc = await PDFDocument.load(bytes)

    expect(doc.getPageCount()).toBe(1)
    expect(doc.getPage(0).getWidth()).toBeCloseTo(80 * MM, 1)
  })

  it('crece a lo largo con más productos', async () => {
    const corta = await PDFDocument.load(await generarPdfFacturaPos(FACTURA))
    const larga = await PDFDocument.load(
      await generarPdfFacturaPos({ ...FACTURA, items: [...FACTURA.items, ...FACTURA.items, ...FACTURA.items] })
    )

    expect(larga.getPage(0).getHeight()).toBeGreaterThan(corta.getPage(0).getHeight())
  })

  it('no falla con nombres muy largos ni caracteres fuera de WinAnsi', async () => {
    const bytes = await generarPdfFacturaPos({
      ...FACTURA,
      observaciones: 'Entregar en la bodega 😀 ' + 'x'.repeat(200),
      items: [{ productoNombre: 'Porcelanato ' + 'Larguísimo'.repeat(20) + ' ✓', cantidadM2: 1, precioUnitario: 1, subtotal: 1 }],
    })

    expect(bytes.length).toBeGreaterThan(0)
  })

  it('nombra el archivo como POS', () => {
    expect(nombreArchivoFacturaPos('20260923-001')).toBe('Factura-POS-20260923-001.pdf')
  })
})
