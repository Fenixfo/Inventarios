'use client'

import { useState } from 'react'
import { enlaceWhatsApp, normalizarTelefono } from '@/lib/whatsapp'

interface Props {
  /** "la factura 20260926-001", "la cotización COT-…" */
  documento: string
  /** Lo que se escribe cuando no hay teléfono: "Esta factura no tiene…" */
  sinTelefono: string
  /** El del cliente, si lo tiene: se propone como destinatario. */
  telefonoCliente?: string | null
  nombreCliente?: string | null
  /** El resumen que va en el mensaje. */
  mensaje: string
  /** Pide el PDF y lo comparte o descarga. */
  onCompartirPdf: () => Promise<'compartido' | 'descargado'>
  onCerrar: () => void
}

/**
 * Ventana para mandar una factura o cotización por WhatsApp.
 *
 * El camino principal es el PDF por el menú de compartir del celular; el
 * secundario, el resumen escrito con el número ya puesto. Estaba copiada
 * en el detalle de factura y en el de cotización.
 */
export function DialogoEnvioWhatsApp({
  documento,
  sinTelefono,
  telefonoCliente,
  nombreCliente,
  mensaje,
  onCompartirPdf,
  onCerrar,
}: Props) {
  // El teléfono del cliente se propone; si no hay, WhatsApp pide el contacto.
  const [destino, setDestino] = useState(telefonoCliente || '')
  const [compartiendo, setCompartiendo] = useState(false)
  const [avisoDescarga, setAvisoDescarga] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const numero = normalizarTelefono(destino)

  const compartir = async () => {
    setCompartiendo(true)
    setError(null)

    try {
      const resultado = await onCompartirPdf()
      if (resultado === 'compartido') onCerrar()
      else setAvisoDescarga(true)
    } catch (err: unknown) {
      // Cancelar el menú de compartir no es un error que haya que mostrar.
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'No se pudo compartir el documento')
      }
    } finally {
      setCompartiendo(false)
    }
  }

  const enviarResumen = () => {
    window.open(enlaceWhatsApp(numero, mensaje), '_blank', 'noopener,noreferrer')
    onCerrar()
  }

  return (
    <div
      onClick={onCerrar}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-envio"
        style={{ backgroundColor: 'var(--white-off)', borderRadius: '12px', maxWidth: '520px', width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '24px' }}
      >
        <h3 id="titulo-envio" style={{ marginTop: 0, marginBottom: '6px', fontSize: '18px', color: 'var(--black-primary)' }}>
          Enviar {documento}
        </h3>

        {error && <p className="alert-box error" style={{ fontSize: '13px' }}>{error}</p>}

        {/* Camino principal: el archivo */}
        <div style={{ border: '1px solid #bbf7d0', backgroundColor: 'var(--status-green-bg)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--status-green-text)' }}>
            Se abre el menú de compartir del celular: eliges WhatsApp, eliges el contacto
            y va el PDF adjunto.
          </p>

          <button
            onClick={compartir}
            disabled={compartiendo}
            style={{
              width: '100%',
              padding: '13px 16px',
              backgroundColor: compartiendo ? '#9ca3af' : '#25d366',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: compartiendo ? 'wait' : 'pointer',
              fontSize: '15px',
              fontWeight: 'bold',
            }}
          >
            {compartiendo ? 'Generando el PDF...' : '📎 Enviar el PDF'}
          </button>

          {avisoDescarga && (
            <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: 'var(--status-green-text)' }}>
              Este navegador no puede entregarle el archivo a WhatsApp, así que el PDF se
              descargó. Adjúntalo desde WhatsApp, o ábrelo desde el celular para mandarlo
              directo.
            </p>
          )}
        </div>

        <p style={{ fontSize: '13px', color: 'var(--gray-secondary)', marginTop: 0, marginBottom: '14px' }}>
          O envía solo el resumen escrito, sin archivo. Esta vía sí permite indicar el
          número de una vez:
        </p>

        <label htmlFor="destino-whatsapp" className="field-label">
          Número de destino
        </label>
        <input
          id="destino-whatsapp"
          type="tel"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          placeholder="Sin número: eliges el contacto en WhatsApp"
          className="field-input"
        />

        <p style={{ fontSize: '12px', color: 'var(--gray-secondary)', margin: '6px 0 18px 0' }}>
          {telefonoCliente ? `Tomado del cliente ${nombreCliente || ''}.` : sinTelefono}{' '}
          {numero
            ? `Se abrirá el chat con +${numero}.`
            : 'Se abrirá WhatsApp sin destinatario para que elijas a quién enviarlo.'}
        </p>

        <details style={{ marginBottom: '18px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--gold-dark)' }}>
            Ver el mensaje que se va a enviar
          </summary>
          <pre style={{ backgroundColor: 'var(--beige-light)', border: '1px solid var(--gray-light)', borderRadius: '8px', padding: '12px', fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '8px' }}>
            {mensaje}
          </pre>
        </details>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={onCerrar} className="btn-secondary" style={{ padding: '11px 16px' }}>
            Cancelar
          </button>
          <button
            onClick={enviarResumen}
            style={{ flex: 1, padding: '11px 16px', border: '1px solid #25d366', borderRadius: '8px', backgroundColor: 'var(--white-off)', color: '#128c3e', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
          >
            Enviar solo el resumen
          </button>
        </div>
      </div>
    </div>
  )
}
