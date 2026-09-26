'use client'

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
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Dashboard</h1>

      {/* Dos tarjetas por fila en móvil: una sola dejaría la pantalla en
          blanco hasta el tercer scroll. */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
        <StatCard
          title="Productos"
          value={stats.totalProductos}
          color="blue"
        />
        <StatCard
          title="Clientes"
          value={stats.totalClientes}
          color="green"
        />
        <StatCard
          title="Facturas Hoy"
          value={stats.facturasHoy}
          color="purple"
        />
        <StatCard
          title="Stock Bajo"
          value={stats.stockBajo}
          color="red"
        />
      </div>

      {/* Alertas de stock bajo */}
      {productosAlerta.length > 0 && puede('productos.ver') && (
        <div className="bg-white rounded-lg shadow mb-8 overflow-hidden border-l-4 border-red-500">
          <div className="flex items-center justify-between px-6 py-4 bg-red-50">
            <h2 className="text-lg font-bold text-red-800">
              ⚠️ Stock bajo mínimo
              <span className="ml-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                {stats.stockBajo ?? productosAlerta.length}
              </span>
            </h2>
            <a href="/admin/inventario" className="text-sm text-red-700 hover:text-red-900 font-medium">
              Registrar entrada →
            </a>
          </div>

          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-600">
                <th className="px-6 py-2 text-left font-medium">Producto</th>
                <th className="px-6 py-2 text-right font-medium">Actual</th>
                <th className="px-6 py-2 text-right font-medium">Mínimo</th>
                <th className="px-6 py-2 text-right font-medium">Faltante</th>
                <th className="px-6 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {productosAlerta.map((p) => {
                const faltante = p.stockMinimo - p.stockActual
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-3">
                      <span className="font-medium text-sm">{p.nombre}</span>
                      <span className="text-xs text-gray-500 ml-2">{p.sku}</span>
                      {p.stockActual <= 0 && (
                        <span className="ml-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                          AGOTADO
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-sm font-bold text-red-600">
                      {p.stockActual.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-sm text-gray-500">
                      {p.stockMinimo.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-sm font-bold text-amber-600">
                      +{faltante.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <a
                        href={`/admin/productos/${p.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Editar
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {(stats.stockBajo ?? 0) > productosAlerta.length && (
            <div className="px-6 py-3 bg-gray-50 text-sm text-gray-600 border-t">
              y {(stats.stockBajo ?? 0) - productosAlerta.length} producto{(stats.stockBajo ?? 0) - productosAlerta.length !== 1 ? 's' : ''} más —{' '}
              <a href="/admin/reportes/inventario" className="text-blue-600 hover:text-blue-800 font-medium">
                ver reporte completo
              </a>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Acciones Rápidas</h2>
          <div className="space-y-2">
            {puede('productos.ver') && (
              <a
                href="/admin/productos/nuevo"
                className="block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Nuevo Producto
              </a>
            )}
            {puede('clientes.ver') && (
              <a
                href="/admin/clientes/nuevo"
                className="block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Nuevo Cliente
              </a>
            )}
            {puede('facturas.ver') && (
              <a
                href="/admin/facturas/nueva"
                className="block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Nueva Factura
              </a>
            )}
            {!puede('productos.ver') && !puede('clientes.ver') && !puede('facturas.ver') && (
              <p className="text-gray-600 text-sm">No tienes permisos para crear elementos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string
  value: number | null
  color: 'blue' | 'green' | 'purple' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    red: 'bg-red-50 border-red-200 text-red-600',
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-4 sm:p-6`}>
      <p className="text-xs sm:text-sm font-semibold opacity-75">{title}</p>
      {/* Sin permiso para esa cifra se muestra un guion, no un cero engañoso. */}
      <p className="text-2xl sm:text-3xl font-bold">{value ?? '—'}</p>
    </div>
  )
}
