'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'

/** Espera tras la última tecla antes de preguntar al servidor. */
const PAUSA_MS = 250

/**
 * Busca en el servidor mientras se escribe.
 *
 * Espera una pausa corta tras la última tecla, para no mandar una consulta
 * por letra, y cancela la anterior si llega otra: así una respuesta lenta no
 * pisa a una más nueva.
 *
 * `clave` es el nombre de la lista en la respuesta (`{ productos: [...] }`).
 */
export function useBusquedaRemota<T>(
  ruta: string,
  clave: string,
  texto: string,
  minimo = 1,
  /** Con false no consulta: por ejemplo, mientras un selector está cerrado. */
  habilitada = true
) {
  const [resultados, setResultados] = useState<T[]>([])
  const [buscando, setBuscando] = useState(false)

  const limpio = texto.trim()
  const activa = habilitada && limpio.length >= minimo

  useEffect(() => {
    if (!activa) return

    const control = new AbortController()
    const espera = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await apiFetch(`${ruta}?q=${encodeURIComponent(limpio)}`, { signal: control.signal })
        if (!res.ok) return
        const datos = await res.json()
        if (!control.signal.aborted) setResultados(datos[clave] || [])
      } catch {
        // Cancelada por una búsqueda más nueva, o sin conexión: se deja lo anterior.
      } finally {
        if (!control.signal.aborted) setBuscando(false)
      }
    }, PAUSA_MS)

    return () => {
      clearTimeout(espera)
      control.abort()
    }
  }, [ruta, clave, limpio, activa])

  // Por debajo del mínimo no hay resultados, sin esperar a la red.
  return { resultados: activa ? resultados : [], buscando: activa && buscando }
}
