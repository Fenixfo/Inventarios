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

  useEffect(() => {
    const fetchFactura = async () => {
      try {
        const res = await fetch(`/api/facturas/${id}`)
        if (!res.ok) throw new Error('Factura not found')
        const data = await res.json()
        setFactura(data)
        setEstado(data.estado)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchFactura()
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!factura) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/facturas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: factura.id,
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
        return '#10b981'
      case 'anulado':
        return '#ef4444'
      case 'pendiente':
      default:
        return '#f59e0b'
    }
  }

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
            backgroundColor: getStatusColor(factura.estado),
            color: 'white',
            borderRadius: '4px',
            fontSize: '14px',
            display: 'inline-block'
          }}>
            {factura.estado.toUpperCase()}
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
    </div>
  )
}
