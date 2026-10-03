'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Producto, TiendaCatalogo } from './tipos'

/**
 * La tienda que se muestra sola en la portada mientras el visitante no elija
 * otra: LAMINADOS Y CERAMICAS BERACA JJ. Hay varias tiendas de prueba en la
 * base, y volcarlas todas en la vitrina pública confunde a quien solo conoce
 * esta.
 *
 * Se elige por id y no por nombre: antes se buscaba "beraca" en el nombre, y
 * lo contienen dos tiendas (esta y "Beraca tienda de Don Jairo"), así que la
 * portada tomaba la primera que devolviera el filtro, que no era esta.
 *
 * Si esta tienda dejara de ser pública, no aparecería entre las del filtro y
 * la portada volvería a mostrar una muestra de todas.
 */
const TIENDA_PRINCIPAL_ID = '4fdb5356-4b10-4120-a183-c2a59979878f'

/**
 * Cuántos productos de cada tienda se enseñan en la portada.
 *
 * Es una vitrina, no el inventario: con varias tiendas y cientos de
 * productos cada una, volcarlo todo deja al visitante desplazándose sin
 * rumbo. Para ver el resto están los filtros.
 */
const POR_TIENDA_EN_PORTADA = 5

/** Cuántos se traen al filtrar, y cuántos añade cada "Ver más". */
const PRIMERA_TANDA = 9
const TANDA_SIGUIENTE = 3

/**
 * Pide el catálogo y reintenta una vez si falla.
 *
 * Es la portada de una tienda: un tropiezo de red o una conexión que el
 * pooler de la base cerró por inactividad no deberían dejar al visitante
 * mirando un mensaje de error. El estado va en el mensaje para que, si
 * vuelve a fallar, se sepa por qué.
 */
async function pedirCatalogo(params: URLSearchParams, signal?: AbortSignal) {
  const intentar = async () => {
    const res = await fetch(`/api/productos/catalogo?${params.toString()}`, { signal })
    if (!res.ok) throw new Error(`Error al cargar productos (${res.status})`)
    return res.json()
  }

  try {
    return await intentar()
  } catch (primerFallo) {
    // Una consulta cancelada no se reintenta: ya hay otra más nueva en camino.
    if (signal?.aborted) throw primerFallo
    await new Promise((seguir) => setTimeout(seguir, 600))
    if (signal?.aborted) throw primerFallo
    return intentar()
  }
}

/**
 * Productos y filtros del catálogo público.
 *
 * Los productos se piden al servidor según la categoría, la tienda y la
 * búsqueda; sin nada de eso, la portada trae una muestra por tienda.
 */
export function useCatalogo() {
  const [productos, setProductos] = useState<Producto[]>([])
  // Cuántos hay en total con los filtros puestos: es lo que dice si queda
  // algo por ver detrás del botón.
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [tiendaFiltro, setTiendaFiltro] = useState<string>('')
  const [tiendas, setTiendas] = useState<TiendaCatalogo[]>([])
  // Lo que se está buscando de verdad. Lo que hay escrito en el campo vive
  // en la página: cada tecla no debe disparar una consulta al servidor.
  const [busqueda, setBusqueda] = useState('')

  // La consulta de productos en curso. Cada una nueva cancela la anterior:
  // sin esto, si se cambiaba de categoría rápido y la primera respuesta
  // llegaba de última, se mostraban los productos de un filtro que ya no
  // estaba puesto. También cancela un "Ver más" a medias al cambiar de
  // filtro, para no añadir productos de la búsqueda anterior a la nueva.
  const consultaEnCurso = useRef<AbortController | null>(null)

  // Solo se elige la tienda principal una vez: si el visitante la cambia a
  // "todas" o a otra, no debe volver a imponérsela.
  const tiendaPorDefectoAplicada = useRef(false)

  // Los filtros se piden aparte de los productos —la portada trae solo unos
  // pocos por tienda— y se rehacen cada vez que cambia una selección, para
  // que cada lista muestre solo lo que combina con la otra.
  useEffect(() => {
    // Igual que con los productos: al cambiar la selección, la consulta
    // anterior se cancela para que no pise a la nueva si llega después.
    const control = new AbortController()

    const cargarFiltros = async () => {
      try {
        const params = new URLSearchParams()
        if (categoriaFiltro) params.set('categoria', categoriaFiltro)
        if (tiendaFiltro) params.set('tienda', tiendaFiltro)

        const res = await fetch(`/api/productos/catalogo/filtros?${params.toString()}`, {
          signal: control.signal,
        })
        if (!res.ok) return

        const datos = await res.json()
        if (control.signal.aborted) return
        const nuevasCategorias: string[] = datos.categorias || []
        const nuevasTiendas: TiendaCatalogo[] = datos.tiendas || []

        setCategorias(nuevasCategorias)
        setTiendas(nuevasTiendas)

        // Si lo elegido dejó de existir en la otra lista, se limpia: si no,
        // el desplegable mostraría una opción que ya no da resultados.
        if (categoriaFiltro && !nuevasCategorias.includes(categoriaFiltro)) {
          setCategoriaFiltro('')
        }
        if (tiendaFiltro && !nuevasTiendas.some((t) => t.id === tiendaFiltro)) {
          setTiendaFiltro('')
        }

        // Primera carga sin nada elegido: se acota a la tienda principal en
        // vez de dejar ver la mezcla de todas (incluidas las de prueba).
        if (!tiendaFiltro && !tiendaPorDefectoAplicada.current) {
          tiendaPorDefectoAplicada.current = true
          const principal = nuevasTiendas.find((t) => t.id === TIENDA_PRINCIPAL_ID)
          if (principal) setTiendaFiltro(principal.id)
        }
      } catch {
        // Sin filtros el catálogo sigue viéndose; solo no se puede acotar.
        // Una cancelación también cae aquí, y tampoco hay nada que mostrar.
      }
    }

    cargarFiltros()
    return () => control.abort()
  }, [categoriaFiltro, tiendaFiltro])

  /**
   * Trae productos del servidor.
   *
   * Con `reiniciar` empieza de cero; sin él añade la tanda siguiente a lo
   * que ya se está viendo, que es lo que hace el botón "Ver más".
   */
  const cargarProductos = async ({ reiniciar = false } = {}) => {
    // Empezar de cero cancela lo que hubiera en curso. "Ver más" se cuelga
    // de la consulta actual, para que un cambio de filtro también lo corte.
    if (reiniciar) {
      consultaEnCurso.current?.abort()
      consultaEnCurso.current = new AbortController()
    } else if (!consultaEnCurso.current || consultaEnCurso.current.signal.aborted) {
      consultaEnCurso.current = new AbortController()
    }
    const { signal } = consultaEnCurso.current

    if (reiniciar) setLoading(true)
    else setCargandoMas(true)
    setError(null)

    const desde = reiniciar ? 0 : productos.length

    try {
      const params = new URLSearchParams()
      if (categoriaFiltro) params.set('categoria', categoriaFiltro)
      if (tiendaFiltro) params.set('tienda', tiendaFiltro)
      if (busqueda) params.set('busqueda', busqueda)

      // Sin filtros ni búsqueda, la portada enseña una muestra de cada
      // tienda en vez de volcar el inventario de todas.
      if (!categoriaFiltro && !tiendaFiltro && !busqueda) {
        params.set('limitePorTienda', String(POR_TIENDA_EN_PORTADA))
      } else {
        params.set('limite', String(reiniciar ? PRIMERA_TANDA : TANDA_SIGUIENTE))
        params.set('desde', String(desde))
      }

      const datos = await pedirCatalogo(params, signal)
      if (signal.aborted) return

      setProductos(reiniciar ? datos.productos : [...productos, ...datos.productos])
      setTotal(datos.total)
    } catch (err) {
      // Cancelada a propósito: no es un error, y la consulta que la
      // reemplazó ya está mostrando su propio estado de carga.
      if (signal.aborted) return
      setError(err instanceof Error ? err.message : 'Error al cargar productos')
      console.error('Error:', err)
    } finally {
      if (!signal.aborted) {
        setLoading(false)
        setCargandoMas(false)
      }
    }
  }

  // cargarProductos cambia en cada render (lee `productos` para el "Ver
  // más"): como evento de efecto, el efecto de abajo depende solo de los
  // filtros y no vuelve a cargar sin fin.
  const empezarDeCero = useEffectEvent(() => {
    cargarProductos({ reiniciar: true })
  })

  // Al cambiar de filtro o de búsqueda se vuelve a empezar desde la primera
  // tanda: si no, se pediría la página 3 de un listado que ahora tiene dos.
  useEffect(() => {
    empezarDeCero()
    return () => consultaEnCurso.current?.abort()
  }, [categoriaFiltro, tiendaFiltro, busqueda])

  return {
    productos,
    total,
    loading,
    cargandoMas,
    error,
    categorias,
    categoriaFiltro,
    setCategoriaFiltro,
    tiendas,
    tiendaFiltro,
    setTiendaFiltro,
    busqueda,
    setBusqueda,
    /** La portada enseña una muestra por tienda mientras no haya nada elegido ni buscado. */
    esMuestra: !categoriaFiltro && !tiendaFiltro && !busqueda,
    verMas: () => cargarProductos(),
  }
}
