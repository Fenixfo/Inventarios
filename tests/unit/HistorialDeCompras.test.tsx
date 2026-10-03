import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { HistorialDeCompras } from '@/components/compras/HistorialDeCompras'

const apiFetch = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

let permisos: string[] = []
vi.mock('@/components/PermisosProvider', () => ({
  usePermisos: () => ({ puede: (p: string) => permisos.includes(p) }),
}))

const respuesta = (ok: boolean, cuerpo: unknown) => ({ ok, json: async () => cuerpo })

const COMPRAS = [
  { compraId: 'c1', fecha: '2026-10-03T12:00:00.000Z', numeroFacturaProveedor: 'F-100', estado: 'registrada', proveedor: 'Cerámicas del Norte', cantidad: 10, precioFactura: 2000, costoFinal: 2087.5 },
  { compraId: 'c2', fecha: '2026-09-01T12:00:00.000Z', numeroFacturaProveedor: null, estado: 'anulada', proveedor: 'Otro proveedor', cantidad: 3, precioFactura: 1500, costoFinal: 1500 },
]

beforeEach(() => {
  apiFetch.mockReset()
  permisos = ['compras.ver']
})

describe('HistorialDeCompras', () => {
  it('sin permiso para ver compras no consulta nada ni muestra nada', () => {
    permisos = []
    const { container } = render(<HistorialDeCompras productoId="prod-1" />)

    expect(container).toBeEmptyDOMElement()
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('lista las compras del producto con enlace a cada una y marca las anuladas', async () => {
    apiFetch.mockResolvedValue(respuesta(true, { compras: COMPRAS }))
    render(<HistorialDeCompras productoId="prod-1" />)

    expect(await screen.findByText('Historial de compras')).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/api/productos/prod-1/compras')
    expect(screen.getByText('Cerámicas del Norte')).toBeInTheDocument()
    expect(screen.getByText('Anulada')).toBeInTheDocument()
    expect(screen.getByText('Registrada')).toBeInTheDocument()

    const enlaces = screen.getAllByRole('link')
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/admin/compras/c1', '/admin/compras/c2'])
  })

  it('muestra un estado vacío si el producto no aparece en ninguna compra', async () => {
    apiFetch.mockResolvedValue(respuesta(true, { compras: [] }))
    render(<HistorialDeCompras productoId="prod-1" />)

    expect(await screen.findByText(/todavía no aparece en ninguna compra/i)).toBeInTheDocument()
  })

  it('si la consulta falla (por ejemplo un 403) no muestra nada y no rompe la ficha', async () => {
    apiFetch.mockResolvedValue(respuesta(false, { error: 'No tienes permiso' }))
    const { container } = render(<HistorialDeCompras productoId="prod-1" />)

    await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('si la red falla tampoco rompe', async () => {
    apiFetch.mockRejectedValue(new Error('sin red'))
    const { container } = render(<HistorialDeCompras productoId="prod-1" />)

    await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
