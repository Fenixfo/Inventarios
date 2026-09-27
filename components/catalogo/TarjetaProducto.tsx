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
    <div
      className="rounded-lg shadow hover:shadow-lg transition transform hover:-translate-y-1 overflow-hidden flex flex-col"
      style={{ backgroundColor: 'var(--white-off)', border: '1px solid var(--gray-light)' }}
    >
      {/* Imagen y datos: pulsarlos abre la ficha ampliada.
          Es un button para que también funcione con teclado. */}
      <button
        type="button"
        onClick={onVerDetalle}
        aria-label={`Ver detalles de ${producto.nombre}`}
        className="text-left flex-1 flex flex-col cursor-zoom-in focus:outline-none"
      >
        <div className="relative h-48 overflow-hidden flex items-center justify-center group" style={{ backgroundColor: 'var(--beige-light)' }}>
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
            <span className="badge badge-gold">{producto.sku}</span>
            <span className="badge" style={{ backgroundColor: 'var(--beige-light)', color: 'var(--black-primary)' }}>
              {producto.categoria}
            </span>
            {/* De qué tienda es: en el catálogo conviven varias
                y el cliente necesita saber a quién le compra. */}
            {mostrarTienda && producto.tienda && (
              <span className="badge badge-indigo">🏪 {producto.tienda.nombre}</span>
            )}
          </div>

          {/* Nombre */}
          {/* h2 y no h3: el h1 es el título del catálogo y saltar
              un nivel rompe la navegación por encabezados. */}
          <h2 className="font-semibold text-lg mb-2" style={{ color: 'var(--black-primary)' }}>{producto.nombre}</h2>

          {/* Atributos */}
          <div className="text-sm space-y-1" style={{ color: 'var(--gray-secondary)' }}>
            {producto.dimensiones && <p>📏 {producto.dimensiones}</p>}
            {producto.color && <p>🎨 {producto.color}</p>}
            {producto.acabado && <p>✨ {producto.acabado}</p>}
            {producto.m2PorCaja && <p>📦 {producto.m2PorCaja} m² por caja</p>}
          </div>
        </div>
      </button>

      {/* Precio y botón, fuera del área que abre la ficha */}
      <div className="px-4 pb-4 pt-3" style={{ borderTop: '1px solid var(--gray-light)' }}>
        <p className="text-2xl font-bold mb-3" style={{ color: 'var(--gold-dark)' }}>{pesos(producto.precioUnitario)}</p>
        <button onClick={onAgregar} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
          🛒 Agregar al carrito
        </button>
      </div>
    </div>
  )
}
