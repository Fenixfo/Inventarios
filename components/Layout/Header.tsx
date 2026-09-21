'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface HeaderProps {
  showNav?: boolean
  compact?: boolean
  showLogo?: boolean
}

export function Header({ showNav = true, compact = false, showLogo = true }: HeaderProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // El cliente de Supabase se carga aparte del bundle inicial. Importarlo
  // arriba obliga a cada visitante del catálogo a descargar y ejecutar toda
  // la librería de autenticación antes de ver la página, solo para decidir
  // si el botón dice "Ingresar" o muestra el menú de la sesión.
  useEffect(() => {
    let cancelado = false
    let desuscribir: (() => void) | undefined

    import('@/lib/supabase-client')
      .then(async ({ supabase }) => {
        if (cancelado) return

        const { data: { session } } = await supabase.auth.getSession()
        if (cancelado) return

        setUser(session?.user)
        setLoading(false)

        const { data } = supabase.auth.onAuthStateChange((_event, sesion) => {
          setUser(sesion?.user)
        })
        desuscribir = () => data.subscription?.unsubscribe()
      })
      .catch(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
      desuscribir?.()
    }
  }, [])

  const handleLogout = async () => {
    const { supabase } = await import('@/lib/supabase-client')
    await supabase.auth.signOut()
    router.push('/')
  }

  if (compact) {
    return (
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          {showLogo && (
            <Link href="/" className="flex items-center gap-1 group whitespace-nowrap">
              <span className="text-2xl group-hover:scale-110 transition-transform inline-block">🏠</span>
              <span className="text-white font-bold text-lg">Home</span>
            </Link>
          )}
          {!showLogo && <div />}

          <nav className="flex items-center gap-6">
            {!loading && user && (
              <>
                <Link
                  href="/admin"
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium transition-colors flex items-center gap-2"
                >
                  <span>✓</span>
                  Panel de administración
                </Link>
                <div className="flex items-center gap-3 border-l border-blue-500 pl-6">
                  <span className="text-white text-sm">
                    {user.email}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
            {!loading && !user && (
              <Link
                href="/login"
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-medium transition-colors"
              >
                Ingresar
              </Link>
            )}
            {loading && (
              <span className="text-white">Cargando...</span>
            )}
          </nav>
        </div>
      </header>
    )
  }

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {showLogo && (
          <Link href="/" className="flex items-center gap-1 group whitespace-nowrap">
            <span className="text-2xl group-hover:scale-110 transition-transform inline-block">🏠</span>
            <span className="text-white font-bold text-lg">Home</span>
          </Link>
        )}
        {!showLogo && <div />}

        <nav className="flex items-center gap-8">
          {!loading && user && (
            <div className="flex items-center gap-3 border-l border-blue-500 pl-8">
              <span className="text-white text-sm">
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-5 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
