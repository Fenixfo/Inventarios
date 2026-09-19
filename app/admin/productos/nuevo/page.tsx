'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PermissionProtector } from '@/components/PermissionProtector'

interface Producto {
  id: string
  nombre: string
  sku: string
}

export default function NuevoProductoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skuError, setSkuError] = useState<string | null>(null)
  const [productosExistentes, setProductosExistentes] = useState<Producto[]>([])
  const [sugerenciasNombre, setSugerenciasNombre] = useState<Producto[]>([])
  const [mostrarSugerenciasNombre, setMostrarSugerenciasNombre] = useState(false)
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
    costo: '',
    stockActual: '0',
    stockMinimo: '0',
    proveedor: '',
    descripcion: '',
  })

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const res = await fetch('/api/productos')
        const data = await res.json()
        setProductosExistentes(data)
      } catch (err) {
        console.error('Error fetching productos:', err)
      }
    }

    fetchProductos()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    if (name === 'nombre') {
      if (value.trim() === '') {
        setSugerenciasNombre([])
        setMostrarSugerenciasNombre(false)
        return
      }

      const sugerencias = productosExistentes.filter(p =>
        p.nombre.toLowerCase().includes(value.toLowerCase())
      )

      setSugerenciasNombre(sugerencias)
      setMostrarSugerenciasNombre(true)
    }
  }

  const seleccionarProductoExistente = (producto: Producto) => {
    setFormData(prev => ({ ...prev, nombre: producto.nombre }))
    setSugerenciasNombre([])
    setMostrarSugerenciasNombre(false)
  }

  const crearNombreNuevo = () => {
    setSugerenciasNombre([])
    setMostrarSugerenciasNombre(false)
  }

  const checkSkuExists = async () => {
    if (!formData.sku.trim()) {
      setSkuError(null)
      return
    }

    try {
      const res = await fetch(`/api/productos?sku=${encodeURIComponent(formData.sku)}`)
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
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/productos', {
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
      <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h1 style={{ marginBottom: '20px' }}>Nuevo Producto</h1>

      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
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
                border: skuError ? '2px solid #dc2626' : '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
            {skuError && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                {skuError}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre *</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
            />

            {mostrarSugerenciasNombre && formData.nombre.trim() !== '' && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                maxHeight: '200px',
                overflow: 'auto',
                zIndex: 10,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                marginTop: '2px'
              }}>
                {sugerenciasNombre.map(producto => (
                  <div
                    key={producto.id}
                    onClick={() => seleccionarProductoExistente(producto)}
                    style={{
                      padding: '10px',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontWeight: 'bold' }}>{producto.nombre}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>SKU: {producto.sku}</div>
                  </div>
                ))}
                <div
                  onClick={() => crearNombreNuevo()}
                  style={{
                    padding: '10px',
                    borderTop: sugerenciasNombre.length > 0 ? '1px solid #eee' : 'none',
                    cursor: 'pointer',
                    color: '#2563eb',
                    backgroundColor: '#f9f9f9'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                >
                  <div style={{ fontWeight: 'bold' }}>➕ Nuevo: {formData.nombre}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Crear producto con este nombre</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Categoría *</label>
            <select
              name="categoria"
              value={formData.categoria}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="">Selecciona categoría</option>
              <option value="baldosa">Baldosa</option>
              <option value="ceramica">Cerámica</option>
              <option value="porcelanato">Porcelanato</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Color</label>
            <input
              type="text"
              name="color"
              value={formData.color}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dimensiones</label>
            <input
              type="text"
              name="dimensiones"
              value={formData.dimensiones}
              onChange={handleChange}
              placeholder="ej: 30x30"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Acabado</label>
            <input
              type="text"
              name="acabado"
              value={formData.acabado}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Precio Unitario *</label>
            <input
              type="number"
              name="precioUnitario"
              value={formData.precioUnitario}
              onChange={handleChange}
              onWheel={preventWheelChange}
              step="0.01"
              required
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Costo</label>
            <input
              type="number"
              name="costo"
              value={formData.costo}
              onChange={handleChange}
              onWheel={preventWheelChange}
              step="0.01"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Stock Actual</label>
            <input
              type="number"
              name="stockActual"
              value={formData.stockActual}
              onChange={handleChange}
              onWheel={preventWheelChange}
              step="0.01"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Stock Mínimo</label>
            <input
              type="number"
              name="stockMinimo"
              value={formData.stockMinimo}
              onChange={handleChange}
              onWheel={preventWheelChange}
              step="0.01"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Proveedor</label>
            <input
              type="text"
              name="proveedor"
              value={formData.proveedor}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>M² por caja</label>
            <input
              type="number"
              name="m2PorCaja"
              value={formData.m2PorCaja}
              onChange={handleChange}
              onWheel={preventWheelChange}
              step="0.01"
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Descripción</label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            rows={4}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            disabled={loading || !!skuError}
            style={{
              padding: '10px 20px',
              backgroundColor: loading || skuError ? '#999' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || skuError ? 'not-allowed' : 'pointer',
              opacity: loading || skuError ? 0.6 : 1,
            }}
          >
            {loading ? 'Guardando...' : 'Guardar Producto'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ccc',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
      </div>
    </PermissionProtector>
  )
}
