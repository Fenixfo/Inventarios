'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { BuscadorEnter } from '@/components/Common/BuscadorEnter'
import { fechaYHora } from '@/lib/fechas'
import { useListaPaginada } from '@/lib/use-lista-paginada'

interface Factura {
  id: string
  numeroFactura: string
  cliente?: {
    nombre: string
    cedulaCc?: string
  } | null
  fecha: string
  total: number
  estado: string
}

const getStatusColor = (estado: string) => {
  switch (estado) {
    case 'pagado':
      return '#10b981'
    case 'entregado':
      return '#0891b2'
    case 'anulado':
      return '#ef4444'
    // El final de una factura cobrada: ya se repartió la ganancia.
    case 'liquidado':
      return '#6366f1'
    case 'pendiente':
    default:
      return '#f59e0b'
  }
}

const formatearEstado = (estado: string) => estado.charAt(0).toUpperCase() + estado.slice(1)

export default function FacturasPage() {
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<string | null>(null)

  // Las 10 más recientes y el resto con "Ver más". La búsqueda y el estado
  // van al servidor y se suman; quien solo puede ver sus facturas busca
  // entre las suyas, porque ese alcance lo pone el servidor.
  const { items: facturas, total, cargando, cargandoMas, error, verMas, hayMas } =
    useListaPaginada<Factura>('/api/facturas', 'facturas', {
      busqueda,
      estado: estadoFiltro || '',
    })

  const hayFiltros = Boolean(busqueda || estadoFiltro)

  return (
    <PermissionProtector requiredPermission="facturas">
      <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
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
          {['pendiente', 'entregado', 'pagado', 'liquidado'].map((estado) => (
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
      <div style={{ marginBottom: '20px', maxWidth: '500px' }}>
        <BuscadorEnter
          onBuscar={setBusqueda}
          etiqueta="Buscar"
          placeholder="Número de factura, cliente o cédula"
        />
      </div>

      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}

      {cargando ? (
        <p style={{ color: '#666' }}>Cargando...</p>
      ) : facturas.length === 0 ? (
        <p style={{ color: '#666' }}>
          {hayFiltros ? 'No hay facturas que coincidan con la búsqueda' : 'No hay facturas registradas'}
        </p>
      ) : (
        <>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 10px 0' }}>
            {hayFiltros
              ? `Mostrando ${facturas.length} de ${total} que coinciden${estadoFiltro ? ` (${formatearEstado(estadoFiltro)})` : ''}`
              : `Mostrando las ${facturas.length} más recientes de ${total}`}
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Número</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Cliente</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Fecha y hora</th>
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
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{fechaYHora(factura.fecha)}</td>
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
                      }}>
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hayMas && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                onClick={verMas}
                disabled={cargandoMas}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'white',
                  color: '#2563eb',
                  border: '1px solid #2563eb',
                  borderRadius: '4px',
                  cursor: cargandoMas ? 'wait' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {cargandoMas ? 'Cargando...' : `Ver más (${total - facturas.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </PermissionProtector>
  )
}
