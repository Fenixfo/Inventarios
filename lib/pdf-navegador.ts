'use client'

import { apiFetch } from '@/lib/api-client'

/**
 * Abrir y compartir el PDF de una factura o cotización desde el navegador.
 *
 * Estaba copiado en el detalle de factura y en el de cotización.
 */

/**
 * Abre el PDF en una pestaña nueva, en el visor del navegador: desde ahí se
 * ve, se imprime o se guarda.
 *
 * La pestaña se abre en el mismo clic, antes de pedir el archivo: si se
 * abriera después de esperar al servidor, el navegador la bloquearía como
 * ventana emergente. Por eso esta función se llama directo desde el clic.
 */
export async function abrirPdfEnPestana(ruta: string, aviso = 'Generando el documento…'): Promise<void> {
  const ventana = window.open('', '_blank')
  if (!ventana) throw new Error('Permite las ventanas emergentes para ver el documento')
  ventana.document.title = aviso

  try {
    const res = await apiFetch(ruta)
    if (!res.ok) throw new Error('No se pudo generar el PDF')

    const url = URL.createObjectURL(await res.blob())
    ventana.location.href = url
    // El visor necesita la dirección mientras carga; se libera después.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    ventana.close()
    throw err
  }
}

/**
 * Comparte el PDF con el menú del sistema, o lo descarga si el navegador no
 * sabe compartir archivos.
 *
 * En el celular se elige WhatsApp y el contacto, y va el PDF adjunto: es la
 * única forma de mandar el archivo sin pagar la API de WhatsApp. En
 * computador casi ningún navegador comparte archivos, así que se descarga y
 * se adjunta a mano.
 *
 * Cancelar el menú de compartir lanza un error con `name === 'AbortError'`.
 */
export async function compartirPdf(ruta: string, nombre: string): Promise<'compartido' | 'descargado'> {
  const res = await apiFetch(ruta)
  if (!res.ok) throw new Error('No se pudo generar el PDF')

  const blob = await res.blob()
  const archivo = new File([blob], nombre, { type: 'application/pdf' })

  // canShare con archivos distingue un celular capaz de entregarle el PDF a
  // WhatsApp de un navegador que solo sabe bajarlo.
  if (navigator.canShare?.({ files: [archivo] })) {
    await navigator.share({ files: [archivo], title: nombre })
    return 'compartido'
  }

  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
  return 'descargado'
}
