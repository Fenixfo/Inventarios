/**
 * Comprime imágenes en el navegador antes de subirlas.
 *
 * Una foto de celular ronda los 4 MB y 4000 px de ancho, cuando en el
 * catálogo se muestra a 300 px. Reducirla a 1200 px y convertirla a WebP
 * la deja en ~150 KB, sin diferencia visible en pantalla.
 */

const ANCHO_MAXIMO = 1200
const ALTO_MAXIMO = 1200
const CALIDAD = 0.85

export interface ResultadoCompresion {
  archivo: File
  pesoOriginal: number
  pesoFinal: number
  ancho: number
  alto: number
}

function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('El archivo no es una imagen válida'))
    }

    img.src = url
  })
}

function calcularMedidas(ancho: number, alto: number) {
  if (ancho <= ANCHO_MAXIMO && alto <= ALTO_MAXIMO) return { ancho, alto }

  const escala = Math.min(ANCHO_MAXIMO / ancho, ALTO_MAXIMO / alto)
  return {
    ancho: Math.round(ancho * escala),
    alto: Math.round(alto * escala),
  }
}

function aBlob(canvas: HTMLCanvasElement, tipo: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, CALIDAD))
}

export async function comprimirImagen(archivo: File): Promise<ResultadoCompresion> {
  if (!archivo.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen')
  }

  const img = await cargarImagen(archivo)
  const { ancho, alto } = calcularMedidas(img.naturalWidth, img.naturalHeight)

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen en este navegador')

  ctx.drawImage(img, 0, 0, ancho, alto)

  // WebP pesa bastante menos que JPEG a igual calidad, pero si el navegador
  // no lo soporta devuelve otro formato o null: en ese caso se usa JPEG.
  let blob = await aBlob(canvas, 'image/webp')
  let extension = 'webp'

  if (!blob || blob.type !== 'image/webp') {
    blob = await aBlob(canvas, 'image/jpeg')
    extension = 'jpg'
  }

  if (!blob) throw new Error('No se pudo comprimir la imagen')

  const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.' + extension

  return {
    archivo: new File([blob], nombre, { type: blob.type }),
    pesoOriginal: archivo.size,
    pesoFinal: blob.size,
    ancho,
    alto,
  }
}

export function formatearPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
