'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { usePermisos } from '@/components/PermisosProvider'
import { VerMas } from '@/components/Common/VerMas'
import { SelectorProveedor } from '@/components/compras/SelectorProveedor'
import type { Proveedor } from '@/components/compras/FormularioProveedor'
import { useListaPaginada } from '@/lib/use-lista-paginada'
import { soloFecha } from '@/lib/fechas'
import { pesos } from '@/lib/formato'

interface CompraDeLista {
  id: string
  fecha: string
  numeroFacturaProveedor: string | null
  estado: 'registrada' | 'anulada'
  proveedor: { id: string; nombre: string }
  lineas: number
  total: number
}

export default function ComprasPage() {
  const { puede } = usePermisos()
  const puedeCrear = puede('compras.crear')

  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const hayFiltros = Boolean(proveedor || fechaDesde || fechaHasta)

  const { items: compras, total, cargando, cargandoMas, error, verMas, hayMas } =
    useListaPaginada<CompraDeLista>('/api/compras', 'compras', {
      proveedorId: proveedor?.id ?? '',
      fechaDesde,
      fechaHasta,
    })

  const limpiar = () => {
    setProveedor(null)
    setFechaDesde('')
    setFechaHasta('')
  }

  return (
    <PermissionProtector requiredPermission="compras">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title" style={{ fontSize: 20 }}>Compras</h1>
          {puedeCrear && (
            <Link href="/admin/compras/nueva" className="btn-primary">
              + Nueva compra
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5" style={{ alignItems: 'start' }}>
          <SelectorProveedor valor={proveedor} onChange={setProveedor} etiqueta="Proveedor" permitirCrear={false} />
          <div>
            <label htmlFor="filtro-desde" className="field-label">Desde</label>
            <input
              id="filtro-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="filtro-hasta" className="field-label">Hasta</label>
            <input
              id="filtro-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="field-input"
            />
          </div>
        </div>

        {hayFiltros && (
          <button type="button" onClick={limpiar} className="btn-action mb-4">
            Quitar filtros
          </button>
        )}

        {error && <p style={{ color: 'var(--status-red-solid)' }}>Error: {error}</p>}

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : compras.length === 0 ? (
          <p style={{ color: 'var(--gray-secondary)' }}>
            {hayFiltros ? 'No hay compras con esos filtros' : 'No hay compras registradas'}
          </p>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: 'var(--gray-secondary)' }}>
              {hayFiltros ? `Mostrando ${compras.length} de ${total} que coinciden` : `Mostrando las ${compras.length} más recientes de ${total}`}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Factura</th>
                    <th style={{ textAlign: 'right' }}>Líneas</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {compras.map((c) => (
                    <tr key={c.id} style={{ opacity: c.estado === 'anulada' ? 0.65 : 1 }}>
                      <td style={{ whiteSpace: 'nowrap' }}>{soloFecha(c.fecha)}</td>
                      <td>{c.proveedor.nombre}</td>
                      <td>{c.numeroFacturaProveedor || '-'}</td>
                      <td style={{ textAlign: 'right' }}>{c.lineas}</td>
                      <td style={{ textAlign: 'right' }}>{pesos(c.total)}</td>
                      <td>
                        {c.estado === 'anulada' ? (
                          <span style={{ color: 'var(--status-red-solid)', fontWeight: 'bold' }}>Anulada</span>
                        ) : (
                          'Registrada'
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/admin/compras/${c.id}`} className="btn-action">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hayMas && <VerMas restantes={total - compras.length} cargando={cargandoMas} onClick={verMas} />}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
