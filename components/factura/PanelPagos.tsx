'use client'

import { useState } from 'react'
import { fechaYHora } from '@/lib/fechas'
import { pesos } from '@/lib/formato'

export interface AbonoRegistrado {
  monto: number
  fecha: string
}

interface Props {
  total: number
  anticipo: number
  abonos: AbonoRegistrado[]
  /** Solo en una factura pendiente, con saldo y con permiso se puede abonar. */
  puedeAbonar: boolean
  guardando: boolean
  /** Registra el abono; devuelve true si quedó guardado. */
  onRegistrarAbono: (monto: number) => Promise<boolean>
}

/** Cuánto se abona por encima del saldo como mucho, por redondeos o cambio. */
const MARGEN_SOBRE_SALDO = 10000

/**
 * "Términos de pago" del detalle de factura: anticipo, abonos, saldo y el
 * formulario para registrar un abono nuevo, con su confirmación.
 */
export function PanelPagos({ total, anticipo, abonos, puedeAbonar, guardando, onRegistrarAbono }: Props) {
  const [nuevoAbono, setNuevoAbono] = useState('')
  const [aConfirmar, setAConfirmar] = useState<number | null>(null)

  const totalAbonos = abonos.reduce((suma, a) => suma + Number(a.monto), 0)
  const totalAbonado = anticipo + totalAbonos
  const saldoPendiente = total - totalAbonado

  const pedirConfirmacion = () => {
    const monto = parseFloat(nuevoAbono)
    if (isNaN(monto) || monto <= 0) {
      alert('Ingrese un monto válido')
      return
    }

    const maximo = saldoPendiente + MARGEN_SOBRE_SALDO
    if (monto > maximo) {
      alert(`El abono no puede exceder el saldo pendiente en más de $10.000\nSaldo pendiente: ${pesos(saldoPendiente)}\nMáximo permitido: ${pesos(maximo)}`)
      return
    }

    setAConfirmar(monto)
  }

  const confirmar = async () => {
    if (aConfirmar === null) return
    if (await onRegistrarAbono(aConfirmar)) {
      setNuevoAbono('')
      setAConfirmar(null)
    }
  }

  return (
    <div style={{ backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '4px', marginBottom: '20px', border: '1px solid #0ea5e9' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#0369a1' }}>Términos de Pago</h3>

      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace' }}>
          <span>Total:</span>
          <span style={{ fontWeight: 'bold' }}>{pesos(total)}</span>
        </div>

        {anticipo > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace', color: '#059669' }}>
            <span>Adelanto (Inicial):</span>
            <span>{pesos(anticipo)}</span>
          </div>
        )}

        {abonos.length > 0 && (
          <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Abonos Registrados:</p>
            {abonos.map((abono) => (
              <div key={`${abono.fecha}-${abono.monto}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                <span>{fechaYHora(abono.fecha)}</span>
                <span>{pesos(abono.monto)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '12px' }}>
              <span>Subtotal abonos:</span>
              <span>{pesos(totalAbonos)}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace', backgroundColor: 'white', padding: '8px', borderRadius: '4px' }}>
          <span>Total Abonado:</span>
          <span style={{ fontWeight: 'bold', color: '#059669' }}>{pesos(totalAbonado)}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', backgroundColor: saldoPendiente > 0 ? '#fef2f2' : '#f0fdf4', padding: '10px', borderRadius: '4px', borderLeft: `4px solid ${saldoPendiente > 0 ? '#dc2626' : '#10b981'}` }}>
          <span style={{ fontWeight: 'bold' }}>Saldo Pendiente:</span>
          <span style={{ fontWeight: 'bold', color: saldoPendiente > 0 ? '#dc2626' : '#10b981' }}>{pesos(saldoPendiente)}</span>
        </div>
      </div>

      {puedeAbonar && saldoPendiente > 0 && (
        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #0ea5e9' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#0369a1' }}>Agregar Nuevo Abono:</p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                value={nuevoAbono}
                onChange={(e) => setNuevoAbono(e.target.value)}
                placeholder="Ingrese monto del abono"
                title={`Máximo permitido: ${pesos(Math.max(0, saldoPendiente + MARGEN_SOBRE_SALDO))}`}
                min="0"
                step="100"
                onWheel={(e) => e.currentTarget.blur()}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #0ea5e9',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={pedirConfirmacion}
              disabled={guardando || !nuevoAbono}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                opacity: guardando || !nuevoAbono ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {guardando ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {aConfirmar !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '8px',
            maxWidth: '500px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>Confirmar Abono</h2>

            <div style={{
              backgroundColor: '#f3f4f6',
              padding: '15px',
              borderRadius: '6px',
              marginBottom: '20px',
            }}>
              <div style={{ marginBottom: '15px' }}>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>Saldo Actual:</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {pesos(saldoPendiente)}
                </p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>Abono a Registrar:</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0ea5e9', fontFamily: 'monospace' }}>
                  {pesos(aConfirmar)}
                </p>
              </div>

              <div style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: '15px',
              }}>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>Nuevo Saldo Pendiente:</p>
                <p style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: saldoPendiente - aConfirmar > 0 ? '#dc2626' : '#10b981',
                  fontFamily: 'monospace'
                }}>
                  {pesos(saldoPendiente - aConfirmar)}
                </p>
              </div>
            </div>

            {aConfirmar > saldoPendiente && (
              <div style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                color: '#92400e',
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '15px',
                fontSize: '12px',
              }}>
                <strong>⚠️ Advertencia:</strong> Este abono es superior al saldo pendiente de {pesos(saldoPendiente)}.
                Está pagando {pesos(aConfirmar - saldoPendiente)} de más.
              </div>
            )}

            <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px', textAlign: 'center' }}>
              ¿Confirma el registro de este abono? Esta acción no se puede deshacer.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAConfirmar(null)}
                disabled={guardando}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={guardando}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  opacity: guardando ? 0.6 : 1,
                }}
              >
                {guardando ? 'Guardando...' : 'Confirmar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
