'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
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
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email

        const url = email
          ? `/api/clientes/${id}?email=${encodeURIComponent(email)}`
          : `/api/clientes/${id}`

        const res = await apiFetch(url)
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
      const res = await apiFetch('/api/clientes')
      const clientes = await res.json()
      const exists = clientes.some((c: Cliente) => c.cedulaCc === formData.cedulaCc && c.id !== id)
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

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>
  if (!formData) return <div style={{ padding: '20px', color: 'red' }}>Cliente no encontrado</div>

  return (
    <PermissionProtector requiredPermission="clientes">
      <div style={{ padding: '20px', maxWidth: '600px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin/clientes" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver a Clientes
          </Link>
        </div>

        <h1 style={{ marginBottom: '20px' }}>Editar Cliente</h1>

        {error && (
          <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Cédula/CC *</label>
              <input
                type="text"
                name="cedulaCc"
                value={formData.cedulaCc || ''}
                onChange={handleChange}
                onBlur={checkCedulaExists}
                required
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: cedulaError ? '2px solid #dc2626' : '1px solid #ddd',
                  boxSizing: 'border-box'
                }}
              />
              {cedulaError && (
                <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  {cedulaError}
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Teléfono</label>
              <input
                type="text"
                name="telefono"
                value={formData.telefono || ''}
                onChange={handleChange}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email || ''}
                onChange={handleChange}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Término de Pago</label>
              <select
                name="terminoPago"
                value={formData.terminoPago || ''}
                onChange={handleChange}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              >
                <option value="">Selecciona un término</option>
                <option value="contado">Contado</option>
                <option value="mixto">Mixto</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dirección</label>
            <textarea
              name="direccion"
              value={formData.direccion || ''}
              onChange={handleChange}
              rows={3}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Límite de Crédito</label>
            <input
              type="number"
              name="limiteCredito"
              value={formData.limiteCredito}
              onChange={handleChange}
              step="0.01"
              min="0"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          {formData.ultimaCompraFecha && (
            <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <strong>Última compra:</strong> {soloFecha(formData.ultimaCompraFecha)}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving || !!cedulaError}
              style={{
                padding: '10px 20px',
                backgroundColor: saving || cedulaError ? '#999' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving || cedulaError ? 'not-allowed' : 'pointer',
                opacity: saving || cedulaError ? 0.6 : 1,
              }}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              style={{
                padding: '10px 20px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Eliminando...' : 'Eliminar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </PermissionProtector>
  )
}
