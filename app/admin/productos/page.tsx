'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { BuscadorEnter } from '@/components/Common/BuscadorEnter'
import { useListaPaginada } from '@/lib/use-lista-paginada'

interface Producto {
  id: string
  nombre: string
  categoria: string
  dimensiones?: string | null
  precioUnitario: number
  precioBodega?: number | null
  stockActual: number
  stockMinimo: number
  m2PorCaja?: number | null
}

const celda = { padding: '10px' }

export default function ProductosPage() {
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  // Los 10 más recientes; el resto con "Ver más" o buscando. La búsqueda y
  // la categoría van al servidor y se suman: buscar "gris" con Porcelanato
  // elegido busca entre los porcelanatos de toda la tienda, no entre los 10
  // que haya en pantalla.
  const { items: productos, total, cargando, cargandoMas, error, verMas, hayMas, primera } =
    useListaPaginada<Producto>('/api/productos', 'productos', {
      busqueda,
      categoria: filtroCategoria,
    })

  // Llegan con la primera página, y siempre todas las de la tienda: el
  // servidor no les aplica los filtros, así que elegir una no vacía la lista.
  const categorias: string[] = primera?.categorias || []

  const hayFiltros = Boolean(busqueda || filtroCategoria)

  return (
    <PermissionProtector requiredPermission="productos">
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px', alignItems: 'start' }}>
            <BuscadorEnter onBuscar={setBusqueda} etiqueta="Nombre" placeholder="Ej: porcelanato gris" />

            <div>
              <label htmlFor="filtro-categoria" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>Categoría</label>
              <select
                id="filtro-categoria"
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

        {error && (
          <p style={{ color: '#dc2626' }}>Error: {error}</p>
        )}

        {cargando ? (
          <p style={{ color: '#666' }}>Cargando...</p>
        ) : productos.length === 0 ? (
          <p style={{ color: '#666' }}>
            {hayFiltros ? 'No hay productos que coincidan con la búsqueda' : 'No hay productos registrados'}
          </p>
        ) : (
          <>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 10px 0' }}>
              {hayFiltros
                ? `Mostrando ${productos.length} de ${total} que coinciden`
                : `Mostrando los ${productos.length} más recientes de ${total}`}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ ...celda, textAlign: 'left' }}>Nombre</th>
                    <th style={{ ...celda, textAlign: 'left' }}>Categoría</th>
                    <th style={{ ...celda, textAlign: 'left' }}>Medida</th>
                    <th style={{ ...celda, textAlign: 'right' }}>Precio público</th>
                    <th style={{ ...celda, textAlign: 'right' }}>Precio bodega</th>
                    <th style={{ ...celda, textAlign: 'right' }}>Stock (m²)</th>
                    <th style={{ ...celda, textAlign: 'right' }}>m² por caja</th>
                    <th style={{ ...celda, textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((producto) => {
                    const bajo = Number(producto.stockActual) < Number(producto.stockMinimo)

                    return (
                      <tr key={producto.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={celda}>{producto.nombre}</td>
                        <td style={celda}>{producto.categoria}</td>
                        <td style={{ ...celda, whiteSpace: 'nowrap', color: producto.dimensiones ? 'inherit' : '#9ca3af' }}>
                          {producto.dimensiones || '—'}
                        </td>
                        <td style={{ ...celda, textAlign: 'right' }}>${Number(producto.precioUnitario).toFixed(2)}</td>
                        <td style={{ ...celda, textAlign: 'right', color: producto.precioBodega ? 'inherit' : '#9ca3af' }}>
                          {producto.precioBodega
                            ? `$${Number(producto.precioBodega).toFixed(2)}`
                            : '—'}
                        </td>
                        <td style={{ ...celda, textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            {bajo && (
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
                                color: bajo ? '#dc2626' : '#059669',
                              }}
                            >
                              {Number(producto.stockActual)}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...celda, textAlign: 'right', color: producto.m2PorCaja ? 'inherit' : '#9ca3af' }}>
                          {producto.m2PorCaja ? Number(producto.m2PorCaja) : '—'}
                        </td>
                        <td style={{ ...celda, textAlign: 'center' }}>
                          <Link href={`/admin/productos/${producto.id}`} style={{
                            color: '#2563eb',
                            textDecoration: 'none',
                          }}>
                            Editar
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {hayMas && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button
                  onClick={verMas}
                  disabled={cargandoMas}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: 'white',
                    color: '#2563eb',
                    border: '1px solid #2563eb',
                    borderRadius: '4px',
                    cursor: cargandoMas ? 'wait' : 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {cargandoMas ? 'Cargando...' : `Ver más (${total - productos.length} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
