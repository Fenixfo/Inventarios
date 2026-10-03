import { describe, it, expect } from 'vitest'
import { puedeAlguno, type AccesoTienda, type UsuarioAutenticado } from '@/lib/permisos'
import {
  PERMISOS_SUBIR_POR_CARPETA,
  puedeBorrarImagen,
  rutaReciente,
  VENTANA_BORRADO_COMPRAS_MS,
} from '@/lib/imagen-permisos'

function usuario(permisos: string[], extra: Partial<AccesoTienda> = {}): UsuarioAutenticado {
  const acceso: AccesoTienda = { tiendaId: 't1', tiendaNombre: 't1', esOwner: false, esAdmin: false, permisos, ...extra }
  return { id: 'u1', email: 'a@b.co', tiendas: [acceso], tienda: acceso }
}

/** Una ruta como la que genera la subida: productos/<hora en base 36>-<azar>.<ext> */
const rutaDe = (cuando: number, ext = 'png') => `productos/${cuando.toString(36)}-ab12cd.${ext}`

const AHORA = Date.UTC(2026, 9, 3, 15, 0, 0)

describe('subir imágenes', () => {
  const puedeSubir = (u: UsuarioAutenticado, carpeta: string) => puedeAlguno(u, PERMISOS_SUBIR_POR_CARPETA[carpeta] ?? [])

  it('quien registra compras puede subir imágenes de productos', () => {
    expect(puedeSubir(usuario(['compras.crear']), 'productos')).toBe(true)
  })

  it('quien solo puede ver compras o nada no puede subirlas', () => {
    expect(puedeSubir(usuario(['compras.ver']), 'productos')).toBe(false)
    expect(puedeSubir(usuario([]), 'productos')).toBe(false)
  })

  it('crear o editar productos sigue abriendo la carpeta de productos', () => {
    expect(puedeSubir(usuario(['productos.crear']), 'productos')).toBe(true)
    expect(puedeSubir(usuario(['productos.editar']), 'productos')).toBe(true)
  })

  it('la carpeta de logos no cambia: la abre solo configuracion.editar', () => {
    expect(puedeSubir(usuario(['compras.crear', 'productos.crear']), 'logos')).toBe(false)
    expect(puedeSubir(usuario(['configuracion.editar']), 'logos')).toBe(true)
  })

  it('una carpeta que no existe no tiene permisos', () => {
    expect(PERMISOS_SUBIR_POR_CARPETA['otra']).toBeUndefined()
  })
})

describe('rutaReciente', () => {
  it('acepta una imagen subida hace unos minutos', () => {
    expect(rutaReciente(rutaDe(AHORA - 5 * 60_000), AHORA)).toBe(true)
  })

  it('rechaza una imagen subida hace más de una hora', () => {
    expect(rutaReciente(rutaDe(AHORA - VENTANA_BORRADO_COMPRAS_MS - 1000), AHORA)).toBe(false)
  })

  it('acepta una subida con unos segundos de diferencia de reloj, pero no una del futuro lejano', () => {
    expect(rutaReciente(rutaDe(AHORA + 10_000), AHORA)).toBe(true)
    expect(rutaReciente(rutaDe(AHORA + 10 * 60_000), AHORA)).toBe(false)
  })

  it('rechaza rutas con otra forma, incluidos intentos de salirse de la carpeta', () => {
    for (const ruta of [
      'productos/../logos/abc-def.png',
      'logos/' + (AHORA).toString(36) + '-ab12cd.png',
      `productos/${AHORA.toString(36)}-ab12cd.gif`,
      `productos/sub/${AHORA.toString(36)}-ab12cd.png`,
      'productos/',
      '',
    ]) {
      expect(rutaReciente(ruta, AHORA)).toBe(false)
    }
  })
})

describe('borrar imágenes', () => {
  const vieja = rutaDe(AHORA - 3 * 24 * 60 * 60_000)
  const nueva = rutaDe(AHORA - 2 * 60_000)

  it('quien solo registra compras borra únicamente imágenes recién subidas', () => {
    const comprador = usuario(['compras.crear'])
    expect(puedeBorrarImagen(comprador, nueva, AHORA)).toBe(true)
    expect(puedeBorrarImagen(comprador, vieja, AHORA)).toBe(false)
  })

  it('quien edita productos borra cualquier imagen de productos, como antes', () => {
    const editor = usuario(['productos.editar'])
    expect(puedeBorrarImagen(editor, vieja, AHORA)).toBe(true)
    expect(puedeBorrarImagen(editor, nueva, AHORA)).toBe(true)
  })

  it('sin permisos no se borra nada, ni siquiera lo reciente', () => {
    expect(puedeBorrarImagen(usuario([]), nueva, AHORA)).toBe(false)
    expect(puedeBorrarImagen(usuario(['compras.ver']), nueva, AHORA)).toBe(false)
    expect(puedeBorrarImagen(null, nueva, AHORA)).toBe(false)
  })

  it('un comprador no puede borrar logos, aunque la ruta parezca reciente', () => {
    const comprador = usuario(['compras.crear'])
    expect(puedeBorrarImagen(comprador, `logos/${(AHORA - 60_000).toString(36)}-ab12cd.png`, AHORA)).toBe(false)
    expect(puedeBorrarImagen(comprador, 'productos/../logos/x.png', AHORA)).toBe(false)
  })

  it('los logos solo los borra quien edita la configuración', () => {
    const logo = `logos/${(AHORA - 60_000).toString(36)}-ab12cd.png`
    expect(puedeBorrarImagen(usuario(['configuracion.editar']), logo, AHORA)).toBe(true)
    expect(puedeBorrarImagen(usuario(['productos.editar']), logo, AHORA)).toBe(false)
  })

  it('el dueño o administrador pasa cualquier comprobación', () => {
    expect(puedeBorrarImagen(usuario([], { esAdmin: true }), vieja, AHORA)).toBe(true)
  })
})
