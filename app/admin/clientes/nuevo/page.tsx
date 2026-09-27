'use client'

import { apiFetch } from '@/lib/api-client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'

export default function NuevoClientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cedulaError, setCedulaError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    cedulaCc: '',
    direccion: '',
    terminoPago: '',
    limiteCredito: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const checkCedulaExists = async () => {
    if (!formData.cedulaCc.trim()) {
      setCedulaError(null)
      return
    }

    try {
      // Solo los que tengan esa cédula, no la lista entera de clientes.
      const res = await apiFetch(`/api/clientes?cedula=${encodeURIComponent(formData.cedulaCc.trim())}`)
      const clientes = await res.json()
      const exists = Array.isArray(clientes) && clientes.length > 0
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
    setLoading(true)
    setError(null)

    try {
      const res = await apiFetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error('Error creating cliente')
      router.push('/admin/clientes')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PermissionProtector requiredPermission="clientes">
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="mb-4">
          <Link href="/admin/clientes" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Clientes
          </Link>
        </div>

        <h1 className="card-title mb-4" style={{ fontSize: 20 }}>Nuevo Cliente</h1>

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
                value={formData.cedulaCc}
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
              <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} className="field-input" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="field-input" />
            </div>

            <div>
              <label className="field-label">Término de Pago</label>
              <select name="terminoPago" value={formData.terminoPago} onChange={handleChange} className="field-select">
                <option value="">Selecciona un término</option>
                <option value="contado">Contado</option>
                <option value="mixto">Mixto</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>

          <div>
            <label className="field-label">Dirección</label>
            <textarea name="direccion" value={formData.direccion} onChange={handleChange} rows={3} className="field-textarea" />
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

          <div className="flex gap-3 mt-2">
            <button type="submit" disabled={loading || !!cedulaError} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar Cliente'}
            </button>

            <Link href="/admin/clientes" className="btn-secondary">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </PermissionProtector>
  )
}

