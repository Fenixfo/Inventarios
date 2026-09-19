'use client'

import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'

interface PermisoModulo {
  id: string
  modulo: string
  nombre: string
  icono?: string
}

interface PermisoRol {
  modulo: PermisoModulo
}

interface RolPersonalizado {
  id: string
  nombre: string
  descripcion?: string
  esAdmin: boolean
  permisos: PermisoRol[]
}

type Vista = 'listar' | 'crear' | 'editar'

export default function RolesPage() {
  const [roles, setRoles] = useState<RolPersonalizado[]>([])
  const [modulos, setModulos] = useState<PermisoModulo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrando, setMostrando] = useState<Vista>('listar')
  const [procesando, setProcesando] = useState(false)
  const [rolEditando, setRolEditando] = useState<RolPersonalizado | null>(null)

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    permisoIds: [] as string[]
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [rolesRes, modulosRes] = await Promise.all([
        fetch('/api/roles-personalizados'),
        fetch('/api/permisos-modulos')
      ])

      if (!rolesRes.ok || !modulosRes.ok) {
        throw new Error('Error al cargar datos')
      }

      const rolesData = await rolesRes.json()
      const modulosData = await modulosRes.json()

      setRoles(rolesData)
      setModulos(modulosData)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const crearRol = async (e: React.FormEvent) => {
    e.preventDefault()
    setProcesando(true)

    try {
      if (!formData.nombre.trim()) {
        setError('El nombre es requerido')
        return
      }

      const res = await fetch('/api/roles-personalizados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al crear rol')
      }

      const nuevoRol = await res.json()
      setRoles([...roles, nuevoRol])
      setFormData({ nombre: '', descripcion: '', permisoIds: [] })
      setMostrando('listar')
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  const actualizarRol = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rolEditando) return
    setProcesando(true)

    try {
      if (!formData.nombre.trim()) {
        setError('El nombre es requerido')
        return
      }

      const res = await fetch(`/api/roles-personalizados/${rolEditando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al actualizar rol')
      }

      const rolActualizado = await res.json()
      setRoles(roles.map(r => r.id === rolEditando.id ? rolActualizado : r))
      setFormData({ nombre: '', descripcion: '', permisoIds: [] })
      setRolEditando(null)
      setMostrando('listar')
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  const eliminarRol = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este rol?')) return

    setProcesando(true)
    try {
      const res = await fetch(`/api/roles-personalizados/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar rol')
      }

      setRoles(roles.filter(r => r.id !== id))
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setProcesando(false)
    }
  }

  const iniciarEdicion = (rol: RolPersonalizado) => {
    setRolEditando(rol)
    setFormData({
      nombre: rol.nombre,
      descripcion: rol.descripcion || '',
      permisoIds: rol.permisos.map(p => p.modulo.id)
    })
    setMostrando('editar')
  }

  const togglePermiso = (moduloId: string) => {
    setFormData(prev => ({
      ...prev,
      permisoIds: prev.permisoIds.includes(moduloId)
        ? prev.permisoIds.filter(id => id !== moduloId)
        : [...prev.permisoIds, moduloId]
    }))
  }

  if (loading) {
    return (
      <PermissionProtector requiredPermission="roles">
        <div className="text-center py-12">Cargando roles...</div>
      </PermissionProtector>
    )
  }

  return (
    <PermissionProtector requiredPermission="roles">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Gestión de Roles</h1>
          {mostrando === 'listar' && (
            <button
              onClick={() => {
                setMostrando('crear')
                setFormData({ nombre: '', descripcion: '', permisoIds: [] })
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              + Crear Rol
            </button>
          )}
          {mostrando !== 'listar' && (
            <button
              onClick={() => {
                setMostrando('listar')
                setRolEditando(null)
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Volver
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {mostrando === 'crear' || mostrando === 'editar' ? (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-6">
              {mostrando === 'crear' ? 'Crear Nuevo Rol' : 'Editar Rol'}
            </h2>

            <form onSubmit={mostrando === 'crear' ? crearRol : actualizarRol} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Rol
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej: Editor de Productos"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={procesando}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={e => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Describe las responsabilidades de este rol"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  disabled={procesando}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Permisos
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {modulos.filter(m => m.modulo !== 'dashboard').map(modulo => (
                    <label
                      key={modulo.id}
                      className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.permisoIds.includes(modulo.id)}
                        onChange={() => togglePermiso(modulo.id)}
                        disabled={procesando}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="ml-3 flex items-center gap-2">
                        <span className="text-lg">{modulo.icono || '📦'}</span>
                        <span className="font-medium text-gray-700">{modulo.nombre}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={procesando}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  {procesando ? 'Procesando...' : mostrando === 'crear' ? 'Crear Rol' : 'Guardar Cambios'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ nombre: '', descripcion: '', permisoIds: [] })
                    setMostrando('listar')
                    setRolEditando(null)
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 font-medium"
                  disabled={procesando}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {roles.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-gray-600">
                No hay roles creados. Crea uno para empezar.
              </div>
            ) : (
              roles.map(rol => (
                <div
                  key={rol.id}
                  className="bg-white rounded-lg shadow border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 text-lg">
                        {rol.nombre}
                      </div>
                      {rol.descripcion && (
                        <div className="text-sm text-gray-600 mt-1">{rol.descripcion}</div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {rol.permisos.map(p => (
                          <span
                            key={p.modulo.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                          >
                            <span>{p.modulo.icono}</span>
                            {p.modulo.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => iniciarEdicion(rol)}
                        disabled={procesando}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => eliminarRol(rol.id)}
                        disabled={procesando}
                        className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </PermissionProtector>
  )
}
