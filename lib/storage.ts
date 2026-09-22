import { comprimirImagen, type ResultadoCompresion } from '@/lib/imagen'
import { apiFetch } from '@/lib/api-client'

export interface ResultadoSubida extends ResultadoCompresion {
  url: string
  ruta: string
}

/**
 * Comprime la imagen y la sube a través de la API.
 *
 * No sube directo a Supabase a propósito: el bucket solo acepta escrituras
 * de la llave de servicio, y el endpoint comprueba que el usuario tenga el
 * permiso del módulo correspondiente. Así la regla de acceso vive en un
 * único lugar, junto al resto de permisos, y no duplicada en políticas SQL.
 */
export async function subirImagen(
  archivo: File,
  carpeta: 'productos' | 'logos'
): Promise<ResultadoSubida> {
  const comprimida = await comprimirImagen(archivo)

  const form = new FormData()
  form.append('archivo', comprimida.archivo)
  form.append('carpeta', carpeta)

  const res = await apiFetch('/api/upload/imagen', { method: 'POST', body: form })
  const datos = await res.json().catch(() => ({}))

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(datos.error || 'No tienes permiso para subir imágenes')
    }
    if (res.status === 401) {
      throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
    }
    throw new Error(datos.error || 'No se pudo subir la imagen')
  }

  return { ...comprimida, url: datos.url, ruta: datos.ruta }
}

/**
 * Borra una imagen a partir de su URL pública. Se usa al reemplazar una
 * imagen para no dejar archivos ocupando espacio del bucket.
 */
export async function borrarImagen(url: string): Promise<void> {
  const marca = '/object/public/productos/'
  const i = url.indexOf(marca)
  if (i === -1) return // No es una imagen de nuestro bucket.

  const ruta = url.slice(i + marca.length)
  await apiFetch(`/api/upload/imagen?ruta=${encodeURIComponent(ruta)}`, { method: 'DELETE' })
}
