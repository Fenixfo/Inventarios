'use client'

import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { usePermisos } from '@/components/PermisosProvider'
import { fechaYHora } from '@/lib/fechas'
import { useListaPaginada } from '@/lib/use-lista-paginada'

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

const pesos = (valor: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)

export default function LiquidacionesPage() {
  const { puede } = usePermisos()

  const { items: liquidaciones, total, cargando, cargandoMas, error, verMas, hayMas } =
    useListaPaginada<Liquidacion>('/api/liquidaciones', 'liquidaciones')

  return (
    <PermissionProtector requiredPermission="liquidaciones">
      <div style={{ padding: '20px', maxWidth: '1100px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin/reportes" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver a Reportes
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0 }}>💼 Liquidaciones</h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '13px' }}>
              El cierre de las facturas cobradas de cada vendedor: ganancia (venta sin impuesto −
              costo) y lo que se le paga.
            </p>
          </div>
          {puede('liquidaciones.crear') && (
            <Link href="/admin/reportes/liquidaciones/nueva" style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
            }}>
              Nueva liquidación
            </Link>
          )}
        </div>

        {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}

        {cargando ? (
          <p style={{ color: '#666' }}>Cargando...</p>
        ) : liquidaciones.length === 0 ? (
          <p style={{ color: '#666' }}>Aún no hay liquidaciones.</p>
        ) : (
          <>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 10px 0' }}>
              Mostrando las {liquidaciones.length} más recientes de {total}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Vendedor</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Facturas</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Venta</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Ganancia</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>%</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Pago al vendedor</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidaciones.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{fechaYHora(l.fecha)}</td>
                      <td style={{ padding: '10px' }}>{l.vendedor}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{l.facturas}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{pesos(l.totalVenta)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: l.totalGanancia < 0 ? '#dc2626' : 'inherit' }}>
                        {pesos(l.totalGanancia)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{l.porcentaje}%</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>
                        {pesos(l.pagoVendedor)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <Link href={`/admin/reportes/liquidaciones/${l.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
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
                  {cargandoMas ? 'Cargando...' : `Ver más (${total - liquidaciones.length} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
