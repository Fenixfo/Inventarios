'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { PermissionProtector } from '@/components/PermissionProtector'

interface ReporteInventario {
  metricas: {
    totalProductos: number
    productosActivos: number
    productosStockBajo: number
    productosSinMovimiento: number
    valorInventario: number
  }
  stockBajo: Array<{
    id: string
    nombre: string
    sku: string
    categoria: string
    stockActual: number
    stockMinimo: number
    diferencia: number
  }>
  rotacion: Array<{
    nombre: string
    cantidad: number
    ingresos: number
  }>
  sinMovimiento: Array<{
    id: string
    nombre: string
    sku: string
    categoria: string
    stockActual: number
    precioUnitario: number
  }>
  periodo: {
    desde: string
    hasta: string
  }
}

export default function ReportesInventarioPage() {
  const [reporte, setReporte] = useState<ReporteInventario | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cargarReporte = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email

        const url = email
          ? `/api/reportes/inventario?email=${encodeURIComponent(email)}`
          : '/api/reportes/inventario'

        const res = await fetch(url)
        if (!res.ok) {
          if (res.status === 403) {
            setError('No tienes permiso para ver reportes')
          } else {
            throw new Error('Error al cargar reporte')
          }
          return
        }

        const data = await res.json()
        setReporte(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    cargarReporte()
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

      <h1 style={{ marginBottom: '30px' }}>Reportes de Inventario</h1>

      {/* Selector de tipo de reporte */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link href="/admin/reportes" style={{
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
            📊 Facturación
          </Link>
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
            📦 Inventario
          </button>
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
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>TOTAL DE PRODUCTOS</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0369a1', fontFamily: 'monospace' }}>
                {reporte.metricas.totalProductos}
              </p>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>PRODUCTOS CON STOCK</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#047857', fontFamily: 'monospace' }}>
                {reporte.metricas.productosActivos}
              </p>
            </div>

            <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>STOCK BAJO</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#92400e', fontFamily: 'monospace' }}>
                {reporte.metricas.productosStockBajo}
              </p>
            </div>

            <div style={{ backgroundColor: '#fce7f3', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #ec4899' }}>
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>SIN MOVIMIENTO (30 DÍAS)</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#be185d', fontFamily: 'monospace' }}>
                {reporte.metricas.productosSinMovimiento}
              </p>
            </div>

            <div style={{ backgroundColor: '#ede9fe', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #a855f7' }}>
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>VALOR INVENTARIO</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace' }}>
                {formatearDinero(reporte.metricas.valorInventario)}
              </p>
            </div>
          </div>

          {/* Stock Bajo */}
          {reporte.stockBajo.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '16px', marginBottom: '15px', color: '#ef4444' }}>
                ⚠️ Productos con Stock Bajo ({reporte.stockBajo.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f0f0f0' }}>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Producto</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>SKU</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Categoría</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Stock Actual</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Stock Mínimo</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px', color: '#ef4444' }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.stockBajo.map((producto, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px', fontSize: '12px' }}>{producto.nombre}</td>
                      <td style={{ padding: '10px', fontSize: '12px' }}>{producto.sku}</td>
                      <td style={{ padding: '10px', fontSize: '12px' }}>{producto.categoria}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontFamily: 'monospace' }}>
                        {Number(producto.stockActual).toFixed(2)} m²
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontFamily: 'monospace' }}>
                        {Number(producto.stockMinimo).toFixed(2)} m²
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          textAlign: 'right',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          color: '#ef4444',
                        }}
                      >
                        {Number(producto.diferencia).toFixed(2)} m²
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rotación (Top 10) */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '15px' }}>
              📈 Rotación de Productos - Últimos 30 Días (Top 10)
            </h2>
            {reporte.rotacion.length === 0 ? (
              <p style={{ color: '#666', fontSize: '12px' }}>No hay datos de rotación en los últimos 30 días</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f0f0f0' }}>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Producto</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Cantidad Vendida (m²)</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.rotacion.map((prod, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px', fontSize: '12px' }}>{prod.nombre}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontFamily: 'monospace' }}>
                        {Number(prod.cantidad).toFixed(2)} m²
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          textAlign: 'right',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          color: '#10b981',
                        }}
                      >
                        {formatearDinero(prod.ingresos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sin Movimiento */}
          {reporte.sinMovimiento.length > 0 && (
            <div>
              <h2 style={{ fontSize: '16px', marginBottom: '15px', color: '#f59e0b' }}>
                🔇 Productos Sin Movimiento en 30 Días ({reporte.sinMovimiento.length})
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f0f0f0' }}>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Producto</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>SKU</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Categoría</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Stock Disponible (m²)</th>
                    <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Precio Unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.sinMovimiento.map((producto, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px', fontSize: '12px' }}>{producto.nombre}</td>
                      <td style={{ padding: '10px', fontSize: '12px' }}>{producto.sku}</td>
                      <td style={{ padding: '10px', fontSize: '12px' }}>{producto.categoria}</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '12px', fontFamily: 'monospace' }}>
                        {Number(producto.stockActual).toFixed(2)} m²
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          textAlign: 'right',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                        }}
                      >
                        {formatearDinero(Number(producto.precioUnitario))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
      </div>
    </PermissionProtector>
  )
}
