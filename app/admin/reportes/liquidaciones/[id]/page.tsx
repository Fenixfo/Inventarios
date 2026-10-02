'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { fechaYHora } from '@/lib/fechas'
import { PermissionProtector } from '@/components/PermissionProtector'
import { pesos } from '@/lib/formato'

interface Detalle {
  id: string
  fecha: string
  vendedor: string
  autor: string | null
  porcentaje: number
  totalVenta: number
  totalCosto: number
  totalGanancia: number
  descuento: number
  descuentoMotivo: string | null
  pagoVendedor: number
  observaciones: string | null
  facturas: {
    id: string
    numeroFactura: string
    fecha: string
    cliente: string | null
    venta: number
    costo: number
    ganancia: number
  }[]
}

export default function LiquidacionPage() {
  const params = useParams()
  const id = params.id as string

  const [liquidacion, setLiquidacion] = useState<Detalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await apiFetch(`/api/liquidaciones/${id}`)
        const datos = await res.json()
        if (!res.ok) throw new Error(datos.error || 'Liquidación no encontrada')
        setLiquidacion(datos)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [id])

  return (
    <PermissionProtector requiredPermission="liquidaciones">
      <div className="card" style={{ maxWidth: 1000 }}>
        <div className="mb-4">
          <Link href="/admin/reportes/liquidaciones" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Liquidaciones
          </Link>
        </div>

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : error || !liquidacion ? (
          <p style={{ color: 'var(--status-red-solid)' }}>{error || 'Liquidación no encontrada'}</p>
        ) : (
          <>
            <h1 style={{ margin: '0 0 6px 0', color: 'var(--black-primary)' }}>Liquidación de {liquidacion.vendedor}</h1>
            <p style={{ margin: '0 0 20px 0', color: 'var(--gray-secondary)' }}>
              {fechaYHora(liquidacion.fecha)}
              {liquidacion.autor && ` · hecha por ${liquidacion.autor}`}
            </p>

            <div style={{ backgroundColor: 'var(--status-green-bg)', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div><div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Venta sin impuesto</div><strong>{pesos(liquidacion.totalVenta)}</strong></div>
                <div><div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Costo</div><strong>{pesos(liquidacion.totalCosto)}</strong></div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Ganancia</div>
                  <strong style={{ color: liquidacion.totalGanancia < 0 ? 'var(--status-red-solid)' : 'inherit' }}>{pesos(liquidacion.totalGanancia)}</strong>
                </div>
                {liquidacion.descuento > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Descuento</div>
                    <strong style={{ color: 'var(--status-red-solid)' }}>− {pesos(liquidacion.descuento)}</strong>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Pago al vendedor ({liquidacion.porcentaje}%)</div>
                  <strong style={{ fontSize: '18px', color: 'var(--status-green-text)' }}>{pesos(liquidacion.pagoVendedor)}</strong>
                </div>
              </div>
            </div>

            {liquidacion.descuento > 0 && liquidacion.descuentoMotivo && (
              <p style={{ backgroundColor: 'var(--beige-light)', padding: '12px', borderRadius: '8px' }}>
                <strong>Motivo del descuento:</strong> {liquidacion.descuentoMotivo}
              </p>
            )}

            {liquidacion.observaciones && (
              <p style={{ backgroundColor: 'var(--beige-light)', padding: '12px', borderRadius: '8px' }}>
                <strong>Observaciones:</strong> {liquidacion.observaciones}
              </p>
            )}

            <h2 className="card-title mb-3">Facturas liquidadas ({liquidacion.facturas.length})</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th style={{ textAlign: 'right' }}>Venta</th>
                    <th style={{ textAlign: 'right' }}>Costo</th>
                    <th style={{ textAlign: 'right' }}>Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidacion.facturas.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <Link href={`/admin/facturas/${f.id}`} style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
                          {f.numeroFactura}
                        </Link>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaYHora(f.fecha)}</td>
                      <td>{f.cliente || 'Cliente General'}</td>
                      <td style={{ textAlign: 'right' }}>{pesos(f.venta)}</td>
                      <td style={{ textAlign: 'right' }}>{pesos(f.costo)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: f.ganancia < 0 ? 'var(--status-red-solid)' : 'var(--status-green-text)' }}>
                        {pesos(f.ganancia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
