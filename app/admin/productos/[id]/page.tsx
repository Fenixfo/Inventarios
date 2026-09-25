'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { apiFetch } from '@/lib/api-client'
import { ImageUploader } from '@/components/ImageUploader'
import { PermissionProtector } from '@/components/PermissionProtector'
import { SelectorCategoria } from '@/components/Common/SelectorCategoria'

interface Producto {
  id: string
  sku: string
  nombre: string
  categoria: string
  dimensiones?: string
  color?: string
  acabado?: string
  espesorMm?: number
  m2PorCaja?: number
  precioUnitario: number
  precioBodega?: number | null
  costo?: number
  stockActual: number
  stockMinimo: number
  proveedor?: string
  descripcion?: string
  imagenUrl?: string
}

export default function EditProductoPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [formData, setFormData] = useState<Producto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [skuOriginal, setSkuOriginal] = useState('')
  const [categoriasExistentes, setCategoriasExistentes] = useState<string[]>([])

  useEffect(() => {
    const fetchProducto = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email

        const url = email
          ? `/api/productos/${id}?email=${encodeURIComponent(email)}`
          : `/api/productos/${id}`

        const res = await apiFetch(url)
        if (!res.ok) {
          if (res.status === 403) {
            setError('No tienes permiso para ver productos')
          } else {
            throw new Error('Producto not found')
          }
          return
        }
        const data = await res.json()
        setFormData(data)
        setSkuOriginal(data.sku)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProducto()
  }, [id])

  // Las categorías que ya usa la tienda, para ofrecerlas en el campo.
  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const res = await apiFetch('/api/productos')
        if (!res.ok) return

        const productos = await res.json()
        setCategoriasExistentes(
          Array.from(
            new Set(productos.map((p: any) => p.categoria).filter(Boolean) as string[])
          ).sort((a, b) => a.localeCompare(b, 'es'))
        )
      } catch {
        // Sin la lista el campo sigue sirviendo: se escribe la categoría.
      }
    }

    cargarCategorias()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!formData) return
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const checkSkuExists = async () => {
    if (!formData?.sku.trim() || formData.sku === skuOriginal) {
      setSkuError(null)
      return
    }

    try {
      const res = await apiFetch(`/api/productos?sku=${encodeURIComponent(formData.sku)}`)
      const productos = await res.json()
      if (Array.isArray(productos) && productos.length > 0) {
        setSkuError('Este SKU ya existe')
      } else {
        setSkuError(null)
      }
    } catch (err) {
      setSkuError(null)
    }
  }

  const preventWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData) return

    // La categoría es un campo de texto con lista: el navegador ya no la
    // exige por su cuenta como hacía el select.
    if (!formData.categoria.trim()) {
      setError('Elige una categoría o escribe una nueva')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await apiFetch('/api/productos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error('Error updating producto')
      router.push('/admin/productos')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este producto?')) return

    setSaving(true)
    setError(null)

    try {
      const res = await apiFetch(`/api/productos/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Error deleting producto')
      router.push('/admin/productos')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>
  if (!formData) return <div style={{ padding: '20px', color: 'red' }}>Producto no encontrado</div>

  return (
    <PermissionProtector requiredPermission="productos">
      <div style={{ padding: '20px', maxWidth: '800px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin/productos" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver a Productos
          </Link>
        </div>

        <h1 style={{ marginBottom: '20px' }}>Editar Producto</h1>

        {error && (
          <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>SKU *</label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              onBlur={checkSkuExists}
              required
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: skuError ? '2px solid #dc2626' : '1px solid #ddd',
                boxSizing: 'border-box'
              }}
            />
            {skuError && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                {skuError}
              </div>
            )}
          </div>

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

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Categoría *</label>
            <SelectorCategoria
              value={formData.categoria}
              onChange={(categoria) =>
                setFormData((prev) => (prev ? { ...prev, categoria } : prev))
              }
              categorias={categoriasExistentes}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dimensiones</label>
              <input
                type="text"
                name="dimensiones"
                value={formData.dimensiones || ''}
                onChange={handleChange}
                placeholder="Ej: 60x60"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Color</label>
              <input
                type="text"
                name="color"
                value={formData.color || ''}
                onChange={handleChange}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Acabado</label>
              <input
                type="text"
                name="acabado"
                value={formData.acabado || ''}
                onChange={handleChange}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Espesor (mm)</label>
              <input
                type="number"
                name="espesorMm"
                value={formData.espesorMm || ''}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>m² por caja</label>
            <input
              type="number"
              name="m2PorCaja"
              value={formData.m2PorCaja || ''}
              onChange={handleChange}
              onWheel={preventWheelChange}
              step="0.01"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Precio al público *</label>
              <input
                type="number"
                name="precioUnitario"
                value={formData.precioUnitario}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>El que ve el cliente.</small>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Precio de bodega</label>
              <input
                type="number"
                name="precioBodega"
                value={formData.precioBodega ?? ''}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>
                Vacío = se cobra el del público.
              </small>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Costo</label>
              <input
                type="number"
                name="costo"
                value={formData.costo || ''}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
              <small style={{ color: '#6b7280', fontSize: '12px' }}>Precio de compra.</small>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Stock Actual *</label>
              <input
                type="number"
                name="stockActual"
                value={formData.stockActual}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Stock Mínimo *</label>
              <input
                type="number"
                name="stockMinimo"
                value={formData.stockMinimo}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Proveedor</label>
            <input
              type="text"
              name="proveedor"
              value={formData.proveedor || ''}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion || ''}
              onChange={handleChange}
              rows={4}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <ImageUploader
              etiqueta="Imagen del producto"
              valor={formData.imagenUrl || ''}
              onChange={(url) =>
                setFormData((prev) => (prev ? { ...prev, imagenUrl: url } : prev))
              }
              carpeta="productos"
              ayuda="Es lo que ven tus clientes en el catálogo. Se reduce y optimiza automáticamente."
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving || !!skuError}
              style={{
                padding: '10px 20px',
                backgroundColor: saving || skuError ? '#999' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving || skuError ? 'not-allowed' : 'pointer',
                opacity: saving || skuError ? 0.6 : 1,
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
              {saving ? 'Eliminando...' : 'Eliminar Producto'}
            </button>
          </div>
        </form>
      </div>
    </PermissionProtector>
  )
}
