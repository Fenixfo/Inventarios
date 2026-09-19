'use client'

import { AdminProtector } from '@/components/AdminProtector'
import { Header } from '@/components/Layout/Header'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { useState, useEffect } from 'react'

interface MenuItem {
  label: string
  href: string
  permiso?: string
  icono?: string
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [permisos, setPermisos] = useState<string[]>([])
  const [esAdmin, setEsAdmin] = useState(false)

  const menuItems: MenuItem[] = [
    { label: 'Dashboard', href: '/admin' }, // Visible para todos
    { label: 'Productos', href: '/admin/productos', permiso: 'productos' },
    { label: 'Clientes', href: '/admin/clientes', permiso: 'clientes' },
    { label: 'Facturas', href: '/admin/facturas', permiso: 'facturas' },
    { label: 'Reportes', href: '/admin/reportes', permiso: 'reportes' },
    { label: 'Auditoría', href: '/admin/auditoria', permiso: 'auditoria' },
    { label: 'Solicitudes de Acceso', href: '/admin/solicitudes-acceso', permiso: 'solicitudes-acceso' },
    { label: 'Gestión de Roles', href: '/admin/roles', permiso: 'roles' },
    { label: 'Gestión de Usuarios', href: '/admin/usuarios', permiso: 'usuarios' },
  ]

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        setUserEmail(session.user.email)

        // Obtener permisos del usuario
        try {
          const res = await fetch(`/api/debug/usuario-actual?email=${encodeURIComponent(session.user.email)}`)
          if (res.ok) {
            const usuario = await res.json()

            // Verificar si es Owner (admin)
            const esOwner = usuario.rolesPersonalizados?.some(
              (ur: any) => ur.rol.nombre === 'Owner'
            )

            if (esOwner) {
              setEsAdmin(true)
              setPermisos(['dashboard', 'productos', 'clientes', 'facturas', 'reportes', 'auditoria', 'administrador', 'roles', 'usuarios', 'solicitudes-acceso'])
            } else {
              // Obtener permisos de los roles del usuario
              const permisosUnicos = new Set<string>()
              usuario.rolesPersonalizados?.forEach((ur: any) => {
                ur.rol.permisos.forEach((p: any) => {
                  permisosUnicos.add(p.modulo.modulo)
                })
              })
              const permisosArray = Array.from(permisosUnicos)
              console.log('Roles:', usuario.rolesPersonalizados)
              console.log('Permisos obtenidos:', permisosArray)
              setPermisos(permisosArray)
            }
          }
        } catch (error) {
          console.error('Error obteniendo permisos:', error)
        }
      }
    }

    getUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <AdminProtector>
      <Header />
      <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
        <aside style={{ width: '250px', backgroundColor: '#1f2937', color: 'white', padding: '20px' }}>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {menuItems.map((item) => {
              // Mostrar item si: no requiere permiso específico O el usuario es admin O tiene el permiso
              const debeVisualizar = !item.permiso || esAdmin || permisos.includes(item.permiso)

              return debeVisualizar ? (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    color: 'white',
                    fontSize: '14px'
                  }}
                >
                  {item.label}
                </a>
              ) : null
            })}
            <hr style={{ margin: '15px 0', borderColor: '#374151' }} />
            <div style={{ fontSize: '12px', color: '#9ca3af', padding: '10px 16px' }}>
              {userEmail}
            </div>
            <button
              onClick={handleLogout}
              style={{
                padding: '10px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Cerrar Sesión
            </button>
          </nav>
        </aside>
        <main style={{ flex: 1, backgroundColor: '#f9fafb', padding: '20px' }}>
          {children}
        </main>
      </div>
    </AdminProtector>
  )
}
