import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import AdminLayout from '@/app/admin/layout'

// El menú depende de la ruta y de los permisos; todo lo demás se sustituye.
let ruta = '/admin'
vi.mock('next/navigation', () => ({
  usePathname: () => ruta,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

let datos: { permisos: string[]; administraTienda: boolean; email: string } = {
  permisos: [],
  administraTienda: false,
  email: 'alguien@tienda.co',
}
vi.mock('@/components/PermisosProvider', () => ({
  PermisosProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePermisos: () => ({ datos, cargando: false, puede: () => true }),
  invalidarPermisos: vi.fn(),
}))

vi.mock('@/components/AdminProtector', () => ({
  AdminProtector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/Layout/MenuTiendas', () => ({ MenuTiendas: () => null }))
vi.mock('@/lib/supabase-client', () => ({ supabase: { auth: { signOut: vi.fn() } } }))
vi.mock('@/lib/sesion', () => ({ olvidarSesion: vi.fn() }))

const conPermisos = (permisos: string[], administraTienda = false) => {
  datos = { permisos, administraTienda, email: 'alguien@tienda.co' }
}

beforeEach(() => {
  ruta = '/admin'
  conPermisos([])
})

const grupoCompras = () => screen.queryByRole('button', { name: /Compras/ })

describe('menú lateral: grupo Compras', () => {
  it('con compras.ver aparece el grupo, con Compras y Proveedores', () => {
    conPermisos(['compras.ver'])
    ruta = '/admin/compras'
    render(<AdminLayout>contenido</AdminLayout>)

    expect(grupoCompras()).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Compras/ })).toHaveAttribute('href', '/admin/compras')
    expect(screen.getByRole('link', { name: /Proveedores/ })).toHaveAttribute('href', '/admin/proveedores')
  })

  it('sin compras.ver no aparece ni el grupo ni sus enlaces', () => {
    conPermisos(['productos.ver', 'facturas.ver'])
    ruta = '/admin/productos'
    render(<AdminLayout>contenido</AdminLayout>)

    expect(grupoCompras()).toBeNull()
    expect(screen.queryByRole('link', { name: /Proveedores/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Compras/ })).toBeNull()
  })

  it('con solo compras.crear o compras.anular, sin ver, el grupo tampoco aparece', () => {
    conPermisos(['compras.crear', 'compras.anular'])
    render(<AdminLayout>contenido</AdminLayout>)
    expect(grupoCompras()).toBeNull()
  })

  it('el dueño o administrador de la tienda lo ve aunque no tenga el permiso suelto', () => {
    conPermisos([], true)
    ruta = '/admin/proveedores'
    render(<AdminLayout>contenido</AdminLayout>)

    expect(grupoCompras()).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Proveedores/ })).toBeInTheDocument()
  })

  it('el grupo no aparece vacío: quien no ve nada de compras no ve el encabezado', () => {
    conPermisos(['clientes.ver'])
    render(<AdminLayout>contenido</AdminLayout>)
    expect(grupoCompras()).toBeNull()
  })

  it('en /admin/compras/nueva se resalta Compras y no Proveedores', () => {
    conPermisos(['compras.ver'])
    ruta = '/admin/compras/nueva'
    render(<AdminLayout>contenido</AdminLayout>)

    expect(screen.getByRole('link', { name: /Compras/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Proveedores/ })).not.toHaveAttribute('aria-current')
  })

  it('en el detalle de una compra se sigue resaltando Compras', () => {
    conPermisos(['compras.ver'])
    ruta = '/admin/compras/4fdb5356-4b10-4120-a183-c2a59979878f'
    render(<AdminLayout>contenido</AdminLayout>)

    expect(screen.getByRole('link', { name: /Compras/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Proveedores/ })).not.toHaveAttribute('aria-current')
  })

  it('en /admin/proveedores se resalta Proveedores y no Compras', () => {
    conPermisos(['compras.ver'])
    ruta = '/admin/proveedores'
    render(<AdminLayout>contenido</AdminLayout>)

    expect(screen.getByRole('link', { name: /Proveedores/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Compras/ })).not.toHaveAttribute('aria-current')
  })

  it('el grupo Compras queda debajo de Ventas y encima de Administración (donde está Configuración)', () => {
    conPermisos([], true) // quien administra la tienda ve todos los grupos
    render(<AdminLayout>contenido</AdminLayout>)

    const grupos = within(screen.getByRole('navigation'))
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .map((texto) => ['Catálogo', 'Ventas', 'Compras', 'Administración'].find((g) => texto.includes(g)))

    expect(grupos).toEqual(['Catálogo', 'Ventas', 'Compras', 'Administración'])
  })

  it('el título de la barra superior dice en qué sección se está', () => {
    conPermisos(['compras.ver'])
    ruta = '/admin/proveedores'
    render(<AdminLayout>contenido</AdminLayout>)

    // El mismo texto sale en el menú y en la barra superior.
    expect(screen.getAllByText('Proveedores').length).toBeGreaterThanOrEqual(2)
  })
})
