'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'
import { fechaYHora } from '@/lib/fechas'
import { montoEnPalabras } from '@/lib/numero-a-palabras'
import { mensajeFactura } from '@/lib/whatsapp'
import { abrirPdfEnPestana, compartirPdf } from '@/lib/pdf-navegador'
import { PermissionProtector } from '@/components/PermissionProtector'
import { DialogoEnvioWhatsApp } from '@/components/Common/DialogoEnvioWhatsApp'
import { pesos } from '@/lib/formato'

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

const etiqueta = { margin: '0 0 5px 0', color: '#666', fontSize: '12px' }

export default function CotizacionPage() {
  const params = useParams()
  const id = params.id as string

  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [descargando, setDescargando] = useState(false)
  const [envioWhatsApp, setEnvioWhatsApp] = useState(false)

  /** Abre el PDF en una pestaña nueva, como la factura. */
  const descargarPdf = async () => {
    setDescargando(true)
    setError(null)

    try {
      await abrirPdfEnPestana(`/api/cotizaciones/${id}/pdf`, 'Generando la cotización…')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF')
    } finally {
      setDescargando(false)
    }
  }

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await apiFetch(`/api/cotizaciones/${id}`)
        const datos = await res.json()
        if (!res.ok) throw new Error(datos.error || 'Cotización no encontrada')
        setCotizacion(datos)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Cotización no encontrada')
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
                onClick={() => setEnvioWhatsApp(true)}
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
              <DialogoEnvioWhatsApp
                documento={`la cotización ${cotizacion.numeroCotizacion}`}
                sinTelefono="Esta cotización no tiene teléfono registrado."
                telefonoCliente={cotizacion.cliente?.telefono}
                nombreCliente={cotizacion.cliente?.nombre}
                mensaje={mensajeFactura(
                  { ...cotizacion, numeroFactura: cotizacion.numeroCotizacion },
                  { tipo: 'cotizacion' }
                )}
                onCompartirPdf={() => compartirPdf(`/api/cotizaciones/${id}/pdf`, `Cotizacion-${cotizacion.numeroCotizacion}.pdf`)}
                onCerrar={() => setEnvioWhatsApp(false)}
              />
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
