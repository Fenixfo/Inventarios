'use client'

import { AdminProtector } from '@/components/AdminProtector'
import { PermisosProvider, usePermisos, invalidarPermisos } from '@/components/PermisosProvider'
import { MenuTiendas } from '@/components/Layout/MenuTiendas'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { olvidarSesion } from '@/lib/sesion'

interface MenuItem {
  label: string
  href: string
  permiso?: string
  icono?: string
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // El proveedor envuelve todo el panel: carga los permisos una vez y los
  // comparte, incluido este layout, que los usa para armar el menú.
  return (
    <PermisosProvider>
      <PanelAdmin>{children}</PanelAdmin>
    </PermisosProvider>
  )
}

function PanelAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // En móvil la barra lateral no cabe al lado del contenido, así que se
  // convierte en un cajón que se abre desde el botón de la cabecera.
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Al cambiar de sección el cajón se cierra solo: si no, taparía la
  // pantalla a la que se acaba de entrar.
  useEffect(() => {
    setMenuAbierto(false)
  }, [pathname])

  useEffect(() => {
    if (!menuAbierto) return

    const alPulsarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }

    document.addEventListener('keydown', alPulsarEscape)
    return () => document.removeEventListener('keydown', alPulsarEscape)
  }, [menuAbierto])

  const menuItems: MenuItem[] = [
    { label: 'Dashboard', href: '/admin', icono: '📊' }, // Visible para todos
    { label: 'Productos', href: '/admin/productos', permiso: 'productos.ver', icono: '📦' },
    { label: 'Inventario', href: '/admin/inventario', permiso: 'inventario.ver', icono: '🔄' },
    { label: 'Clientes', href: '/admin/clientes', permiso: 'clientes.ver', icono: '👥' },
    { label: 'Facturas', href: '/admin/facturas', permiso: 'facturas.ver', icono: '📄' },
    { label: 'Reportes', href: '/admin/reportes', permiso: 'reportes.ver', icono: '📈' },
    { label: 'Auditoría', href: '/admin/auditoria', permiso: 'auditoria.ver', icono: '🔍' },
    { label: 'Solicitudes de Acceso', href: '/admin/solicitudes-acceso', permiso: 'solicitudes-acceso.ver', icono: '✋' },
    { label: 'Gestión de Usuarios', href: '/admin/usuarios', permiso: 'usuarios.ver', icono: '👨‍💼' },
    { label: 'Configuración', href: '/admin/configuracion', permiso: 'configuracion.ver', icono: '⚙️' },
  ]

  // El menú se arma con los permisos del contexto: ya están cargados y no
  // hace falta volver a pedirlos en cada navegación.
  const { datos } = usePermisos()
  const permisos = datos?.permisos || []
  const esAdmin = Boolean(datos?.administraTienda)
  const userEmail = datos?.email || null

  const visibles = menuItems.filter(
    (item) => !item.permiso || esAdmin || permisos.includes(item.permiso)
  )

  const seccionActual =
    [...visibles]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(item.href + '/'))?.label ||
    'Panel'

  const handleLogout = async () => {
    invalidarPermisos()
    // Se borra la marca de inicio, no la preferencia: quien pidió mantener
    // la sesión en su celular no tiene por qué volver a marcar la casilla.
    olvidarSesion()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <AdminProtector>
      {/* Una sola barra superior. Antes había dos: la cabecera general y
          esta; el correo y el cerrar sesión se movieron al menú de la
          tienda, que es donde están las cosas de la cuenta. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-gray-900 px-4 py-3 text-white shadow-lg">
        <button
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xl active:bg-white/20 md:hidden"
        >
          ☰
        </button>
        {/* En escritorio la barra quedaría vacía a la izquierda: el nombre
            de la sección la equilibra y dice dónde se está. */}
        <span className="truncate font-semibold">{seccionActual}</span>

        <div className="ml-auto">
          <MenuTiendas email={userEmail} onCerrarSesion={handleLogout} />
        </div>
      </div>

      <div className="flex min-h-screen bg-gray-100">
        {/* Fondo oscuro al abrir el cajón */}
        {menuAbierto && (
          <div
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
          />
        )}

        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[270px] max-w-[85vw] overflow-y-auto p-5 text-white
            shadow-[2px_0_10px_rgba(0,0,0,0.1)] transition-transform duration-300
            md:static md:z-auto md:w-[250px] md:max-w-none md:translate-x-0
            ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}
          `}
          style={{ background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)' }}
        >
          <div className="mb-6 flex items-center justify-between gap-2">
            <a
              href="/"
              className="flex items-center gap-2 rounded-lg p-2 no-underline transition hover:bg-white/10"
            >
              <span className="rounded-md bg-white px-2 py-1 text-lg">🏠</span>
              <span className="text-base font-bold text-white">Home</span>
            </a>

            <button
              onClick={() => setMenuAbierto(false)}
              aria-label="Cerrar menú"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-2xl leading-none text-white md:hidden"
            >
              ×
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            {visibles.map((item) => {
              const activo =
                pathname === item.href ||
                (item.href !== '/admin' && pathname.startsWith(item.href + '/'))

              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-white no-underline transition hover:bg-blue-500/20 md:hover:translate-x-1 ${
                    activo ? 'bg-blue-500/25' : ''
                  }`}
                >
                  <span>{item.icono || '📌'}</span>
                  {item.label}
                </a>
              )
            })}

            {/* El correo y el cerrar sesión viven en el menú de la tienda:
                tenerlos también aquí eran dos botones de salir a la vista
                al mismo tiempo. */}
          </nav>
        </aside>

        <main className="admin-main min-w-0 flex-1 bg-gray-50 p-5">
          {children}
        </main>
      </div>
    </AdminProtector>
  )
}
