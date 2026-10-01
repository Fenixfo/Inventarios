import { createHash } from 'node:crypto'

/**
 * Las categorías son texto en `productos.categoria`, no una tabla, así que la
 * imagen de cada una se guarda en `configuracion` de la tienda.
 *
 * La clave no puede ser el nombre tal cual: `configuracion.clave` admite 100
 * caracteres y un nombre de categoría ya ocupa hasta 100. Se usa un hash
 * corto del nombre sin mayúsculas ni espacios sobrantes, así "Pisos" y
 * " pisos " son la misma categoría.
 */
export function claveImagenCategoria(categoria: string): string {
  const normalizada = categoria.trim().toLowerCase()
  return `cat_img_${createHash('sha1').update(normalizada).digest('hex').slice(0, 16)}`
}

/** Mismo criterio que el logo: solo direcciones http(s) o vacío para quitarla. */
export function urlImagenValida(url: string): boolean {
  return url === '' || /^https?:\/\/.+/.test(url)
}
