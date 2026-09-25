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
  /**
   * Tienda en la que se está trabajando. Sale de la cabecera `x-tienda-id`
   * y solo si el usuario pertenece a esa tienda; si no, es la primera.
   */
  tienda: AccesoTienda | null
}

/**
 * Cabecera con la que el cliente indica en qué tienda está trabajando.
 *
 * Es una preferencia, nunca una credencial: el servidor comprueba que el
 * usuario pertenezca a la tienda antes de usarla, así que mandar el
 * identificador de una tienda ajena no da acceso a nada.
 */
export const CABECERA_TIENDA = 'x-tienda-id'

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

/**
 * Elige la tienda activa entre las del usuario.
 *
 * Solo se acepta la pedida si el usuario pertenece a ella. Una tienda ajena
 * en la cabecera se ignora en silencio y se cae al valor por defecto.
 *
 * Sin cabecera se entra a la tienda donde la persona puede trabajar: su
 * propio negocio antes que uno donde solo es vendedora, y cualquiera con
 * permisos antes que una donde se los quitaron. Entrar siempre a la más
 * antigua dejaba a alguien mirando "no tienes permiso" en todas las
 * pantallas mientras su tienda estaba a un clic, sin ninguna pista.
 */
export function elegirTienda(
  tiendas: AccesoTienda[],
  pedida: string | null
): AccesoTienda | null {
  if (pedida) {
    const elegida = tiendas.find((t) => t.tiendaId === pedida)
    if (elegida) return elegida
  }

  if (tiendas.length <= 1) return tiendas[0] || null

  // A igualdad de nivel gana la primera, que vienen ordenadas por
  // antigüedad: así la elección es estable entre peticiones.
  const porCapacidad = [...tiendas].sort((a, b) => nivel(b) - nivel(a))
  return porCapacidad[0]
}

/** Cuánto puede hacer alguien en una tienda, para elegir dónde entrar. */
function nivel(acceso: AccesoTienda): number {
  if (acceso.esOwner) return 1000
  if (acceso.esAdmin) return 500
  return acceso.permisos.length
}

export async function usuarioDePeticion(
  request: Request
): Promise<UsuarioAutenticado | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const pedida = request.headers.get(CABECERA_TIENDA)

  // El caché guarda los accesos del usuario, no la tienda activa: la misma
  // persona puede cambiar de tienda entre dos peticiones con el mismo token.
  const enCache = leerCache(token)
  if (enCache) {
    return { ...enCache, tienda: elegirTienda(enCache.tiendas, pedida) }
  }

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
        // Sin un orden explícito, "la primera tienda" la decide la base y
        // puede cambiar entre dos peticiones: quien trabaje en dos tiendas
        // vería sus datos alternarse sin tocar nada.
        orderBy: { createdAt: 'asc' },
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

  const resultado: UsuarioAutenticado = {
    id: usuario.id,
    email: usuario.email,
    tiendas,
    tienda: elegirTienda(tiendas, pedida),
  }

  guardarCache(token, resultado)
  return resultado
}

/**
 * Identificador de la tienda activa, listo para usar en un `where`.
 *
 * Sin tienda no hay nada que consultar: es alguien con sesión pero sin
 * acceso a ninguna, y devolver todo sería justo el problema que esto evita.
 */
export function tiendaDe(usuario: UsuarioAutenticado | null): string | null {
  return usuario?.tienda?.tiendaId || null
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

/**
 * Como `exigirPermiso`, pero además devuelve la tienda activa ya resuelta.
 *
 * Es lo que usan los endpoints de datos: todos tienen que filtrar por
 * tienda, y así el identificador viene comprobado en lugar de sacarlo cada
 * uno por su cuenta.
 */
export async function exigirTienda(
  request: Request,
  permisos: string | string[]
): Promise<
  | { usuario: UsuarioAutenticado; tiendaId: string; error: null }
  | { usuario: null; tiendaId: null; error: Response }
> {
  const { usuario, error } = await exigirPermiso(request, permisos)
  if (error) return { usuario: null, tiendaId: null, error }

  const tiendaId = tiendaDe(usuario)
  if (!tiendaId) {
    return {
      usuario: null,
      tiendaId: null,
      error: Response.json(
        { error: 'No tienes ninguna tienda asignada' },
        { status: 403 }
      ),
    }
  }

  return { usuario, tiendaId, error: null }
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
