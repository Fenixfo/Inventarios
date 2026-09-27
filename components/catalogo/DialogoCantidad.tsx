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
        className="rounded-2xl shadow-2xl max-w-md w-full popup-in"
        style={{ backgroundColor: 'var(--white-off)' }}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--black-primary)' }}>{producto.nombre}</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--gray-secondary)' }}>
              SKU {producto.sku}
              {producto.dimensiones && ` · ${producto.dimensiones}`}
            </p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-3xl leading-none transition"
            style={{ color: 'var(--gray-secondary)' }}
          >
            ×
          </button>
        </div>

        <div className="px-6 pb-6">
          <p className="mb-5">
            <span className="font-bold text-lg" style={{ color: 'var(--gold-dark)' }}>{pesos(producto.precioUnitario)}</span>
            <span className="text-sm" style={{ color: 'var(--gray-secondary)' }}> por m²</span>
          </p>

          <label className="field-label">¿Cuántos m² deseas?</label>

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setCantidad(String(Math.max(0.5, numero - 0.5)))}
              className="w-11 h-11 rounded-lg text-xl font-bold transition"
              style={{ backgroundColor: 'var(--beige-light)', color: 'var(--black-primary)' }}
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
              className="field-input flex-1 h-11 text-center text-lg font-semibold"
            />
            <button
              onClick={() => setCantidad(String(numero + 0.5))}
              className="w-11 h-11 rounded-lg text-xl font-bold transition"
              style={{ backgroundColor: 'var(--beige-light)', color: 'var(--black-primary)' }}
            >
              +
            </button>
          </div>

          <div className="flex justify-between items-center rounded-lg px-4 py-3 mb-5" style={{ backgroundColor: 'var(--beige-light)' }}>
            <span className="text-sm" style={{ color: 'var(--gray-secondary)' }}>Total</span>
            <span className="text-xl font-bold" style={{ color: 'var(--gold-dark)' }}>
              {pesos(numero * producto.precioUnitario)}
            </span>
          </div>

          <div className="flex gap-3">
            <button onClick={onCerrar} className="btn-secondary flex-1" style={{ justifyContent: 'center' }}>
              Cancelar
            </button>
            <button onClick={confirmar} disabled={!(numero > 0)} className="btn-primary flex-1" style={{ justifyContent: 'center' }}>
              Agregar al carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
