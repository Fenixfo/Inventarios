'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { Header } from '@/components/Layout/Header'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      // Verificar si el usuario tiene rol admin
      const { data: roles } = await supabase
        .from('usuarios_roles')
        .select('rol')
        .eq('usuario_id', session.user.id)
        .eq('rol', 'admin')
        .single()

      if (!roles) {
        // Usuario no tiene rol admin, redirigir
        router.push('/')
        return
      }

      setAuthorized(true)
    }

    checkAuth()
  }, [router])

  if (authorized === null) {
    return (
      <>
        <Header />
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </>
    )
  }

  if (!authorized) {
    return (
      <>
        <Header />
        <div className="flex justify-center items-center min-h-screen">
          <p className="text-red-600">No tienes permisos para acceder a esta área</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      <div className="flex">
        <aside className="w-64 bg-gray-900 text-white min-h-screen p-4">
          <nav className="space-y-2">
            <a href="/admin" className="block px-4 py-2 rounded hover:bg-gray-800">
              Dashboard
            </a>
            <a href="/admin/productos" className="block px-4 py-2 rounded hover:bg-gray-800">
              Productos
            </a>
            <a href="/admin/clientes" className="block px-4 py-2 rounded hover:bg-gray-800">
              Clientes
            </a>
            <a href="/admin/facturas" className="block px-4 py-2 rounded hover:bg-gray-800">
              Facturas
            </a>
            <a href="/admin/reportes" className="block px-4 py-2 rounded hover:bg-gray-800">
              Reportes
            </a>
            <a href="/admin/configuracion" className="block px-4 py-2 rounded hover:bg-gray-800">
              Configuración
            </a>
          </nav>
        </aside>
        <main className="flex-1 bg-gray-50 p-8">
          {children}
        </main>
      </div>
    </>
  )
}
