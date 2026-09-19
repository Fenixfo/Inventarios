'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  userRole: string | null
}

export function useAuth() {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    userRole: null,
  })

  const fetchUserRoles = async (userId: string, email: string) => {
    try {
      const res = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email }),
      })

      if (res.ok) {
        const data = await res.json()
        return data.usuario.roles.includes('admin') ? 'admin' : null
      }
    } catch (error) {
      console.error('Error fetching user roles:', error)
    }
    return null
  }

  useEffect(() => {
    // Obtener sesión actual
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        const userRole = await fetchUserRoles(session.user.id, session.user.email!)
        setAuthState({
          session,
          user: session.user,
          loading: false,
          userRole,
        })
      } else {
        setAuthState({
          session: null,
          user: null,
          loading: false,
          userRole: null,
        })
      }
    }

    getSession()

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userRole = await fetchUserRoles(session.user.id, session.user.email!)
        setAuthState({
          session,
          user: session.user,
          loading: false,
          userRole,
        })
      } else {
        setAuthState({
          session: null,
          user: null,
          loading: false,
          userRole: null,
        })
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    router.push('/login')
  }

  const signup = async (email: string, password: string, metadata?: Record<string, any>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })

    if (error) throw error
    return data
  }

  const isAdmin = () => authState.userRole === 'admin'
  const isAuthenticated = () => !!authState.user

  return {
    ...authState,
    login,
    logout,
    signup,
    isAdmin,
    isAuthenticated,
  }
}
