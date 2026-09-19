'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'
import { AdminOnlyProtector } from '@/components/AdminOnlyProtector'

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
  const [adminUserId, setAdminUserId] = useState<string | null>(null)

  useEffect(() => {
    const getAdminUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        setAdminUserId(session.user.id)
      }
    }
    getAdminUserId()
    cargarSolicitudes()
  }, [])

  const cargarSolicitudes = async () => {
    try {
      const res = await fetch('/api/solicitudes-acceso?estado=pendiente')
      if (!res.ok) throw new Error('Error al cargar solicitudes')
      const data = await res.json()
      setSolicitudes(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const aprobar = async (id: string) => {
    setProcesando(id)
    try {
      const res = await fetch(`/api/solicitudes-acceso/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'aprobado', adminId: adminUserId }),
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
      const res = await fetch(`/api/solicitudes-acceso/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'rechazado', adminId: adminUserId }),
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
    <AdminOnlyProtector>
      <div>
        <h1 className="text-3xl font-bold mb-8">Solicitudes de Acceso</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Cargando solicitudes...</div>
      ) : solicitudes.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
          ✓ No hay solicitudes pendientes. ¡Excelente!
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Email</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Tienda</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Razón</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">Fecha</th>
                <th className="px-6 py-3 text-center font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((solicitud, idx) => (
                <tr key={solicitud.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 font-medium text-gray-900">{solicitud.email}</td>
                  <td className="px-6 py-4 text-gray-700">{solicitud.tienda.nombre}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                    {solicitud.razon || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(solicitud.createdAt).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => aprobar(solicitud.id)}
                        disabled={procesando === solicitud.id}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        ✓ Aprobar
                      </button>
                      <button
                        onClick={() => rechazar(solicitud.id)}
                        disabled={procesando === solicitud.id}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        ✗ Rechazar
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
    </AdminOnlyProtector>
  )
}
