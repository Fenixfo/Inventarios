import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SelectorProveedor } from '@/components/compras/SelectorProveedor'
import type { Proveedor } from '@/components/compras/FormularioProveedor'

const apiFetch = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

let permisos: string[] = []
vi.mock('@/components/PermisosProvider', () => ({
  usePermisos: () => ({ puede: (p: string) => permisos.includes(p) }),
}))

const respuesta = (ok: boolean, cuerpo: unknown) => ({ ok, json: async () => cuerpo })

const NORTE: Proveedor = { id: 'p1', nombre: 'Cerámicas del Norte', nit: '900123', telefono: null, email: null, direccion: null }
const SUR: Proveedor = { id: 'p2', nombre: 'Pisos del Sur', nit: null, telefono: null, email: null, direccion: null }

beforeEach(() => {
  apiFetch.mockReset()
  permisos = ['compras.crear']
})

describe('SelectorProveedor', () => {
  it('con un proveedor elegido lo muestra y "Cambiar" lo quita', async () => {
    const onChange = vi.fn()
    render(<SelectorProveedor valor={NORTE} onChange={onChange} />)

    expect(screen.getByText('Cerámicas del Norte')).toBeInTheDocument()
    expect(screen.getByText('NIT 900123')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cambiar' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('al abrirlo lista los primeros proveedores y al elegir uno lo entrega', async () => {
    apiFetch.mockResolvedValue(respuesta(true, { proveedores: [NORTE, SUR] }))
    const onChange = vi.fn()
    render(<SelectorProveedor valor={null} onChange={onChange} />)

    await userEvent.click(screen.getByLabelText('Proveedor *'))
    expect(await screen.findByText('Pisos del Sur')).toBeInTheDocument()
    // Sin texto no se manda búsqueda: se traen los primeros por orden alfabético.
    expect(apiFetch.mock.calls[0][0]).toBe('/api/proveedores?limite=8')

    await userEvent.click(screen.getByRole('button', { name: /Cerámicas del Norte/ }))
    expect(onChange).toHaveBeenCalledWith(NORTE)
  })

  it('busca en el servidor con tres letras o más, y con menos no manda la búsqueda', async () => {
    apiFetch.mockResolvedValue(respuesta(true, { proveedores: [NORTE] }))
    render(<SelectorProveedor valor={null} onChange={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Proveedor *'), 'ce')
    await waitFor(() => expect(apiFetch).toHaveBeenCalled())
    expect(apiFetch.mock.calls.at(-1)![0]).toBe('/api/proveedores?limite=8')

    await userEvent.type(screen.getByLabelText('Proveedor *'), 'r')
    await waitFor(() => expect(apiFetch.mock.calls.at(-1)![0]).toBe('/api/proveedores?limite=8&busqueda=cer'))
  })

  it('sin resultados lo dice y ofrece crear el proveedor con lo escrito', async () => {
    apiFetch.mockResolvedValue(respuesta(true, { proveedores: [] }))
    render(<SelectorProveedor valor={null} onChange={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Proveedor *'), 'Nuevo Proveedor')

    expect(await screen.findByText('No hay proveedores con ese nombre.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Crear proveedor «Nuevo Proveedor»/ })).toBeInTheDocument()
  })

  it('crear al vuelo: abre el formulario con el nombre escrito, guarda y deja el proveedor elegido', async () => {
    const creado = { ...NORTE, id: 'nuevo', nombre: 'Nuevo Proveedor', nit: null }
    apiFetch.mockImplementation(async (url: string, init?: { method?: string }) =>
      init?.method === 'POST' ? respuesta(true, creado) : respuesta(true, { proveedores: [] })
    )
    const onChange = vi.fn()
    render(<SelectorProveedor valor={null} onChange={onChange} />)

    await userEvent.type(screen.getByLabelText('Proveedor *'), 'Nuevo Proveedor')
    await userEvent.click(await screen.findByRole('button', { name: /Crear proveedor «Nuevo Proveedor»/ }))

    expect(screen.getByRole('heading', { name: 'Nuevo proveedor' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Nuevo Proveedor')

    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(creado))
  })

  it('sin compras.crear no ofrece crear proveedores', async () => {
    permisos = ['compras.ver']
    apiFetch.mockResolvedValue(respuesta(true, { proveedores: [] }))
    render(<SelectorProveedor valor={null} onChange={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('Proveedor *'))
    await screen.findByText('No hay proveedores con ese nombre.')
    expect(screen.queryByRole('button', { name: /Crear proveedor/ })).toBeNull()
  })

  it('como filtro (permitirCrear=false) tampoco ofrece crear, y usa su propio rótulo', async () => {
    apiFetch.mockResolvedValue(respuesta(true, { proveedores: [] }))
    render(<SelectorProveedor valor={null} onChange={vi.fn()} etiqueta="Proveedor" permitirCrear={false} />)

    await userEvent.click(screen.getByLabelText('Proveedor'))
    await screen.findByText('No hay proveedores con ese nombre.')
    expect(screen.queryByRole('button', { name: /Crear proveedor/ })).toBeNull()
  })

  it('si la búsqueda falla muestra el error en el desplegable', async () => {
    apiFetch.mockResolvedValue(respuesta(false, { error: 'No se pudieron obtener los proveedores' }))
    render(<SelectorProveedor valor={null} onChange={vi.fn()} />)

    await userEvent.click(screen.getByLabelText('Proveedor *'))
    expect(await screen.findByText('No se pudieron obtener los proveedores')).toBeInTheDocument()
  })
})
