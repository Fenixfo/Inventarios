'use client'

import { useState } from 'react'
import { pesos } from '@/lib/formato'
import type { Producto } from './tipos'
import { useTeclasDialogo } from './useTeclasDialogo'

interface Props {
  producto: Producto
  /** Recibe los m² pedidos, siempre mayores que cero. */
  onAgregar: (cantidad: number) => void
  onCerrar: () => void
}

/**
 * Pop-up para elegir cuántos m² se agregan al carrito. Se monta al abrirlo,
 * así que cada vez empieza en 1.
 */
export function DialogoCantidad({ producto, onAgregar, onCerrar }: Props) {
  const [cantidad, setCantidad] = useState('1')
  const numero = parseFloat(cantidad) || 0

  const confirmar = () => {
    const pedida = parseFloat(cantidad) || 1
    if (pedida > 0) onAgregar(pedida)
  }

  useTeclasDialogo((tecla) => {
    if (tecla === 'Escape') onCerrar()
    if (tecla === 'Enter') confirmar()
  })

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full popup-in"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{producto.nombre}</h2>
            <p className="text-sm text-gray-500 mt-1">
              SKU {producto.sku}
              {producto.dimensiones && ` · ${producto.dimensiones}`}
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-gray-700 text-3xl leading-none transition"
          >
            ×
          </button>
        </div>

        <div className="px-6 pb-6">
          <p className="mb-5">
            <span className="font-bold text-red-600 text-lg">{pesos(producto.precioUnitario)}</span>
            <span className="text-sm text-gray-600"> por m²</span>
          </p>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿Cuántos m² deseas?
          </label>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setCantidad(String(Math.max(0.5, numero - 0.5)))}
              className="w-11 h-11 rounded-lg bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-700 transition"
            >
              −
            </button>
            <input
              type="number"
              min="0.1"
              step="0.5"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              autoFocus
              className="flex-1 h-11 text-center text-lg font-semibold px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            <button
              onClick={() => setCantidad(String(numero + 0.5))}
              className="w-11 h-11 rounded-lg bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-700 transition"
            >
              +
            </button>
          </div>

          <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3 mb-5">
            <span className="text-sm text-gray-600">Total</span>
            <span className="text-xl font-bold text-red-600">
              {pesos(numero * producto.precioUnitario)}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCerrar}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={!(numero > 0)}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition"
            >
              Agregar al carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
