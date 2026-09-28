'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'
import { PermissionProtector } from '@/components/PermissionProtector'
import { soloFecha } from '@/lib/fechas'

interface Cliente {
  id: string
  nombre: string
  email?: string
  telefono?: string
  cedulaCc?: string
  direccion?: string
  terminoPago?: string
  limiteCredito: number
  ultimaCompraFecha?: string
}

export default function EditClientePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [formData, setFormData] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cedulaError, setCedulaError] = useState<string | null>(null)
  const [cedulaOriginal, setCedulaOriginal] = useState('')

  useEffect(() => {
    const fetchCliente = async () => {
      try {
        // El usuario sale del token: el ?email= que se mandaba ya no se usaba.
        const res = await apiFetch(`/api/clientes/${id}`)
        if (!res.ok) {
          if (res.status === 403) {
            setError('No tienes permiso para ver clientes')
          } else {
            throw new Error('Cliente not found')
          }
          return
        }
        const data = await res.json()
        setFormData(data)
        setCedulaOriginal(data.cedulaCc || '')
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchCliente()
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formData) return
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const checkCedulaExists = async () => {
    if (!formData?.cedulaCc?.trim() || formData.cedulaCc === cedulaOriginal) {
      setCedulaError(null)
      return
    }

    try {
      // Solo los que tengan esa cédula, no la lista entera de clientes.
      const res = await apiFetch(`/api/clientes?cedula=${encodeURIComponent(formData.cedulaCc.trim())}`)
      const clientes = await res.json()
      const exists = clientes.some((c: Cliente) => c.id !== id)
      if (exists) {
        setCedulaError('Esta cédula ya existe')
      } else {
        setCedulaError(null)
      }
    } catch (err) {
      setCedulaError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData) return

    setSaving(true)
    setError(null)

    try {
      const res = await apiFetch('/api/clientes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error('Error updating cliente')
      router.push('/admin/clientes')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) return

    setSaving(true)
    setError(null)

    try {
      const res = await apiFetch(`/api/clientes/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Error deleting cliente')
      router.push('/admin/clientes')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card" style={{ color: 'var(--gray-secondary)' }}>Cargando...</div>
  if (!formData) return <div className="card" style={{ color: 'var(--status-red-solid)' }}>Cliente no encontrado</div>

  return (
    <PermissionProtector requiredPermission="clientes">
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="mb-4">
          <Link href="/admin/clientes" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Clientes
          </Link>
        </div>

        <h1 className="card-title mb-4" style={{ fontSize: 20 }}>Editar Cliente</h1>

        {error && <div className="alert-box error">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="field-label">Nombre *</label>
            <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required className="field-input" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Cédula/CC *</label>
              <input
                type="text"
                name="cedulaCc"
                value={formData.cedulaCc || ''}
                onChange={handleChange}
                onBlur={checkCedulaExists}
                required
                className={`field-input ${cedulaError ? 'has-error' : ''}`}
              />
              {cedulaError && (
                <div style={{ color: 'var(--status-red-solid)', fontSize: '12px', marginTop: '4px' }}>
                  {cedulaError}
                </div>
              )}
            </div>

            <div>
              <label className="field-label">Teléfono</label>
              <input type="text" name="telefono" value={formData.telefono || ''} onChange={handleChange} className="field-input" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Email</label>
              <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="field-input" />
            </div>

            <div>
              <label className="field-label">Término de Pago</label>
              <select name="terminoPago" value={formData.terminoPago || ''} onChange={handleChange} className="field-select">
                <option value="">Selecciona un término</option>
                <option value="contado">Contado</option>
                <option value="mixto">Mixto</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Dirección</label>
            <textarea name="direccion" value={formData.direccion || ''} onChange={handleChange} rows={3} className="field-textarea" />
          </div>

          <div>
            <label className="field-label">Límite de Crédito</label>
            <input
              type="number"
              name="limiteCredito"
              value={formData.limiteCredito}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="field-input"
            />
          </div>

          {formData.ultimaCompraFecha && (
            <div style={{ padding: '10px', backgroundColor: 'var(--beige-light)', borderRadius: '8px' }}>
              <strong>Última compra:</strong> {soloFecha(formData.ultimaCompraFecha)}
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button type="submit" disabled={saving || !!cedulaError} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>

            <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger">
              {saving ? 'Eliminando...' : 'Eliminar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </PermissionProtector>
  )
}
