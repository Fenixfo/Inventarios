'use client'

import { pesos } from '@/lib/formato'
import type { Totales } from '@/lib/totales-factura'
import { estiloCampo, estiloEtiqueta, estiloSeccion, sinRueda } from './tipos'

interface Props {
  totales: Totales
  descuentoPorcentaje: number
  descuentoMonto: number
  onDescuentoPorcentaje: (valor: string) => void
  onDescuentoMonto: (valor: string) => void
  impuestoPorcentaje: number
  onImpuestoPorcentaje: (valor: number) => void
  /** Sin permiso de abonar, o en una cotización, el campo ni se muestra. */
  puedeAbonar: boolean
  abono: number
  onAbono: (valor: number) => void
  metodoPago: string
  onMetodoPago: (valor: string) => void
  observaciones: string
  onObservaciones: (valor: string) => void
}

/** Descuento, impuesto, totales, abono inicial, método de pago y observaciones. */
export function SeccionResumen(props: Props) {
  const { totales, descuentoPorcentaje, descuentoMonto, impuestoPorcentaje, puedeAbonar, abono } = props
  const { subtotal, descuento, impuesto, total } = totales

  return (
    <div style={estiloSeccion}>
      <h3 style={{ marginBottom: '15px' }}>Resumen</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
        <div>
          <label style={estiloEtiqueta}>Descuento (%)</label>
          <input
            type="number"
            value={descuentoPorcentaje || ''}
            onChange={(e) => props.onDescuentoPorcentaje(e.target.value)}
            onWheel={sinRueda}
            step="0.01"
            min="0"
            max="100"
            placeholder="0.00"
            style={estiloCampo}
          />
        </div>
        <div>
          <label style={estiloEtiqueta}>Descuento ($)</label>
          <input
            type="number"
            value={descuentoMonto || ''}
            onChange={(e) => props.onDescuentoMonto(e.target.value)}
            onWheel={sinRueda}
            step="0.01"
            min="0"
            placeholder="0.00"
            style={estiloCampo}
          />
        </div>
        <div>
          <label style={estiloEtiqueta}>Impuesto (%)</label>
          <input
            type="number"
            value={impuestoPorcentaje}
            onChange={(e) => props.onImpuestoPorcentaje(parseFloat(e.target.value) || 0)}
            onWheel={sinRueda}
            step="0.01"
            min="0"
            style={estiloCampo}
          />
        </div>
      </div>

      <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', fontFamily: 'monospace' }}>
          <span>Subtotal:</span>
          <span>{pesos(subtotal)}</span>
        </div>
        {descuento > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', color: '#dc2626', fontFamily: 'monospace' }}>
            <span>Descuento ({descuentoPorcentaje.toFixed(2)}%):</span>
            <span>-{pesos(descuento)}</span>
          </div>
        )}
        {impuesto > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', color: '#2563eb', fontFamily: 'monospace' }}>
            <span>Impuesto ({impuestoPorcentaje.toFixed(2)}%):</span>
            <span>+{pesos(impuesto)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '2px solid #ddd', paddingTop: '10px', color: '#2563eb', fontFamily: 'monospace', marginBottom: '15px' }}>
          <span>TOTAL:</span>
          <span>{pesos(total)}</span>
        </div>

        {puedeAbonar && (
          <div>
            <label style={estiloEtiqueta}>Abono Inicial ($)</label>
            <input
              type="number"
              value={abono || ''}
              onChange={(e) => {
                // Hasta $10.000 por encima del total, como el abono posterior.
                const valor = parseFloat(e.target.value) || 0
                props.onAbono(Math.min(valor, total + 10000))
              }}
              onWheel={sinRueda}
              step="100"
              min="0"
              max={total + 10000}
              placeholder="0.00"
              title={`Máximo permitido: ${pesos(total + 10000)}`}
              style={{ ...estiloCampo, fontFamily: 'monospace' }}
            />
            {abono > 0 && (
              <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
                <div>Abono: {pesos(abono)}</div>
                <div style={{ color: abono > total ? '#dc2626' : '#10b981', fontWeight: 'bold' }}>
                  Saldo pendiente: {pesos(Math.max(0, total - abono))}
                </div>
                {abono > total && (
                  <div style={{ color: '#f59e0b', marginTop: '5px', fontSize: '11px' }}>
                    ⚠️ Pagando ${((abono - total) / 1000).toFixed(1)}k de más
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label style={estiloEtiqueta}>Método de Pago</label>
        <select
          value={props.metodoPago}
          onChange={(e) => props.onMetodoPago(e.target.value)}
          style={{ ...estiloCampo, marginBottom: '15px' }}
        >
          <option value="">Selecciona método</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>

      <div>
        <label style={estiloEtiqueta}>Observaciones</label>
        <textarea
          value={props.observaciones}
          onChange={(e) => props.onObservaciones(e.target.value)}
          rows={3}
          style={estiloCampo}
        />
      </div>
    </div>
  )
}
