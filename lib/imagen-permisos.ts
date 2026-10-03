import { puede, puedeAlguno, type UsuarioAutenticado } from '@/lib/permisos'

/**
 * Quién puede subir y borrar imágenes en el almacenamiento.
 *
 * Aquí no hay red ni base de datos, para poder probarlo aparte: la ruta
 * /api/upload/imagen solo resuelve al usuario y usa estas funciones.
 */

/**
 * Qué permisos abren cada carpeta al SUBIR. La foto de un producto es parte de
 * crearlo, editarlo o registrarlo en una compra; el logo es configuración de la tienda.
 */
export const PERMISOS_SUBIR_POR_CARPETA: Record<string, string[]> = {
  productos: ['productos.crear', 'productos.editar', 'compras.crear'],
  logos: ['configuracion.editar'],
}

/** Quién puede borrar CUALQUIER imagen de la carpeta. */
const PERMISOS_BORRAR_POR_CARPETA: Record<string, string[]> = {
  productos: ['productos.crear', 'productos.editar'],
  logos: ['configuracion.editar'],
}

/**
 * Quien solo puede registrar compras puede borrar únicamente imágenes recién
 * subidas: es lo que necesita para limpiar un intento que falló. La ruta no
 * dice de qué tienda es cada imagen, así que sin este límite podría borrar las
 * de cualquier producto.
 */
export const VENTANA_BORRADO_COMPRAS_MS = 60 * 60 * 1000

/**
 * ¿La ruta es de una imagen de producto subida hace menos de una hora?
 *
 * Las rutas que genera la subida son `productos/<hora en base 36>-<azar>.<ext>`:
 * de ahí sale cuándo se subió. Cualquier otra forma (incluido `..`) no cuenta.
 */
export function rutaReciente(ruta: string, ahora: number = Date.now()): boolean {
  const m = /^productos\/([a-z0-9]+)-[a-z0-9]+\.(jpg|png|webp)$/.exec(ruta)
  if (!m) return false

  const subida = parseInt(m[1], 36)
  if (!Number.isFinite(subida)) return false

  // Un minuto de margen por si los relojes no coinciden exactamente.
  return subida <= ahora + 60_000 && ahora - subida <= VENTANA_BORRADO_COMPRAS_MS
}

export function puedeBorrarImagen(
  usuario: UsuarioAutenticado | null,
  ruta: string,
  ahora: number = Date.now()
): boolean {
  const carpeta = ruta.split('/')[0]

  const completos = PERMISOS_BORRAR_POR_CARPETA[carpeta]
  if (completos && puedeAlguno(usuario, completos)) return true

  return carpeta === 'productos' && puede(usuario, 'compras.crear') && rutaReciente(ruta, ahora)
}
