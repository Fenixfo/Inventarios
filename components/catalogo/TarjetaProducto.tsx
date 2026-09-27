'use client'

import { pesos } from '@/lib/formato'
import type { Producto } from './tipos'

interface Props {
  producto: Producto
  /** De qué tienda es: solo cuando en el catálogo conviven varias. */
  mostrarTienda: boolean
  onVerDetalle: () => void
  onAgregar: () => void
}

/** Un producto en la rejilla del catálogo. */
export function TarjetaProducto({ producto, mostrarTienda, onVerDetalle, onAgregar }: Props) {
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition transform hover:-translate-y-1 overflow-hidden flex flex-col">
      {/* Imagen y datos: pulsarlos abre la ficha ampliada.
          Es un button para que también funcione con teclado. */}
      <button
        type="button"
        onClick={onVerDetalle}
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
            {mostrarTienda && producto.tienda && (
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                🏪 {producto.tienda.nombre}
              </span>
            )}
          </div>

          {/* Nombre */}
          {/* h2 y no h3: el h1 es el título del catálogo y saltar
              un nivel rompe la navegación por encabezados. */}
          <h2 className="font-semibold text-lg text-gray-900 mb-2">{producto.nombre}</h2>

          {/* Atributos */}
          <div className="text-sm text-gray-600 space-y-1">
            {producto.dimensiones && <p>📏 {producto.dimensiones}</p>}
            {producto.color && <p>🎨 {producto.color}</p>}
            {producto.acabado && <p>✨ {producto.acabado}</p>}
            {producto.m2PorCaja && <p>📦 {producto.m2PorCaja} m² por caja</p>}
          </div>
        </div>
      </button>

      {/* Precio y botón, fuera del área que abre la ficha */}
      <div className="px-4 pb-4 border-t pt-3">
        <p className="text-2xl font-bold text-red-600 mb-3">{pesos(producto.precioUnitario)}</p>
        <button
          onClick={onAgregar}
          className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 font-medium transition"
        >
          🛒 Agregar al carrito
        </button>
      </div>
    </div>
  )
}
