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
    { label: 'Dashboard', href: '/admin', icono: '📊' }, // Visible para todos
    { label: 'Productos', href: '/admin/productos', permiso: 'productos', icono: '📦' },
    { label: 'Clientes', href: '/admin/clientes', permiso: 'clientes', icono: '👥' },
    { label: 'Facturas', href: '/admin/facturas', permiso: 'facturas', icono: '📄' },
    { label: 'Reportes', href: '/admin/reportes', permiso: 'reportes', icono: '📈' },
    { label: 'Auditoría', href: '/admin/auditoria', permiso: 'auditoria', icono: '🔍' },
    { label: 'Solicitudes de Acceso', href: '/admin/solicitudes-acceso', permiso: 'solicitudes-acceso', icono: '✋' },
    { label: 'Gestión de Roles', href: '/admin/roles', permiso: 'roles', icono: '🎭' },
    { label: 'Gestión de Usuarios', href: '/admin/usuarios', permiso: 'usuarios', icono: '👨‍💼' },
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
        <aside style={{ width: '250px', background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', color: 'white', padding: '20px', boxShadow: '2px 0 10px rgba(0,0,0,0.1)' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '30px', padding: '10px', borderRadius: '8px', transition: 'all 0.3s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
            <div style={{ backgroundColor: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '18px' }}>🏠</div>
            <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Home</span>
          </a>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {menuItems.map((item) => {
              // Mostrar item si: no requiere permiso específico O el usuario es admin O tiene el permiso
              const debeVisualizar = !item.permiso || esAdmin || permisos.includes(item.permiso)

              return debeVisualizar ? (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'
                    e.currentTarget.style.transform = 'translateX(4px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.transform = 'translateX(0)'
                  }}
                >
                  <span>{item.icono || '📌'}</span>
                  {item.label}
                </a>
              ) : null
            })}
            <hr style={{ margin: '20px 0', borderColor: '#374151' }} />
            <div style={{ fontSize: '11px', color: '#9ca3af', padding: '10px 16px', textAlign: 'center', wordBreak: 'break-word' }}>
              👤 {userEmail}
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.3s',
                marginTop: '10px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
            >
              🚪 Cerrar Sesión
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
