import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CompraPage from '@/app/admin/compras/[id]/page'

const apiFetch = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'compra-1' }) }))

vi.mock('@/components/PermissionProtector', () => ({
  PermissionProtector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let permisos: string[] = []
vi.mock('@/components/PermisosProvider', () => ({
  usePermisos: () => ({ puede: (p: string) => permisos.includes(p) }),
}))

const respuesta = (ok: boolean, cuerpo: unknown, status = ok ? 200 : 400) => ({ ok, status, json: async () => cuerpo })

const COMPRA = {
  id: 'compra-1',
  fecha: '2026-10-03T12:00:00.000Z',
  numeroFacturaProveedor: 'F-100',
  estado: 'registrada',
  metodoReparto: 'valor',
  observaciones: 'Entrega en bodega',
  proveedor: { id: 'prov-1', nombre: 'Cerámicas del Norte', nit: '900123' },
  autor: 'comprador@tienda.co',
  subtotal: 32000,
  totalExtras: 1400,
  total: 33400,
  anuladaPor: null,
  anuladaEn: null,
  motivoAnulacion: null,
  costosExtra: [{ id: 'e1', concepto: 'Flete', valor: 1400 }],
  items: [
    { id: 'i1', productoId: 'prod-1', sku: 'BAL-2', productoNombre: 'Baldosa 2', productoCreado: false, cantidad: 10, precioFactura: 2000, costoExtra: 875, costoFinal: 2087.5, costoEditado: false },
    { id: 'i2', productoId: 'prod-2', sku: 'NUE-1', productoNombre: 'Producto nuevo', productoCreado: true, cantidad: 4, precioFactura: 3000, costoExtra: 525, costoFinal: 3200, costoEditado: true },
  ],
}

function simular(opciones: { compra?: object | null; anular?: () => ReturnType<typeof respuesta> } = {}) {
  let actual = opciones.compra === undefined ? COMPRA : opciones.compra
  apiFetch.mockImplementation(async (url: string) => {
    if (url === '/api/compras/compra-1') {
      return actual ? respuesta(true, actual) : respuesta(false, { error: 'Compra no encontrada' }, 404)
    }
    if (url === '/api/compras/compra-1/anular') {
      const r = opciones.anular!()
      if (r.ok) actual = { ...COMPRA, estado: 'anulada', motivoAnulacion: 'Factura duplicada', anuladaPor: 'admin@tienda.co', anuladaEn: '2026-10-04T15:00:00.000Z' }
      return r
    }
    throw new Error(`Ruta no simulada: ${url}`)
  })
}

beforeEach(() => {
  apiFetch.mockReset()
  permisos = ['compras.ver']
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('detalle de una compra', () => {
  it('muestra proveedor, líneas con precio de factura y costo final, extras y totales', async () => {
    simular()
    render(<CompraPage />)

    expect(await screen.findByText(/Compra a Cerámicas del Norte/)).toBeInTheDocument()
    expect(screen.getByText(/Factura F-100/)).toBeInTheDocument()
    expect(screen.getByText('Baldosa 2')).toBeInTheDocument()
    expect(screen.getByText(/creado en esta compra/)).toBeInTheDocument()
    expect(screen.getByText('ajustado a mano')).toBeInTheDocument()
    expect(screen.getByText('Flete')).toBeInTheDocument()
    expect(screen.getByText('Entrega en bodega', { exact: false })).toBeInTheDocument()
    // Cada producto enlaza a su ficha.
    expect(screen.getByRole('link', { name: 'Baldosa 2' })).toHaveAttribute('href', '/admin/productos/prod-1')
  })

  it('una compra que no existe muestra el mensaje y no rompe', async () => {
    simular({ compra: null })
    render(<CompraPage />)
    expect(await screen.findByText('Compra no encontrada')).toBeInTheDocument()
  })

  it('el botón de anular solo aparece con compras.anular', async () => {
    simular()
    const { unmount } = render(<CompraPage />)
    await screen.findByText(/Compra a Cerámicas del Norte/)
    expect(screen.queryByRole('button', { name: 'Anular compra' })).toBeNull()
    unmount()

    permisos = ['compras.ver', 'compras.anular']
    simular()
    render(<CompraPage />)
    expect(await screen.findByRole('button', { name: 'Anular compra' })).toBeInTheDocument()
  })

  it('una compra ya anulada no ofrece anular y muestra el motivo', async () => {
    permisos = ['compras.ver', 'compras.anular']
    simular({ compra: { ...COMPRA, estado: 'anulada', motivoAnulacion: 'Mal registrada', anuladaPor: 'admin@tienda.co', anuladaEn: '2026-10-04T15:00:00.000Z' } })
    render(<CompraPage />)

    expect(await screen.findByText(/Mal registrada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular compra' })).toBeNull()
  })

  it('no anula sin motivo', async () => {
    permisos = ['compras.ver', 'compras.anular']
    simular({ anular: () => respuesta(true, { estado: 'anulada' }) })
    render(<CompraPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Anular compra' }))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))

    expect(screen.getByText('Escribe el motivo de la anulación.')).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalledWith('/api/compras/compra-1/anular', expect.anything())
  })

  it('al anular manda el motivo, avisa de revisar los costos y marca la compra como anulada', async () => {
    permisos = ['compras.ver', 'compras.anular']
    simular({ anular: () => respuesta(true, { estado: 'anulada', revisarCostos: true }) })
    render(<CompraPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Anular compra' }))
    await userEvent.type(screen.getByLabelText('Motivo *'), 'Factura duplicada')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))

    expect(await screen.findByText(/Revisa el costo de los/)).toBeInTheDocument()
    const [, opciones] = apiFetch.mock.calls.find(([url]) => url === '/api/compras/compra-1/anular')!
    expect(JSON.parse(opciones.body)).toEqual({ motivo: 'Factura duplicada' })
    await waitFor(() => expect(screen.getByText('ANULADA')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Anular compra' })).toBeNull()
  })

  it('si falta stock porque ya se vendió, muestra el mensaje del servidor y la compra sigue registrada', async () => {
    permisos = ['compras.ver', 'compras.anular']
    const mensaje = 'No se puede anular: ya no hay stock suficiente porque se vendió. Baldosa 2 (BAL-2): faltan 7'
    simular({ anular: () => respuesta(false, { error: mensaje, tipo: 'stock_insuficiente' }, 409) })
    render(<CompraPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Anular compra' }))
    await userEvent.type(screen.getByLabelText('Motivo *'), 'Error')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))

    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(screen.queryByText('ANULADA')).toBeNull()
  })

  it('si se cancela la confirmación no se llama a la API', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    permisos = ['compras.ver', 'compras.anular']
    simular({ anular: () => respuesta(true, {}) })
    render(<CompraPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Anular compra' }))
    await userEvent.type(screen.getByLabelText('Motivo *'), 'Cualquiera')
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }))

    expect(apiFetch).not.toHaveBeenCalledWith('/api/compras/compra-1/anular', expect.anything())
  })
})
