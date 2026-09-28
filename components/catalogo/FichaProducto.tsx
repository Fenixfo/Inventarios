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
        className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto popup-in"
        style={{ backgroundColor: 'var(--white-off)' }}
      >
        <div className="md:flex">
          {/* Imagen grande: object-contain para no recortar la pieza */}
          <div className="md:w-1/2 flex items-center justify-center p-4" style={{ backgroundColor: 'var(--beige-light)' }}>
            {producto.imagenUrl ? (
              <img
                src={producto.imagenUrl}
                // En móvil la ficha se apila: si la foto ocupa 60vh,
                // los datos quedan fuera de la pantalla.
                className="max-h-[40vh] md:max-h-[60vh] w-auto max-w-full object-contain rounded-lg"
                alt={producto.nombre}
              />
            ) : (
              <div className="py-20 text-center" style={{ color: 'var(--gray-secondary)' }}>
                <div className="text-6xl mb-2">📦</div>
                <p className="text-sm">Sin imagen disponible</p>
              </div>
            )}
          </div>

          {/* Datos */}
          <div className="md:w-1/2 p-5 sm:p-6 flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex gap-2 flex-wrap">
                <span className="badge badge-gold">{producto.sku}</span>
                <span className="badge" style={{ backgroundColor: 'var(--beige-light)', color: 'var(--black-primary)' }}>
                  {producto.categoria}
                </span>
              </div>
              <button
                onClick={onCerrar}
                aria-label="Cerrar"
                className="text-3xl leading-none transition -mt-2"
                style={{ color: 'var(--gray-secondary)' }}
              >
                ×
              </button>
            </div>

            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--black-primary)' }}>{producto.nombre}</h2>

            <dl className="text-sm mb-6" style={{ color: 'var(--black-primary)' }}>
              {producto.dimensiones && (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--gray-light)' }}>
                  <dt style={{ color: 'var(--gray-secondary)' }}>📏 Medida</dt>
                  <dd className="font-medium">{producto.dimensiones}</dd>
                </div>
              )}
              {producto.color && (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--gray-light)' }}>
                  <dt style={{ color: 'var(--gray-secondary)' }}>🎨 Color</dt>
                  <dd className="font-medium">{producto.color}</dd>
                </div>
              )}
              {producto.acabado && (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--gray-light)' }}>
                  <dt style={{ color: 'var(--gray-secondary)' }}>✨ Acabado</dt>
                  <dd className="font-medium">{producto.acabado}</dd>
                </div>
              )}
              {producto.m2PorCaja && (
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--gray-light)' }}>
                  <dt style={{ color: 'var(--gray-secondary)' }}>📦 Metraje por caja</dt>
                  <dd className="font-medium">{producto.m2PorCaja} m²</dd>
                </div>
              )}
              <div className="flex justify-between py-2">
                <dt style={{ color: 'var(--gray-secondary)' }}>🏷️ Precio</dt>
                <dd className="font-bold text-lg" style={{ color: 'var(--gold-dark)' }}>
                  {pesos(producto.precioUnitario)}
                  <span className="text-sm font-normal" style={{ color: 'var(--gray-secondary)' }}> / m²</span>
                </dd>
              </div>
            </dl>

            <div className="flex-1" />

            <div className="flex gap-3">
              <button onClick={onCerrar} className="btn-secondary flex-1" style={{ justifyContent: 'center' }}>
                Cerrar
              </button>
              <button onClick={onAgregar} className="btn-primary flex-1" style={{ justifyContent: 'center' }}>
                🛒 Agregar al carrito
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
