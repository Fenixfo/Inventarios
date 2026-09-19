'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'

interface PermisoModulo {
  id: string
  nombre: string
  icono?: string
}

interface RolPersonalizado {
  id: string
  nombre: string
  descripcion?: string
  permisos: Array<{ modulo: PermisoModulo }>
  asignado: boolean
}

interface Usuario {
  id: string
  email: string
  createdAt: string
  roles: Array<{ id: string; rol: string }>
  rolesPersonalizados: Array<{
    rol: {
      id: string
      nombre: string
      descripcion?: string
      permisos: Array<{ modulo: PermisoModulo }>
    }
  }>
  tiendas: Array<{
    tienda: { id: string; nombre: string }
  }>
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [rolesDisponibles, setRolesDisponibles] = useState<Record<string, RolPersonalizado[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    cargarUsuarios()
  }, [])

  const cargarUsuarios = async () => {
    try {
      const res = await apiFetch('/api/usuarios')
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

  const cargarRolesDisponibles = async (usuarioId: string) => {
    try {
      const res = await apiFetch(`/api/usuarios/${usuarioId}/roles-disponibles`)
      if (!res.ok) throw new Error('Error al cargar roles disponibles')
      const data = await res.json()
      setRolesDisponibles(prev => ({ ...prev, [usuarioId]: data }))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const asignarRolPersonalizado = async (usuarioId: string, rolId: string) => {
    setProcesando(usuarioId)
    try {
      const res = await apiFetch(`/api/usuarios/${usuarioId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al asignar rol')
      }

      const usuarioActualizado = await res.json()
      setUsuarios(usuarios.map(u => u.id === usuarioId ? usuarioActualizado : u))
      await cargarRolesDisponibles(usuarioId)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(null)
    }
  }

  const removerRolPersonalizado = async (usuarioId: string, rolId: string) => {
    setProcesando(usuarioId)
    try {
      const res = await apiFetch(`/api/usuarios/${usuarioId}/roles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al remover rol')
      }

      const usuarioActualizado = await res.json()
      setUsuarios(usuarios.map(u => u.id === usuarioId ? usuarioActualizado : u))
      await cargarRolesDisponibles(usuarioId)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(null)
    }
  }

  const toggleExpandir = async (usuarioId: string) => {
    if (expandido === usuarioId) {
      setExpandido(null)
    } else {
      setExpandido(usuarioId)
      if (!rolesDisponibles[usuarioId]) {
        await cargarRolesDisponibles(usuarioId)
      }
    }
  }

  return (
    <PermissionProtector requiredPermission="usuarios">
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
                  onClick={() => toggleExpandir(usuario.id)}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{usuario.email}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(usuario.createdAt).toLocaleDateString('es-CO')}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                      {usuario.rolesPersonalizados.map((ur) => (
                        <span
                          key={ur.rol.id}
                          className="inline-block px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-medium"
                        >
                          {ur.rol.nombre}
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Roles Actuales */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Roles Asignados</h3>
                        <div className="space-y-2">
                          {usuario.rolesPersonalizados.length > 0 ? (
                            usuario.rolesPersonalizados.map((ur) => (
                              <div
                                key={ur.rol.id}
                                className="bg-white p-3 rounded border border-gray-200"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {ur.rol.nombre}
                                    </div>
                                    {ur.rol.descripcion && (
                                      <div className="text-xs text-gray-600">
                                        {ur.rol.descripcion}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => removerRolPersonalizado(usuario.id, ur.rol.id)}
                                    disabled={procesando === usuario.id}
                                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                  >
                                    Remover
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {ur.rol.permisos.map(p => (
                                    <span
                                      key={p.modulo.id}
                                      className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded"
                                    >
                                      {p.modulo.icono} {p.modulo.nombre}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-600">Sin roles asignados</p>
                          )}
                        </div>
                      </div>

                      {/* Roles Disponibles */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Agregar Rol</h3>
                        <div className="space-y-2">
                          {rolesDisponibles[usuario.id] ? (
                            rolesDisponibles[usuario.id].filter(r => !r.asignado).length > 0 ? (
                              rolesDisponibles[usuario.id]
                                .filter(r => !r.asignado)
                                .map((rol) => (
                                  <button
                                    key={rol.id}
                                    onClick={() => asignarRolPersonalizado(usuario.id, rol.id)}
                                    disabled={procesando === usuario.id}
                                    className="w-full text-left p-3 bg-green-50 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50"
                                  >
                                    <div className="font-medium text-green-900 mb-1">
                                      + {rol.nombre}
                                    </div>
                                    {rol.descripcion && (
                                      <div className="text-xs text-green-800 mb-2">
                                        {rol.descripcion}
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-1">
                                      {rol.permisos.map(p => (
                                        <span
                                          key={p.modulo.id}
                                          className="text-xs bg-white text-green-700 px-1.5 py-0.5 rounded border border-green-200"
                                        >
                                          {p.modulo.icono}
                                        </span>
                                      ))}
                                    </div>
                                  </button>
                                ))
                            ) : (
                              <p className="text-sm text-gray-600">
                                El usuario ya tiene todos los roles disponibles
                              </p>
                            )
                          ) : (
                            <p className="text-sm text-gray-600">Cargando...</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tiendas */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h3 className="font-semibold text-gray-900 mb-3">Tiendas Asignadas</h3>
                      <div className="flex flex-wrap gap-2">
                        {usuario.tiendas.length > 0 ? (
                          usuario.tiendas.map((ut) => (
                            <span
                              key={ut.tienda.id}
                              className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium"
                            >
                              {ut.tienda.nombre}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm text-gray-600">Sin tiendas asignadas</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionProtector>
  )
}

