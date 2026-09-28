'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { BuscadorEnter } from '@/components/Common/BuscadorEnter'
import { useListaPaginada } from '@/lib/use-lista-paginada'
import { pesos } from '@/lib/formato'
import { VerMas } from '@/components/Common/VerMas'

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
      <div className="card">
        <div className="card-header">
          <h1 className="card-title" style={{ fontSize: 20 }}>Productos</h1>
          <Link href="/admin/productos/nuevo" className="btn-primary">
            + Nuevo Producto
          </Link>
        </div>

        <div className="filters-row">
          <BuscadorEnter onBuscar={setBusqueda} etiqueta="Nombre" placeholder="Ej: porcelanato gris" ocultarAyuda />

          <div>
            <label htmlFor="filtro-categoria" className="field-label">Categoría</label>
            <select
              id="filtro-categoria"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="filter-select"
            >
              <option value="">Todas las categorías</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p style={{ color: 'var(--status-red-solid)' }}>Error: {error}</p>}

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : productos.length === 0 ? (
          <p style={{ color: 'var(--gray-secondary)' }}>
            {hayFiltros ? 'No hay productos que coincidan con la búsqueda' : 'No hay productos registrados'}
          </p>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: 'var(--gray-secondary)' }}>
              {hayFiltros
                ? `Mostrando ${productos.length} de ${total} que coinciden`
                : `Mostrando los ${productos.length} más recientes de ${total}`}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Medida</th>
                    <th style={{ textAlign: 'right' }}>Precio público</th>
                    <th style={{ textAlign: 'right' }}>Precio bodega</th>
                    <th style={{ textAlign: 'right' }}>Stock (m²)</th>
                    <th style={{ textAlign: 'right' }}>m² por caja</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((producto) => {
                    const bajo = Number(producto.stockActual) < Number(producto.stockMinimo)
                    const agotado = Number(producto.stockActual) <= 0

                    return (
                      <tr key={producto.id}>
                        <td>{producto.nombre}</td>
                        <td>{producto.categoria}</td>
                        <td style={{ whiteSpace: 'nowrap', color: producto.dimensiones ? 'inherit' : 'var(--gray-secondary)' }}>
                          {producto.dimensiones || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>{pesos(producto.precioUnitario)}</td>
                        <td style={{ textAlign: 'right', color: producto.precioBodega ? 'inherit' : 'var(--gray-secondary)' }}>
                          {producto.precioBodega ? pesos(producto.precioBodega) : '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            {bajo && (
                              <span
                                title={`Mínimo: ${producto.stockMinimo} m²`}
                                className={`badge ${agotado ? 'badge-red-solid' : 'badge-amber'}`}
                              >
                                {agotado ? 'AGOTADO' : 'STOCK BAJO'}
                              </span>
                            )}
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                color: bajo ? 'var(--status-red-solid)' : 'var(--status-green-text)',
                              }}
                            >
                              {Number(producto.stockActual)}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', color: producto.m2PorCaja ? 'inherit' : 'var(--gray-secondary)' }}>
                          {producto.m2PorCaja ? Number(producto.m2PorCaja) : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Link href={`/admin/productos/${producto.id}`} className="btn-action">
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
              <VerMas restantes={total - productos.length} cargando={cargandoMas} onClick={verMas} />
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
