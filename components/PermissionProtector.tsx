'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

interface PermissionProtectorProps {
  requiredPermission: string
  children: React.ReactNode
}

export function PermissionProtector({ requiredPermission, children }: PermissionProtectorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasPermission, setHasPermission] = useState(false)

  useEffect(() => {
    const checkPermission = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
          router.replace('/login')
          return
        }

        // Sincronizar usuario y obtener permisos
        const res = await fetch('/api/auth/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: session.user.id,
            email: session.user.email,
          }),
        })

        if (!res.ok) {
          router.replace('/login')
          return
        }

        const data = await res.json()
        const usuarioData = data.usuario

        // Verificar si el usuario es Owner (por el rol "admin" legacy)
        const esOwner = usuarioData.roles?.includes('admin')

        if (esOwner) {
          setHasPermission(true)
          setLoading(false)
          return
        }

        // Para usuarios no-owner, obtener permisos personalizados
        const usuarioRes = await fetch('/api/debug/usuario-actual?email=' + encodeURIComponent(session.user.email!))
        if (!usuarioRes.ok) {
          router.replace('/admin')
          return
        }

        const usuario = await usuarioRes.json()

        // Verificar si tiene el permiso requerido
        const tienePermiso = usuario.rolesPersonalizados?.some((ur: any) =>
          ur.rol.permisos.some((p: any) => p.modulo.modulo === requiredPermission)
        )

        if (tienePermiso) {
          setHasPermission(true)
        } else {
          router.replace('/admin')
        }
      } catch (error) {
        console.error('Error checking permission:', error)
        router.replace('/admin')
      } finally {
        setLoading(false)
      }
    }

    checkPermission()
  }, [requiredPermission, router])

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Verificando permisos...
      </div>
    )
  }

  if (!hasPermission) {
    return null
  }

  return <>{children}</>
}
