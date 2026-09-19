'use client'

import { useEffect, useState } from 'react'
import { AdminOnlyProtector } from '@/components/AdminOnlyProtector'

interface Usuario {
  id: string
  email: string
  createdAt: string
  roles: Array<{ id: string; rol: string }>
  tiendas: Array<{
    tienda: { id: string; nombre: string }
  }>
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const cargarUsuarios = async () => {
    try {
      const res = await fetch('/api/usuarios')
      if (!res.ok) throw new Error('Error al cargar usuarios')
      const data = await res.json()
      setUsuarios(data)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const agregarRol = async (usuarioId: string, rol: string) => {
    setProcesando(usuarioId)
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al asignar rol')
      }

      const usuarioActualizado = await res.json()
      setUsuarios(usuarios.map(u => u.id === usuarioId ? usuarioActualizado : u))
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(null)
    }
  }

  const removerRol = async (usuarioId: string, rol: string) => {
    setProcesando(usuarioId)
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rol }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al remover rol')
      }

      const usuarioActualizado = await res.json()
      setUsuarios(usuarios.map(u => u.id === usuarioId ? usuarioActualizado : u))
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(null)
    }
  }

  return (
    <AdminOnlyProtector>
      <div>
        <h1 className="text-3xl font-bold mb-8">Gestión de Usuarios</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Cargando usuarios...</div>
      ) : usuarios.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
          No hay usuarios registrados
        </div>
      ) : (
        <div className="space-y-4">
          {usuarios.map((usuario) => (
            <div
              key={usuario.id}
              className="bg-white rounded-lg shadow border border-gray-200"
            >
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => setExpandido(expandido === usuario.id ? null : usuario.id)}
              >
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{usuario.email}</div>
                  <div className="text-sm text-gray-600">
                    {new Date(usuario.createdAt).toLocaleDateString('es-CO')}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                    {usuario.roles.map((r) => (
                      <span
                        key={r.id}
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          r.rol === 'admin'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {r.rol}
                      </span>
                    ))}
                  </div>

                  <div className="text-gray-400">
                    {expandido === usuario.id ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {expandido === usuario.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Roles</h3>
                      <div className="space-y-2">
                        {usuario.roles.length > 0 ? (
                          usuario.roles.map((rol) => (
                            <div
                              key={rol.id}
                              className="flex items-center justify-between bg-white p-2 rounded border border-gray-200"
                            >
                              <span className="text-sm font-medium text-gray-700">
                                {rol.rol}
                              </span>
                              <button
                                onClick={() => removerRol(usuario.id, rol.rol)}
                                disabled={procesando === usuario.id}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                              >
                                Remover
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-600">Sin roles</p>
                        )}
                      </div>

                      <h3 className="font-semibold text-gray-900 mt-4 mb-3">Agregar Rol</h3>
                      <div className="space-y-2">
                        {['admin', 'user'].map((rol) => {
                          const tieneRol = usuario.roles.some(r => r.rol === rol)
                          return (
                            <button
                              key={rol}
                              onClick={() => agregarRol(usuario.id, rol)}
                              disabled={tieneRol || procesando === usuario.id}
                              className={`w-full px-3 py-2 rounded text-sm font-medium ${
                                tieneRol
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              } disabled:opacity-50`}
                            >
                              + {rol}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Tiendas Asignadas</h3>
                      <div className="space-y-2">
                        {usuario.tiendas.length > 0 ? (
                          usuario.tiendas.map((ut) => (
                            <div
                              key={ut.tienda.id}
                              className="bg-white p-2 rounded border border-gray-200"
                            >
                              <span className="text-sm font-medium text-gray-700">
                                {ut.tienda.nombre}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-600">Sin tiendas asignadas</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </AdminOnlyProtector>
  )
}
