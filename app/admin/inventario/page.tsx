'use client'

import { apiFetch } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import { SelectorProducto } from '@/components/Common/SelectorProducto'
import { supabase } from '@/lib/supabase-client'
import Link from 'next/link'

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

interface Producto {
  id: string
  sku: string
  nombre: string
  stockActual: number
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
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filtroProducto, setFiltroProducto] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const [formAbierto, setFormAbierto] = useState(false)
  const [formProducto, setFormProducto] = useState('')
  const [formTipo, setFormTipo] = useState<'entrada' | 'salida' | 'ajuste'>('entrada')
  const [formCantidad, setFormCantidad] = useState('')
  const [formMotivo, setFormMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  useEffect(() => {
    cargarProductos()
  }, [])

  useEffect(() => {
    cargarMovimientos()
  }, [filtroProducto, filtroTipo, filtroDesde, filtroHasta])

  const cargarProductos = async () => {
    try {
      const res = await apiFetch('/api/productos')
      if (!res.ok) return
      const data = await res.json()
      setProductos(
        data.map((p: any) => ({
          id: p.id,
          sku: p.sku,
          nombre: p.nombre,
          stockActual: Number(p.stockActual),
        }))
      )
    } catch {
      // El selector queda vacío; la tabla de movimientos sigue siendo usable.
    }
  }

  const cargarMovimientos = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (filtroProducto) params.set('productoId', filtroProducto)
      if (filtroTipo) params.set('tipo', filtroTipo)
      if (filtroDesde) params.set('desde', filtroDesde)
      if (filtroHasta) params.set('hasta', filtroHasta)

      const res = await apiFetch(`/api/inventario/movimientos?${params.toString()}`)
      if (!res.ok) throw new Error('Error al cargar movimientos')

      setMovimientos(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
      await Promise.all([cargarMovimientos(), cargarProductos()])
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

  const productoSeleccionado = productos.find((p) => p.id === formProducto)

  const inputStyle = {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
  }

  return (
    <PermissionProtector requiredPermission="productos">
      <div style={{ padding: '20px', maxWidth: '1200px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver al Dashboard
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1 style={{ margin: 0 }}>Movimientos de Inventario</h1>
          <button
            onClick={() => setFormAbierto(!formAbierto)}
            style={{
              padding: '10px 20px',
              backgroundColor: formAbierto ? '#6b7280' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            {formAbierto ? '✕ Cerrar' : '+ Registrar Movimiento'}
          </button>
        </div>

        {/* Formulario de registro */}
        {formAbierto && (
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '15px' }}>Nuevo Movimiento</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                  Producto
                </label>
                <SelectorProducto
                  productos={productos}
                  value={formProducto}
                  onChange={setFormProducto}
                  placeholder="Selecciona..."
                  mostrarStock
                  ancho="100%"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                  Tipo
                </label>
                <select
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value as any)}
                  style={{ ...inputStyle, width: '100%' }}
                >
                  <option value="entrada">⬆️ Entrada (sumar stock)</option>
                  <option value="salida">⬇️ Salida (restar stock)</option>
                  <option value="ajuste">⚖️ Ajuste (fijar stock real)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                  {formTipo === 'ajuste' ? 'Stock real contado (m²)' : 'Cantidad (m²)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formCantidad}
                  onChange={(e) => setFormCantidad(e.target.value)}
                  placeholder="0.00"
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                  Motivo
                </label>
                <input
                  type="text"
                  value={formMotivo}
                  onChange={(e) => setFormMotivo(e.target.value)}
                  placeholder="Compra a proveedor, rotura, conteo físico..."
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
            </div>

            {/* Vista previa del efecto */}
            {productoSeleccionado && parseFloat(formCantidad) > 0 && (
              <div style={{ backgroundColor: '#f3f4f6', padding: '12px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px' }}>
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

            {errorForm && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px' }}>
                {errorForm}
              </div>
            )}

            {exito && (
              <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '14px' }}>
                ✅ {exito}
              </div>
            )}

            <button
              onClick={registrarMovimiento}
              disabled={guardando}
              style={{
                padding: '10px 24px',
                backgroundColor: guardando ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: guardando ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
            >
              {guardando ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        )}

        {/* Filtros */}
        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '8px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                Producto
              </label>
              <SelectorProducto
                productos={productos}
                value={filtroProducto}
                onChange={setFiltroProducto}
                placeholder="Todos"
                ancho="280px"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                Tipo
              </label>
              <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={inputStyle}>
                <option value="">Todos</option>
                <option value="entrada">⬆️ Entrada</option>
                <option value="salida">⬇️ Salida</option>
                <option value="ajuste">⚖️ Ajuste</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                Desde
              </label>
              <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#374151' }}>
                Hasta
              </label>
              <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} style={inputStyle} />
            </div>

            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {/* Tabla de movimientos */}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>Cargando movimientos...</div>
        ) : movimientos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px', backgroundColor: 'white', borderRadius: '8px' }}>
            {hayFiltros ? 'No hay movimientos que coincidan con los filtros' : 'Aún no hay movimientos registrados'}
          </div>
        ) : (
          <div style={{ backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Fecha</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Tipo</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Producto</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px' }}>Cantidad</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px' }}>Antes</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px' }}>Después</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Motivo</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {new Date(m.fechaMovimiento).toLocaleString('es-CO', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px' }}>
                      <span
                        style={{
                          backgroundColor: COLORES_TIPO[m.tipo] || '#6b7280',
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
                    <td style={{ padding: '12px', fontSize: '12px' }}>
                      {m.producto ? (
                        <>
                          <strong>{m.producto.sku}</strong>
                          <br />
                          <span style={{ color: '#6b7280' }}>{m.producto.nombre}</span>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {m.cantidad.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>
                      {m.stockAntes.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold', color: COLORES_TIPO[m.tipo] }}>
                      {m.stockDespues.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', maxWidth: '220px' }}>
                      {m.motivo || '—'}
                      {m.referenciaTipo === 'factura' && (
                        <span style={{ display: 'inline-block', marginLeft: '6px', backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                          auto
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#6b7280' }}>
                      {m.usuario?.email || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: '12px', fontSize: '12px', color: '#6b7280', borderTop: '1px solid #f3f4f6' }}>
              Mostrando {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}
              {movimientos.length === 200 && ' (máximo por consulta)'}
            </div>
          </div>
        )}
      </div>
    </PermissionProtector>
  )
}
