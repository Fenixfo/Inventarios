'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { usePermisos } from '@/components/PermisosProvider'

/** `null` cuando la persona no tiene permiso para ver esa cifra. */
interface Stats {
  totalProductos: number | null
  totalClientes: number | null
  facturasHoy: number | null
  stockBajo: number | null
}

interface ProductoAlerta {
  id: string
  sku: string
  nombre: string
  stockActual: number
  stockMinimo: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProductos: null,
    totalClientes: null,
    facturasHoy: null,
    stockBajo: null,
  })
  const [productosAlerta, setProductosAlerta] = useState<ProductoAlerta[]>([])
  const [loading, setLoading] = useState(true)

  // Los permisos ya los cargó el panel al entrar: antes el tablero los
  // volvía a pedir a /api/debug/usuario-actual en cada visita.
  const { puede } = usePermisos()

  useEffect(() => {
    // Una sola petición con las cifras ya calculadas. Antes se bajaban las
    // listas completas de productos, clientes y facturas para contarlas.
    const loadData = async () => {
      try {
        const res = await apiFetch('/api/tablero')
        if (!res.ok) return

        const datos = await res.json()
        setProductosAlerta(datos.alertas || [])
        setStats({
          totalProductos: datos.totalProductos,
          totalClientes: datos.totalClientes,
          facturasHoy: datos.facturasHoy,
          stockBajo: datos.stockBajo,
        })
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return <div className="text-center py-12">Cargando...</div>
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8" style={{ color: 'var(--black-primary)' }}>
        Dashboard
      </h1>

      {/* Dos tarjetas por fila en móvil: una sola dejaría la pantalla en
          blanco hasta el tercer scroll. */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <StatCard icon="📦" title="Productos" value={stats.totalProductos} />
        <StatCard icon="👥" title="Clientes" value={stats.totalClientes} />
        <StatCard icon="📄" title="Facturas Hoy" value={stats.facturasHoy} />
        <StatCard icon="⚠️" title="Stock Bajo" value={stats.stockBajo} />
      </div>

      {/* Alertas de stock bajo */}
      {productosAlerta.length > 0 && puede('productos.ver') && (
        <div className="card mb-8" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="flex items-center justify-between gap-3 flex-wrap px-6 py-4"
            style={{ backgroundColor: 'var(--status-amber-bg)' }}
          >
            <h2 className="text-lg font-bold" style={{ color: 'var(--status-amber-text)' }}>
              ⚠️ Stock bajo mínimo
              <span className="badge badge-red-solid ml-2">
                {stats.stockBajo ?? productosAlerta.length}
              </span>
            </h2>
            <Link href="/admin/inventario" className="text-sm font-medium" style={{ color: 'var(--gold-dark)' }}>
              Registrar entrada →
            </Link>
          </div>

          <table className="table-luxe">
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ textAlign: 'right' }}>Actual</th>
                <th style={{ textAlign: 'right' }}>Mínimo</th>
                <th style={{ textAlign: 'right' }}>Faltante</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {productosAlerta.map((p) => {
                const faltante = p.stockMinimo - p.stockActual
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="font-medium text-sm">{p.nombre}</span>
                      <span className="text-xs ml-2" style={{ color: 'var(--gray-secondary)' }}>{p.sku}</span>
                      {p.stockActual <= 0 && <span className="badge badge-red-solid ml-2">AGOTADO</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--status-red-solid)' }}>
                      {p.stockActual.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--gray-secondary)' }}>
                      {p.stockMinimo.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--status-amber-text)' }}>
                      +{faltante.toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link href={`/admin/productos/${p.id}`} className="btn-action">
                        Editar
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {(stats.stockBajo ?? 0) > productosAlerta.length && (
            <div
              className="px-6 py-3 text-sm"
              style={{ backgroundColor: 'var(--beige-light)', color: 'var(--gray-secondary)', borderTop: '1px solid var(--gray-light)' }}
            >
              y {(stats.stockBajo ?? 0) - productosAlerta.length} producto{(stats.stockBajo ?? 0) - productosAlerta.length !== 1 ? 's' : ''} más —{' '}
              <Link href="/admin/reportes/inventario" className="font-medium" style={{ color: 'var(--gold-dark)' }}>
                ver reporte completo
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="card-title mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {puede('productos.ver') && (
            <Link href="/admin/productos/nuevo" className="btn-quick">
              + Nuevo Producto
            </Link>
          )}
          {puede('clientes.ver') && (
            <Link href="/admin/clientes/nuevo" className="btn-quick">
              + Nuevo Cliente
            </Link>
          )}
          {puede('facturas.ver') && (
            <Link href="/admin/facturas/nueva" className="btn-quick">
              + Nueva Factura
            </Link>
          )}
          {!puede('productos.ver') && !puede('clientes.ver') && !puede('facturas.ver') && (
            <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
              No tienes permisos para crear elementos
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: string
  title: string
  value: number | null
}) {
  return (
    <div className="indicator-card">
      <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 18 }}>{icon}</div>
      <div className="indicator-label">{title}</div>
      {/* Sin permiso para esa cifra se muestra un guion, no un cero engañoso. */}
      <div className="indicator-value">{value ?? '—'}</div>
    </div>
  )
}
