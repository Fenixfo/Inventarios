'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { PermissionProtector } from '@/components/PermissionProtector'

interface ReporteFacturacion {
  periodo: {
    desde: string
    hasta: string
  }
  metricas: {
    totalVendido: number
    numeroFacturas: number
    promedioPorFactura: number
    clienteTop: {
      nombre: string
      total: number
      cantidad: number
    } | null
  }
  ventasPorDia: Array<{
    fecha: string
    total: number
  }>
  productosTop: Array<{
    nombre: string
    cantidad: number
    ingresos: number
  }>
}

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState('mes')
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('')
  const [reporte, setReporte] = useState<ReporteFacturacion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Obtener mes actual en formato YYYY-MM
  useEffect(() => {
    const hoy = new Date()
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
    setMesSeleccionado(mes)
  }, [])

  const cargarReporte = async (p: string = periodo, mes?: string) => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email

      let url = `/api/reportes/facturacion?periodo=${p}`

      if (email) {
        url += `&email=${encodeURIComponent(email)}`
      }

      if (p === 'personalizado' && mes) {
        const [year, month] = mes.split('-')
        const desde = new Date(parseInt(year), parseInt(month) - 1, 1)
        const hasta = new Date(parseInt(year), parseInt(month), 0)

        url = `/api/reportes/facturacion?periodo=personalizado&fechaInicio=${desde.toISOString()}&fechaFin=${hasta.toISOString()}&email=${encodeURIComponent(email || '')}`
      }

      const res = await apiFetch(url)
      if (!res.ok) throw new Error('Error al cargar reporte')

      const data = await res.json()
      setReporte(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mesSeleccionado) {
      cargarReporte(periodo, mesSeleccionado)
    }
  }, [])

  const formatearDinero = (valor: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valor)
  }

  return (
    <PermissionProtector requiredPermission="reportes">
      <div style={{ padding: '20px', maxWidth: '1200px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none' }}>
          ← Volver al Dashboard
        </Link>
      </div>

      <h1 style={{ marginBottom: '30px' }}>Reportes</h1>

      {/* Selector de tipo de reporte */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
            disabled
          >
            📊 Facturación
          </button>
          <Link href="/admin/reportes/inventario" style={{
            padding: '10px 20px',
            backgroundColor: '#e5e7eb',
            color: '#374151',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'normal',
            fontSize: '14px',
            textDecoration: 'none',
            display: 'inline-block'
          }}>
            📦 Inventario
          </Link>
        </div>
      </div>

      {/* Selector de período */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          {['hoy', 'semana', 'mes'].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriodo(p)
                cargarReporte(p)
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: periodo === p && periodo !== 'personalizado' ? '#2563eb' : '#e5e7eb',
                color: periodo === p && periodo !== 'personalizado' ? 'white' : '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: periodo === p && periodo !== 'personalizado' ? 'bold' : 'normal',
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Ver mes específico:</label>
          <input
            type="month"
            value={mesSeleccionado}
            onChange={(e) => {
              setMesSeleccionado(e.target.value)
              setPeriodo('personalizado')
              cargarReporte('personalizado', e.target.value)
            }}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'system-ui',
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fee', color: '#c00', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#666' }}>Cargando reporte...</div>
      ) : reporte ? (
        <>
          {/* Métricas principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '30px' }}>
            <div style={{ backgroundColor: '#f0f9ff', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #0ea5e9' }}>
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>TOTAL VENDIDO</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0369a1', fontFamily: 'monospace' }}>
                {formatearDinero(reporte.metricas.totalVendido)}
              </p>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>NÚMERO DE FACTURAS</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#047857', fontFamily: 'monospace' }}>
                {reporte.metricas.numeroFacturas}
              </p>
            </div>

            <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>PROMEDIO POR FACTURA</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#92400e', fontFamily: 'monospace' }}>
                {formatearDinero(reporte.metricas.promedioPorFactura)}
              </p>
            </div>

            {reporte.metricas.clienteTop && (
              <div style={{ backgroundColor: '#fce7f3', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
                <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>CLIENTE TOP</p>
                <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold', color: '#be185d' }}>
                  {reporte.metricas.clienteTop.nombre}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#ec4899' }}>
                  {formatearDinero(reporte.metricas.clienteTop.total)} ({reporte.metricas.clienteTop.cantidad} facturas)
                </p>
              </div>
            )}
          </div>

          {/* Tabla de ventas por día */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '15px' }}>Ventas por Día</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Fecha</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Ventas</th>
                </tr>
              </thead>
              <tbody>
                {reporte.ventasPorDia.map((dia, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{dia.fecha}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {formatearDinero(dia.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabla de productos más vendidos */}
          <div>
            <h2 style={{ fontSize: '16px', marginBottom: '15px' }}>Top 10 Productos Más Vendidos</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Producto</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Cantidad (m²)</th>
                  <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {reporte.productosTop.map((prod, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{prod.nombre}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontFamily: 'monospace' }}>
                      {Number(prod.cantidad).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981' }}>
                      {formatearDinero(prod.ingresos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      </div>
    </PermissionProtector>
  )
}

