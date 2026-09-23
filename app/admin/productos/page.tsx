'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'

interface Producto {
  id: string
  sku: string
  nombre: string
  categoria: string
  precioUnitario: number
  precioBodega?: number | null
  stockActual: number
  stockMinimo: number
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroSku, setFiltroSku] = useState('')
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const res = await apiFetch('/api/productos')
        if (!res.ok) throw new Error('Error fetching productos')
        const data = await res.json()
        setProductos(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProductos()
  }, [])

  const productosFiltrados = productos.filter(p => {
    const coincideSku = p.sku.toLowerCase().includes(filtroSku.toLowerCase())
    const coincideNombre = p.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
    const coincideCategoria = !filtroCategoria || p.categoria === filtroCategoria

    return coincideSku && coincideNombre && coincideCategoria
  })

  const categorias = Array.from(new Set(productos.map(p => p.categoria)))

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>

  return (
    <PermissionProtector requiredPermission="productos">
      <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Productos</h1>
        <Link href="/admin/productos/nuevo" style={{
          padding: '10px 20px',
          backgroundColor: '#2563eb',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px'
        }}>
          Nuevo Producto
        </Link>
      </div>

      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>SKU</label>
            <input
              type="text"
              placeholder="Buscar por SKU"
              value={filtroSku}
              onChange={(e) => setFiltroSku(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Nombre</label>
            <input
              type="text"
              placeholder="Buscar por nombre"
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Categoría</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            >
              <option value="">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {productos.length === 0 ? (
        <p style={{ color: '#666' }}>No hay productos registrados</p>
      ) : productosFiltrados.length === 0 ? (
        <p style={{ color: '#666' }}>No hay productos que coincidan con los filtros</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>SKU</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Nombre</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Categoría</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Público</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Bodega</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Stock</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.map((producto) => (
              <tr key={producto.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{producto.sku}</td>
                <td style={{ padding: '10px' }}>{producto.nombre}</td>
                <td style={{ padding: '10px' }}>{producto.categoria}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>${Number(producto.precioUnitario).toFixed(2)}</td>
                <td style={{ padding: '10px', textAlign: 'right', color: producto.precioBodega ? 'inherit' : '#9ca3af' }}>
                  {producto.precioBodega
                    ? `$${Number(producto.precioBodega).toFixed(2)}`
                    : '—'}
                </td>
                <td style={{ padding: '10px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    {Number(producto.stockActual) < Number(producto.stockMinimo) && (
                      <span
                        title={`Mínimo: ${producto.stockMinimo} m²`}
                        style={{
                          backgroundColor: Number(producto.stockActual) <= 0 ? '#dc2626' : '#f59e0b',
                          color: 'white',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {Number(producto.stockActual) <= 0 ? 'AGOTADO' : 'STOCK BAJO'}
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        color:
                          Number(producto.stockActual) < Number(producto.stockMinimo)
                            ? '#dc2626'
                            : '#059669',
                      }}
                    >
                      {producto.stockActual}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <Link href={`/admin/productos/${producto.id}`} style={{
                    color: '#2563eb',
                    textDecoration: 'none',
                    marginRight: '10px'
                  }}>
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </PermissionProtector>
  )
}

