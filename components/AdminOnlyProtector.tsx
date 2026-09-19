'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { Session } from '@supabase/supabase-js'

export function AdminOnlyProtector({ children }: { children: React.ReactNode }) {
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

        // Sincronizar usuario y obtener roles de BD
        const res = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            email: session.user.email,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const hasAdminRole = data.usuario.roles.includes('admin')

          if (hasAdminRole) {
            setIsAdmin(true)
          } else {
            router.replace('/admin')
          }
        } else {
          router.replace('/login')
        }
      } catch (error) {
        console.error('Error checking auth:', error)
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
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
