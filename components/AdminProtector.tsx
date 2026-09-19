'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { Session } from '@supabase/supabase-js'

export function AdminProtector({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        setSession(session)

        // Verificar si es admin
        const userRole = session.user?.user_metadata?.role
        if (userRole === 'admin') {
          setIsAdmin(true)
        } else {
          router.replace('/')
        }
      } catch (error) {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/login')
      } else {
        const userRole = session.user?.user_metadata?.role
        if (userRole === 'admin') {
          setIsAdmin(true)
          setSession(session)
        } else {
          router.replace('/')
        }
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [router])

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Verificando autenticación...
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
