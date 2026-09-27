'use client'

import { pesos } from '@/lib/formato'
import type { Producto } from './tipos'
import { useTeclasDialogo } from './useTeclasDialogo'

interface Props {
  producto: Producto
  onCerrar: () => void
  onAgregar: () => void
}

/**
 * Ficha ampliada del producto. Se abre al pulsar la tarjeta y es
 * independiente del pop-up de cantidad, que sale desde el botón del carrito.
 */
export function FichaProducto({ producto, onCerrar, onAgregar }: Props) {
  // Solo se cierra con Escape: aquí Enter no confirma nada.
  useTeclasDialogo((tecla) => {
    if (tecla === 'Escape') onCerrar()
  })

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={producto.nombre}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto popup-in"
      >
        <div className="md:flex">
          {/* Imagen grande: object-contain para no recortar la pieza */}
          <div className="md:w-1/2 bg-gray-100 flex items-center justify-center p-4">
            {producto.imagenUrl ? (
              <img
                src={producto.imagenUrl}
                // En móvil la ficha se apila: si la foto ocupa 60vh,
                // los datos quedan fuera de la pantalla.
                className="max-h-[40vh] md:max-h-[60vh] w-auto max-w-full object-contain rounded-lg"
                alt={producto.nombre}
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
                  {producto.sku}
                </span>
                <span className="inline-block bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded capitalize">
                  {producto.categoria}
                </span>
              </div>
              <button
                onClick={onCerrar}
                aria-label="Cerrar"
                className="text-gray-400 hover:text-gray-700 text-3xl leading-none transition -mt-2"
              >
                ×
              </button>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">{producto.nombre}</h2>

            <dl className="text-sm text-gray-700 divide-y divide-gray-100 mb-6">
              {producto.dimensiones && (
                <div className="flex justify-between py-2">
                  <dt className="text-gray-500">📏 Medida</dt>
                  <dd className="font-medium">{producto.dimensiones}</dd>
                </div>
              )}
              {producto.color && (
                <div className="flex justify-between py-2">
                  <dt className="text-gray-500">🎨 Color</dt>
                  <dd className="font-medium">{producto.color}</dd>
                </div>
              )}
              {producto.acabado && (
                <div className="flex justify-between py-2">
                  <dt className="text-gray-500">✨ Acabado</dt>
                  <dd className="font-medium">{producto.acabado}</dd>
                </div>
              )}
              {producto.m2PorCaja && (
                <div className="flex justify-between py-2">
                  <dt className="text-gray-500">📦 Metraje por caja</dt>
                  <dd className="font-medium">{producto.m2PorCaja} m²</dd>
                </div>
              )}
              <div className="flex justify-between py-2">
                <dt className="text-gray-500">🏷️ Precio</dt>
                <dd className="font-bold text-red-600 text-lg">
                  {pesos(producto.precioUnitario)}
                  <span className="text-sm font-normal text-gray-600"> / m²</span>
                </dd>
              </div>
            </dl>

            <div className="flex-1" />

            <div className="flex gap-3">
              <button
                onClick={onCerrar}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
              >
                Cerrar
              </button>
              <button
                onClick={onAgregar}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
              >
                🛒 Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
