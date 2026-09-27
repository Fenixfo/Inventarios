'use client'

import type { Producto } from './tipos'

interface Props {
  /** El producto que se quiso agregar, de una tienda distinta a la del carrito. */
  producto: Producto
  tiendaDelCarrito?: string
  onSeguir: () => void
  onEmpezarPedidoNuevo: () => void
}

/**
 * Aviso antes de mezclar tiendas en el mismo carrito: cada tienda recibe los
 * pedidos en su propio WhatsApp, así que un pedido solo puede ser de una.
 */
export function DialogoOtraTienda({
  producto,
  tiendaDelCarrito,
  onSeguir,
  onEmpezarPedidoNuevo,
}: Props) {
  return (
    <div
      onClick={onSeguir}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 popup-in"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-3">Es de otra tienda</h2>

        <p className="text-sm text-gray-600 mb-4">
          Tu pedido es de <strong>{tiendaDelCarrito}</strong> y <strong>{producto.nombre}</strong>{' '}
          lo vende <strong>{producto.tienda?.nombre}</strong>.
        </p>

        <p className="text-sm text-gray-600 mb-6">
          Cada tienda recibe los pedidos en su propio WhatsApp, así que un pedido solo puede ser de
          una. Si sigues, se vacía lo que llevabas.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onSeguir}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
          >
            Seguir con {tiendaDelCarrito}
          </button>
          <button
            onClick={onEmpezarPedidoNuevo}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition"
          >
            Empezar pedido nuevo
          </button>
        </div>
      </div>
    </div>
  )
}
