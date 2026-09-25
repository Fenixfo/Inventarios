/**
 * Cuánto dura la sesión en este dispositivo.
 *
 * El tope no lo pone Supabase, que refresca el token indefinidamente, sino
 * esta aplicación: a las 6 horas obliga a volver a entrar. Para el mostrador
 * de una tienda, donde el computador es compartido, eso está bien. Para
 * quien trabaja desde su propio celular es una molestia diaria.
 *
 * De ahí la casilla al iniciar sesión: quien la marca acepta quedar dentro
 * en ese dispositivo. La decisión es por dispositivo, no por cuenta.
 */

const CLAVE_INICIO = 'beraca.sesion.inicio'
const CLAVE_RECORDAR = 'beraca.sesion.recordar'

/** Sin marcar la casilla: una jornada de trabajo. */
export const DURACION_CORTA_MS = 6 * 60 * 60 * 1000

/**
 * Marcando la casilla: un mes. No es "para siempre" a propósito — un
 * dispositivo que nadie toca en un mes es un dispositivo perdido, robado o
 * de alguien que ya no trabaja aquí.
 */
export const DURACION_LARGA_MS = 30 * 24 * 60 * 60 * 1000

/** Guarda si en este dispositivo se quiere mantener la sesión abierta. */
export function recordarSesion(recordar: boolean) {
  try {
    if (recordar) localStorage.setItem(CLAVE_RECORDAR, '1')
    else localStorage.removeItem(CLAVE_RECORDAR)
  } catch {
    // Sin almacenamiento se aplica la duración corta, que es la prudente.
  }
}

export function sesionRecordada(): boolean {
  try {
    return localStorage.getItem(CLAVE_RECORDAR) === '1'
  } catch {
    return false
  }
}

export function duracionSesionMs(): number {
  return sesionRecordada() ? DURACION_LARGA_MS : DURACION_CORTA_MS
}

/**
 * Marca cuándo empezó la sesión.
 *
 * Se guarda en `localStorage` y no en `sessionStorage`: con el segundo, el
 * reloj se reiniciaba al abrir una pestaña nueva, así que las 6 horas se
 * podían estirar indefinidamente cerrando y abriendo el navegador.
 */
export function marcarInicioSesion(ahora: number = Date.now()) {
  try {
    localStorage.setItem(CLAVE_INICIO, String(ahora))
  } catch {}
}

export function olvidarSesion() {
  try {
    localStorage.removeItem(CLAVE_INICIO)
  } catch {}
}

/**
 * Milisegundos que le quedan a la sesión, o 0 si ya venció.
 *
 * Si no hay marca de inicio —por ejemplo alguien que ya estaba dentro antes
 * de que esto existiera— se toma este momento como el comienzo en vez de
 * cerrarle la sesión de golpe.
 */
export function sesionRestanteMs(ahora: number = Date.now()): number {
  const duracion = duracionSesionMs()

  try {
    const inicio = Number(localStorage.getItem(CLAVE_INICIO))

    if (!inicio) {
      marcarInicioSesion(ahora)
      return duracion
    }

    return Math.max(0, inicio + duracion - ahora)
  } catch {
    return duracion
  }
}

/** Texto para la interfaz, sin decimales raros. */
export function describirDuracion(ms: number): string {
  const horas = Math.round(ms / (60 * 60 * 1000))
  if (horas < 48) return `${horas} horas`

  return `${Math.round(horas / 24)} días`
}
