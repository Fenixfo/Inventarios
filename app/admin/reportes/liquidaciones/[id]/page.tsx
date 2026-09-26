'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { fechaYHora } from '@/lib/fechas'
import { PermissionProtector } from '@/components/PermissionProtector'

interface Detalle {
  id: string
  fecha: string
  vendedor: string
  autor: string | null
  porcentaje: number
  totalVenta: number
  totalCosto: number
  totalGanancia: number
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

const pesos = (valor: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor)

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
      <div style={{ padding: '20px', maxWidth: '1000px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin/reportes/liquidaciones" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver a Liquidaciones
          </Link>
        </div>

        {cargando ? (
          <p style={{ color: '#666' }}>Cargando...</p>
        ) : error || !liquidacion ? (
          <p style={{ color: '#dc2626' }}>{error || 'Liquidación no encontrada'}</p>
        ) : (
          <>
            <h1 style={{ margin: '0 0 6px 0' }}>Liquidación de {liquidacion.vendedor}</h1>
            <p style={{ margin: '0 0 20px 0', color: '#6b7280' }}>
              {fechaYHora(liquidacion.fecha)}
              {liquidacion.autor && ` · hecha por ${liquidacion.autor}`}
            </p>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                <div><div style={{ fontSize: '12px', color: '#6b7280' }}>Venta sin impuesto</div><strong>{pesos(liquidacion.totalVenta)}</strong></div>
                <div><div style={{ fontSize: '12px', color: '#6b7280' }}>Costo</div><strong>{pesos(liquidacion.totalCosto)}</strong></div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Ganancia</div>
                  <strong style={{ color: liquidacion.totalGanancia < 0 ? '#dc2626' : 'inherit' }}>{pesos(liquidacion.totalGanancia)}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Pago al vendedor ({liquidacion.porcentaje}%)</div>
                  <strong style={{ fontSize: '18px', color: '#059669' }}>{pesos(liquidacion.pagoVendedor)}</strong>
                </div>
              </div>
            </div>

            {liquidacion.observaciones && (
              <p style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '6px' }}>
                <strong>Observaciones:</strong> {liquidacion.observaciones}
              </p>
            )}

            <h2 style={{ fontSize: '16px' }}>Facturas liquidadas ({liquidacion.facturas.length})</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Número</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Venta</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Costo</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidacion.facturas.map((f) => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>
                        <Link href={`/admin/facturas/${f.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                          {f.numeroFactura}
                        </Link>
                      </td>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{fechaYHora(f.fecha)}</td>
                      <td style={{ padding: '10px' }}>{f.cliente || 'Cliente General'}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{pesos(f.venta)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{pesos(f.costo)}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: f.ganancia < 0 ? '#dc2626' : '#059669' }}>
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
