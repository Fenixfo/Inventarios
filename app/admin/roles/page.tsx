'use client'

import { useEffect, useState } from 'react'
import { AdminOnlyProtector } from '@/components/AdminOnlyProtector'

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

export default function RolesPage() {
  const [roles, setRoles] = useState<RolPersonalizado[]>([])
  const [modulos, setModulos] = useState<PermisoModulo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [mostrando, setMostrando] = useState<'listar' | 'crear'>('listar')
  const [procesando, setProcesando] = useState(false)

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

      if (!rolesRes.ok) throw new Error('Error al cargar roles')
      if (!modulosRes.ok) throw new Error('Error al cargar módulos')

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
      <AdminOnlyProtector>
        <div className="text-center py-12">Cargando roles...</div>
      </AdminOnlyProtector>
    )
  }

  return (
    <AdminOnlyProtector>
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Gestión de Roles</h1>
          {mostrando === 'listar' && (
            <button
              onClick={() => setMostrando('crear')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              + Crear Rol
            </button>
          )}
          {mostrando === 'crear' && (
            <button
              onClick={() => setMostrando('listar')}
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

        {mostrando === 'crear' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Roles Existentes */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">Roles Existentes</h2>
              <div className="space-y-3">
                {roles.length === 0 ? (
                  <p className="text-gray-600">No hay roles existentes</p>
                ) : (
                  roles.map(rol => (
                    <div
                      key={rol.id}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                        {rol.nombre}
                        {rol.esAdmin && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      {rol.descripcion && (
                        <p className="text-sm text-gray-600 mb-3">{rol.descripcion}</p>
                      )}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-700">Permisos ({rol.permisos.length}):</p>
                        <div className="flex flex-wrap gap-2">
                          {rol.permisos.length > 0 ? (
                            rol.permisos.map(p => (
                              <span
                                key={p.modulo.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs"
                              >
                                <span>{p.modulo.icono || '📦'}</span>
                                {p.modulo.nombre}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500">Sin permisos</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Formulario Crear Rol */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-6">Crear Nuevo Rol</h2>

              <form onSubmit={crearRol} className="space-y-6">
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
                  Permisos (selecciona los módulos a los que tendrá acceso)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {modulos.map(modulo => (
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
                  {procesando ? 'Creando...' : 'Crear Rol'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({ nombre: '', descripcion: '', permisoIds: [] })
                    setMostrando('listar')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 font-medium"
                  disabled={procesando}
                >
                  Cancelar
                </button>
              </div>
            </form>
            </div>
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
                  className="bg-white rounded-lg shadow border border-gray-200"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                    onClick={() => setExpandido(expandido === rol.id ? null : rol.id)}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 flex items-center gap-2">
                        {rol.nombre}
                        {rol.esAdmin && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            Admin
                          </span>
                        )}
                      </div>
                      {rol.descripcion && (
                        <div className="text-sm text-gray-600">{rol.descripcion}</div>
                      )}
                    </div>
                    <div className="text-gray-400">
                      {expandido === rol.id ? '▼' : '▶'}
                    </div>
                  </div>

                  {expandido === rol.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <h3 className="font-semibold text-gray-900 mb-3">Permisos Asignados</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {rol.permisos.length > 0 ? (
                          rol.permisos.map(p => (
                            <div
                              key={p.modulo.id}
                              className="bg-white p-2 rounded border border-gray-200 flex items-center gap-2"
                            >
                              <span className="text-lg">{p.modulo.icono || '📦'}</span>
                              <span className="text-sm font-medium text-gray-700">
                                {p.modulo.nombre}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-600 col-span-2">
                            Sin permisos asignados
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AdminOnlyProtector>
  )
}
