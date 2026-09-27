'use client'

import { apiFetch } from '@/lib/api-client'
import { useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import { SelectorProducto, type ProductoOpcion } from '@/components/Common/SelectorProducto'
import { fechaYHora } from '@/lib/fechas'
import { useListaPaginada } from '@/lib/use-lista-paginada'
import { supabase } from '@/lib/supabase-client'
import Link from 'next/link'
import { VerMas } from '@/components/Common/VerMas'

interface Movimiento {
  id: string
  tipo: string
  cantidad: number
  stockAntes: number
  stockDespues: number
  motivo: string | null
  referenciaTipo: string | null
  fechaMovimiento: string
  producto: { sku: string; nombre: string } | null
  usuario: { email: string } | null
}

const COLORES_TIPO: Record<string, string> = {
  entrada: '#10b981',
  salida: '#ef4444',
  ajuste: '#f59e0b',
}

const ICONOS_TIPO: Record<string, string> = {
  entrada: '⬆️',
  salida: '⬇️',
  ajuste: '⚖️',
}

export default function InventarioPage() {
  // El producto elegido en el formulario, con su stock, para la vista previa
  // del movimiento. Antes se bajaba el catálogo entero para buscarlo.
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoOpcion | null>(null)

  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // Los 10 más recientes y el resto con "Ver más". Los filtros van al
  // servidor, así que miran todos los movimientos de la tienda.
  const {
    items: movimientos,
    total,
    cargando: loading,
    cargandoMas,
    error,
    verMas,
    recargar,
    hayMas,
  } = useListaPaginada<Movimiento>('/api/inventario/movimientos', 'movimientos', {
    productoId: filtroProducto,
    tipo: filtroTipo,
    fechaDesde: filtroDesde,
    fechaHasta: filtroHasta,
  })

  const [formAbierto, setFormAbierto] = useState(false)
  const [formProducto, setFormProducto] = useState('')
  const [formTipo, setFormTipo] = useState<'entrada' | 'salida' | 'ajuste'>('entrada')
  const [formCantidad, setFormCantidad] = useState('')
  const [formMotivo, setFormMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  const registrarMovimiento = async () => {
    setErrorForm(null)
    setExito(null)

    const cantidad = parseFloat(formCantidad)

    if (!formProducto) return setErrorForm('Selecciona un producto')
    if (!(cantidad > 0)) return setErrorForm('La cantidad debe ser mayor a cero')
    if (!formMotivo.trim()) return setErrorForm('Indica el motivo del movimiento')

    setGuardando(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await apiFetch('/api/inventario/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoId: formProducto,
          tipo: formTipo,
          cantidad,
          motivo: formMotivo.trim(),
          email: session?.user?.email || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al registrar movimiento')

      setExito(`Stock actualizado: ${data.stockAntes} → ${data.stockDespues} m²`)
      setFormCantidad('')
      setFormMotivo('')
      recargar()
      // El stock nuevo lo dice la respuesta: sin volver a pedir el catálogo.
      setProductoSeleccionado((previo) =>
        previo && previo.id === formProducto ? { ...previo, stockActual: Number(data.stockDespues) } : previo
      )
    } catch (err: any) {
      setErrorForm(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const limpiarFiltros = () => {
    setFiltroProducto('')
    setFiltroTipo('')
    setFiltroDesde('')
    setFiltroHasta('')
  }

  const hayFiltros = filtroProducto || filtroTipo || filtroDesde || filtroHasta


  return (
    <PermissionProtector requiredPermission="productos">
      <div style={{ maxWidth: 1200 }}>
        <div className="mb-4">
          <Link href="/admin" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver al Dashboard
          </Link>
        </div>

        <div className="flex justify-between items-center gap-3 flex-wrap mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--black-primary)' }}>Movimientos de Inventario</h1>
          <button onClick={() => setFormAbierto(!formAbierto)} className={formAbierto ? 'btn-secondary' : 'btn-primary'}>
            {formAbierto ? '✕ Cerrar' : '+ Registrar Movimiento'}
          </button>
        </div>

        {/* Formulario de registro */}
        {formAbierto && (
          <div className="card mb-5">
            <h2 className="card-title mb-4">Nuevo Movimiento</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="field-label">Producto</label>
                <SelectorProducto
                  value={formProducto}
                  onChange={setFormProducto}
                  onElegir={setProductoSeleccionado}
                  placeholder="Selecciona..."
                  mostrarStock
                  ancho="100%"
                />
              </div>

              <div>
                <label className="field-label">Tipo</label>
                <select value={formTipo} onChange={(e) => setFormTipo(e.target.value as any)} className="field-select" style={{ width: '100%' }}>
                  <option value="entrada">⬆️ Entrada (sumar stock)</option>
                  <option value="salida">⬇️ Salida (restar stock)</option>
                  <option value="ajuste">⚖️ Ajuste (fijar stock real)</option>
                </select>
              </div>

              <div>
                <label className="field-label">
                  {formTipo === 'ajuste' ? 'Stock real contado (m²)' : 'Cantidad (m²)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formCantidad}
                  onChange={(e) => setFormCantidad(e.target.value)}
                  placeholder="0.00"
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">Motivo</label>
                <input
                  type="text"
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Compra a proveedor, rotura, conteo físico..."
                  className="field-input"
                />
              </div>
            </div>

            {/* Vista previa del efecto */}
            {productoSeleccionado && parseFloat(formCantidad) > 0 && (
              <div className="mb-4 text-sm" style={{ backgroundColor: 'var(--beige-light)', padding: '12px', borderRadius: '8px' }}>
                Stock: <strong>{productoSeleccionado.stockActual}</strong> →{' '}
                <strong style={{ color: COLORES_TIPO[formTipo] }}>
                  {formTipo === 'entrada'
                    ? productoSeleccionado.stockActual + parseFloat(formCantidad)
                    : formTipo === 'salida'
                      ? productoSeleccionado.stockActual - parseFloat(formCantidad)
                      : parseFloat(formCantidad)}
                </strong>{' '}
                m²
              </div>
            )}

            {errorForm && <div className="alert-box error mb-4">{errorForm}</div>}
            {exito && <div className="alert-box success mb-4">✅ {exito}</div>}

            <button onClick={registrarMovimiento} disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        )}

        {/* Filtros */}
        <div className="card mb-5">
          <div className="filters-row" style={{ alignItems: 'flex-end' }}>
            <div>
              <label className="field-label">Producto</label>
              <SelectorProducto value={filtroProducto} onChange={setFiltroProducto} placeholder="Todos" ancho="280px" />
            </div>

            <div>
              <label className="field-label">Tipo</label>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="filter-select">
                <option value="">Todos</option>
                <option value="entrada">⬆️ Entrada</option>
                <option value="salida">⬇️ Salida</option>
                <option value="ajuste">⚖️ Ajuste</option>
              </select>
            </div>

            <div>
              <label className="field-label">Desde</label>
              <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} className="filter-input" style={{ minWidth: 0 }} />
            </div>

            <div>
              <label className="field-label">Hasta</label>
              <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} className="filter-input" style={{ minWidth: 0 }} />
            </div>

            {hayFiltros && (
              <button onClick={limpiarFiltros} className="btn-secondary">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert-box error">{error}</div>}

        {/* Tabla de movimientos */}
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--gray-secondary)', padding: '40px' }}>Cargando movimientos...</div>
        ) : movimientos.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--gray-secondary)' }}>
            {hayFiltros ? 'No hay movimientos que coincidan con los filtros' : 'Aún no hay movimientos registrados'}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Producto</th>
                    <th style={{ textAlign: 'right' }}>Cantidad</th>
                    <th style={{ textAlign: 'right' }}>Antes</th>
                    <th style={{ textAlign: 'right' }}>Después</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fechaYHora(m.fechaMovimiento)}</td>
                      <td>
                        <span
                          style={{
                            backgroundColor: COLORES_TIPO[m.tipo] || 'var(--gray-secondary)',
                            color: 'white',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            textTransform: 'capitalize',
                          }}
                        >
                          {ICONOS_TIPO[m.tipo] || ''} {m.tipo}
                        </span>
                      </td>
                      <td>
                        {m.producto ? (
                          <>
                            <strong>{m.producto.sku}</strong>
                            <br />
                            <span style={{ color: 'var(--gray-secondary)' }}>{m.producto.nombre}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--gray-secondary)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                        {m.cantidad.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--gray-secondary)' }}>
                        {m.stockAntes.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: COLORES_TIPO[m.tipo] }}>
                        {m.stockDespues.toFixed(2)}
                      </td>
                      <td style={{ maxWidth: '220px' }}>
                        {m.motivo || '—'}
                        {(m.referenciaTipo === 'factura' || m.referenciaTipo === 'edicion_producto') && (
                          <span className="badge badge-indigo ml-1">auto</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--gray-secondary)' }}>{m.usuario?.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--gray-secondary)', borderTop: '1px solid var(--gray-light)' }}>
              Mostrando {movimientos.length} de {total} movimiento{total !== 1 ? 's' : ''}
              {hayFiltros ? ' que coinciden con los filtros' : ', los más recientes primero'}
            </div>
          </div>
        )}

        {!loading && hayMas && (
          <VerMas restantes={total - movimientos.length} cargando={cargandoMas} onClick={verMas} />
        )}
      </div>
    </PermissionProtector>
  )
}
