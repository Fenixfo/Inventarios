'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { usePermisos } from '@/components/PermisosProvider'

/**
 * Comprueba que haya sesión y que el usuario tenga acceso a alguna tienda.
 *
 * Los permisos vienen del contexto, que ya los cargó: antes este componente
 * llamaba a sync-user en cada navegación, y ese endpoint tardaba unos tres
 * segundos contra la base remota.
 */
export function AdminProtector({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { datos, cargando } = usePermisos()

  useEffect(() => {
    const revisarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.replace('/login')
    }

    revisarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!session) router.replace('/login')
    })

    return () => subscription?.unsubscribe()
  }, [router])

  useEffect(() => {
    // Sin tiendas asignadas no hay nada que mostrar en el panel: el usuario
    // existe pero todavía no le dieron acceso.
    if (!cargando && datos && datos.tiendas.length === 0) {
      router.replace('/request-access')
    }
  }, [cargando, datos, router])

  if (cargando) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        Cargando...
      </div>
    )
  }

  if (!datos || datos.tiendas.length === 0) {
    return null
  }

  return <>{children}</>
}
