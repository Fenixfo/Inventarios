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
        className="rounded-2xl shadow-2xl max-w-md w-full p-6 popup-in"
        style={{ backgroundColor: 'var(--white-off)' }}
      >
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--black-primary)' }}>Es de otra tienda</h2>

        <p className="text-sm mb-4" style={{ color: 'var(--gray-secondary)' }}>
          Tu pedido es de <strong>{tiendaDelCarrito}</strong> y <strong>{producto.nombre}</strong>{' '}
          lo vende <strong>{producto.tienda?.nombre}</strong>.
        </p>

        <p className="text-sm mb-6" style={{ color: 'var(--gray-secondary)' }}>
          Cada tienda recibe los pedidos en su propio WhatsApp, así que un pedido solo puede ser de
          una. Si sigues, se vacía lo que llevabas.
        </p>

        <div className="flex gap-3">
          <button onClick={onSeguir} className="btn-secondary flex-1" style={{ justifyContent: 'center' }}>
            Seguir con {tiendaDelCarrito}
          </button>
          <button onClick={onEmpezarPedidoNuevo} className="btn-primary flex-1" style={{ justifyContent: 'center' }}>
            Empezar pedido nuevo
          </button>
        </div>
      </div>
    </div>
  )
}
