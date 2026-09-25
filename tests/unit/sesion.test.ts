import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordarSesion,
  sesionRecordada,
  duracionSesionMs,
  marcarInicioSesion,
  olvidarSesion,
  sesionRestanteMs,
  describirDuracion,
  DURACION_CORTA_MS,
  DURACION_LARGA_MS,
} from '@/lib/sesion'

describe('preferencia de mantener la sesión', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // Desmarcada por defecto: el computador del mostrador lo usa más de una
  // persona, y dejar la sesión abierta ahí es lo peligroso.
  it('por defecto la sesión no se mantiene', () => {
    expect(sesionRecordada()).toBe(false)
    expect(duracionSesionMs()).toBe(DURACION_CORTA_MS)
  })

  it('marcarla alarga la duración', () => {
    recordarSesion(true)

    expect(sesionRecordada()).toBe(true)
    expect(duracionSesionMs()).toBe(DURACION_LARGA_MS)
  })

  it('desmarcarla vuelve a la jornada corta', () => {
    recordarSesion(true)
    recordarSesion(false)

    expect(sesionRecordada()).toBe(false)
    expect(duracionSesionMs()).toBe(DURACION_CORTA_MS)
  })

  it('la larga es de verdad más larga, y ninguna es infinita', () => {
    expect(DURACION_LARGA_MS).toBeGreaterThan(DURACION_CORTA_MS)
    expect(Number.isFinite(DURACION_LARGA_MS)).toBe(true)
  })
})

describe('cuánto le queda a la sesión', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('recién iniciada le queda toda la duración', () => {
    const ahora = 1_000_000
    marcarInicioSesion(ahora)

    expect(sesionRestanteMs(ahora)).toBe(DURACION_CORTA_MS)
  })

  it('va descontando el tiempo transcurrido', () => {
    const ahora = 1_000_000
    marcarInicioSesion(ahora)

    const unaHora = 60 * 60 * 1000
    expect(sesionRestanteMs(ahora + unaHora)).toBe(DURACION_CORTA_MS - unaHora)
  })

  it('pasada la duración no queda nada', () => {
    const ahora = 1_000_000
    marcarInicioSesion(ahora)

    expect(sesionRestanteMs(ahora + DURACION_CORTA_MS + 1)).toBe(0)
  })

  it('con la casilla marcada aguanta más que la jornada corta', () => {
    const ahora = 1_000_000
    recordarSesion(true)
    marcarInicioSesion(ahora)

    expect(sesionRestanteMs(ahora + DURACION_CORTA_MS + 1)).toBeGreaterThan(0)
    expect(sesionRestanteMs(ahora + DURACION_LARGA_MS + 1)).toBe(0)
  })

  // Quien ya estaba dentro antes de que esto existiera no tiene marca: se
  // le empieza a contar ahora en vez de echarlo de golpe.
  it('sin marca de inicio no cierra la sesión: la empieza', () => {
    const ahora = 1_000_000

    expect(sesionRestanteMs(ahora)).toBe(DURACION_CORTA_MS)
    // Y queda registrada, así que la siguiente comprobación ya descuenta.
    expect(sesionRestanteMs(ahora + 1000)).toBe(DURACION_CORTA_MS - 1000)
  })

  it('olvidarla reinicia el conteo', () => {
    const ahora = 1_000_000
    marcarInicioSesion(ahora)
    olvidarSesion()

    expect(sesionRestanteMs(ahora + DURACION_CORTA_MS * 2)).toBe(DURACION_CORTA_MS)
  })

  // Cerrar sesión no debería obligar a volver a marcar la casilla en el
  // celular propio.
  it('olvidar la sesión conserva la preferencia', () => {
    recordarSesion(true)
    marcarInicioSesion()
    olvidarSesion()

    expect(sesionRecordada()).toBe(true)
  })
})

describe('describirDuracion', () => {
  it('habla en horas cuando son pocas', () => {
    expect(describirDuracion(DURACION_CORTA_MS)).toBe('6 horas')
  })

  it('habla en días cuando son muchas', () => {
    expect(describirDuracion(DURACION_LARGA_MS)).toBe('30 días')
  })
})
