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
    <div style={{ backgroundColor: 'var(--beige-light)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--gold)' }}>
      <h3 style={{ margin: '0 0 15px 0', color: 'var(--gold-dark)' }}>Términos de Pago</h3>

      <div style={{ marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace' }}>
          <span>Total:</span>
          <span style={{ fontWeight: 'bold' }}>{pesos(total)}</span>
        </div>

        {anticipo > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace', color: 'var(--status-green-text)' }}>
            <span>Adelanto (Inicial):</span>
            <span>{pesos(anticipo)}</span>
          </div>
        )}

        {abonos.length > 0 && (
          <div style={{ backgroundColor: 'var(--white-off)', padding: '10px', borderRadius: '6px', marginBottom: '10px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px', color: 'var(--gray-secondary)' }}>Abonos Registrados:</p>
            {abonos.map((abono) => (
              <div key={`${abono.fecha}-${abono.monto}`} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                <span>{fechaYHora(abono.fecha)}</span>
                <span>{pesos(abono.monto)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--gray-light)', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '12px' }}>
              <span>Subtotal abonos:</span>
              <span>{pesos(totalAbonos)}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace', backgroundColor: 'var(--white-off)', padding: '8px', borderRadius: '6px' }}>
          <span>Total Abonado:</span>
          <span style={{ fontWeight: 'bold', color: 'var(--status-green-text)' }}>{pesos(totalAbonado)}</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'monospace',
            backgroundColor: saldoPendiente > 0 ? 'var(--status-red-bg)' : 'var(--status-green-bg)',
            padding: '10px',
            borderRadius: '6px',
            borderLeft: `4px solid ${saldoPendiente > 0 ? 'var(--status-red-solid)' : 'var(--status-green-text)'}`,
          }}
        >
          <span style={{ fontWeight: 'bold' }}>Saldo Pendiente:</span>
          <span style={{ fontWeight: 'bold', color: saldoPendiente > 0 ? 'var(--status-red-solid)' : 'var(--status-green-text)' }}>
            {pesos(saldoPendiente)}
          </span>
        </div>
      </div>

      {puedeAbonar && saldoPendiente > 0 && (
        <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid var(--gold)' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: 'var(--gold-dark)' }}>Agregar Nuevo Abono:</p>
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
                className="field-input"
                style={{ fontFamily: 'monospace', borderColor: 'var(--gold)' }}
              />
            </div>
            <button onClick={pedirConfirmacion} disabled={guardando || !nuevoAbono} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
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
          <div className="card" style={{ maxWidth: 500, boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)' }}>
            <h2 style={{ margin: '0 0 20px 0', color: 'var(--black-primary)' }}>Confirmar Abono</h2>

            <div style={{ backgroundColor: 'var(--beige-light)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '15px' }}>
                <p style={{ margin: '0 0 5px 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>Saldo Actual:</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                  {pesos(saldoPendiente)}
                </p>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <p style={{ margin: '0 0 5px 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>Abono a Registrar:</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--gold-dark)', fontFamily: 'monospace' }}>
                  {pesos(aConfirmar)}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--gray-light)', paddingTop: '15px' }}>
                <p style={{ margin: '0 0 5px 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>Nuevo Saldo Pendiente:</p>
                <p
                  style={{
                    margin: 0,
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: saldoPendiente - aConfirmar > 0 ? 'var(--status-red-solid)' : 'var(--status-green-text)',
                    fontFamily: 'monospace',
                  }}
                >
                  {pesos(saldoPendiente - aConfirmar)}
                </p>
              </div>
            </div>

            {aConfirmar > saldoPendiente && (
              <div className="alert-box">
                <strong>⚠️ Advertencia:</strong> Este abono es superior al saldo pendiente de {pesos(saldoPendiente)}.
                Está pagando {pesos(aConfirmar - saldoPendiente)} de más.
              </div>
            )}

            <p style={{ margin: '0 0 20px 0', color: 'var(--gray-secondary)', fontSize: '14px', textAlign: 'center' }}>
              ¿Confirma el registro de este abono? Esta acción no se puede deshacer.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setAConfirmar(null)} disabled={guardando} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={confirmar} disabled={guardando} className="btn-primary">
                {guardando ? 'Guardando...' : 'Confirmar Abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
