'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { POR_PAGINA } from '@/lib/paginacion'

/**
 * Carga un listado del panel de 10 en 10.
 *
 * `filtros` son los parámetros de la consulta (búsqueda, categoría...): al
 * cambiar alguno se vuelve a empezar desde la primera página. Los vacíos no
 * se envían.
 *
 * `clave` es el nombre de la lista dentro de la respuesta
 * (`{ productos, total }` → 'productos').
 */
export function useListaPaginada<T extends { id: string }>(
  ruta: string,
  clave: string,
  filtros: Record<string, string> = {}
) {
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La respuesta completa de la primera página, por si trae algo más que
  // la lista (las categorías para el filtro, por ejemplo).
  const [primera, setPrimera] = useState<any>(null)

  // Subirlo vuelve a cargar desde la primera página: tras registrar algo,
  // lo nuevo tiene que aparecer arriba.
  const [vuelta, setVuelta] = useState(0)
  const recargar = useCallback(() => setVuelta((v) => v + 1), [])

  // Como texto y no como objeto: un objeto nuevo en cada render volvería a
  // disparar la consulta sin que haya cambiado nada.
  const consulta = new URLSearchParams(
    Object.entries(filtros).filter(([, valor]) => valor)
  ).toString()

  const pedir = useCallback(
    async (desde: number) => {
      const params = new URLSearchParams(consulta)
      params.set('limite', String(POR_PAGINA))
      params.set('desde', String(desde))

      const res = await apiFetch(`${ruta}?${params.toString()}`)
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(datos.error || 'No se pudo cargar el listado')

      return datos
    },
    [ruta, consulta]
  )

  useEffect(() => {
    let cancelado = false

    setCargando(true)
    setError(null)

    pedir(0)
      .then((datos) => {
        if (cancelado) return
        setItems(datos[clave] || [])
        setTotal(Number(datos.total) || 0)
        setPrimera(datos)
      })
      .catch((err) => {
        if (!cancelado) setError(err.message)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
  }, [pedir, clave, vuelta])

  const verMas = async () => {
    setCargandoMas(true)
    setError(null)

    try {
      const datos = await pedir(items.length)
      const nuevos: T[] = datos[clave] || []

      // Si alguien añadió un registro entre dos páginas, el último de la
      // anterior vuelve a salir en esta; se descarta para no repetirlo.
      setItems((previos) => {
        const vistos = new Set(previos.map((p) => p.id))
        return [...previos, ...nuevos.filter((n) => !vistos.has(n.id))]
      })
      setTotal(Number(datos.total) || 0)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargandoMas(false)
    }
  }

  return {
    items,
    total,
    cargando,
    cargandoMas,
    error,
    verMas,
    recargar,
    hayMas: items.length < total,
    primera,
  }
}
