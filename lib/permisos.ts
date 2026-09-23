import { prisma } from '@/lib/prisma'

/**
 * Verificación de permisos.
 *
 * Los permisos son pares `módulo.acción` concedidos dentro de una tienda:
 * la misma persona puede ser administradora en una y vendedora en otra.
 * Por encima hay dos niveles que no necesitan permisos sueltos:
 *
 *   owner  — creó la tienda. Puede todo y nadie se lo puede retirar.
 *   admin  — lo nombró el owner. Puede todo, salvo tocar al owner.
 *
 * El usuario se resuelve desde el token, nunca desde un parámetro de la
 * petición: un email en la query lo puede escribir cualquiera.
 */

export interface AccesoTienda {
  tiendaId: string
  tiendaNombre: string
  esOwner: boolean
  esAdmin: boolean
  permisos: string[] // 'productos.ver', 'facturas.crear'...
}

export interface UsuarioAutenticado {
  id: string
  email: string
  tiendas: AccesoTienda[]
  /** Acceso de la tienda activa; con una sola tienda, es esa. */
  tienda: AccesoTienda | null
}

/**
 * Validar el token contra Supabase y leer los permisos cuesta dos viajes de
 * red por petición; contra una base en otra región eso son varios segundos.
 * El resultado se guarda un minuto: el token ya fue verificado de verdad la
 * primera vez, y un cambio de permisos tarda a lo sumo ese minuto en surtir
 * efecto.
 */
const CACHE_MS = 60_000
const CACHE_MAX = 500
const cache = new Map<string, { usuario: UsuarioAutenticado; expira: number }>()

function leerCache(token: string): UsuarioAutenticado | null {
  const entrada = cache.get(token)
  if (!entrada) return null

  if (entrada.expira < Date.now()) {
    cache.delete(token)
    return null
  }

  return entrada.usuario
}

function guardarCache(token: string, usuario: UsuarioAutenticado) {
  if (cache.size >= CACHE_MAX) {
    const masViejo = cache.keys().next().value
    if (masViejo) cache.delete(masViejo)
  }
  cache.set(token, { usuario, expira: Date.now() + CACHE_MS })
}

/** Deja sin efecto el caché de un usuario tras cambiarle los permisos. */
export function olvidarCache(email?: string) {
  if (!email) return cache.clear()
  for (const [token, entrada] of cache) {
    if (entrada.usuario.email === email) cache.delete(token)
  }
}

/** Extrae el email del token de Supabase consultando su API de usuario. */
async function emailDesdeToken(token: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    })
    if (!res.ok) return null

    const usuario = await res.json()
    return usuario?.email || null
  } catch {
    return null
  }
}

export async function usuarioDePeticion(
  request: Request
): Promise<UsuarioAutenticado | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const enCache = leerCache(token)
  if (enCache) return enCache

  const email = await emailDesdeToken(token)
  if (!email) return null

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      tiendas: {
        include: {
          tienda: { select: { id: true, nombre: true } },
          permisos: { include: { permiso: true } },
        },
      },
    },
  })

  if (!usuario) return null

  const tiendas: AccesoTienda[] = usuario.tiendas.map((ut) => ({
    tiendaId: ut.tiendaId,
    tiendaNombre: ut.tienda.nombre,
    esOwner: ut.esOwner,
    esAdmin: ut.esAdmin,
    permisos: ut.permisos.map((pa) => `${pa.permiso.modulo}.${pa.permiso.accion}`),
  }))

  // Mientras exista una sola tienda, la activa es esa. Cuando haya varias,
  // se elegirá por cabecera o por preferencia del usuario.
  const resultado: UsuarioAutenticado = {
    id: usuario.id,
    email: usuario.email,
    tiendas,
    tienda: tiendas[0] || null,
  }

  guardarCache(token, resultado)
  return resultado
}

/**
 * Comprueba un permiso. Acepta `'productos'` (equivale a `productos.ver`) o
 * `'productos.crear'`. Owner y administrador pasan cualquier comprobación.
 */
export function puede(
  usuario: UsuarioAutenticado | null,
  permiso: string,
  tiendaId?: string
): boolean {
  if (!usuario) return false

  const acceso = tiendaId
    ? usuario.tiendas.find((t) => t.tiendaId === tiendaId)
    : usuario.tienda

  if (!acceso) return false
  if (acceso.esOwner || acceso.esAdmin) return true

  const clave = permiso.includes('.') ? permiso : `${permiso}.ver`
  return acceso.permisos.includes(clave)
}

/** Basta con tener uno de los permisos indicados. */
export function puedeAlguno(
  usuario: UsuarioAutenticado | null,
  permisos: string[],
  tiendaId?: string
): boolean {
  return permisos.some((p) => puede(usuario, p, tiendaId))
}

/** El owner es el único al que nadie puede degradar. */
export function esOwner(usuario: UsuarioAutenticado | null, tiendaId?: string): boolean {
  const acceso = tiendaId ? usuario?.tiendas.find((t) => t.tiendaId === tiendaId) : usuario?.tienda
  return Boolean(acceso?.esOwner)
}

/** Owner o administrador: quienes pueden gestionar la tienda entera. */
export function administraTienda(
  usuario: UsuarioAutenticado | null,
  tiendaId?: string
): boolean {
  const acceso = tiendaId ? usuario?.tiendas.find((t) => t.tiendaId === tiendaId) : usuario?.tienda
  return Boolean(acceso?.esOwner || acceso?.esAdmin)
}

/**
 * ¿Puede ver las facturas de toda la tienda, o solo las suyas?
 * Es el único módulo donde el alcance se distingue: reportes siempre
 * muestra la tienda completa.
 */
export function veTodasLasFacturas(
  usuario: UsuarioAutenticado | null,
  tiendaId?: string
): boolean {
  return puede(usuario, 'facturas.ver_todas', tiendaId)
}

/**
 * Resuelve el usuario y comprueba el permiso de una vez. Devuelve la
 * respuesta de error lista para retornar, o el usuario si tiene acceso.
 */
export async function exigirPermiso(
  request: Request,
  permisos: string | string[]
): Promise<{ usuario: UsuarioAutenticado; error: null } | { usuario: null; error: Response }> {
  const usuario = await usuarioDePeticion(request)

  if (!usuario) {
    return {
      usuario: null,
      error: Response.json({ error: 'Sesión no válida' }, { status: 401 }),
    }
  }

  const lista = Array.isArray(permisos) ? permisos : [permisos]
  if (!puedeAlguno(usuario, lista)) {
    return {
      usuario: null,
      error: Response.json(
        { error: 'No tienes permiso para esta operación' },
        { status: 403 }
      ),
    }
  }

  return { usuario, error: null }
}

/** Solo comprueba que haya sesión válida, sin exigir ningún permiso. */
export async function exigirSesion(
  request: Request
): Promise<{ usuario: UsuarioAutenticado; error: null } | { usuario: null; error: Response }> {
  const usuario = await usuarioDePeticion(request)

  if (!usuario) {
    return {
      usuario: null,
      error: Response.json({ error: 'Sesión no válida' }, { status: 401 }),
    }
  }

  return { usuario, error: null }
}
