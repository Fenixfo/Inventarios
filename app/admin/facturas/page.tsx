'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { BuscadorEnter } from '@/components/Common/BuscadorEnter'
import { fechaYHora } from '@/lib/fechas'
import { useListaPaginada } from '@/lib/use-lista-paginada'
import { pesos } from '@/lib/formato'
import { VerMas } from '@/components/Common/VerMas'

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
      return 'var(--status-blue-text)'
    case 'entregado':
      return 'var(--status-teal-text)'
    case 'anulado':
      return 'var(--status-red-solid)'
    // El final de una factura cobrada: ya se repartió la ganancia.
    case 'liquidado':
      return 'var(--status-indigo-text)'
    case 'pendiente':
    default:
      return 'var(--status-amber-text)'
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
      <div className="card">
        <div className="card-header">
          <h1 className="card-title" style={{ fontSize: 20 }}>Facturas</h1>
          <Link href="/admin/facturas/nueva" className="btn-primary">
            + Nueva Factura
          </Link>
        </div>

        {/* Filtros por estado */}
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setEstadoFiltro(null)}
            className="badge"
            style={{
              padding: '8px 16px',
              backgroundColor: estadoFiltro === null ? 'var(--gold)' : 'var(--beige-light)',
              color: estadoFiltro === null ? 'var(--black-primary)' : 'var(--black-primary)',
              cursor: 'pointer',
              fontWeight: estadoFiltro === null ? 'bold' : 'normal',
              fontSize: '14px',
              borderRadius: '8px',
            }}
          >
            Todos
          </button>
          {['pendiente', 'entregado', 'pagado', 'liquidado'].map((estado) => (
            <button
              key={estado}
              onClick={() => setEstadoFiltro(estado)}
              className="badge"
              style={{
                padding: '8px 16px',
                backgroundColor: estadoFiltro === estado ? getStatusColor(estado) : 'var(--beige-light)',
                color: estadoFiltro === estado ? 'white' : 'var(--black-primary)',
                cursor: 'pointer',
                fontWeight: estadoFiltro === estado ? 'bold' : 'normal',
                fontSize: '14px',
                borderRadius: '8px',
              }}
            >
              {formatearEstado(estado)}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="mb-5" style={{ maxWidth: 500 }}>
          <BuscadorEnter onBuscar={setBusqueda} etiqueta="Buscar" placeholder="Número de factura, cliente o cédula" />
        </div>

        {error && <p style={{ color: 'var(--status-red-solid)' }}>Error: {error}</p>}

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : facturas.length === 0 ? (
          <p style={{ color: 'var(--gray-secondary)' }}>
            {hayFiltros ? 'No hay facturas que coincidan con la búsqueda' : 'No hay facturas registradas'}
          </p>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: 'var(--gray-secondary)' }}>
              {hayFiltros
                ? `Mostrando ${facturas.length} de ${total} que coinciden${estadoFiltro ? ` (${formatearEstado(estadoFiltro)})` : ''}`
                : `Mostrando las ${facturas.length} más recientes de ${total}`}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th>Fecha y hora</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((factura) => (
                    <tr key={factura.id}>
                      <td><strong>{factura.numeroFactura}</strong></td>
                      <td>{factura.cliente?.nombre || 'Cliente General'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaYHora(factura.fecha)}</td>
                      <td style={{ textAlign: 'right' }}>{pesos(factura.total)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="badge"
                          style={{ backgroundColor: getStatusColor(factura.estado), color: 'white' }}
                        >
                          {formatearEstado(factura.estado)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/admin/facturas/${factura.id}`} className="btn-action">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hayMas && (
              <VerMas restantes={total - facturas.length} cargando={cargandoMas} onClick={verMas} />
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
