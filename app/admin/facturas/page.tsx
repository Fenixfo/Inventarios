'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'

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
    cedulaCc?: string
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
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null)

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

  // Filtrar facturas por búsqueda y estado
  const facturasFiltradas = facturas.filter((factura) => {
    // Filtro de búsqueda
    const termino = busqueda.toLowerCase()
    const numeroMatch = factura.numeroFactura.toLowerCase().includes(termino)
    const cedulaMatch = factura.cliente?.cedulaCc?.toLowerCase().includes(termino)
    const clienteMatch = factura.cliente?.nombre?.toLowerCase().includes(termino)
    const busquedaValida = !busqueda || numeroMatch || cedulaMatch || clienteMatch

    // Filtro de estado
    const estadoValido = !estadoFiltro || factura.estado === estadoFiltro

    return busquedaValida && estadoValido
  })

  return (
    <PermissionProtector requiredPermission="facturas">
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

      {/* Filtros por estado */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <button
            onClick={() => setEstadoFiltro(null)}
            style={{
              padding: '8px 16px',
              backgroundColor: estadoFiltro === null ? '#2563eb' : '#e5e7eb',
              color: estadoFiltro === null ? 'white' : '#374151',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: estadoFiltro === null ? 'bold' : 'normal',
              fontSize: '14px'
            }}
          >
            Todos
          </button>
          {['pendiente', 'entregado', 'pagado'].map((estado) => (
            <button
              key={estado}
              onClick={() => setEstadoFiltro(estado)}
              style={{
                padding: '8px 16px',
                backgroundColor: estadoFiltro === estado ? getStatusColor(estado) : '#e5e7eb',
                color: estadoFiltro === estado ? 'white' : '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: estadoFiltro === estado ? 'bold' : 'normal',
                fontSize: '14px'
              }}
            >
              {formatearEstado(estado)}
            </button>
          ))}
        </div>
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por número de factura o cédula del cliente..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '10px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
        {(busqueda || estadoFiltro) && (
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#666' }}>
            Se encontraron {facturasFiltradas.length} resultado(s)
            {estadoFiltro && ` (${formatearEstado(estadoFiltro)})`}
          </p>
        )}
      </div>

      {facturasFiltradas.length === 0 ? (
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
            {facturasFiltradas.map((factura) => (
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
    </PermissionProtector>
  )
}
