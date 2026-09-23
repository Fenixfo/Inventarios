/**
 * Límite de peticiones por IP.
 *
 * Sin esto, cualquiera con un bucle puede pedir el catálogo mil veces por
 * segundo: cada llamada es una consulta a una base que está en Oregón y se
 * paga por uso. El objetivo no es parar un ataque distribuido, sino que un
 * script suelto no tumbe el servidor ni dispare la factura.
 *
 * El contador vive en memoria. En Vercel cada instancia tiene el suyo, así
 * que el límite real es "por instancia", no global; aun así frena en seco
 * el caso que importa, que es una sola máquina insistiendo. Si algún día
 * hace falta algo exacto, el sitio natural es Redis.
 */

interface Contador {
  desde: number
  peticiones: number
}

const contadores = new Map<string, Contador>()

/** Con más de esto en memoria se limpia lo viejo, para no crecer sin fin. */
const MAXIMO_CLAVES = 10_000

export interface Limite {
  /** Peticiones permitidas en la ventana. */
  maximo: number
  /** Duración de la ventana, en milisegundos. */
  ventanaMs: number
}

/**
 * Los cuatro grupos, de más estricto a menos:
 *
 * - `registro`: crea cuentas en Supabase y filas en la base. Es la vía más
 *   cara de todas y la única que un anónimo puede usar para escribir.
 * - `sesion`: sincronizar el usuario al entrar. Va aparte del registro
 *   porque toda la tienda puede salir por una sola IP, y con el límite del
 *   registro el sexto login de la mañana se quedaría fuera.
 * - `publico`: catálogo y configuración. Los ve cualquiera, pero cada
 *   llamada consulta la base.
 * - `api`: el resto, que ya exige sesión; aquí el límite solo evita que una
 *   sesión legítima se desboque por un bucle mal hecho.
 */
export const LIMITES: Record<string, Limite> = {
  registro: { maximo: 5, ventanaMs: 60_000 },
  sesion: { maximo: 30, ventanaMs: 60_000 },
  publico: { maximo: 60, ventanaMs: 60_000 },
  api: { maximo: 180, ventanaMs: 60_000 },
}

/** Descarta las ventanas ya vencidas cuando el mapa se hace grande. */
function limpiar(ahora: number) {
  for (const [clave, contador] of contadores) {
    if (ahora - contador.desde > 300_000) contadores.delete(clave)
  }

  // Si aun así sigue lleno, se vacía entero: es preferible perder cuentas
  // a quedarse sin memoria.
  if (contadores.size > MAXIMO_CLAVES) contadores.clear()
}

export interface Resultado {
  permitido: boolean
  restantes: number
  /** Segundos que faltan para que se reinicie la ventana. */
  esperaSegundos: number
}

/**
 * Registra una petición y dice si se permite.
 *
 * `identificador` es normalmente la IP; `grupo` elige el límite.
 */
export function comprobarLimite(
  identificador: string,
  grupo: keyof typeof LIMITES | Limite,
  ahora: number = Date.now()
): Resultado {
  const limite = typeof grupo === 'string' ? LIMITES[grupo] : grupo
  const clave = `${typeof grupo === 'string' ? grupo : 'custom'}:${identificador}`

  if (contadores.size > MAXIMO_CLAVES / 2) limpiar(ahora)

  const contador = contadores.get(clave)

  if (!contador || ahora - contador.desde >= limite.ventanaMs) {
    contadores.set(clave, { desde: ahora, peticiones: 1 })
    return { permitido: true, restantes: limite.maximo - 1, esperaSegundos: 0 }
  }

  contador.peticiones += 1

  const esperaSegundos = Math.ceil((contador.desde + limite.ventanaMs - ahora) / 1000)

  if (contador.peticiones > limite.maximo) {
    return { permitido: false, restantes: 0, esperaSegundos }
  }

  return {
    permitido: true,
    restantes: limite.maximo - contador.peticiones,
    esperaSegundos,
  }
}

/** Qué límite le toca a una ruta. */
export function grupoDeRuta(pathname: string): keyof typeof LIMITES {
  if (pathname.startsWith('/api/auth/register')) {
    return 'registro'
  }
  if (pathname.startsWith('/api/auth/')) {
    return 'sesion'
  }
  if (
    pathname.startsWith('/api/productos/catalogo') ||
    pathname.startsWith('/api/configuracion/publica')
  ) {
    return 'publico'
  }
  return 'api'
}

/** Identifica al cliente. Detrás de Vercel la IP real va en x-forwarded-for. */
export function identificarCliente(cabeceras: Headers): string {
  const reenviada = cabeceras.get('x-forwarded-for')
  if (reenviada) return reenviada.split(',')[0].trim()
  return cabeceras.get('x-real-ip') || 'desconocido'
}

/** Solo para los tests: deja los contadores a cero. */
export function reiniciarLimites() {
  contadores.clear()
}
