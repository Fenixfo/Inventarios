'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import { soloFecha } from '@/lib/fechas'

interface SolicitudAcceso {
  id: string
  usuario: { id: string; email: string }
  tienda: { id: string; nombre: string }
  email: string
  razon: string
  estado: string
  createdAt: string
}

export default function SolicitudesAccesoPage() {
  const [solicitudes, setSolicitudes] = useState<SolicitudAcceso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)

  const cargarSolicitudes = async () => {
    try {
      const res = await apiFetch('/api/solicitudes-acceso?estado=pendiente')
      if (!res.ok) throw new Error('Error al cargar solicitudes')
      const data = await res.json()
      setSolicitudes(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Quién aprueba o rechaza lo saca el servidor del token: el adminId que se
  // mandaba en el cuerpo, y la consulta de sesión para obtenerlo, sobraban.
  useEffect(() => {
    cargarSolicitudes()
  }, [])

  const aprobar = async (id: string) => {
    setProcesando(id)
    try {
      const res = await apiFetch(`/api/solicitudes-acceso/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'aprobado' }),
      })
      if (!res.ok) throw new Error('Error al aprobar')
      setSolicitudes(solicitudes.filter((s) => s.id !== id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(null)
    }
  }

  const rechazar = async (id: string) => {
    setProcesando(id)
    try {
      const res = await apiFetch(`/api/solicitudes-acceso/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'rechazado' }),
      })
      if (!res.ok) throw new Error('Error al rechazar')
      setSolicitudes(solicitudes.filter((s) => s.id !== id))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(null)
    }
  }

  return (
    <PermissionProtector requiredPermission="solicitudes-acceso">
      <div>
        <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--black-primary)' }}>Solicitudes de Acceso</h1>

        {error && <div className="alert-box error">{error}</div>}

        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--gray-secondary)' }}>Cargando solicitudes...</div>
        ) : solicitudes.length === 0 ? (
          <div className="card text-center" style={{ color: 'var(--gray-secondary)' }}>
            ✅ No hay solicitudes pendientes. ¡Excelente!
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table-luxe">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Tienda</th>
                  <th>Razón</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((solicitud) => (
                  <tr key={solicitud.id}>
                    <td style={{ fontWeight: 600 }}>{solicitud.email}</td>
                    <td>{solicitud.tienda.nombre}</td>
                    <td style={{ maxWidth: '280px', fontSize: '13px', color: 'var(--gray-secondary)' }}>
                      {solicitud.razon || '-'}
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--gray-secondary)' }}>{soloFecha(solicitud.createdAt)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => aprobar(solicitud.id)}
                          disabled={procesando === solicitud.id}
                          className="badge badge-green"
                          style={{ cursor: 'pointer', border: 'none', fontSize: 12 }}
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          onClick={() => rechazar(solicitud.id)}
                          disabled={procesando === solicitud.id}
                          className="badge badge-red"
                          style={{ cursor: 'pointer', border: 'none', fontSize: 12 }}
                        >
                          ❌ Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PermissionProtector>
  )
}
