'use client'

import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { usePermisos } from '@/components/PermisosProvider'
import { fechaYHora } from '@/lib/fechas'
import { useListaPaginada } from '@/lib/use-lista-paginada'
import { pesos } from '@/lib/formato'
import { VerMas } from '@/components/Common/VerMas'

interface Liquidacion {
  id: string
  fecha: string
  vendedor: string
  facturas: number
  porcentaje: number
  totalVenta: number
  totalGanancia: number
  pagoVendedor: number
}

export default function LiquidacionesPage() {
  const { puede } = usePermisos()

  const { items: liquidaciones, total, cargando, cargandoMas, error, verMas, hayMas } =
    useListaPaginada<Liquidacion>('/api/liquidaciones', 'liquidaciones')

  return (
    <PermissionProtector requiredPermission="liquidaciones">
      <div className="card" style={{ maxWidth: 1100 }}>
        <div className="mb-4">
          <Link href="/admin/reportes" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Reportes
          </Link>
        </div>

        <div className="card-header">
          <div>
            <h1 className="card-title" style={{ fontSize: 20 }}>💼 Liquidaciones</h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--gray-secondary)', fontSize: '13px' }}>
              El cierre de las facturas cobradas de cada vendedor: ganancia (venta sin impuesto −
              costo) y lo que se le paga.
            </p>
          </div>
          {puede('liquidaciones.crear') && (
            <Link href="/admin/reportes/liquidaciones/nueva" className="btn-primary">
              Nueva liquidación
            </Link>
          )}
        </div>

        {error && <p style={{ color: 'var(--status-red-solid)' }}>Error: {error}</p>}

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : liquidaciones.length === 0 ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Aún no hay liquidaciones.</p>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: 'var(--gray-secondary)' }}>
              Mostrando las {liquidaciones.length} más recientes de {total}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Vendedor</th>
                    <th style={{ textAlign: 'right' }}>Facturas</th>
                    <th style={{ textAlign: 'right' }}>Venta</th>
                    <th style={{ textAlign: 'right' }}>Ganancia</th>
                    <th style={{ textAlign: 'right' }}>%</th>
                    <th style={{ textAlign: 'right' }}>Pago al vendedor</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidaciones.map((l) => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaYHora(l.fecha)}</td>
                      <td>{l.vendedor}</td>
                      <td style={{ textAlign: 'right' }}>{l.facturas}</td>
                      <td style={{ textAlign: 'right' }}>{pesos(l.totalVenta)}</td>
                      <td style={{ textAlign: 'right', color: l.totalGanancia < 0 ? 'var(--status-red-solid)' : 'inherit' }}>
                        {pesos(l.totalGanancia)}
                      </td>
                      <td style={{ textAlign: 'right' }}>{l.porcentaje}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--status-green-text)' }}>
                        {pesos(l.pagoVendedor)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/admin/reportes/liquidaciones/${l.id}`} className="btn-action">
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hayMas && (
              <VerMas restantes={total - liquidaciones.length} cargando={cargandoMas} onClick={verMas} />
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
