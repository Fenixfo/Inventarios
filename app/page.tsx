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
}

export default function Catalogo() {
  const { carrito, agregarAlCarrito } = useCart()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [cantidadModal, setCantidadModal] = useState('1')
  // Ficha ampliada: se abre al pulsar la tarjeta y es independiente del
  // pop-up de cantidad, que sigue saliendo desde el botón del carrito.
  const [detalle, setDetalle] = useState<Producto | null>(null)

  useEffect(() => {
    cargarProductos()
  }, [categoriaFiltro])

  const cargarProductos = async () => {
    setLoading(true)
    setError(null)

    try {
      const url = categoriaFiltro
        ? `/api/productos/catalogo?categoria=${categoriaFiltro}`
        : '/api/productos/catalogo'

      const res = await fetch(url)
      if (!res.ok) throw new Error('Error al cargar productos')

      const data = await res.json()
      setProductos(data)

      // Extraer categorías únicas en la primera carga
      if (!categoriaFiltro && categorias.length === 0) {
        const cats = Array.from(new Set(data.map((p: Producto) => p.categoria)))
        setCategorias(cats as string[])
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(precio)
  }

  const abrirModalAgregar = (producto: Producto) => {
    setProductoSeleccionado(producto)
    setCantidadModal('1')
    setDetalle(null)
    setModalAbierto(true)
  }

  const confirmarAgregar = () => {
    if (productoSeleccionado) {
      const cantidad = parseFloat(cantidadModal) || 1
      if (cantidad > 0) {
        agregarAlCarrito(productoSeleccionado, cantidad)
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
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4">
          {/* Botón del carrito */}
          <div className="flex justify-end mb-6">
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
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Catálogo de Productos
            </h1>
            <p className="text-xl text-gray-600">
              Baldosas, cerámicas y porcelanatos de alta calidad
            </p>
          </div>

          {/* Filtro por categoría */}
          <div className="bg-white p-6 rounded-lg shadow mb-8">
            <p className="font-semibold text-gray-700 mb-4">Filtrar por categoría:</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setCategoriaFiltro('')}
                className={`px-4 py-2 rounded font-medium transition ${
                  categoriaFiltro === ''
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Todas
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFiltro(cat)}
                  className={`px-4 py-2 rounded font-medium transition capitalize ${
                    categoriaFiltro === cat
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

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

          {/* Grid de productos */}
          {!loading && productos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {productos.map((producto) => (
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

          {/* Sin productos */}
          {!loading && productos.length === 0 && !error && (
            <div className="text-center py-12 text-gray-600">
              <p className="text-lg">No hay productos disponibles en esta categoría</p>
            </div>
          )}
        </div>

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
