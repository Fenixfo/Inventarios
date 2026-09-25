'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { apiFetch } from '@/lib/api-client'
import { sesionRestanteMs, olvidarSesion } from '@/lib/sesion'

/**
 * Carga los permisos una sola vez al entrar al panel y los comparte con
 * todas las pantallas.
 *
 * Antes cada página los volvía a pedir —el protector del layout y el de la
 * página, en cada navegación—, así que moverse entre secciones esperaba a
 * la red sin necesidad.
 *
 * Es caché de interfaz, no de seguridad: el servidor comprueba los permisos
 * en cada petición. Manipular lo guardado aquí no concede acceso; a lo sumo
 * muestra un botón que al pulsarlo devuelve 403.
 */

const CLAVE_PERMISOS = 'beraca.permisos'

const PERMISOS_VIGENCIA_MS = 5 * 60 * 1000 // 5 minutos

interface AccesoTienda {
  tiendaId: string
  tiendaNombre: string
  esOwner: boolean
  esAdmin: boolean
  permisos: string[]
}

interface DatosSesion {
  email: string
  permisos: string[]
  esOwner: boolean
  esAdmin: boolean
  administraTienda: boolean
  tiendas: AccesoTienda[]
}

interface Contexto {
  datos: DatosSesion | null
  cargando: boolean
  puede: (permiso: string) => boolean
  refrescar: () => Promise<void>
}

const PermisosContext = createContext<Contexto>({
  datos: null,
  cargando: true,
  puede: () => false,
  refrescar: async () => {},
})

export const usePermisos = () => useContext(PermisosContext)

function leerCache(): DatosSesion | null {
  try {
    const guardado = sessionStorage.getItem(CLAVE_PERMISOS)
    if (!guardado) return null

    const { datos, expira } = JSON.parse(guardado)
    if (Date.now() > expira) {
      sessionStorage.removeItem(CLAVE_PERMISOS)
      return null
    }
    return datos
  } catch {
    return null
  }
}

function guardarCache(datos: DatosSesion) {
  try {
    sessionStorage.setItem(
      CLAVE_PERMISOS,
      JSON.stringify({ datos, expira: Date.now() + PERMISOS_VIGENCIA_MS })
    )
  } catch {
    // Modo privado o almacenamiento lleno: se sigue sin caché.
  }
}

/** Borra el caché para que la próxima pantalla vuelva a consultar. */
export function invalidarPermisos() {
  try {
    sessionStorage.removeItem(CLAVE_PERMISOS)
  } catch {
    // Sin almacenamiento no hay nada que invalidar.
  }
}

export function PermisosProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [datos, setDatos] = useState<DatosSesion | null>(null)
  const [cargando, setCargando] = useState(true)

  const cerrarPorVencimiento = useCallback(async () => {
    invalidarPermisos()
    olvidarSesion()
    await supabase.auth.signOut()
    router.replace('/login?motivo=sesion-expirada')
  }, [router])

  const consultar = useCallback(async () => {
    const res = await apiFetch('/api/debug/usuario-actual')
    if (!res.ok) return null

    const usuario = await res.json()
    const nuevos: DatosSesion = {
      email: usuario.email,
      permisos: usuario.permisos || [],
      esOwner: Boolean(usuario.esOwner),
      esAdmin: Boolean(usuario.esAdmin),
      administraTienda: Boolean(usuario.administraTienda),
      tiendas: usuario.tiendas || [],
    }

    guardarCache(nuevos)
    setDatos(nuevos)
    return nuevos
  }, [])

  const refrescar = useCallback(async () => {
    invalidarPermisos()
    await consultar()
  }, [consultar])

  useEffect(() => {
    let cancelado = false

    const iniciar = async () => {
      if (sesionRestanteMs() <= 0) {
        await cerrarPorVencimiento()
        return
      }

      // Si hay caché vigente se usa y no se consulta: es lo que hace que
      // cambiar de sección sea inmediato.
      const enCache = leerCache()
      if (enCache) {
        if (!cancelado) {
          setDatos(enCache)
          setCargando(false)
        }
        return
      }

      await consultar()
      if (!cancelado) setCargando(false)
    }

    iniciar()

    // Comprobación periódica para cerrar la sesión aunque nadie navegue.
    const reloj = setInterval(() => {
      if (sesionRestanteMs() <= 0) cerrarPorVencimiento()
    }, 60_000)

    return () => {
      cancelado = true
      clearInterval(reloj)
    }
  }, [consultar, cerrarPorVencimiento])

  const puede = useCallback(
    (permiso: string) => {
      if (!datos) return false
      if (datos.administraTienda) return true

      const clave = permiso.includes('.') ? permiso : `${permiso}.ver`
      return datos.permisos.includes(clave)
    },
    [datos]
  )

  return (
    <PermisosContext.Provider value={{ datos, cargando, puede, refrescar }}>
      {children}
    </PermisosContext.Provider>
  )
}
