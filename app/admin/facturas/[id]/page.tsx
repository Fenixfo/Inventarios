'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface FacturaItem {
  id: string
  producto: {
    nombre: string
  }
  cantidadM2: number
  precioUnitario: number
  subtotal: number
}

interface Factura {
  id: string
  numeroFactura: string
  cliente?: {
    nombre: string
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

  useEffect(() => {
    const fetchFactura = async () => {
      try {
        const res = await fetch(`/api/facturas/${id}`)
        if (!res.ok) throw new Error('Factura not found')
        const data = await res.json()
        setFactura(data)
        setEstado(data.estado)

        // Cargar abonos
        const abonosRes = await fetch(`/api/abonos/${id}`)
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

    const adelanto = Number(factura.anticipo || 0)
    const totalAbonosRegistrados = abonos.reduce((sum, abono) => sum + Number(abono.monto), 0)
    const totalAbonado = adelanto + totalAbonosRegistrados
    const saldoPendienteCalculado = Number(factura.total) - totalAbonado

    if (saldoPendienteCalculado <= 0 && factura.estado === 'pendiente' && !saving) {
      handleStatusChange('pagado')
    }
  }, [abonos, abonoCargado, factura?.total, factura?.anticipo])

  const handleStatusChange = async (newStatus: string) => {
    if (!factura) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/facturas', {
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
      const res = await fetch('/api/abonos', {
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
      const res = await fetch(`/api/facturas/${id}/pdf`)
      if (!res.ok) throw new Error('Error al descargar PDF')

      const html = await res.text()

      // Abrir en nueva ventana para imprimir/guardar como PDF
      const ventana = window.open('', '_blank')
      if (ventana) {
        ventana.document.write(html)
        ventana.document.close()

        // Auto-imprimir a PDF después de que cargue
        setTimeout(() => {
          ventana.print()
        }, 500)
      } else {
        alert('Por favor, permite las ventanas emergentes para descargar el PDF')
      }
    } catch (err: any) {
      alert('Error al descargar PDF: ' + err.message)
    }
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
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin/facturas" style={{ color: '#2563eb', textDecoration: 'none' }}>
          ← Volver a Facturas
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: '0 0 10px 0' }}>{factura.numeroFactura}</h1>
          <p style={{ margin: '5px 0', color: '#666' }}>{new Date(factura.fecha).toLocaleDateString()}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
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
              <td style={{ padding: '10px' }}>{item.producto?.nombre || '(Personalizado)'}</td>
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
                  <span>{new Date(abono.fecha).toLocaleDateString('es-CO')}</span>
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
              onClick={() => handleStatusChange('pagado')}
              disabled={saving}
              style={{
                padding: '10px 20px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Procesando...' : 'Marcar como Pagado'}
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
          onClick={() => window.print()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Imprimir
        </button>

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
      </div>

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
  )
}
