'use client'

import Link from 'next/link'
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

interface GrupoMenu {
  id: string
  label: string
  icono: string
  items: MenuItem[]
}

function EnlaceMenu({ item, activo }: { item: MenuItem; activo: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={activo ? 'page' : undefined}
      className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium no-underline transition"
      style={
        activo
          ? { backgroundColor: 'var(--gold)', color: 'var(--black-primary)', fontWeight: 600 }
          : { color: '#D0D0D0' }
      }
      onMouseEnter={(e) => {
        if (!activo) {
          e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.1)'
          e.currentTarget.style.color = 'var(--gold)'
        }
      }}
      onMouseLeave={(e) => {
        if (!activo) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.color = '#D0D0D0'
        }
      }}
    >
      <span>{item.icono || '📌'}</span>
      {item.label}
    </Link>
  )
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
  // El grupo que el usuario abrió o cerró a mano, atado a la ruta en la que lo
  // hizo (null en `grupo` = todos cerrados).
  const [eleccionManual, setEleccionManual] = useState<{ ruta: string; grupo: string | null } | null>(null)

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

  // El Dashboard va siempre suelto; el resto, en grupos desplegables.
  const dashboard: MenuItem = { label: 'Dashboard', href: '/admin', icono: '📊' } // Visible para todos

  const grupos: GrupoMenu[] = [
    {
      id: 'catalogo',
      label: 'Catálogo',
      icono: '📦',
      items: [
        { label: 'Productos', href: '/admin/productos', permiso: 'productos.ver', icono: '📦' },
        { label: 'Categorías', href: '/admin/categorias', permiso: 'productos.ver', icono: '🗂️' },
        { label: 'Inventario', href: '/admin/inventario', permiso: 'inventario.ver', icono: '🔄' },
      ],
    },
    {
      id: 'ventas',
      label: 'Ventas',
      icono: '🧾',
      items: [
        { label: 'Clientes', href: '/admin/clientes', permiso: 'clientes.ver', icono: '👥' },
        { label: 'Facturas', href: '/admin/facturas', permiso: 'facturas.ver', icono: '📄' },
        { label: 'Cotizaciones', href: '/admin/cotizaciones', permiso: 'cotizaciones.ver', icono: '📝' },
        { label: 'Reportes', href: '/admin/reportes', permiso: 'reportes.ver', icono: '📈' },
        { label: 'Liquidaciones', href: '/admin/reportes/liquidaciones', permiso: 'liquidaciones.ver', icono: '💼' },
        { label: 'Auditoría', href: '/admin/auditoria', permiso: 'auditoria.ver', icono: '🔍' },
      ],
    },
    // Debajo de Ventas y encima de Administración (donde está Configuración).
    {
      id: 'compras',
      label: 'Compras',
      icono: '🛒',
      items: [
        { label: 'Compras', href: '/admin/compras', permiso: 'compras.ver', icono: '🧾' },
        { label: 'Proveedores', href: '/admin/proveedores', permiso: 'compras.ver', icono: '🚚' },
      ],
    },
    {
      id: 'administracion',
      label: 'Administración',
      icono: '⚙️',
      items: [
        { label: 'Solicitudes de Acceso', href: '/admin/solicitudes-acceso', permiso: 'solicitudes-acceso.ver', icono: '✋' },
        { label: 'Gestión de Usuarios', href: '/admin/usuarios', permiso: 'usuarios.ver', icono: '👨‍💼' },
        { label: 'Configuración', href: '/admin/configuracion', permiso: 'configuracion.ver', icono: '⚙️' },
      ],
    },
  ]

  // El menú se arma con los permisos del contexto: ya están cargados y no
  // hace falta volver a pedirlos en cada navegación.
  const { datos } = usePermisos()
  const permisos = datos?.permisos || []
  const esAdmin = Boolean(datos?.administraTienda)
  const userEmail = datos?.email || null

  const puedeVer = (item: MenuItem) => !item.permiso || esAdmin || permisos.includes(item.permiso)

  // Un grupo solo sale si hay algo que el usuario pueda ver dentro.
  const gruposVisibles = grupos
    .map((grupo) => ({ ...grupo, items: grupo.items.filter(puedeVer) }))
    .filter((grupo) => grupo.items.length > 0)

  const visibles = [dashboard, ...gruposVisibles.flatMap((grupo) => grupo.items)]

  // Se toma el href más específico que calce (el más largo), para que rutas
  // anidadas como /admin/reportes/liquidaciones no dejen resaltados a la vez
  // a "Reportes" y a "Liquidaciones".
  const itemActivo = [...visibles]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) =>
        pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'))
    )

  const seccionActual = itemActivo?.label || 'Panel'

  // Acordeón: solo un grupo abierto a la vez. Por defecto está abierto el de
  // la sección en la que se está; lo que el usuario abre o cierra a mano vale
  // hasta que cambia de ruta, y entonces vuelve a mandar la sección actual.
  const grupoActivo = gruposVisibles.find((g) => g.items.some((i) => i.href === itemActivo?.href))?.id ?? null
  const grupoAbierto = eleccionManual?.ruta === pathname ? eleccionManual.grupo : grupoActivo

  const alternarGrupo = (id: string) =>
    setEleccionManual({ ruta: pathname, grupo: grupoAbierto === id ? null : id })

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
      {/* Barra superior: a la izquierda el burger (móvil) y el título de la
          sección; a la derecha, el menú de tienda/cuenta. El correo y el
          cerrar sesión viven ahí, no aquí: tenerlos en los dos sitios era
          mostrar dos botones de salir a la vez. */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 md:pl-8"
        style={{
          backgroundColor: 'var(--black-primary)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          color: 'white',
        }}
      >
        <button
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-white md:hidden"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
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

      <div className="flex min-h-screen" style={{ backgroundColor: 'var(--beige-light)' }}>
        {/* Fondo oscuro al abrir el cajón */}
        {menuAbierto && (
          <div
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
          />
        )}

        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[270px] max-w-[85vw] overflow-y-auto p-5
            transition-transform duration-300
            md:static md:z-auto md:w-[260px] md:max-w-none md:translate-x-0
            ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}
          `}
          style={{ backgroundColor: 'var(--black-primary)', color: 'white' }}
        >
          <div className="mb-6 flex items-center justify-between gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-lg p-2 text-lg font-bold no-underline transition hover:bg-white/10"
              style={{ color: 'white' }}
            >
              <span style={{ color: 'var(--gold)' }}>◆</span>
              Beraca
            </Link>

            <button
              onClick={() => setMenuAbierto(false)}
              aria-label="Cerrar menú"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-2xl leading-none text-white md:hidden"
            >
              ×
            </button>
          </div>

          <nav className="flex flex-col gap-2">
            <EnlaceMenu item={dashboard} activo={dashboard.href === itemActivo?.href} />

            {gruposVisibles.map((grupo) => {
              const abierto = grupoAbierto === grupo.id
              // El grupo de la sección actual se marca aunque esté cerrado,
              // para saber dónde se está sin abrirlo.
              const contieneActivo = grupo.id === grupoActivo

              return (
                <div key={grupo.id}>
                  <button
                    onClick={() => alternarGrupo(grupo.id)}
                    aria-expanded={abierto}
                    aria-controls={`grupo-${grupo.id}`}
                    className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition hover:bg-white/10"
                    style={{ color: contieneActivo ? 'var(--gold)' : '#D0D0D0' }}
                  >
                    <span>{grupo.icono}</span>
                    <span className="flex-1">{grupo.label}</span>
                    <span
                      aria-hidden
                      style={{ transition: 'transform 0.2s', transform: abierto ? 'rotate(90deg)' : 'none' }}
                    >
                      ›
                    </span>
                  </button>

                  {abierto && (
                    <div id={`grupo-${grupo.id}`} className="mt-1 ml-3 flex flex-col gap-1 border-l border-white/15 pl-2">
                      {grupo.items.map((item) => (
                        <EnlaceMenu key={item.href} item={item} activo={item.href === itemActivo?.href} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="admin-main min-w-0 flex-1 p-5">
          {children}
        </main>
      </div>
    </AdminProtector>
  )
}
