'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
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
        // El usuario sale del token: el ?email= que se mandaba ya no se usaba.
        const res = await apiFetch(`/api/productos/${id}`)
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

  // Las categorías que ya usa la tienda, para ofrecerlas en el campo. Solo
  // los nombres: antes se bajaban todos los productos para sacarlas.
  useEffect(() => {
    const cargarCategorias = async () => {
      try {
        const res = await apiFetch('/api/productos/categorias')
        if (!res.ok) return

        const categorias: string[] = await res.json()
        setCategoriasExistentes(categorias.sort((a, b) => a.localeCompare(b, 'es')))
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

  if (loading) return <div className="card" style={{ color: 'var(--gray-secondary)' }}>Cargando...</div>
  if (!formData) return <div className="card" style={{ color: 'var(--status-red-solid)' }}>Producto no encontrado</div>

  return (
    <PermissionProtector requiredPermission="productos">
      <div className="card" style={{ maxWidth: 800 }}>
        <div className="mb-4">
          <Link href="/admin/productos" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Productos
          </Link>
        </div>

        <h1 className="card-title mb-4" style={{ fontSize: 20 }}>Editar Producto</h1>

        {error && <div className="alert-box error">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="field-label">SKU *</label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              onBlur={checkSkuExists}
              required
              className={`field-input ${skuError ? 'has-error' : ''}`}
            />
            {skuError && (
              <div style={{ color: 'var(--status-red-solid)', fontSize: '12px', marginTop: '4px' }}>
                {skuError}
              </div>
            )}
          </div>

          <div>
            <label className="field-label">Nombre *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              className="field-input"
            />
          </div>

          <div>
            <label className="field-label">Categoría *</label>
            <SelectorCategoria
              value={formData.categoria}
              onChange={(categoria) => setFormData((prev) => (prev ? { ...prev, categoria } : prev))}
              categorias={categoriasExistentes}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Dimensiones</label>
              <input
                type="text"
                name="dimensiones"
                value={formData.dimensiones || ''}
                onChange={handleChange}
                placeholder="Ej: 60x60"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Color</label>
              <input type="text" name="color" value={formData.color || ''} onChange={handleChange} className="field-input" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Acabado</label>
              <input type="text" name="acabado" value={formData.acabado || ''} onChange={handleChange} className="field-input" />
            </div>

            <div>
              <label className="field-label">Espesor (mm)</label>
              <input
                type="number"
                name="espesorMm"
                value={formData.espesorMm || ''}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                className="field-input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">m² por caja</label>
            <input
              type="number"
              name="m2PorCaja"
              value={formData.m2PorCaja || ''}
              onChange={handleChange}
              onWheel={preventWheelChange}
              step="0.01"
              className="field-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="field-label">Precio al público *</label>
              <input
                type="number"
                name="precioUnitario"
                value={formData.precioUnitario}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                required
                className="field-input"
              />
              <p className="field-help">El que ve el cliente.</p>
            </div>

            <div>
              <label className="field-label">Precio de bodega</label>
              <input
                type="number"
                name="precioBodega"
                value={formData.precioBodega ?? ''}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                className="field-input"
              />
              <p className="field-help">Vacío = se cobra el del público.</p>
            </div>

            <div>
              <label className="field-label">Costo</label>
              <input
                type="number"
                name="costo"
                value={formData.costo || ''}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                className="field-input"
              />
              <p className="field-help">Precio de compra.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Stock Actual *</label>
              <input
                type="number"
                name="stockActual"
                value={formData.stockActual}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                required
                className="field-input"
              />
              <p className="field-help">Si lo cambias, queda en el historial de Inventario.</p>
            </div>

            <div>
              <label className="field-label">Stock Mínimo *</label>
              <input
                type="number"
                name="stockMinimo"
                value={formData.stockMinimo}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                required
                className="field-input"
              />
            </div>
          </div>

          <div>
            <label className="field-label">Proveedor</label>
            <input type="text" name="proveedor" value={formData.proveedor || ''} onChange={handleChange} className="field-input" />
          </div>

          <div>
            <label className="field-label">Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion || ''}
              onChange={handleChange}
              rows={4}
              className="field-textarea"
            />
          </div>

          <div>
            <ImageUploader
              etiqueta="Imagen del producto"
              valor={formData.imagenUrl || ''}
              onChange={(url) => setFormData((prev) => (prev ? { ...prev, imagenUrl: url } : prev))}
              carpeta="productos"
              ayuda="Es lo que ven tus clientes en el catálogo. Se reduce y optimiza automáticamente."
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button type="submit" disabled={saving || !!skuError} className="btn-primary">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>

            <button type="button" onClick={handleDelete} disabled={saving} className="btn-danger">
              {saving ? 'Eliminando...' : 'Eliminar Producto'}
            </button>
          </div>
        </form>
      </div>
    </PermissionProtector>
  )
}
