'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'

interface Stats {
  totalProductos: number
  totalClientes: number
  facturasHoy: number
  stockBajo: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProductos: 0,
    totalClientes: 0,
    facturasHoy: 0,
    stockBajo: 0,
  })
  const [permisos, setPermisos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        // Obtener permisos del usuario
        if (session?.user) {
          const res = await fetch(`/api/debug/usuario-actual?email=${encodeURIComponent(session.user.email || '')}`)
          if (res.ok) {
            const usuario = await res.json()
            const permisosUnicos = new Set<string>()
            usuario.rolesPersonalizados?.forEach((ur: any) => {
              ur.rol.permisos.forEach((p: any) => {
                permisosUnicos.add(p.modulo.modulo)
              })
            })
            setPermisos(Array.from(permisosUnicos))
          }
        }

        // Total de productos
        const productosRes = await fetch('/api/productos')
        const productos = productosRes.ok ? await productosRes.json() : []

        // Total de clientes
        const clientesRes = await fetch('/api/clientes')
        const clientes = clientesRes.ok ? await clientesRes.json() : []

        // Facturas
        const facturasRes = await fetch('/api/facturas')
        const facturas = facturasRes.ok ? await facturasRes.json() : []

        // Facturas de hoy
        const today = new Date().toISOString().split('T')[0]
        const facturasHoy = facturas.filter((f: any) =>
          f.fecha.split('T')[0] === today
        ).length

        // Stock bajo
        const stockBajo = productos.filter((p: any) =>
          p.stockActual < p.stockMinimo
        ).length

        setStats({
          totalProductos: productos.length,
          totalClientes: clientes.length,
          facturasHoy,
          stockBajo,
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
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Acciones Rápidas</h2>
          <div className="space-y-2">
            {permisos.includes('productos') && (
              <a
                href="/admin/productos/nuevo"
                className="block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Nuevo Producto
              </a>
            )}
            {permisos.includes('clientes') && (
              <a
                href="/admin/clientes/nuevo"
                className="block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Nuevo Cliente
              </a>
            )}
            {permisos.includes('facturas') && (
              <a
                href="/admin/facturas/nueva"
                className="block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Nueva Factura
              </a>
            )}
            {permisos.length === 0 && (
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
  value: number
  color: 'blue' | 'green' | 'purple' | 'red'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    red: 'bg-red-50 border-red-200 text-red-600',
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6`}>
      <p className="text-sm font-semibold opacity-75">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  )
}
