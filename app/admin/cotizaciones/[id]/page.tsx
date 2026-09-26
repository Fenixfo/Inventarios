'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'
import { fechaYHora } from '@/lib/fechas'
import { montoEnPalabras } from '@/lib/numero-a-palabras'
import { enlaceWhatsApp, mensajeFactura, normalizarTelefono } from '@/lib/whatsapp'
import { PermissionProtector } from '@/components/PermissionProtector'

interface Item {
  id: string
  productoNombre?: string | null
  producto?: { sku: string; nombre: string } | null
  cantidadM2: number
  precioUnitario: number
  subtotal: number
}

interface Cotizacion {
  id: string
  numeroCotizacion: string
  fecha: string
  terminoPago?: string | null
  metodoPago?: string | null
  subtotal: number
  descuentoPorcentaje: number
  descuentoMonto: number
  impuesto: number
  total: number
  esBodega: boolean
  observaciones?: string | null
  cliente?: {
    nombre: string
    cedulaCc?: string | null
    telefono?: string | null
    email?: string | null
    direccion?: string | null
  } | null
  usuario?: { email: string } | null
  items: Item[]
}

const pesos = (valor: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(valor))

const etiqueta = { margin: '0 0 5px 0', color: '#666', fontSize: '12px' }

export default function CotizacionPage() {
  const params = useParams()
  const id = params.id as string

  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Envío por WhatsApp, igual que en facturas: el PDF por el menú de
  // compartir del celular, o el resumen escrito con el número ya puesto.
  const [descargando, setDescargando] = useState(false)
  const [envioWhatsApp, setEnvioWhatsApp] = useState(false)
  const [destinoWhatsApp, setDestinoWhatsApp] = useState('')
  const [compartiendo, setCompartiendo] = useState(false)
  const [avisoDescarga, setAvisoDescarga] = useState(false)

  const pedirPdf = async () => {
    const res = await apiFetch(`/api/cotizaciones/${id}/pdf`)
    if (!res.ok) throw new Error('No se pudo generar el PDF')

    const blob = await res.blob()
    const nombre = `Cotizacion-${cotizacion!.numeroCotizacion}.pdf`
    return { blob, nombre }
  }

  const bajarArchivo = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombre
    enlace.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Abre el PDF en una pestaña nueva, como la factura: desde el visor del
   * navegador se ve, se imprime o se guarda.
   *
   * La pestaña se abre en el mismo clic, antes de pedir el archivo: si se
   * abriera después de esperar al servidor, el navegador la trataría como
   * una ventana emergente y la bloquearía.
   */
  const descargarPdf = async () => {
    if (!cotizacion) return

    const ventana = window.open('', '_blank')
    if (!ventana) {
      setError('Permite las ventanas emergentes para ver la cotización')
      return
    }
    ventana.document.write('<p style="font-family: sans-serif; padding: 20px">Generando la cotización…</p>')

    setDescargando(true)
    setError(null)

    try {
      const { blob } = await pedirPdf()
      const url = URL.createObjectURL(blob)
      ventana.location.href = url
      // El visor necesita la dirección mientras carga; se libera después.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err: any) {
      ventana.close()
      setError(err.message)
    } finally {
      setDescargando(false)
    }
  }

  /**
   * En el celular abre el menú de compartir con el PDF adjunto: se elige
   * WhatsApp y el contacto. En computador casi ningún navegador comparte
   * archivos, así que se descarga para adjuntarlo a mano.
   */
  const compartirPdf = async () => {
    if (!cotizacion) return
    setCompartiendo(true)
    setError(null)

    try {
      const { blob, nombre } = await pedirPdf()
      const archivo = new File([blob], nombre, { type: 'application/pdf' })

      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: nombre })
        setEnvioWhatsApp(false)
        return
      }

      bajarArchivo(blob, nombre)
      setAvisoDescarga(true)
    } catch (err: any) {
      // Cancelar el menú de compartir no es un error.
      if (err?.name !== 'AbortError') setError(err.message || 'No se pudo compartir la cotización')
    } finally {
      setCompartiendo(false)
    }
  }

  const mensaje = () =>
    cotizacion
      ? mensajeFactura(
          { ...cotizacion, numeroFactura: cotizacion.numeroCotizacion },
          { tipo: 'cotizacion' }
        )
      : ''

  const abrirWhatsApp = () => {
    const numero = normalizarTelefono(destinoWhatsApp)
    window.open(enlaceWhatsApp(numero, mensaje()), '_blank', 'noopener,noreferrer')
    setEnvioWhatsApp(false)
  }

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await apiFetch(`/api/cotizaciones/${id}`)
        const datos = await res.json()
        if (!res.ok) throw new Error(datos.error || 'Cotización no encontrada')
        setCotizacion(datos)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [id])

  return (
    <PermissionProtector requiredPermission="cotizaciones">
      <div style={{ padding: '20px', maxWidth: '900px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin/cotizaciones" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver a Cotizaciones
          </Link>
        </div>

        {cargando ? (
          <p style={{ color: '#666' }}>Cargando...</p>
        ) : error || !cotizacion ? (
          <p style={{ color: '#dc2626' }}>{error || 'Cotización no encontrada'}</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div>
                <h1 style={{ margin: '0 0 6px 0' }}>{cotizacion.numeroCotizacion}</h1>
                <p style={{ margin: 0, color: '#666' }}>{fechaYHora(cotizacion.fecha)}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {cotizacion.esBodega && (
                  <span style={{ padding: '8px 12px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>
                    🏭 Precio de bodega
                  </span>
                )}
                <span style={{ padding: '8px 12px', backgroundColor: '#e0e7ff', color: '#3730a3', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>
                  Cotización
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div>
                  <p style={etiqueta}>CLIENTE</p>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{cotizacion.cliente?.nombre || 'Cliente General'}</p>
                  {cotizacion.cliente?.cedulaCc && (
                    <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#6b7280' }}>CC/NIT: {cotizacion.cliente.cedulaCc}</p>
                  )}
                  {cotizacion.cliente?.telefono && (
                    <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#6b7280' }}>Tel: {cotizacion.cliente.telefono}</p>
                  )}
                </div>
                <div>
                  <p style={etiqueta}>VENDEDOR</p>
                  <p style={{ margin: 0 }}>{cotizacion.usuario?.email || '-'}</p>
                </div>
                <div>
                  <p style={etiqueta}>TÉRMINO DE PAGO</p>
                  <p style={{ margin: 0 }}>{cotizacion.terminoPago || '-'}</p>
                </div>
                <div>
                  <p style={etiqueta}>MÉTODO DE PAGO</p>
                  <p style={{ margin: 0 }}>{cotizacion.metodoPago || '-'}</p>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Producto</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Cantidad (m²)</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Precio Unit.</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizacion.items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{item.productoNombre || item.producto?.nombre || '(Personalizado)'}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{Number(item.cantidadM2).toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{pesos(item.precioUnitario)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{pesos(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px', maxWidth: '420px', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span>Subtotal:</span>
                <span>{pesos(cotizacion.subtotal)}</span>
              </div>
              {Number(cotizacion.descuentoMonto) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#dc2626' }}>
                  <span>Descuento ({Number(cotizacion.descuentoPorcentaje)}%):</span>
                  <span>-{pesos(cotizacion.descuentoMonto)}</span>
                </div>
              )}
              {Number(cotizacion.impuesto) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#2563eb' }}>
                  <span>Impuesto:</span>
                  <span>+{pesos(cotizacion.impuesto)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '2px solid #ddd', paddingTop: '10px' }}>
                <span>Total:</span>
                <span>{pesos(cotizacion.total)}</span>
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                Son: {montoEnPalabras(cotizacion.total)}
              </p>
            </div>

            {cotizacion.observaciones && (
              <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 5px 0', color: '#666', fontWeight: 'bold' }}>Observaciones:</p>
                <p style={{ margin: 0 }}>{cotizacion.observaciones}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '20px' }}>
              <button
                onClick={descargarPdf}
                disabled={descargando}
                style={{
                  padding: '10px 20px',
                  backgroundColor: descargando ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: descargando ? 'wait' : 'pointer',
                }}
              >
                {descargando ? 'Generando PDF...' : 'Descargar PDF'}
              </button>

              <button
                onClick={() => {
                  // El teléfono del cliente se propone como destinatario.
                  setDestinoWhatsApp(cotizacion.cliente?.telefono || '')
                  setAvisoDescarga(false)
                  setEnvioWhatsApp(true)
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#25d366',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Enviar por WhatsApp
              </button>
            </div>

            {envioWhatsApp && (
              <div
                onClick={() => setEnvioWhatsApp(false)}
                style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="titulo-envio"
                  style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '520px', width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '24px' }}
                >
                  <h3 id="titulo-envio" style={{ marginTop: 0, marginBottom: '6px', fontSize: '18px' }}>
                    Enviar la cotización {cotizacion.numeroCotizacion}
                  </h3>

                  <div style={{ border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#166534' }}>
                      Se abre el menú de compartir del celular: eliges WhatsApp, eliges el contacto
                      y va el PDF adjunto.
                    </p>

                    <button
                      onClick={compartirPdf}
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
                      <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#166534' }}>
                        Este navegador no puede entregarle el archivo a WhatsApp, así que el PDF se
                        descargó. Adjúntalo desde WhatsApp, o abre esta cotización desde el celular
                        para mandarlo directo.
                      </p>
                    )}
                  </div>

                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '14px' }}>
                    O envía solo el resumen escrito, sin archivo. Esta vía sí permite indicar el
                    número de una vez:
                  </p>

                  <label htmlFor="destino-whatsapp" style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
                    Número de destino
                  </label>
                  <input
                    id="destino-whatsapp"
                    type="tel"
                    value={destinoWhatsApp}
                    onChange={(e) => setDestinoWhatsApp(e.target.value)}
                    placeholder="Sin número: eliges el contacto en WhatsApp"
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />

                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 18px 0' }}>
                    {cotizacion.cliente?.telefono
                      ? `Tomado del cliente ${cotizacion.cliente.nombre}.`
                      : 'Esta cotización no tiene teléfono registrado.'}{' '}
                    {normalizarTelefono(destinoWhatsApp)
                      ? `Se abrirá el chat con +${normalizarTelefono(destinoWhatsApp)}.`
                      : 'Se abrirá WhatsApp sin destinatario para que elijas a quién enviarlo.'}
                  </p>

                  <details style={{ marginBottom: '18px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#2563eb' }}>
                      Ver el mensaje que se va a enviar
                    </summary>
                    <pre style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '8px' }}>
                      {mensaje()}
                    </pre>
                  </details>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setEnvioWhatsApp(false)}
                      style={{ padding: '11px 16px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={abrirWhatsApp}
                      style={{ flex: 1, padding: '11px 16px', border: '1px solid #25d366', borderRadius: '6px', backgroundColor: 'white', color: '#128c3e', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                    >
                      Enviar solo el resumen
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
