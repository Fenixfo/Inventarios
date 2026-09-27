'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { PermissionProtector } from '@/components/PermissionProtector'
import { diaColombiano } from '@/lib/fechas'
import { usePermisos } from '@/components/PermisosProvider'
import { pesos } from '@/lib/formato'

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
  const { puede } = usePermisos()
  const [periodo, setPeriodo] = useState('hoy')
  const [mesSeleccionado, setMesSeleccionado] = useState<string>('')
  const [reporte, setReporte] = useState<ReporteFacturacion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estados, setEstados] = useState<string[]>(['pagado', 'entregado'])
  const [inicializado, setInicializado] = useState(false)

  // Obtener mes actual en formato YYYY-MM
  // El mes de Colombia, no el del reloj del dispositivo: el resto de la app
  // ya usa esa hora, y en la noche del último día del mes no coincidían.
  useEffect(() => {
    setMesSeleccionado(diaColombiano(new Date()).slice(0, 7))
  }, [])

  const cargarReporte = async (p: string = periodo, mes?: string, estadosFiltro: string[] = estados) => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = session?.user?.email

      const estadosParam = estadosFiltro.length > 0 ? `&estados=${estadosFiltro.join(',')}` : ''
      let url = `/api/reportes/facturacion?periodo=${p}${estadosParam}`

      if (email) {
        url += `&email=${encodeURIComponent(email)}`
      }

      if (p === 'personalizado' && mes) {
        const [year, month] = mes.split('-')
        const desde = new Date(parseInt(year), parseInt(month) - 1, 1)
        const hasta = new Date(parseInt(year), parseInt(month), 0)

        url = `/api/reportes/facturacion?periodo=personalizado&fechaInicio=${desde.toISOString()}&fechaFin=${hasta.toISOString()}${estadosParam}&email=${encodeURIComponent(email || '')}`
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

  const handleEstadoChange = (estado: string) => {
    const nuevosEstados = estados.includes(estado)
      ? estados.filter((e) => e !== estado)
      : [...estados, estado]
    setEstados(nuevosEstados)
    cargarReporte(periodo, mesSeleccionado, nuevosEstados)
  }

  // Cargar reporte inicial
  // Una vez al abrir; el resto de cambios recargan desde sus controles.
  useEffect(() => {
    if (!inicializado) {
      cargarReporte('hoy')
      setInicializado(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicializado])

  return (
    <PermissionProtector requiredPermission="reportes">
      <div style={{ maxWidth: 1200 }}>
        <div className="mb-4">
          <Link href="/admin" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver al Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--black-primary)' }}>Reportes</h1>

        {/* Selector de tipo de reporte */}
        <div className="flex gap-2 mb-6">
          <button className="btn-primary" disabled>
            📊 Facturación
          </button>
          <Link href="/admin/reportes/inventario" className="btn-secondary">
            📦 Inventario
          </Link>
          {puede('liquidaciones.ver') && (
            <Link href="/admin/reportes/liquidaciones" className="btn-secondary">
              💼 Liquidaciones
            </Link>
          )}
        </div>

        {/* Selector de período */}
        <div className="card mb-6">
          <div className="flex gap-2 mb-4">
            {['hoy', 'semana', 'mes'].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriodo(p)
                  cargarReporte(p)
                }}
                className={periodo === p && periodo !== 'personalizado' ? 'btn-primary' : 'btn-secondary'}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Filtros de estado */}
          <div style={{ padding: '15px', backgroundColor: 'var(--beige-light)', borderRadius: '8px', marginBottom: '15px' }}>
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

          <div className="flex gap-2 items-center">
            <label className="field-label" style={{ margin: 0 }}>Ver mes específico:</label>
            <input
              type="month"
              value={mesSeleccionado}
              onChange={(e) => {
                setMesSeleccionado(e.target.value)
                setPeriodo('personalizado')
                cargarReporte('personalizado', e.target.value)
              }}
              className="field-input"
              style={{ width: 'auto' }}
            />
          </div>
        </div>

        {error && <div className="alert-box error">{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--gray-secondary)' }}>Cargando reporte...</div>
        ) : reporte ? (
          <>
            {/* Métricas principales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="indicator-card">
                <div className="indicator-label">TOTAL VENDIDO</div>
                <div className="indicator-value" style={{ fontFamily: 'monospace', fontSize: 22 }}>
                  {pesos(reporte.metricas.totalVendido)}
                </div>
              </div>

              <div className="indicator-card">
                <div className="indicator-label">NÚMERO DE FACTURAS</div>
                <div className="indicator-value" style={{ fontFamily: 'monospace' }}>
                  {reporte.metricas.numeroFacturas}
                </div>
              </div>

              <div className="indicator-card">
                <div className="indicator-label">PROMEDIO POR FACTURA</div>
                <div className="indicator-value" style={{ fontFamily: 'monospace', fontSize: 22 }}>
                  {pesos(reporte.metricas.promedioPorFactura)}
                </div>
              </div>

              {reporte.metricas.clienteTop && (
                <div className="indicator-card">
                  <div className="indicator-label">CLIENTE TOP</div>
                  <p style={{ margin: '0 0 5px 0', fontSize: '14px', fontWeight: 'bold', color: 'var(--gold-dark)' }}>
                    {reporte.metricas.clienteTop.nombre}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--gray-secondary)' }}>
                    {pesos(reporte.metricas.clienteTop.total)} ({reporte.metricas.clienteTop.cantidad} facturas)
                  </p>
                </div>
              )}
            </div>

            {/* Tabla de ventas por día */}
            <div className="card mb-6">
              <h2 className="card-title mb-4">Ventas por Día</h2>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'right' }}>Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.ventasPorDia.map((dia) => (
                    <tr key={dia.fecha}>
                      <td>{dia.fecha}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {pesos(dia.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tabla de productos más vendidos */}
            <div className="card">
              <h2 className="card-title mb-4">Top 10 Productos Más Vendidos</h2>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'right' }}>Cantidad (m²)</th>
                    <th style={{ textAlign: 'right' }}>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.productosTop.map((prod) => (
                    <tr key={prod.nombre}>
                      <td>{prod.nombre}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(prod.cantidad).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--status-green-text)' }}>
                        {pesos(prod.ingresos)}
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

