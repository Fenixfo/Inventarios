'use client'

import { pesos } from '@/lib/formato'
import { precioAplicable } from '@/lib/precios'
import type { LineaFactura, ProductoFactura } from './tipos'

interface Props {
  /** true si se está pasando a bodega; false si se vuelve al público. */
  aBodega: boolean
  lineas: LineaFactura[]
  productos: Map<string, ProductoFactura>
  onCancelar: () => void
  /** Cambia la lista de precios; con `recalcular`, también las líneas ya añadidas. */
  onElegir: (recalcular: boolean) => void
}

/** Qué hacer con los productos ya añadidos al cambiar de lista de precios. */
export function DialogoBodega({ aBodega, lineas, productos, onCancelar, onElegir }: Props) {
  const conProducto = lineas.filter((l) => l.productoId)

  return (
    <div
      onClick={onCancelar}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: 'var(--white-off)', borderRadius: '12px', maxWidth: '520px', width: '100%', padding: '24px' }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '18px', color: 'var(--black-primary)' }}>
          {aBodega ? 'Cambiar a precio de bodega' : 'Volver al precio del público'}
        </h3>

        <p style={{ fontSize: '14px', color: 'var(--gray-secondary)', marginTop: 0, marginBottom: '18px' }}>
          Ya tienes {conProducto.length} producto
          {conProducto.length !== 1 ? 's' : ''} en la factura.
          ¿Actualizo sus precios a los de{' '}
          {aBodega ? 'bodega' : 'público'}, o los dejo como están?
        </p>

        {/* Vista previa del cambio, para no decidir a ciegas. */}
        <div style={{ border: '1px solid var(--gray-light)', borderRadius: '8px', padding: '12px', marginBottom: '18px', maxHeight: '220px', overflowY: 'auto', fontSize: '13px' }}>
          {conProducto.map((linea) => {
            const producto = productos.get(linea.productoId ?? '')
            const nuevo = producto ? precioAplicable(producto, aBodega) : linea.precioUnitario

            return (
              <div key={linea.clave} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--gray-secondary)' }}>{linea.productoNombre}</span>
                <span style={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                  {pesos(linea.precioUnitario)}
                  {nuevo !== linea.precioUnitario && (
                    <>
                      {' → '}
                      <strong style={{ color: nuevo < linea.precioUnitario ? 'var(--status-green-text)' : 'var(--status-red-solid)' }}>
                        {pesos(nuevo)}
                      </strong>
                    </>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--gray-secondary)', marginTop: 0, marginBottom: '18px' }}>
          Si habías ajustado algún precio a mano, actualizar lo sobrescribe.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancelar} className="btn-secondary" style={{ padding: '11px 16px' }}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onElegir(false)}
            className="btn-secondary"
            style={{ flex: 1, padding: '11px 16px', justifyContent: 'center' }}
          >
            Mantener los actuales
          </button>
          <button
            type="button"
            onClick={() => onElegir(true)}
            className="btn-primary"
            style={{ flex: 1, padding: '11px 16px', justifyContent: 'center' }}
          >
            Actualizar precios
          </button>
        </div>
      </div>
    </div>
  )
}
