'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import Link from 'next/link'
import { fechaYHora } from '@/lib/fechas'

interface RegistroAuditoria {
  id: string
  usuarioId: string | null
  usuario: {
    id: string
    email: string
  } | null
  tablaAfectada: string
  registroId: string
  accion: string
  datosAntes: Record<string, any> | null
  datosDespues: Record<string, any> | null
  ipAddress: string | null
  userAgent: string | null
  fechaAccion: string
}

export default function AuditoriaPage() {
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroTabla, setFiltroTabla] = useState<string | null>(null)
  const [filtroAccion, setFiltroAccion] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const pageSize = 50

  const tablas = ['facturas', 'clientes', 'productos', 'abonos']
  const acciones = ['CREATE', 'UPDATE', 'DELETE']

  const cargarRegistros = async (p: number = 0) => {
    setLoading(true)
    setError(null)

    try {
      let url = `/api/auditoria?limit=${pageSize}&offset=${p * pageSize}`
      if (filtroTabla) url += `&tabla=${filtroTabla}`
      if (filtroAccion) url += `&accion=${filtroAccion}`

      const res = await apiFetch(url)
      if (!res.ok) throw new Error('Error al cargar auditoría')

      const data = await res.json()
      setRegistros(data.registros)
      setPage(p)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Vuelve a la primera página solo cuando cambia un filtro. cargarRegistros
  // cambia en cada render: ponerla en la lista cargaría sin fin.
  useEffect(() => {
    cargarRegistros(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTabla, filtroAccion])

  const getAccionColor = (accion: string) => {
    switch (accion) {
      case 'CREATE':
        return 'var(--status-green-text)'
      case 'UPDATE':
        return 'var(--status-blue-text)'
      case 'DELETE':
        return 'var(--status-red-solid)'
      default:
        return 'var(--gray-secondary)'
    }
  }

  const formatearFecha = (fecha: string) => {
    return fechaYHora(fecha)
  }

  return (
    <PermissionProtector requiredPermission="auditoria">
      <div className="card" style={{ maxWidth: 1400 }}>
        <div className="mb-4">
          <Link href="/admin" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver al Dashboard
          </Link>
        </div>

        <h1 className="card-title mb-5" style={{ fontSize: 20 }}>Auditoría e Historial</h1>

        {/* Filtros */}
        <div className="filters-row">
          <div>
            <label className="field-label">Tabla:</label>
            <select value={filtroTabla || ''} onChange={(e) => setFiltroTabla(e.target.value || null)} className="filter-select">
              <option value="">Todas</option>
              {tablas.map((tabla) => (
                <option key={tabla} value={tabla}>
                  {tabla}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Acción:</label>
            <select value={filtroAccion || ''} onChange={(e) => setFiltroAccion(e.target.value || null)} className="filter-select">
              <option value="">Todas</option>
              {acciones.map((accion) => (
                <option key={accion} value={accion}>
                  {accion}
                </option>
              ))}
            </select>
          </div>

          {(filtroTabla || filtroAccion) && (
            <button
              onClick={() => {
                setFiltroTabla(null)
                setFiltroAccion(null)
              }}
              className="btn-secondary"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {error && <div className="alert-box error">{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--gray-secondary)' }}>Cargando auditoría...</div>
        ) : registros.length === 0 ? (
          <div style={{ color: 'var(--gray-secondary)' }}>No hay registros de auditoría</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tabla</th>
                    <th>Acción</th>
                    <th>Usuario</th>
                    <th>IP</th>
                    <th style={{ textAlign: 'center' }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro) => (
                    <tr key={registro.id}>
                      <td style={{ fontSize: '11px' }}>{formatearFecha(registro.fechaAccion)}</td>
                      <td style={{ fontSize: '11px', fontWeight: 'bold' }}>{registro.tablaAfectada}</td>
                      <td>
                        <span
                          className="badge"
                          style={{ backgroundColor: getAccionColor(registro.accion), color: 'white' }}
                        >
                          {registro.accion}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px' }}>{registro.usuario?.email || '(Sistema)'}</td>
                      <td style={{ fontSize: '10px', color: 'var(--gray-secondary)' }}>{registro.ipAddress || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setExpandido(expandido === registro.id ? null : registro.id)}
                          className="btn-action"
                        >
                          {expandido === registro.id ? '↑ Ocultar' : '↓ Ver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detalles expandidos */}
            {expandido && (
              <div style={{ backgroundColor: 'var(--beige-light)', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--gray-light)' }}>
                {registros.find((r) => r.id === expandido) && (
                  <>
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: 'var(--black-primary)' }}>
                      Detalles del Cambio (ID: {expandido})
                    </h3>

                    {registros.find((r) => r.id === expandido)?.datosDespues && (
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--status-green-text)' }}>📝 Datos Actuales</h4>
                        <pre
                          style={{
                            backgroundColor: 'var(--white-off)',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid var(--gray-light)',
                            fontSize: '11px',
                            overflow: 'auto',
                            maxHeight: '300px',
                          }}
                        >
                          {JSON.stringify(registros.find((r) => r.id === expandido)?.datosDespues, null, 2)}
                        </pre>
                      </div>
                    )}

                    {registros.find((r) => r.id === expandido)?.datosAntes && (
                      <div>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--status-blue-text)' }}>📋 Datos Anteriores</h4>
                        <pre
                          style={{
                            backgroundColor: 'var(--white-off)',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid var(--gray-light)',
                            fontSize: '11px',
                            overflow: 'auto',
                            maxHeight: '300px',
                          }}
                        >
                          {JSON.stringify(registros.find((r) => r.id === expandido)?.datosAntes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Paginación */}
            <div className="flex gap-3 justify-center mt-5">
              <button onClick={() => cargarRegistros(page - 1)} disabled={page === 0} className="btn-secondary">
                ← Anterior
              </button>

              <span style={{ padding: '8px 16px', fontSize: '12px' }}>Página {page + 1}</span>

              <button onClick={() => cargarRegistros(page + 1)} disabled={registros.length < pageSize} className="btn-secondary">
                Siguiente →
              </button>
            </div>
          </>
        )}
      </div>
    </PermissionProtector>
  )
}

