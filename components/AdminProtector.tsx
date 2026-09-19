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

        // Sincronizar usuario y obtener roles de BD
        console.log('🔍 AdminProtector: Sincronizando usuario...', session.user.id)

        const res = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            email: session.user.email,
          }),
        })

        console.log('Response status:', res.status)

        if (res.ok) {
          const data = await res.json()
          console.log('Response data:', data)

          const hasAdminRole = data.usuario.roles.includes('admin')
          const hasTiendas = data.usuario.tiendas && data.usuario.tiendas.length > 0
          console.log('Has admin role:', hasAdminRole)
          console.log('Has tiendas:', hasTiendas)

          if (hasAdminRole || hasTiendas) {
            console.log('✅ Acceso permitido')
            setIsAdmin(true)
          } else {
            console.log('❌ No tiene acceso a ninguna tienda')
            router.replace('/request-access')
          }
        } else {
          console.log('❌ Error en sync-user:', res.status)
          router.replace('/request-access')
        }
      } catch (error) {
        console.error('Error checking auth:', error)
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        router.replace('/login')
      } else {
        try {
          console.log('🔄 Auth state changed, checking permissions...')

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
            console.log('User roles:', data.usuario.roles)

            const hasAdminRole = data.usuario.roles.includes('admin')
            const hasTiendas = data.usuario.tiendas && data.usuario.tiendas.length > 0
            if (hasAdminRole || hasTiendas) {
              console.log('✅ User has admin role or tiendas')
              setIsAdmin(true)
              setSession(session)
            } else {
              console.log('❌ User does not have access')
              router.replace('/request-access')
            }
          } else {
            console.log('❌ Failed to get user roles')
            router.replace('/request-access')
          }
        } catch (error) {
          console.error('Error checking auth:', error)
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
