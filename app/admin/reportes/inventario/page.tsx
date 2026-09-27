'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { POR_PAGINA } from '@/lib/paginacion'
import { VerMas } from '@/components/Common/VerMas'
import { pesos } from '@/lib/formato'

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

    // Mientras carga una sección, la otra también espera: así no se mezclan
    // dos respuestas si se cambian los estados en medio.
    return (
      <VerMas
        restantes={total - cargados}
        cargando={cargandoMas !== null}
        onClick={() => verMas(seccion)}
      />
    )
  }

  const handleEstadoChange = (estado: string) => {
    const nuevosEstados = estados.includes(estado)
      ? estados.filter((e) => e !== estado)
      : [...estados, estado]
    setEstados(nuevosEstados)
    cargarReporte(nuevosEstados)
  }

  // Una vez al abrir; los cambios de estados recargan desde su propio botón.
  useEffect(() => {
    cargarReporte()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PermissionProtector requiredPermission="reportes">
      <div style={{ maxWidth: 1200 }}>
        <div className="mb-4">
          <Link href="/admin" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver al Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--black-primary)' }}>Reportes de Inventario</h1>

        {/* Selector de tipo de reporte */}
        <div className="flex gap-2 mb-6">
          <Link href="/admin/reportes" className="btn-secondary">
            📊 Facturación
          </Link>
          <button className="btn-primary" disabled>
            📦 Inventario
          </button>
        </div>

        {/* Filtros de estado */}
        <div className="card mb-5">
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '14px', color: 'var(--black-primary)' }}>Estado de Facturas:</p>
          <div className="flex gap-5 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={estados.includes('pagado')} onChange={() => handleEstadoChange('pagado')} />
              ✅ Pagado
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={estados.includes('entregado')} onChange={() => handleEstadoChange('entregado')} />
              🚚 Entregado
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={estados.includes('pendiente')} onChange={() => handleEstadoChange('pendiente')} />
              ⏳ Pendiente
            </label>
          </div>
        </div>

        {error && <div className="alert-box error">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--gray-secondary)' }}>Cargando reporte...</div>
      ) : reporte ? (
        <>
          {/* Métricas principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="indicator-card">
              <div className="indicator-label">TOTAL DE PRODUCTOS</div>
              <div className="indicator-value" style={{ fontFamily: 'monospace' }}>{reporte.metricas.totalProductos}</div>
            </div>

            <div className="indicator-card">
              <div className="indicator-label">PRODUCTOS CON STOCK</div>
              <div className="indicator-value" style={{ fontFamily: 'monospace' }}>{reporte.metricas.productosActivos}</div>
            </div>

            <div className="indicator-card">
              <div className="indicator-label">STOCK BAJO</div>
              <div className="indicator-value" style={{ fontFamily: 'monospace', color: 'var(--status-amber-text)' }}>
                {reporte.metricas.productosStockBajo}
              </div>
            </div>

            <div className="indicator-card">
              <div className="indicator-label">SIN MOVIMIENTO (30 DÍAS)</div>
              <div className="indicator-value" style={{ fontFamily: 'monospace' }}>{reporte.metricas.productosSinMovimiento}</div>
            </div>

            <div className="indicator-card">
              <div className="indicator-label">VALOR INVENTARIO (AL COSTO)</div>
              <div className="indicator-value" style={{ fontFamily: 'monospace', fontSize: 20, color: 'var(--gold-dark)' }}>
                {pesos(reporte.metricas.valorInventario)}
              </div>
              {/* Un producto sin costo cargado no suma, y la cifra se queda
                  corta sin explicación si no se avisa. */}
              {Boolean(reporte.metricas.productosSinCosto) && (
                <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: 'var(--gray-secondary)' }}>
                  {reporte.metricas.productosSinCosto} producto
                  {reporte.metricas.productosSinCosto !== 1 ? 's' : ''} sin costo, no suman
                </p>
              )}
            </div>
          </div>

          {/* Stock Bajo */}
          {reporte.stockBajo.length > 0 && (
            <div className="card mb-6">
              <h2 className="card-title mb-4" style={{ color: 'var(--status-red-solid)' }}>
                ⚠️ Productos con Stock Bajo ({reporte.stockBajo.length}/{reporte.metricas.productosStockBajo})
              </h2>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>SKU</th>
                    <th>Categoría</th>
                    <th style={{ textAlign: 'right' }}>Stock Actual</th>
                    <th style={{ textAlign: 'right' }}>Stock Mínimo</th>
                    <th style={{ textAlign: 'right', color: 'var(--status-red-solid)' }}>Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.stockBajo.map((producto) => (
                    <tr key={producto.id}>
                      <td>{producto.nombre}</td>
                      <td>{producto.sku}</td>
                      <td>{producto.categoria}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(producto.stockActual).toFixed(2)} m²
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(producto.stockMinimo).toFixed(2)} m²
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--status-red-solid)' }}>
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
          <div className="card mb-6">
            <h2 className="card-title mb-4">📈 Rotación de Productos - Últimos 30 Días (Top 10)</h2>
            {reporte.rotacion.length === 0 ? (
              <p style={{ color: 'var(--gray-secondary)', fontSize: '12px' }}>No hay datos de rotación en los últimos 30 días</p>
            ) : (
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'right' }}>Cantidad Vendida (m²)</th>
                    <th style={{ textAlign: 'right' }}>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.rotacion.map((prod) => (
                    <tr key={prod.nombre}>
                      <td>{prod.nombre}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(prod.cantidad).toFixed(2)} m²
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--status-green-text)' }}>
                        {pesos(prod.ingresos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sin Movimiento */}
          {reporte.sinMovimiento.length > 0 && (
            <div className="card">
              <h2 className="card-title mb-4" style={{ color: 'var(--status-amber-text)' }}>
                🔇 Productos Sin Movimiento en 30 Días ({reporte.sinMovimiento.length}/{reporte.metricas.productosSinMovimiento})
              </h2>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>SKU</th>
                    <th>Categoría</th>
                    <th style={{ textAlign: 'right' }}>Stock Disponible (m²)</th>
                    <th style={{ textAlign: 'right' }}>Precio Unitario</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.sinMovimiento.map((producto) => (
                    <tr key={producto.id}>
                      <td>{producto.nombre}</td>
                      <td>{producto.sku}</td>
                      <td>{producto.categoria}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(producto.stockActual).toFixed(2)} m²
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {pesos(Number(producto.precioUnitario))}
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

