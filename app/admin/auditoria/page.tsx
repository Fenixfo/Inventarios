'use client'

import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import Link from 'next/link'

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

      const res = await fetch(url)
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

  useEffect(() => {
    cargarRegistros(0)
  }, [filtroTabla, filtroAccion])

  const getAccionColor = (accion: string) => {
    switch (accion) {
      case 'CREATE':
        return '#10b981'
      case 'UPDATE':
        return '#3b82f6'
      case 'DELETE':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-CO')
  }

  return (
    <PermissionProtector requiredPermission="auditoria">
      <div style={{ padding: '20px', maxWidth: '1400px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none' }}>
          ← Volver al Dashboard
        </Link>
      </div>

      <h1 style={{ marginBottom: '30px' }}>Auditoría e Historial</h1>

      {/* Filtros */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Tabla:</label>
          <select
            value={filtroTabla || ''}
            onChange={(e) => setFiltroTabla(e.target.value || null)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
            <option value="">Todas</option>
            {tablas.map((tabla) => (
              <option key={tabla} value={tabla}>
                {tabla}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Acción:</label>
          <select
            value={filtroAccion || ''}
            onChange={(e) => setFiltroAccion(e.target.value || null)}
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '12px',
              marginTop: '4px',
            }}
          >
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
            style={{
              padding: '8px 12px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              marginTop: '24px',
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fee',
            color: '#c00',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: '#666' }}>Cargando auditoría...</div>
      ) : registros.length === 0 ? (
        <div style={{ color: '#666' }}>No hay registros de auditoría</div>
      ) : (
        <>
          <div style={{ marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f9fafb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Fecha</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Tabla</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Acción</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>Usuario</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px' }}>IP</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px' }}>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((registro) => (
                  <tr key={registro.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px', fontSize: '11px' }}>
                      {formatearFecha(registro.fechaAccion)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                      {registro.tablaAfectada}
                    </td>
                    <td style={{ padding: '12px', fontSize: '11px' }}>
                      <span
                        style={{
                          backgroundColor: getAccionColor(registro.accion),
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                        }}
                      >
                        {registro.accion}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '11px' }}>
                      {registro.usuario?.email || '(Sistema)'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '10px', color: '#999' }}>
                      {registro.ipAddress || '-'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() =>
                          setExpandido(expandido === registro.id ? null : registro.id)
                        }
                        style={{
                          backgroundColor: '#e5e7eb',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
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
            <div
              style={{
                backgroundColor: '#f9fafb',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '1px solid #e5e7eb',
              }}
            >
              {registros.find((r) => r.id === expandido) && (
                <>
                  <h3 style={{ marginTop: 0, marginBottom: '15px' }}>
                    Detalles del Cambio (ID: {expandido})
                  </h3>

                  {registros.find((r) => r.id === expandido)?.datosDespues && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 10px 0', color: '#10b981' }}>
                        📝 Datos Actuales
                      </h4>
                      <pre
                        style={{
                          backgroundColor: 'white',
                          padding: '10px',
                          borderRadius: '4px',
                          border: '1px solid #e5e7eb',
                          fontSize: '11px',
                          overflow: 'auto',
                          maxHeight: '300px',
                        }}
                      >
                        {JSON.stringify(
                          registros.find((r) => r.id === expandido)?.datosDespues,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}

                  {registros.find((r) => r.id === expandido)?.datosAntes && (
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', color: '#3b82f6' }}>
                        📋 Datos Anteriores
                      </h4>
                      <pre
                        style={{
                          backgroundColor: 'white',
                          padding: '10px',
                          borderRadius: '4px',
                          border: '1px solid #e5e7eb',
                          fontSize: '11px',
                          overflow: 'auto',
                          maxHeight: '300px',
                        }}
                      >
                        {JSON.stringify(
                          registros.find((r) => r.id === expandido)?.datosAntes,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Paginación */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={() => cargarRegistros(page - 1)}
              disabled={page === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: page === 0 ? '#e5e7eb' : '#2563eb',
                color: page === 0 ? '#999' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: page === 0 ? 'default' : 'pointer',
              }}
            >
              ← Anterior
            </button>

            <span style={{ padding: '8px 16px', fontSize: '12px' }}>
              Página {page + 1}
            </span>

            <button
              onClick={() => cargarRegistros(page + 1)}
              disabled={registros.length < pageSize}
              style={{
                padding: '8px 16px',
                backgroundColor: registros.length < pageSize ? '#e5e7eb' : '#2563eb',
                color: registros.length < pageSize ? '#999' : 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: registros.length < pageSize ? 'default' : 'pointer',
              }}
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
      </div>
    </PermissionProtector>
  )
}
