'use client'

import { AdminProtector } from '@/components/AdminProtector'
import { Header } from '@/components/Layout/Header'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { useState, useEffect } from 'react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        setUserEmail(session.user.email)
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
            <a href="/admin" style={{ padding: '10px 16px', borderRadius: '4px', textDecoration: 'none', color: 'white' }}>
              Dashboard
            </a>
            <a href="/admin/productos" style={{ padding: '10px 16px', borderRadius: '4px', textDecoration: 'none', color: 'white' }}>
              Productos
            </a>
            <a href="/admin/clientes" style={{ padding: '10px 16px', borderRadius: '4px', textDecoration: 'none', color: 'white' }}>
              Clientes
            </a>
            <a href="/admin/facturas" style={{ padding: '10px 16px', borderRadius: '4px', textDecoration: 'none', color: 'white' }}>
              Facturas
            </a>
            <a href="/admin/reportes" style={{ padding: '10px 16px', borderRadius: '4px', textDecoration: 'none', color: 'white' }}>
              Reportes
            </a>
            <a href="/admin/auditoria" style={{ padding: '10px 16px', borderRadius: '4px', textDecoration: 'none', color: 'white' }}>
              Auditoría
            </a>
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
