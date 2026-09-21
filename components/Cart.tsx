'use client'

import { Carrito } from '@/hooks/useCart'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import Link from 'next/link'

interface CartProps {
  carrito: Carrito
  onQuitarItem: (id: string) => void
  onActualizarCantidad: (id: string, cantidad: number) => void
  onVaciarCarrito: () => void
}

export function Cart({ carrito, onQuitarItem, onActualizarCantidad, onVaciarCarrito }: CartProps) {
  const formatearPrecio = (precio: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(precio)
  }

  if (carrito.items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Carrito de Compras</h1>
        <p className="text-gray-600 mb-4">El carrito está vacío</p>
        <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
          ← Volver al catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Resumen del carrito */}
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Carrito de Compras</h1>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-600">Productos</p>
            <p className="text-2xl font-bold text-gray-900">{carrito.totalCantidad}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">m² Total</p>
            <p className="text-2xl font-bold text-gray-900">{carrito.totalM2.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-red-600">{formatearPrecio(carrito.totalPrecio)}</p>
          </div>
        </div>
      </div>

      {/* Lista de items */}
      <div className="divide-y">
        {carrito.items.map((item) => (
          <div key={item.id} className="p-4 hover:bg-gray-50 transition">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="font-semibold text-gray-900">{item.nombre}</h2>
                <p className="text-sm text-gray-600">SKU: {item.sku}</p>
              </div>
              <button
                onClick={() => onQuitarItem(item.id)}
                className="text-red-600 hover:text-red-800 font-medium text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onActualizarCantidad(item.id, item.cantidad - 0.5)}
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                >
                  −
                </button>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={item.cantidad}
                  onChange={(e) => {
                    const valor = parseFloat(e.target.value)
                    if (!isNaN(valor) && valor > 0) {
                      onActualizarCantidad(item.id, valor)
                    }
                  }}
                  className="w-16 text-center font-medium border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-600"
                />
                <span className="text-sm text-gray-600">m²</span>
                <button
                  onClick={() => onActualizarCantidad(item.id, item.cantidad + 0.5)}
                  className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                >
                  +
                </button>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-600">
                  {formatearPrecio(item.precioUnitario)}/m²
                </p>
                <p className="font-bold text-gray-900">
                  {formatearPrecio(item.subtotal)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totales y acciones */}
      <div className="p-6 bg-gray-50">
        <div className="space-y-2 mb-6 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-medium">{formatearPrecio(carrito.totalPrecio)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span className="text-red-600">{formatearPrecio(carrito.totalPrecio)}</span>
          </div>
        </div>

        <WhatsAppButton carrito={carrito} onPedidoEnviado={onVaciarCarrito} />

        <Link
          href="/"
          className="block text-center text-blue-600 hover:text-blue-800 font-medium py-2"
        >
          ← Seguir comprando
        </Link>
      </div>
    </div>
  )
}
