'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'

export function Header() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user)
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user)
      }
    )

    return () => subscription?.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          Beraca
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            Catálogo
          </Link>

          {!loading && (
            <>
              {user ? (
                <>
                  <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                    Admin
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <Link href="/login" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Ingresar
                </Link>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
