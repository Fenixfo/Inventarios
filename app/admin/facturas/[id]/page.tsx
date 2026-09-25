'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { enlaceWhatsApp, mensajeFactura, normalizarTelefono } from '@/lib/whatsapp'
import { fechaYHora } from '@/lib/fechas'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { apiFetch } from '@/lib/api-client'
import { PermissionProtector } from '@/components/PermissionProtector'

interface FacturaItem {
  id: string
  productoNombre?: string | null
  producto?: {
    nombre: string
  } | null
  cantidadM2: number
  precioUnitario: number
  subtotal: number
}

interface Factura {
  id: string
  numeroFactura: string
  cliente?: {
    nombre: string
    telefono?: string | null
  }
  usuario?: {
    email: string
  }
  fecha: string
  terminoPago?: string
  metodoPago?: string
  subtotal: number
  descuentoPorcentaje: number
  descuentoMonto: number
  impuesto: number
  total: number
  anticipo: number
  contraEntrega: number
  estado: string
  esBodega?: boolean
  observaciones?: string
  items: FacturaItem[]
}

export default function FacturaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [factura, setFactura] = useState<Factura | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState('')
  const [nuevoAbono, setNuevoAbono] = useState('')
  const [abonos, setAbonos] = useState<Array<{ monto: number; fecha: string }>>([])
  const [abonoCargado, setAbonoCargado] = useState(false)
  const [mostrarConfirmacionAbono, setMostrarConfirmacionAbono] = useState(false)
  const [montoAbonoConfirmacion, setMontoAbonoConfirmacion] = useState(0)

  // Marca que el saldo se está cerrando desde el botón de "pagado", para
  // que el efecto que vigila el saldo no dispare el mismo cambio a la vez.
  const saldandoRef = useRef(false)

  // Envío por WhatsApp: el destinatario se puede corregir antes de abrir
  // el chat, y queda vacío si la factura no trae teléfono.
  const [envioWhatsApp, setEnvioWhatsApp] = useState(false)
  const [destinoWhatsApp, setDestinoWhatsApp] = useState('')
  const [compartiendo, setCompartiendo] = useState(false)
  const [avisoDescarga, setAvisoDescarga] = useState(false)

  useEffect(() => {
    const fetchFactura = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email

        const url = email
          ? `/api/facturas/${id}?email=${encodeURIComponent(email)}`
          : `/api/facturas/${id}`

        const res = await apiFetch(url)
        if (!res.ok) {
          if (res.status === 403) {
            setError('No tienes permiso para ver esta factura')
          } else {
            throw new Error('Factura not found')
          }
          return
        }
        const data = await res.json()
        setFactura(data)
        setEstado(data.estado)

        // Cargar abonos
        const abonosRes = await apiFetch(`/api/abonos/${id}`)
        if (abonosRes.ok) {
          const abonosData = await abonosRes.json()
          const abonosConNumeros = (abonosData || []).map((abono: any) => ({
            ...abono,
            monto: Number(abono.monto),
          }))
          setAbonos(abonosConNumeros)
        }
        setAbonoCargado(true)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchFactura()
  }, [id])

  useEffect(() => {
    if (!factura || !abonoCargado) return

    // Mientras el botón de "pagado" hace su trabajo, este efecto se queda
    // quieto: si no, los dos mandarían el cambio de estado a la vez.
    if (saldandoRef.current) return

    const adelanto = Number(factura.anticipo || 0)
    const totalAbonosRegistrados = abonos.reduce((sum, abono) => sum + Number(abono.monto), 0)
    const totalAbonado = adelanto + totalAbonosRegistrados
    const saldoPendienteCalculado = Number(factura.total) - totalAbonado

    if (saldoPendienteCalculado <= 0 && factura.estado === 'pendiente' && !saving) {
      handleStatusChange('pagado')
    }
  }, [abonos, abonoCargado, factura?.total, factura?.anticipo])

  /**
   * Marcar la factura como pagada salda lo que falte.
   *
   * Antes el estado pasaba a "pagado" pero el saldo seguía mostrando deuda:
   * la factura se daba por cobrada sin que ese dinero apareciera en ningún
   * abono, así que los totales de caja no cuadraban con los estados.
   */
  const handleMarcarPagado = async () => {
    if (!factura) return

    if (saldoPendiente <= 0) {
      await handleStatusChange('pagado')
      return
    }

    saldandoRef.current = true
    setSaving(true)
    setError(null)

    try {
      const res = await apiFetch('/api/abonos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facturaId: factura.id, monto: saldoPendiente }),
      })

      if (!res.ok) throw new Error('No se pudo registrar el abono del saldo pendiente')

      const abonoDelSaldo = await res.json()
      setAbonos([
        ...abonos,
        { monto: Number(abonoDelSaldo.monto), fecha: abonoDelSaldo.fecha },
      ])
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
      saldandoRef.current = false
      return
    }

    setSaving(false)
    await handleStatusChange('pagado')
    saldandoRef.current = false
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!factura) return

    setSaving(true)
    setError(null)

    try {
      const res = await apiFetch('/api/facturas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...factura,
          estado: newStatus,
        }),
      })

      if (!res.ok) throw new Error('Error updating status')
      const updated = await res.json()
      setFactura(updated)
      setEstado(newStatus)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAnular = async () => {
    if (!window.confirm('¿Anular esta factura?')) return

    await handleStatusChange('anulado')
  }

  const handleAgregarAbono = () => {
    if (!factura || !nuevoAbono) return

    const monto = parseFloat(nuevoAbono)
    if (isNaN(monto) || monto <= 0) {
      alert('Ingrese un monto válido')
      return
    }

    const montoMaximoPermitido = saldoPendiente + 10000
    if (monto > montoMaximoPermitido) {
      alert(`El abono no puede exceder el saldo pendiente en más de $10.000\nSaldo pendiente: ${formatearDinero(saldoPendiente)}\nMáximo permitido: ${formatearDinero(montoMaximoPermitido)}`)
      return
    }

    setMontoAbonoConfirmacion(monto)
    setMostrarConfirmacionAbono(true)
  }

  const handleConfirmarAbono = async () => {
    if (!factura) return

    setSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email

      const url = email
        ? `/api/abonos?email=${encodeURIComponent(email)}`
        : '/api/abonos'

      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaId: factura.id,
          monto: montoAbonoConfirmacion,
        }),
      })

      if (!res.ok) throw new Error('Error al agregar abono')
      const nuevoAbonoData = await res.json()

      setAbonos([...abonos, {
        monto: Number(nuevoAbonoData.monto),
        fecha: nuevoAbonoData.fecha,
      }])
      setNuevoAbono('')
      setMostrarConfirmacionAbono(false)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDescargarPDF = async () => {
    try {
      const res = await apiFetch(`/api/facturas/${id}/pdf`)
      if (!res.ok) throw new Error('Error al generar la factura')

      const html = await res.text()

      // El HTML dispara su propio diálogo de impresión al cargar,
      // así que aquí solo se abre la pestaña.
      const ventana = window.open('', '_blank')
      if (!ventana) {
        alert('Permite las ventanas emergentes para ver la factura')
        return
      }

      ventana.document.write(html)
      ventana.document.close()
    } catch (err: any) {
      alert('Error al generar el PDF: ' + err.message)
    }
  }

  /**
   * Comparte el archivo PDF de la factura.
   *
   * En el celular abre el menú de compartir del sistema: se elige WhatsApp
   * y ahí mismo el contacto, y va el PDF adjunto. Es la única forma de
   * mandar el archivo sin pagar la API de WhatsApp, y a cambio el
   * destinatario no se puede preseleccionar.
   *
   * En computador casi ningún navegador permite compartir archivos, así
   * que se descarga y se adjunta a mano.
   */
  const compartirPdf = async () => {
    if (!factura) return

    setCompartiendo(true)
    setError(null)

    try {
      const res = await apiFetch(`/api/facturas/${id}/pdf?formato=pdf`)
      if (!res.ok) throw new Error('No se pudo generar el PDF')

      const blob = await res.blob()
      const nombre = `Factura-${factura.numeroFactura}.pdf`
      const archivo = new File([blob], nombre, { type: 'application/pdf' })

      // canShare con archivos es lo que distingue un celular capaz de
      // entregarle el PDF a WhatsApp de un navegador que solo sabe bajarlo.
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: nombre })
        setEnvioWhatsApp(false)
        return
      }

      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = nombre
      enlace.click()
      URL.revokeObjectURL(url)

      setAvisoDescarga(true)
    } catch (err: any) {
      // Cancelar el menú de compartir no es un error que haya que mostrar.
      if (err?.name !== 'AbortError') {
        setError(err.message || 'No se pudo compartir la factura')
      }
    } finally {
      setCompartiendo(false)
    }
  }

  /**
   * Abre WhatsApp con el resumen de la factura.
   *
   * WhatsApp no deja adjuntar archivos desde un enlace, así que va el
   * resumen en el mensaje y el PDF se adjunta a mano desde la otra ventana.
   * Sin teléfono, el enlace abre sin destinatario y WhatsApp pide a quién
   * enviarlo.
   */
  const abrirWhatsApp = () => {
    if (!factura) return

    const numero = normalizarTelefono(destinoWhatsApp)

    const mensaje = mensajeFactura(factura, {
      totalAbonado,
      saldoPendiente,
    })

    window.open(enlaceWhatsApp(numero, mensaje), '_blank', 'noopener,noreferrer')
    setEnvioWhatsApp(false)
  }

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>
  if (!factura) return <div style={{ padding: '20px', color: 'red' }}>Factura no encontrada</div>

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pagado':
        return { bg: '#10b981', text: 'white' }
      case 'entregado':
        return { bg: '#0891b2', text: 'white' }
      case 'anulado':
        return { bg: '#ef4444', text: 'white' }
      case 'pendiente':
      default:
        return { bg: '#f59e0b', text: 'white' }
    }
  }

  const formatearEstado = (estado: string) => {
    return estado.charAt(0).toUpperCase() + estado.slice(1)
  }

  const formatearDinero = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor)
  }

  const totalAbonosRegistrados = abonos.reduce((sum, abono) => sum + Number(abono.monto), 0)
  const adelanto = Number(factura?.anticipo || 0)
  const totalAbonadoSinAdelanto = totalAbonosRegistrados
  const totalAbonado = adelanto + totalAbonadoSinAdelanto
  const saldoPendiente = factura ? Number(factura.total) - totalAbonado : 0

  return (
    <PermissionProtector requiredPermission="facturas">
      <div style={{ padding: '20px', maxWidth: '900px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin/facturas" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver a Facturas
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: '0 0 10px 0' }}>{factura.numeroFactura}</h1>
            <p style={{ margin: '5px 0', color: '#666' }}>{fechaYHora(factura.fecha)}</p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Marca por qué los precios de esta factura son distintos. */}
            {factura.esBodega && (
              <span style={{
                padding: '8px 12px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                borderRadius: '4px',
                fontSize: '14px',
                display: 'inline-block',
                fontWeight: 'bold'
              }}>
                🏭 Precio de bodega
              </span>
            )}
            <span style={{
              padding: '8px 12px',
              backgroundColor: getStatusColor(factura.estado).bg,
              color: getStatusColor(factura.estado).text,
              borderRadius: '4px',
              fontSize: '14px',
              display: 'inline-block',
              fontWeight: 'bold'
            }}>
              {formatearEstado(factura.estado)}
            </span>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>CLIENTE</p>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{factura.cliente?.nombre || 'Cliente General'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>VENDEDOR</p>
              <p style={{ margin: 0 }}>{factura.usuario?.email || '-'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>TÉRMINO DE PAGO</p>
              <p style={{ margin: 0 }}>{factura.terminoPago || '-'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>MÉTODO DE PAGO</p>
              <p style={{ margin: 0 }}>{factura.metodoPago || '-'}</p>
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Producto</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Cantidad (m²)</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Precio Unit.</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {factura.items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{item.productoNombre || item.producto?.nombre || '(Personalizado)'}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>{Number(item.cantidadM2).toFixed(2)}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>${Number(item.precioUnitario).toFixed(2)}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>${Number(item.subtotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px', maxWidth: '400px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Subtotal:</span>
            <span>${Number(factura.subtotal).toFixed(2)}</span>
          </div>
          {factura.descuentoMonto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#dc2626' }}>
              <span>Descuento ({factura.descuentoPorcentaje}%):</span>
              <span>-${Number(factura.descuentoMonto).toFixed(2)}</span>
            </div>
          )}
          {factura.impuesto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#2563eb' }}>
              <span>Impuesto:</span>
              <span>+${Number(factura.impuesto).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '2px solid #ddd', paddingTop: '10px' }}>
            <span>Total:</span>
            <span>${Number(factura.total).toFixed(2)}</span>
          </div>
        </div>

        {factura.observaciones && (
          <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 5px 0', color: '#666', fontWeight: 'bold' }}>Observaciones:</p>
            <p style={{ margin: 0 }}>{factura.observaciones}</p>
          </div>
        )}

        <div style={{ backgroundColor: '#f0f9ff', padding: '15px', borderRadius: '4px', marginBottom: '20px', border: '1px solid #0ea5e9' }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#0369a1' }}>Términos de Pago</h3>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace' }}>
              <span>Total:</span>
              <span style={{ fontWeight: 'bold' }}>{formatearDinero(factura.total)}</span>
            </div>

            {adelanto > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace', color: '#059669' }}>
                <span>Adelanto (Inicial):</span>
                <span>{formatearDinero(adelanto)}</span>
              </div>
            )}

            {abonos.length > 0 && (
              <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Abonos Registrados:</p>
                {abonos.map((abono, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                    <span>{fechaYHora(abono.fecha)}</span>
                    <span>{formatearDinero(abono.monto)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', fontWeight: 'bold', fontFamily: 'monospace', fontSize: '12px' }}>
                  <span>Subtotal abonos:</span>
                  <span>{formatearDinero(totalAbonosRegistrados)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontFamily: 'monospace', backgroundColor: 'white', padding: '8px', borderRadius: '4px' }}>
              <span>Total Abonado:</span>
              <span style={{ fontWeight: 'bold', color: '#059669' }}>{formatearDinero(totalAbonado)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', backgroundColor: saldoPendiente > 0 ? '#fef2f2' : '#f0fdf4', padding: '10px', borderRadius: '4px', borderLeft: `4px solid ${saldoPendiente > 0 ? '#dc2626' : '#10b981'}` }}>
              <span style={{ fontWeight: 'bold' }}>Saldo Pendiente:</span>
              <span style={{ fontWeight: 'bold', color: saldoPendiente > 0 ? '#dc2626' : '#10b981' }}>{formatearDinero(saldoPendiente)}</span>
            </div>
          </div>

          {factura.estado === 'pendiente' && saldoPendiente > 0 && (
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #0ea5e9' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold', color: '#0369a1' }}>Agregar Nuevo Abono:</p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="number"
                    value={nuevoAbono}
                    onChange={(e) => setNuevoAbono(e.target.value)}
                    placeholder="Ingrese monto del abono"
                    title={`Máximo permitido: ${formatearDinero(Math.max(0, saldoPendiente + 10000))}`}
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
                  onClick={handleAgregarAbono}
                  disabled={saving || !nuevoAbono}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0ea5e9',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    opacity: saving || !nuevoAbono ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {saving ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          {factura.estado === 'pendiente' && (
            <>
              <button
                onClick={handleMarcarPagado}
                disabled={saving}
                title={
                  saldoPendiente > 0
                    ? `Se registrará un abono de ${formatearDinero(saldoPendiente)} para dejar el saldo en cero`
                    : 'La factura ya está saldada'
                }
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {saving
                  ? 'Procesando...'
                  : saldoPendiente > 0
                    ? `Marcar como Pagado (abona ${formatearDinero(saldoPendiente)})`
                    : 'Marcar como Pagado'}
              </button>

              <button
                onClick={handleAnular}
                disabled={saving}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {saving ? 'Procesando...' : 'Anular Factura'}
              </button>
            </>
          )}

          {factura.estado === 'pagado' && (
            <button
              onClick={() => handleStatusChange('entregado')}
              disabled={saving}
              style={{
                padding: '10px 20px',
                backgroundColor: '#0891b2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Procesando...' : 'Marcar como Entregado'}
            </button>
          )}

          <button
            onClick={handleDescargarPDF}
            style={{
              padding: '10px 20px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Descargar PDF
          </button>

          <button
            onClick={() => {
              // El teléfono del cliente se propone como destinatario; si no
              // tiene, el campo queda vacío y se elige el contacto en
              // WhatsApp.
              setDestinoWhatsApp(factura.cliente?.telefono || '')
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
            Enviar factura por WhatsApp
          </button>
        </div>

        {/* Envío por WhatsApp */}
        {envioWhatsApp && (
          <div
            onClick={() => setEnvioWhatsApp(false)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '520px', width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '24px' }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '6px', fontSize: '18px' }}>
                Enviar la factura {factura.numeroFactura}
              </h3>

              {/* Camino principal: el archivo */}
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
                    descargó. Adjúntalo desde WhatsApp, o abre esta factura desde el celular
                    para mandarlo directo.
                  </p>
                )}
              </div>

              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '14px' }}>
                O envía solo el resumen escrito, sin archivo. Esta vía sí permite indicar el
                número de una vez:
              </p>

              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
                Número de destino
              </label>
              <input
                type="tel"
                value={destinoWhatsApp}
                onChange={(e) => setDestinoWhatsApp(e.target.value)}
                placeholder="Sin número: eliges el contacto en WhatsApp"
                style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />

              <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 18px 0' }}>
                {factura.cliente?.telefono
                  ? `Tomado del cliente ${factura.cliente.nombre}.`
                  : 'Esta factura no tiene teléfono registrado.'}{' '}
                {normalizarTelefono(destinoWhatsApp)
                  ? `Se abrirá el chat con +${normalizarTelefono(destinoWhatsApp)}.`
                  : 'Se abrirá WhatsApp sin destinatario para que elijas a quién enviarlo.'}
              </p>

              <details style={{ marginBottom: '18px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#2563eb' }}>
                  Ver el mensaje que se va a enviar
                </summary>
                <pre style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '8px' }}>
                  {mensajeFactura(factura, { totalAbonado, saldoPendiente })}
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

        {mostrarConfirmacionAbono && (
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
                    {formatearDinero(saldoPendiente)}
                  </p>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '12px' }}>Abono a Registrar:</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0ea5e9', fontFamily: 'monospace' }}>
                    {formatearDinero(montoAbonoConfirmacion)}
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
                    color: saldoPendiente - montoAbonoConfirmacion > 0 ? '#dc2626' : '#10b981',
                    fontFamily: 'monospace'
                  }}>
                    {formatearDinero(saldoPendiente - montoAbonoConfirmacion)}
                  </p>
                </div>
              </div>

              {montoAbonoConfirmacion > saldoPendiente && (
                <div style={{
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fcd34d',
                  color: '#92400e',
                  padding: '12px',
                  borderRadius: '4px',
                  marginBottom: '15px',
                  fontSize: '12px',
                }}>
                  <strong>⚠️ Advertencia:</strong> Este abono es superior al saldo pendiente de {formatearDinero(saldoPendiente)}.
                  Está pagando {formatearDinero(montoAbonoConfirmacion - saldoPendiente)} de más.
                </div>
              )}

              <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px', textAlign: 'center' }}>
                ¿Confirma el registro de este abono? Esta acción no se puede deshacer.
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setMostrarConfirmacionAbono(false)}
                  disabled={saving}
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
                  onClick={handleConfirmarAbono}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Guardando...' : 'Confirmar Abono'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionProtector>
  )
}
