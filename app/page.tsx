'use client'

import { Header } from '@/components/Layout/Header'
import { useCart } from '@/hooks/useCart'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Producto {
  id: string
  imagenUrl?: string | null
  nombre: string
  sku: string
  categoria: string
  dimensiones?: string | null
  color?: string | null
  acabado?: string | null
  m2PorCaja?: number | null
  precioUnitario: number
  tienda?: { id: string; nombre: string; ciudad?: string | null } | null
}

interface TiendaCatalogo {
  id: string
  nombre: string
  ciudad?: string | null
}

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
async function pedirCatalogo(params: URLSearchParams) {
  const intentar = async () => {
    const res = await fetch(`/api/productos/catalogo?${params.toString()}`)
    if (!res.ok) throw new Error(`Error al cargar productos (${res.status})`)
    return res.json()
  }

  try {
    return await intentar()
  } catch (primerFallo) {
    await new Promise((seguir) => setTimeout(seguir, 600))
    return intentar()
  }
}

export default function Catalogo() {
  const { carrito, agregarAlCarrito, tiendaDelCarrito, esDeOtraTienda, vaciarCarrito } = useCart()
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
  const [busqueda, setBusqueda] = useState('')
  // Avisa antes de mezclar tiendas en el mismo carrito.
  const [cambioDeTienda, setCambioDeTienda] = useState<Producto | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [cantidadModal, setCantidadModal] = useState('1')
  // Ficha ampliada: se abre al pulsar la tarjeta y es independiente del
  // pop-up de cantidad, que sigue saliendo desde el botón del carrito.
  const [detalle, setDetalle] = useState<Producto | null>(null)

  // Al cambiar de filtro se vuelve a empezar desde la primera tanda: si no,
  // se pediría la página 3 de un listado que ahora tiene dos.
  useEffect(() => {
    cargarProductos({ reiniciar: true })
  }, [categoriaFiltro, tiendaFiltro])

  // Los filtros se piden una sola vez y aparte de los productos: la portada
  // trae solo unos pocos por tienda, así que armarlos con eso dejaría fuera
  // categorías que sí existen.
  useEffect(() => {
    const cargarFiltros = async () => {
      try {
        const res = await fetch('/api/productos/catalogo/filtros')
        if (!res.ok) return

        const datos = await res.json()
        setCategorias(datos.categorias || [])
        setTiendas(datos.tiendas || [])
      } catch {
        // Sin filtros el catálogo sigue viéndose; solo no se puede acotar.
      }
    }

    cargarFiltros()
  }, [])

  /**
   * Trae productos del servidor.
   *
   * Con `reiniciar` empieza de cero; sin él añade la tanda siguiente a lo
   * que ya se está viendo, que es lo que hace el botón "Ver más".
   */
  const cargarProductos = async ({ reiniciar = false } = {}) => {
    if (reiniciar) setLoading(true)
    else setCargandoMas(true)
    setError(null)

    const desde = reiniciar ? 0 : productos.length

    try {
      const params = new URLSearchParams()
      if (categoriaFiltro) params.set('categoria', categoriaFiltro)
      if (tiendaFiltro) params.set('tienda', tiendaFiltro)

      // Sin filtros, la portada enseña una muestra de cada tienda en vez de
      // volcar el inventario de todas.
      if (!categoriaFiltro && !tiendaFiltro) {
        params.set('limitePorTienda', String(POR_TIENDA_EN_PORTADA))
      } else {
        params.set('limite', String(reiniciar ? PRIMERA_TANDA : TANDA_SIGUIENTE))
        params.set('desde', String(desde))
      }

      const datos = await pedirCatalogo(params)

      setProductos(reiniciar ? datos.productos : [...productos, ...datos.productos])
      setTotal(datos.total)
    } catch (err: any) {
      setError(err.message)
      console.error('Error:', err)
    } finally {
      setLoading(false)
      setCargandoMas(false)
    }
  }

  /** Sin filtros lo que se ve es una muestra, no el catálogo completo. */
  const esMuestra = !categoriaFiltro && !tiendaFiltro

  /** Sin tildes y en minúsculas, para que "cafe" encuentre "Pared Café". */
  const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  // El filtro trabaja sobre lo ya cargado: no hace falta ir al servidor por
  // cada tecla. Cada palabra debe aparecer, así "pared gris" vale aunque el
  // nombre sea "Pared Mancha Gris".
  const palabras = normalizar(busqueda.trim()).split(/\s+/).filter(Boolean)
  const productosFiltrados = palabras.length
    ? productos.filter((p) => {
        const nombre = normalizar(p.nombre)
        return palabras.every((w) => nombre.includes(w))
      })
    : productos

  const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(precio)
  }

  const abrirModalAgregar = (producto: Producto) => {
    setDetalle(null)

    // Cada tienda recibe los pedidos en su propio WhatsApp, así que un
    // carrito con productos de dos negocios no se podría enviar.
    if (esDeOtraTienda(producto.tienda?.id)) {
      setCambioDeTienda(producto)
      return
    }

    setProductoSeleccionado(producto)
    setCantidadModal('1')
    setModalAbierto(true)
  }

  /** Vacía lo que había y empieza el pedido en la tienda nueva. */
  const empezarPedidoNuevo = () => {
    if (!cambioDeTienda) return

    vaciarCarrito()
    setProductoSeleccionado(cambioDeTienda)
    setCantidadModal('1')
    setCambioDeTienda(null)
    setModalAbierto(true)
  }

  const confirmarAgregar = () => {
    if (productoSeleccionado) {
      const cantidad = parseFloat(cantidadModal) || 1
      if (cantidad > 0) {
        agregarAlCarrito(
          {
            ...productoSeleccionado,
            tiendaId: productoSeleccionado.tienda?.id,
            tiendaNombre: productoSeleccionado.tienda?.nombre,
          },
          cantidad
        )
        setModalAbierto(false)
      }
    }
  }

  // Cerrar con Escape y bloquear el scroll del fondo mientras el pop-up está abierto
  useEffect(() => {
    if (!modalAbierto) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalAbierto(false)
      if (e.key === 'Enter') confirmarAgregar()
    }

    document.addEventListener('keydown', onKeyDown)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflowPrevio
    }
  }, [modalAbierto, cantidadModal, productoSeleccionado])

  // La ficha ampliada solo se cierra con Escape: aquí Enter no confirma nada.
  useEffect(() => {
    if (!detalle) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetalle(null)
    }

    document.addEventListener('keydown', onKeyDown)
    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflowPrevio
    }
  }, [detalle])

  return (
    <>
      <Header compact={true} showLogo={false} />
      <main className="min-h-screen bg-gray-50 py-6 sm:py-12">
        <div className="max-w-7xl mx-auto px-4">
          {/* Botón del carrito. En móvil queda fijo abajo a la derecha:
              arriba obligaría a subir toda la lista para llegar a él. */}
          <div className="hidden sm:flex justify-end mb-6">
            <Link
              href="/carrito"
              className="relative bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium transition flex items-center gap-2"
            >
              🛒 Carrito
              {carrito.totalCantidad > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-red-600 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {carrito.totalCantidad}
                </span>
              )}
            </Link>
          </div>

          {/* Encabezado */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
              Catálogo de Productos
            </h1>
            <p className="text-base sm:text-xl text-gray-600">
              Baldosas, cerámicas y porcelanatos de alta calidad
            </p>
          </div>

          {/* Filtros */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow mb-6 sm:mb-8">
            <label htmlFor="buscar" className="block font-semibold text-gray-700 mb-2">
              Buscar por nombre:
            </label>
            <div className="relative mb-6">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                🔍
              </span>
              <input
                id="buscar"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: pared gris, carrara, porcelanato…"
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  // Nombre distinto al del botón del mensaje "sin
                  // resultados": dos controles con el mismo nombre se
                  // anuncian igual y no hay forma de distinguirlos.
                  aria-label="Limpiar el campo de búsqueda"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xl leading-none"
                >
                  ×
                </button>
              )}
            </div>

            {/* Listas desplegables y no botones: con muchas categorías o
                muchas tiendas, las hileras de botones empujaban los
                productos fuera de la pantalla. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="categoria" className="block font-semibold text-gray-700 mb-2">
                  Categoría
                </label>
                <select
                  id="categoria"
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white capitalize focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((cat) => (
                    <option key={cat} value={cat} className="capitalize">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* El de tiendas solo cuando hay más de una: con una sola no
                  dice nada y ocupa sitio. */}
              {tiendas.length > 1 && (
                <div>
                  <label htmlFor="tienda" className="block font-semibold text-gray-700 mb-2">
                    Tienda
                  </label>
                  <select
                    id="tienda"
                    value={tiendaFiltro}
                    onChange={(e) => setTiendaFiltro(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="">Todas las tiendas</option>
                    {tiendas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* A quién se le está comprando: el pedido va a esa tienda. */}
          {tiendaDelCarrito?.nombre && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Tu pedido es de <strong>{tiendaDelCarrito.nombre}</strong>. Para pedirle a otra
              tienda tendrás que empezar un pedido nuevo.
            </div>
          )}

          {/* Estado de carga */}
          {loading && (
            <div className="text-center py-12 text-gray-600">
              <p className="text-lg">Cargando productos...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Cuántos resultados hay, y si es una muestra o el listado entero */}
          {!loading && !error && productos.length > 0 && (
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-gray-600">
                {/* Sin filtros el total es la muestra misma, así que no
                    aporta decir "de cuántos". */}
                {esMuestra
                  ? `${productosFiltrados.length} producto${productosFiltrados.length !== 1 ? 's' : ''}`
                  : `${productosFiltrados.length} de ${total} producto${total !== 1 ? 's' : ''}`}
                {busqueda && ` para “${busqueda}”`}
              </p>

              {esMuestra && (
                <p className="text-sm text-gray-500">
                  Lo más reciente de cada tienda. Elige una categoría o una tienda para ver
                  todo.
                </p>
              )}
            </div>
          )}

          {/* Grid de productos. Lleva data-testid porque en la página hay
              más de una rejilla y las pruebas necesitan señalar esta. */}
          {!loading && productosFiltrados.length > 0 && (
            <div
              data-testid="productos"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {productosFiltrados.map((producto) => (
                <div
                  key={producto.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition transform hover:-translate-y-1 overflow-hidden flex flex-col"
                >
                  {/* Imagen y datos: pulsarlos abre la ficha ampliada.
                      Es un button para que también funcione con teclado. */}
                  <button
                    type="button"
                    onClick={() => setDetalle(producto)}
                    aria-label={`Ver detalles de ${producto.nombre}`}
                    className="text-left flex-1 flex flex-col cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-inset"
                  >
                    <div className="relative bg-gray-200 h-48 overflow-hidden flex items-center justify-center group">
                      {producto.imagenUrl ? (
                        <img
                          src={producto.imagenUrl}
                          alt={producto.nombre}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="text-4xl">📦</div>
                      )}
                      <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">
                        🔍 Ver detalles
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      {/* SKU y Categoría */}
                      <div className="mb-3 flex gap-2 flex-wrap">
                        <span className="inline-block bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                          {producto.sku}
                        </span>
                        <span className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded capitalize">
                          {producto.categoria}
                        </span>
                        {/* De qué tienda es: en el catálogo conviven varias
                            y el cliente necesita saber a quién le compra. */}
                        {tiendas.length > 1 && producto.tienda && (
                          <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            🏪 {producto.tienda.nombre}
                          </span>
                        )}
                      </div>

                      {/* Nombre */}
                      {/* h2 y no h3: el h1 es el título del catálogo y saltar
                          un nivel rompe la navegación por encabezados. */}
                      <h2 className="font-semibold text-lg text-gray-900 mb-2">
                        {producto.nombre}
                      </h2>

                      {/* Atributos */}
                      <div className="text-sm text-gray-600 space-y-1">
                        {producto.dimensiones && (
                          <p>📏 {producto.dimensiones}</p>
                        )}
                        {producto.color && (
                          <p>🎨 {producto.color}</p>
                        )}
                        {producto.acabado && (
                          <p>✨ {producto.acabado}</p>
                        )}
                        {producto.m2PorCaja && (
                          <p>📦 {producto.m2PorCaja} m² por caja</p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Precio y botón, fuera del área que abre la ficha */}
                  <div className="px-4 pb-4 border-t pt-3">
                    <p className="text-2xl font-bold text-red-600 mb-3">
                      {formatearPrecio(producto.precioUnitario)}
                    </p>
                    <button
                      onClick={() => abrirModalAgregar(producto)}
                      className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 font-medium transition"
                    >
                      🛒 Agregar al carrito
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ver más: solo al filtrar, y solo si queda algo por traer. La
              búsqueda por nombre trabaja sobre lo ya cargado, así que
              mientras hay texto escrito no tiene sentido pedir más. */}
          {!loading && !esMuestra && !busqueda && productos.length < total && (
            <div className="mt-8 text-center">
              <button
                onClick={() => cargarProductos()}
                disabled={cargandoMas}
                className="px-8 py-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400 transition"
              >
                {cargandoMas
                  ? 'Cargando...'
                  : `Ver más (quedan ${total - productos.length})`}
              </button>
            </div>
          )}

          {/* Sin productos */}
          {!loading && productosFiltrados.length === 0 && !error && (
            <div className="text-center py-12 text-gray-600">
              {busqueda ? (
                <>
                  <p className="text-lg">
                    Ningún producto coincide con “{busqueda}”
                  </p>
                  <button
                    onClick={() => setBusqueda('')}
                    className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 transition"
                  >
                    Borrar búsqueda
                  </button>
                </>
              ) : (
                <p className="text-lg">No hay productos disponibles en esta categoría</p>
              )}
            </div>
          )}
        </div>

        {/* Carrito flotante en móvil, siempre a mano */}
        <Link
          href="/carrito"
          aria-label="Ver carrito"
          className="sm:hidden fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-2xl text-white shadow-lg active:bg-red-700"
        >
          🛒
          {carrito.totalCantidad > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow-400 px-1 text-xs font-bold text-red-600">
              {carrito.totalCantidad}
            </span>
          )}
        </Link>

        {/* Mezclar tiendas en el mismo pedido */}
        {cambioDeTienda && (
          <div
            onClick={() => setCambioDeTienda(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 popup-in"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Es de otra tienda
              </h2>

              <p className="text-sm text-gray-600 mb-4">
                Tu pedido es de <strong>{tiendaDelCarrito?.nombre}</strong> y{' '}
                <strong>{cambioDeTienda.nombre}</strong> lo vende{' '}
                <strong>{cambioDeTienda.tienda?.nombre}</strong>.
              </p>

              <p className="text-sm text-gray-600 mb-6">
                Cada tienda recibe los pedidos en su propio WhatsApp, así que un pedido solo
                puede ser de una. Si sigues, se vacía lo que llevabas.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setCambioDeTienda(null)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
                >
                  Seguir con {tiendaDelCarrito?.nombre}
                </button>
                <button
                  onClick={empezarPedidoNuevo}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
                >
                  Empezar pedido nuevo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ficha ampliada del producto */}
        {detalle && (
          <div
            onClick={() => setDetalle(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={detalle.nombre}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto popup-in"
            >
              <div className="md:flex">
                {/* Imagen grande: object-contain para no recortar la pieza */}
                <div className="md:w-1/2 bg-gray-100 flex items-center justify-center p-4">
                  {detalle.imagenUrl ? (
                    <img
                      src={detalle.imagenUrl}
                      // En móvil la ficha se apila: si la foto ocupa 60vh,
                      // los datos quedan fuera de la pantalla.
                      className="max-h-[40vh] md:max-h-[60vh] w-auto max-w-full object-contain rounded-lg"
                      alt={detalle.nombre}
                    />
                  ) : (
                    <div className="py-20 text-center text-gray-400">
                      <div className="text-6xl mb-2">📦</div>
                      <p className="text-sm">Sin imagen disponible</p>
                    </div>
                  )}
                </div>

                {/* Datos */}
                <div className="md:w-1/2 p-5 sm:p-6 flex flex-col">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex gap-2 flex-wrap">
                      <span className="inline-block bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                        {detalle.sku}
                      </span>
                      <span className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded capitalize">
                        {detalle.categoria}
                      </span>
                    </div>
                    <button
                      onClick={() => setDetalle(null)}
                      aria-label="Cerrar"
                      className="text-gray-400 hover:text-gray-700 text-3xl leading-none transition -mt-2"
                    >
                      ×
                    </button>
                  </div>

                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {detalle.nombre}
                  </h2>

                  <dl className="text-sm text-gray-700 divide-y divide-gray-100 mb-6">
                    {detalle.dimensiones && (
                      <div className="flex justify-between py-2">
                        <dt className="text-gray-500">📏 Medida</dt>
                        <dd className="font-medium">{detalle.dimensiones}</dd>
                      </div>
                    )}
                    {detalle.color && (
                      <div className="flex justify-between py-2">
                        <dt className="text-gray-500">🎨 Color</dt>
                        <dd className="font-medium">{detalle.color}</dd>
                      </div>
                    )}
                    {detalle.acabado && (
                      <div className="flex justify-between py-2">
                        <dt className="text-gray-500">✨ Acabado</dt>
                        <dd className="font-medium">{detalle.acabado}</dd>
                      </div>
                    )}
                    {detalle.m2PorCaja && (
                      <div className="flex justify-between py-2">
                        <dt className="text-gray-500">📦 Metraje por caja</dt>
                        <dd className="font-medium">{detalle.m2PorCaja} m²</dd>
                      </div>
                    )}
                    <div className="flex justify-between py-2">
                      <dt className="text-gray-500">🏷️ Precio</dt>
                      <dd className="font-bold text-red-600 text-lg">
                        {formatearPrecio(detalle.precioUnitario)}
                        <span className="text-sm font-normal text-gray-600"> / m²</span>
                      </dd>
                    </div>
                  </dl>

                  <div className="flex-1" />

                  <div className="flex gap-3">
                    <button
                      onClick={() => setDetalle(null)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
                    >
                      Cerrar
                    </button>
                    <button
                      onClick={() => abrirModalAgregar(detalle)}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
                    >
                      🛒 Agregar al carrito
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para agregar al carrito */}
        {modalAbierto && productoSeleccionado && (
          <div
            onClick={() => setModalAbierto(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full popup-in"
            >
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-4 p-6 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {productoSeleccionado.nombre}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    SKU {productoSeleccionado.sku}
                    {productoSeleccionado.dimensiones && ` · ${productoSeleccionado.dimensiones}`}
                  </p>
                </div>
                <button
                  onClick={() => setModalAbierto(false)}
                  aria-label="Cerrar"
                  className="text-gray-400 hover:text-gray-700 text-3xl leading-none transition"
                >
                  ×
                </button>
              </div>

              <div className="px-6 pb-6">
                <p className="mb-5">
                  <span className="font-bold text-red-600 text-lg">
                    {formatearPrecio(productoSeleccionado.precioUnitario)}
                  </span>
                  <span className="text-sm text-gray-600"> por m²</span>
                </p>

                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ¿Cuántos m² deseas?
                </label>

                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() =>
                      setCantidadModal(
                        String(Math.max(0.5, (parseFloat(cantidadModal) || 0) - 0.5))
                      )
                    }
                    className="w-11 h-11 rounded-lg bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-700 transition"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={cantidadModal}
                    onChange={(e) => setCantidadModal(e.target.value)}
                    autoFocus
                    className="flex-1 h-11 text-center text-lg font-semibold px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                  <button
                    onClick={() =>
                      setCantidadModal(String((parseFloat(cantidadModal) || 0) + 0.5))
                    }
                    className="w-11 h-11 rounded-lg bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-700 transition"
                  >
                    +
                  </button>
                </div>

                <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3 mb-5">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-xl font-bold text-red-600">
                    {formatearPrecio(
                      (parseFloat(cantidadModal) || 0) * productoSeleccionado.precioUnitario
                    )}
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setModalAbierto(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarAgregar}
                    disabled={!(parseFloat(cantidadModal) > 0)}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition"
                  >
                    Agregar al carrito
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
