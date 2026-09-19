'use client'

import { useEffect, useState } from 'react'
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
  fecha: string
  total: number
  estado: string
  items: FacturaItem[]
}

export default function FacturasPage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchFacturas = async () => {
      try {
        const res = await fetch('/api/facturas')
        if (!res.ok) throw new Error('Error fetching facturas')
        const data = await res.json()
        setFacturas(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchFacturas()
  }, [])

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'pagado':
        return '#10b981'
      case 'entregado':
        return '#0891b2'
      case 'anulado':
        return '#ef4444'
      case 'pendiente':
      default:
        return '#f59e0b'
    }
  }

  const formatearEstado = (estado: string) => {
    return estado.charAt(0).toUpperCase() + estado.slice(1)
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Facturas</h1>
        <Link href="/admin/facturas/nueva" style={{
          padding: '10px 20px',
          backgroundColor: '#2563eb',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px'
        }}>
          Nueva Factura
        </Link>
      </div>

      {facturas.length === 0 ? (
        <p style={{ color: '#666' }}>No hay facturas registradas</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Número</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((factura) => (
              <tr key={factura.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}><strong>{factura.numeroFactura}</strong></td>
                <td style={{ padding: '10px' }}>{factura.cliente?.nombre || 'Cliente General'}</td>
                <td style={{ padding: '10px' }}>{new Date(factura.fecha).toLocaleDateString()}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>${Number(factura.total).toFixed(2)}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 8px',
                    backgroundColor: getStatusColor(factura.estado),
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {formatearEstado(factura.estado)}
                  </span>
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <Link href={`/admin/facturas/${factura.id}`} style={{
                    color: '#2563eb',
                    textDecoration: 'none',
                    marginRight: '10px'
                  }}>
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
