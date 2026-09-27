'use client'

import { apiFetch } from '@/lib/api-client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PermissionProtector } from '@/components/PermissionProtector'
import { ImageUploader } from '@/components/ImageUploader'
import { SelectorCategoria } from '@/components/Common/SelectorCategoria'
import { useBusquedaRemota } from '@/lib/use-busqueda-remota'

interface Producto {
  id: string
  nombre: string
  sku: string
  categoria?: string
}

export default function NuevoProductoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [mostrarSugerenciasNombre, setMostrarSugerenciasNombre] = useState(false)

  // Las categorías salen de los productos de la tienda: no hay catálogo
  // común, cada negocio organiza los suyos como quiera. Solo los nombres:
  // antes se bajaban todos los productos para sacarlas.
  const [categoriasExistentes, setCategoriasExistentes] = useState<string[]>([])
  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    categoria: '',
    dimensiones: '',
    color: '',
    acabado: '',
    espesorMm: '',
    m2PorCaja: '',
    precioUnitario: '',
    precioBodega: '',
    costo: '',
    stockActual: '0',
    stockMinimo: '0',
    proveedor: '',
    descripcion: '',
    imagenUrl: '',
  })

  // Nombres parecidos, para avisar antes de crear uno repetido: se buscan en
  // el servidor mientras se escribe.
  const { resultados: sugerenciasNombre } = useBusquedaRemota<Producto>(
    '/api/productos/buscar',
    'productos',
    formData.nombre,
    3
  )

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
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (name === 'nombre') setMostrarSugerenciasNombre(value.trim() !== '')
  }

  const seleccionarProductoExistente = (producto: Producto) => {
    setFormData(prev => ({ ...prev, nombre: producto.nombre }))
    setMostrarSugerenciasNombre(false)
  }

  const crearNombreNuevo = () => {
    setMostrarSugerenciasNombre(false)
  }

  const checkSkuExists = async () => {
    if (!formData.sku.trim()) {
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

    // La categoría es un campo de texto con lista, así que el navegador no
    // la exige por su cuenta como hacía el select.
    if (!formData.categoria.trim()) {
      setError('Elige una categoría o escribe una nueva')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await apiFetch('/api/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error creating producto')
      }

      router.push('/admin/productos')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PermissionProtector requiredPermission="productos">
      <div className="card" style={{ maxWidth: 800 }}>
        <h1 className="card-title mb-4" style={{ fontSize: 20 }}>Nuevo Producto</h1>

        {error && <div className="alert-box error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
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

            <div style={{ position: 'relative' }}>
              <label className="field-label">Nombre *</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                required
                className="field-input"
              />

              {mostrarSugerenciasNombre && formData.nombre.trim() !== '' && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--white-off)',
                    border: '1px solid var(--gray-light)',
                    borderRadius: '8px',
                    maxHeight: '200px',
                    overflow: 'auto',
                    zIndex: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    marginTop: '2px',
                  }}
                >
                  {sugerenciasNombre.map(producto => (
                    <div
                      key={producto.id}
                      onClick={() => seleccionarProductoExistente(producto)}
                      style={{ padding: '10px', borderBottom: '1px solid var(--gray-light)', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--beige-light)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ fontWeight: 'bold' }}>{producto.nombre}</div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>SKU: {producto.sku}</div>
                    </div>
                  ))}
                  <div
                    onClick={() => crearNombreNuevo()}
                    style={{
                      padding: '10px',
                      borderTop: sugerenciasNombre.length > 0 ? '1px solid var(--gray-light)' : 'none',
                      cursor: 'pointer',
                      color: 'var(--gold-dark)',
                      backgroundColor: 'var(--beige-light)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--beige-light)')}
                  >
                    <div style={{ fontWeight: 'bold' }}>➕ Nuevo: {formData.nombre}</div>
                    <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Crear producto con este nombre</div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="field-label">Categoría *</label>
              <SelectorCategoria
                value={formData.categoria}
                onChange={(categoria) => setFormData((prev) => ({ ...prev, categoria }))}
                categorias={categoriasExistentes}
              />
              <p className="field-help">Escribe para buscar entre las que ya usas, o crea una nueva.</p>
            </div>

            <div>
              <label className="field-label">Color</label>
              <input type="text" name="color" value={formData.color} onChange={handleChange} className="field-input" />
            </div>

            <div>
              <label className="field-label">Dimensiones</label>
              <input
                type="text"
                name="dimensiones"
                value={formData.dimensiones}
                onChange={handleChange}
                placeholder="ej: 30x30"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Acabado</label>
              <input type="text" name="acabado" value={formData.acabado} onChange={handleChange} className="field-input" />
            </div>

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
              <p className="field-help">Es el que ve el cliente en el catálogo.</p>
            </div>

            <div>
              <label className="field-label">Precio de bodega</label>
              <input
                type="number"
                name="precioBodega"
                value={formData.precioBodega}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                className="field-input"
              />
              <p className="field-help">
                Para las facturas marcadas como bodega. Si lo dejas vacío se cobra el precio al público.
              </p>
            </div>

            <div>
              <label className="field-label">Costo (precio de compra)</label>
              <input
                type="number"
                name="costo"
                value={formData.costo}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                className="field-input"
              />
              <p className="field-help">No se muestra al cliente. Con él se valora el inventario.</p>
            </div>

            <div>
              <label className="field-label">Stock Actual</label>
              <input
                type="number"
                name="stockActual"
                value={formData.stockActual}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Stock Mínimo</label>
              <input
                type="number"
                name="stockMinimo"
                value={formData.stockMinimo}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                className="field-input"
              />
            </div>

            <div>
              <label className="field-label">Proveedor</label>
              <input type="text" name="proveedor" value={formData.proveedor} onChange={handleChange} className="field-input" />
            </div>

            <div>
              <label className="field-label">M² por caja</label>
              <input
                type="number"
                name="m2PorCaja"
                value={formData.m2PorCaja}
                onChange={handleChange}
                onWheel={preventWheelChange}
                step="0.01"
                className="field-input"
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="field-label">Descripción</label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={4}
              className="field-textarea"
            />
          </div>

          <div className="mb-4">
            <ImageUploader
              etiqueta="Imagen del producto"
              valor={formData.imagenUrl}
              onChange={(url) => setFormData((prev) => ({ ...prev, imagenUrl: url }))}
              carpeta="productos"
              ayuda="Es lo que ven tus clientes en el catálogo. Se reduce y optimiza automáticamente."
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading || !!skuError} className="btn-primary">
              {loading ? 'Guardando...' : 'Guardar Producto'}
            </button>
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </PermissionProtector>
  )
}
