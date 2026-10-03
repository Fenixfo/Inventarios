import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProveedoresPage from '@/app/admin/proveedores/page'
import ComprasPage from '@/app/admin/compras/page'

// --- Lo que rodea a las pantallas se sustituye ---

const apiFetch = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

vi.mock('@/components/PermissionProtector', () => ({
  PermissionProtector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let permisos: string[] = []
vi.mock('@/components/PermisosProvider', () => ({
  usePermisos: () => ({ puede: (p: string) => permisos.includes(p) }),
}))

// La lista paginada hace la consulta; aquí se le dan los datos y se mira con qué filtros se pidió.
const listaProveedores = { items: [] as unknown[], total: 0, recargar: vi.fn() }
const listaCompras = { items: [] as unknown[], total: 0 }
const llamadasLista: { ruta: string; filtros: Record<string, string> }[] = []

vi.mock('@/lib/use-lista-paginada', () => ({
  useListaPaginada: (ruta: string, _clave: string, filtros: Record<string, string> = {}) => {
    llamadasLista.push({ ruta, filtros })
    const base = ruta === '/api/proveedores' ? listaProveedores : listaCompras
    return {
      items: base.items,
      total: base.total,
      cargando: false,
      cargandoMas: false,
      error: null,
      verMas: vi.fn(),
      hayMas: false,
      recargar: 'recargar' in base ? (base as typeof listaProveedores).recargar : vi.fn(),
      primera: null,
    }
  },
}))

// El selector de proveedor del filtro de compras tiene su propia prueba.
vi.mock('@/components/compras/SelectorProveedor', () => ({
  SelectorProveedor: ({ onChange }: { onChange: (p: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ id: 'prov-7', nombre: 'Filtrado', nit: null })}>
      Filtrar por proveedor
    </button>
  ),
}))

const respuesta = (ok: boolean, cuerpo: unknown) => ({ ok, json: async () => cuerpo })

const PROVEEDOR = { id: 'p1', nombre: 'Cerámicas del Norte', nit: '900123', telefono: '3001234567', email: 'v@norte.co', direccion: null }

beforeEach(() => {
  apiFetch.mockReset()
  llamadasLista.length = 0
  listaProveedores.items = []
  listaProveedores.total = 0
  listaProveedores.recargar = vi.fn()
  listaCompras.items = []
  listaCompras.total = 0
  permisos = ['compras.ver']
})

describe('pantalla de proveedores', () => {
  it('con solo compras.ver muestra la lista pero no los botones de crear ni editar', () => {
    listaProveedores.items = [PROVEEDOR]
    listaProveedores.total = 1
    render(<ProveedoresPage />)

    expect(screen.getByText('Cerámicas del Norte')).toBeInTheDocument()
    expect(screen.getByText('900123')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Nuevo proveedor' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).toBeNull()
  })

  it('con compras.crear aparecen crear y editar', () => {
    permisos = ['compras.ver', 'compras.crear']
    listaProveedores.items = [PROVEEDOR]
    listaProveedores.total = 1
    render(<ProveedoresPage />)

    expect(screen.getByRole('button', { name: '+ Nuevo proveedor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })

  it('muestra un mensaje cuando no hay proveedores', () => {
    render(<ProveedoresPage />)
    expect(screen.getByText('No hay proveedores registrados')).toBeInTheDocument()
  })

  it('crear: abre el formulario vacío, guarda con solo el nombre y recarga la lista', async () => {
    permisos = ['compras.ver', 'compras.crear']
    apiFetch.mockResolvedValue(respuesta(true, { ...PROVEEDOR, id: 'nuevo', nombre: 'Nuevo SAS', nit: null }))
    render(<ProveedoresPage />)

    await userEvent.click(screen.getByRole('button', { name: '+ Nuevo proveedor' }))
    expect(screen.getByRole('heading', { name: 'Nuevo proveedor' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nombre *'), 'Nuevo SAS')
    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }))

    await waitFor(() => expect(listaProveedores.recargar).toHaveBeenCalled())
    expect(apiFetch).toHaveBeenCalledWith('/api/proveedores', expect.objectContaining({ method: 'POST' }))
    // El formulario se cierra.
    expect(screen.queryByRole('heading', { name: 'Nuevo proveedor' })).toBeNull()
  })

  it('editar: abre el formulario con los datos, guarda con PATCH y recarga', async () => {
    permisos = ['compras.ver', 'compras.crear']
    listaProveedores.items = [PROVEEDOR]
    listaProveedores.total = 1
    apiFetch.mockResolvedValue(respuesta(true, { ...PROVEEDOR, telefono: '300' }))
    render(<ProveedoresPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Cerámicas del Norte')

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(listaProveedores.recargar).toHaveBeenCalled())
    expect(apiFetch).toHaveBeenCalledWith('/api/proveedores/p1', expect.objectContaining({ method: 'PATCH' }))
  })

  it('un NIT repetido muestra el mensaje del servidor y deja el formulario abierto', async () => {
    permisos = ['compras.ver', 'compras.crear']
    apiFetch.mockResolvedValue(respuesta(false, { error: 'Ya hay un proveedor con ese NIT en esta tienda' }))
    render(<ProveedoresPage />)

    await userEvent.click(screen.getByRole('button', { name: '+ Nuevo proveedor' }))
    await userEvent.type(screen.getByLabelText('Nombre *'), 'Repetido')
    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }))

    expect(await screen.findByText('Ya hay un proveedor con ese NIT en esta tienda')).toBeInTheDocument()
    expect(listaProveedores.recargar).not.toHaveBeenCalled()
  })
})

describe('lista de compras', () => {
  const COMPRAS = [
    { id: 'c1', fecha: '2026-10-03T12:00:00.000Z', numeroFacturaProveedor: 'F-100', estado: 'registrada', proveedor: { id: 'p1', nombre: 'Cerámicas del Norte' }, lineas: 3, total: 33400 },
    { id: 'c2', fecha: '2026-09-01T12:00:00.000Z', numeroFacturaProveedor: null, estado: 'anulada', proveedor: { id: 'p2', nombre: 'Otro proveedor' }, lineas: 1, total: 5000 },
  ]

  it('muestra las compras, con las anuladas marcadas y un enlace a cada una', () => {
    listaCompras.items = COMPRAS
    listaCompras.total = 2
    render(<ComprasPage />)

    expect(screen.getByText('Cerámicas del Norte')).toBeInTheDocument()
    expect(screen.getByText('Anulada')).toBeInTheDocument()
    expect(screen.getByText('Registrada')).toBeInTheDocument()
    const enlaces = screen.getAllByRole('link', { name: 'Ver' })
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/admin/compras/c1', '/admin/compras/c2'])
  })

  it('"Nueva compra" solo aparece con compras.crear', () => {
    const { unmount } = render(<ComprasPage />)
    expect(screen.queryByRole('link', { name: '+ Nueva compra' })).toBeNull()
    unmount()

    permisos = ['compras.ver', 'compras.crear']
    render(<ComprasPage />)
    expect(screen.getByRole('link', { name: '+ Nueva compra' })).toHaveAttribute('href', '/admin/compras/nueva')
  })

  it('sin compras muestra un mensaje, y con filtros uno distinto', async () => {
    render(<ComprasPage />)
    expect(screen.getByText('No hay compras registradas')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Filtrar por proveedor' }))
    expect(screen.getByText('No hay compras con esos filtros')).toBeInTheDocument()
  })

  it('los filtros de proveedor y de fecha llegan a la consulta y se pueden quitar', async () => {
    render(<ComprasPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Filtrar por proveedor' }))
    await userEvent.type(screen.getByLabelText('Desde'), '2026-02-01')
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-02-28')

    const ultima = llamadasLista[llamadasLista.length - 1]
    expect(ultima.ruta).toBe('/api/compras')
    expect(ultima.filtros).toEqual({ proveedorId: 'prov-7', fechaDesde: '2026-02-01', fechaHasta: '2026-02-28' })

    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(llamadasLista[llamadasLista.length - 1].filtros).toEqual({ proveedorId: '', fechaDesde: '', fechaHasta: '' })
    expect(screen.queryByRole('button', { name: 'Quitar filtros' })).toBeNull()
  })
})
