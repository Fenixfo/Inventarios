'use client'

import { Carrito } from '@/hooks/useCart'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import Link from 'next/link'
import { pesos } from '@/lib/formato'

interface CartProps {
  carrito: Carrito
  onQuitarItem: (id: string) => void
  onActualizarCantidad: (id: string, cantidad: number) => void
  onVaciarCarrito: () => void
}

export function Cart({ carrito, onQuitarItem, onActualizarCantidad, onVaciarCarrito }: CartProps) {
  if (carrito.items.length === 0) {
    return (
      <div className="card text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--black-primary)' }}>Carrito de Compras</h1>
        <p className="mb-4" style={{ color: 'var(--gray-secondary)' }}>El carrito está vacío</p>
        <Link href="/" style={{ color: 'var(--gold-dark)', fontWeight: 600, textDecoration: 'none' }}>
          ← Volver al catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Resumen del carrito */}
      <div className="p-4 sm:p-6" style={{ borderBottom: '1px solid var(--gray-light)' }}>
        <h1 className="text-xl sm:text-2xl font-bold mb-4" style={{ color: 'var(--black-primary)' }}>Carrito de Compras</h1>
        {/* Tres columnas en 360 px dejan ~100 px por dato: los importes se
            bajan de tamaño en vez de desbordarse. */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--gray-secondary)' }}>Productos</p>
            <p className="text-lg sm:text-2xl font-bold" style={{ color: 'var(--black-primary)' }}>{carrito.totalCantidad}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--gray-secondary)' }}>m² Total</p>
            <p className="text-lg sm:text-2xl font-bold" style={{ color: 'var(--black-primary)' }}>{carrito.totalM2.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--gray-secondary)' }}>Total</p>
            <p className="text-sm sm:text-2xl font-bold break-words" style={{ color: 'var(--gold-dark)' }}>
              {pesos(carrito.totalPrecio)}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de items */}
      <div>
        {carrito.items.map((item) => (
          <div key={item.id} className="p-4 transition" style={{ borderBottom: '1px solid var(--gray-light)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h2 className="font-semibold" style={{ color: 'var(--black-primary)' }}>{item.nombre}</h2>
                <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>SKU: {item.sku}</p>
              </div>
              <button
                onClick={() => onQuitarItem(item.id)}
                aria-label={`Quitar ${item.nombre} del carrito`}
                className="shrink-0 h-9 w-9 font-medium"
                style={{ color: 'var(--status-red-solid)' }}
              >
                ✕
              </button>
            </div>

            {/* En móvil los controles y el importe se apilan; en pantalla
                grande siguen en la misma línea. */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onActualizarCantidad(item.id, item.cantidad - 0.5)}
                  aria-label="Quitar medio metro"
                  className="h-10 w-10 rounded text-lg"
                  style={{ backgroundColor: 'var(--beige-light)', color: 'var(--black-primary)' }}
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
                  className="field-input w-16 h-10 text-center font-medium"
                  style={{ padding: '4px' }}
                />
                <span className="text-sm" style={{ color: 'var(--gray-secondary)' }}>m²</span>
                <button
                  onClick={() => onActualizarCantidad(item.id, item.cantidad + 0.5)}
                  aria-label="Añadir medio metro"
                  className="h-10 w-10 rounded text-lg"
                  style={{ backgroundColor: 'var(--beige-light)', color: 'var(--black-primary)' }}
                >
                  +
                </button>
              </div>

              <div className="text-right ml-auto">
                <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
                  {pesos(item.precioUnitario)}/m²
                </p>
                <p className="font-bold" style={{ color: 'var(--black-primary)' }}>
                  {pesos(item.subtotal)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Totales y acciones */}
      <div className="p-4 sm:p-6" style={{ backgroundColor: 'var(--beige-light)' }}>
        <div className="space-y-2 mb-6 pt-4" style={{ borderTop: '1px solid var(--gray-light)' }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: 'var(--gray-secondary)' }}>Subtotal:</span>
            <span className="font-medium">{pesos(carrito.totalPrecio)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span style={{ color: 'var(--gold-dark)' }}>{pesos(carrito.totalPrecio)}</span>
          </div>
        </div>

        <WhatsAppButton carrito={carrito} onPedidoEnviado={onVaciarCarrito} />

        <Link
          href="/"
          className="block text-center font-medium py-2"
          style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}
        >
          ← Seguir comprando
        </Link>
      </div>
    </div>
  )
}
