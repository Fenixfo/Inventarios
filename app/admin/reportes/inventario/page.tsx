'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { POR_PAGINA } from '@/lib/paginacion'

type Seccion = 'stockBajo' | 'sinMovimiento'

interface ReporteInventario {
  metricas: {
    totalProductos: number
    productosActivos: number
    productosStockBajo: number
    productosSinMovimiento: number
    valorInventario: number
    productosSinCosto?: number
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
  const [estados, setEstados] = useState<string[]>(['pagado', 'entregado'])

  // Stock bajo y sin movimiento llegan de a 10; "Ver más" trae los 10
  // siguientes de esa sección. Antes llegaban enteras (85 y 175 en Beraca).
  const [cargandoMas, setCargandoMas] = useState<Seccion | null>(null)

  // Sube con cada recarga del reporte: un "Ver más" que llegue después de
  // cambiar los estados es de la consulta anterior y se descarta.
  const vuelta = useRef(0)

  const parametros = (estadosFiltro: string[]) => {
    const params = new URLSearchParams()
    if (estadosFiltro.length > 0) params.set('estados', estadosFiltro.join(','))
    return params
  }

  const cargarReporte = async (estadosFiltro: string[] = estados) => {
    vuelta.current += 1
    setLoading(true)
    setError(null)

    try {
      // Antes la URL se armaba a mano y, sin correo en la sesión, quedaba
      // `/api/reportes/inventario&estados=…` sin el `?`: el filtro de
      // estados se perdía. El correo tampoco hacía falta: sale del token.
      const res = await apiFetch(`/api/reportes/inventario?${parametros(estadosFiltro).toString()}`)
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

  const verMas = async (seccion: Seccion) => {
    if (!reporte) return

    const miVuelta = vuelta.current
    setCargandoMas(seccion)

    try {
      const params = parametros(estados)
      params.set('seccion', seccion)
      params.set('limite', String(POR_PAGINA))
      params.set('desde', String(reporte[seccion].length))

      const res = await apiFetch(`/api/reportes/inventario?${params.toString()}`)
      if (!res.ok) throw new Error('No se pudieron cargar más productos')

      const datos = await res.json()
      if (miVuelta !== vuelta.current) return

      setReporte((previo) => {
        if (!previo) return previo
        // Sin repetir: si algo cambió entre páginas, el último de la
        // anterior puede volver a salir en esta.
        const vistos = new Set(previo[seccion].map((p) => p.id))
        const nuevos = (datos[seccion] || []).filter((p: { id: string }) => !vistos.has(p.id))
        return { ...previo, [seccion]: [...previo[seccion], ...nuevos] }
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargandoMas(null)
    }
  }

  const botonVerMas = (seccion: Seccion, total: number) => {
    const cargados = reporte ? reporte[seccion].length : 0
    if (cargados >= total) return null

    return (
      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <button
          onClick={() => verMas(seccion)}
          disabled={cargandoMas !== null}
          style={{
            padding: '8px 20px',
            backgroundColor: 'white',
            color: '#2563eb',
            border: '1px solid #2563eb',
            borderRadius: '4px',
            cursor: cargandoMas ? 'wait' : 'pointer',
            fontWeight: 'bold',
            fontSize: '13px',
          }}
        >
          {cargandoMas === seccion ? 'Cargando...' : `Ver más (${total - cargados} restantes)`}
        </button>
      </div>
    )
  }

  const handleEstadoChange = (estado: string) => {
    const nuevosEstados = estados.includes(estado)
      ? estados.filter((e) => e !== estado)
      : [...estados, estado]
    setEstados(nuevosEstados)
    cargarReporte(nuevosEstados)
  }

  useEffect(() => {
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

      {/* Filtros de estado */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '14px', color: '#374151' }}>Estado de Facturas:</p>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={estados.includes('pagado')}
              onChange={() => handleEstadoChange('pagado')}
              style={{ cursor: 'pointer' }}
            />
            ✅ Pagado
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={estados.includes('entregado')}
              onChange={() => handleEstadoChange('entregado')}
              style={{ cursor: 'pointer' }}
            />
            🚚 Entregado
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={estados.includes('pendiente')}
              onChange={() => handleEstadoChange('pendiente')}
              style={{ cursor: 'pointer' }}
            />
            ⏳ Pendiente
          </label>
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
              <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '12px' }}>VALOR INVENTARIO (AL COSTO)</p>
              <p style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#7c3aed', fontFamily: 'monospace' }}>
                {formatearDinero(reporte.metricas.valorInventario)}
              </p>
              {/* Un producto sin costo cargado no suma, y la cifra se queda
                  corta sin explicación si no se avisa. */}
              {Boolean(reporte.metricas.productosSinCosto) && (
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#6b21a8' }}>
                  {reporte.metricas.productosSinCosto} producto
                  {reporte.metricas.productosSinCosto !== 1 ? 's' : ''} sin costo, no suman
                </p>
              )}
            </div>
          </div>

          {/* Stock Bajo */}
          {reporte.stockBajo.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h2 style={{ fontSize: '16px', marginBottom: '15px', color: '#ef4444' }}>
                ⚠️ Productos con Stock Bajo ({reporte.stockBajo.length}/{reporte.metricas.productosStockBajo})
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
                  {reporte.stockBajo.map((producto) => (
                    <tr key={producto.id} style={{ borderBottom: '1px solid #eee' }}>
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
              {botonVerMas('stockBajo', reporte.metricas.productosStockBajo)}
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
                🔇 Productos Sin Movimiento en 30 Días ({reporte.sinMovimiento.length}/{reporte.metricas.productosSinMovimiento})
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
                  {reporte.sinMovimiento.map((producto) => (
                    <tr key={producto.id} style={{ borderBottom: '1px solid #eee' }}>
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
              {botonVerMas('sinMovimiento', reporte.metricas.productosSinMovimiento)}
            </div>
          )}
        </>
      ) : null}
      </div>
    </PermissionProtector>
  )
}

