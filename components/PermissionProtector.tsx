'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermisos } from '@/components/PermisosProvider'

interface Props {
  children: React.ReactNode
  requiredPermission: string
}

/**
 * Deja pasar solo a quien tenga el permiso indicado.
 *
 * Lee del contexto, que ya cargó los permisos al entrar al panel: antes cada
 * pantalla hacía su propia consulta y la navegación esperaba a la red.
 */
export function PermissionProtector({ children, requiredPermission }: Props) {
  const router = useRouter()
  const { datos, cargando, puede } = usePermisos()

  const autorizado = puede(requiredPermission)

  useEffect(() => {
    // Solo se decide cuando los permisos ya están cargados; si no, se
    // expulsaría a todos durante el primer instante.
    if (!cargando && datos && !autorizado) {
      router.replace('/admin')
    }
  }, [cargando, datos, autorizado, router])

  if (cargando) {
    return <div style={{ padding: '20px', color: '#666' }}>Verificando permisos...</div>
  }

  if (!autorizado) {
    return (
      <div style={{ padding: '20px', color: '#666' }}>
        No tienes permiso para ver esta sección.
      </div>
    )
  }

  return <>{children}</>
}
