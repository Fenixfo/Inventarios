'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { apiFetch } from '@/lib/api-client'

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
        const res = await apiFetch('/api/auth/sync-user', {
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

        // Obtener permisos del usuario
        const usuarioRes = await apiFetch('/api/debug/usuario-actual?email=' + encodeURIComponent(session.user.email!))
        if (!usuarioRes.ok) {
          router.replace('/admin')
          return
        }

        const usuario = await usuarioRes.json()

        console.log('=== PermissionProtector Debug ===')
        console.log('Usuario:', usuario.email)
        console.log('Permiso requerido:', requiredPermission)
        console.log('Roles personalizados:', usuario.rolesPersonalizados)
        console.log('Permisos del usuario:', usuario.rolesPersonalizados?.flatMap((ur: any) =>
          ur.rol.permisos.map((p: any) => p.modulo.modulo)
        ))

        // Verificar si tiene el permiso requerido (whitelist estricto)
        const tienePermiso = usuario.rolesPersonalizados?.some((ur: any) =>
          ur.rol.permisos.some((p: any) => p.modulo.modulo === requiredPermission)
        )

        console.log('¿Tiene permiso?', tienePermiso)

        if (tienePermiso) {
          setHasPermission(true)
        } else {
          console.log('Acceso denegado. Redirigiendo a /admin')
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
