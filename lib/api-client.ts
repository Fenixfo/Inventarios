import { supabase } from './supabase-client'

/** Dónde se recuerda la tienda en la que se está trabajando. */
const CLAVE_TIENDA_ACTIVA = 'beraca.tienda'

/**
 * Tienda activa guardada en el navegador.
 *
 * Vive en `localStorage` y no en `sessionStorage` como los permisos: si
 * alguien trabaja siempre en la misma tienda, no tiene por qué volver a
 * elegirla cada vez que abre una pestaña.
 */
export function tiendaActiva(): string | null {
  try {
    return localStorage.getItem(CLAVE_TIENDA_ACTIVA)
  } catch {
    return null
  }
}

export function fijarTiendaActiva(tiendaId: string | null) {
  try {
    if (tiendaId) localStorage.setItem(CLAVE_TIENDA_ACTIVA, tiendaId)
    else localStorage.removeItem(CLAVE_TIENDA_ACTIVA)
  } catch {
    // Sin almacenamiento el servidor usa la primera tienda del usuario.
  }
}

export async function apiFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const tienda = tiendaActiva()

  const headers = {
    ...options.headers,
    ...(token && { Authorization: `Bearer ${token}` }),
    // El servidor comprueba que el usuario pertenezca a esta tienda antes
    // de usarla, así que esto es una preferencia, no una credencial.
    ...(tienda && { 'x-tienda-id': tienda }),
  }

  return fetch(url, {
    ...options,
    headers,
  })
}
