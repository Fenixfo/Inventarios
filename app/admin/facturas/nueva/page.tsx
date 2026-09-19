'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Producto {
  id: string
  sku: string
  nombre: string
  precioUnitario: number
}

interface Cliente {
  id: string
  nombre: string
  terminoPago?: string
  limiteCredito: number
}

interface FacturaItem {
  productoId?: string
  productoNombre: string
  cantidadM2: number
  precioUnitario: number
  subtotal: number
  esPersonalizado?: boolean
}

export default function NuevaFacturaPage() {
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteDireccion, setClienteDireccion] = useState('')
  const [cedulaBusqueda, setCedulaBusqueda] = useState('')
  const [sugerenciasClientes, setSugerenciasClientes] = useState<Cliente[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)

  const [terminoPago, setTerminoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
  const [items, setItems] = useState<FacturaItem[]>([])
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0)
  const [impuesto, setImpuesto] = useState(0)
  const [observaciones, setObservaciones] = useState('')

  const [newItemProductoId, setNewItemProductoId] = useState('')
  const [newItemCantidad, setNewItemCantidad] = useState('')
  const [newItemPrecio, setNewItemPrecio] = useState('')
  const [productoSearchText, setProductoSearchText] = useState('')
  const [sugerenciasProductos, setSugerenciasProductos] = useState<Producto[]>([])
  const [mostrarSugerenciasProductos, setMostrarSugerenciasProductos] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productosRes, clientesRes] = await Promise.all([
          fetch('/api/productos'),
          fetch('/api/clientes'),
        ])

        if (!productosRes.ok || !clientesRes.ok) throw new Error('Error fetching data')

        const productosData = await productosRes.json()
        const clientesData = await clientesRes.json()

        setProductos(productosData)
        setClientes(clientesData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleCedulaBusqueda = (valor: string) => {
    setCedulaBusqueda(valor)

    if (valor.trim() === '') {
      setSugerenciasClientes([])
      setMostrarSugerencias(false)
      return
    }

    const sugerencias = clientes.filter(c =>
      c.cedulaCc?.toLowerCase().includes(valor.toLowerCase())
    )

    setSugerenciasClientes(sugerencias)
    setMostrarSugerencias(true)
  }

  const crearClienteNuevo = (cedula: string) => {
    setClienteId('')
    setClienteNombre('')
    setClienteEmail('')
    setClienteTelefono('')
    setClienteDireccion('')
    setCedulaBusqueda(cedula)
    setTerminoPago('')
    setSugerenciasClientes([])
    setMostrarSugerencias(false)
  }

  const seleccionarCliente = (cliente: Cliente) => {
    setClienteId(cliente.id)
    setClienteNombre(cliente.nombre)
    setClienteEmail(cliente.email || '')
    setClienteTelefono(cliente.telefono || '')
    setClienteDireccion(cliente.direccion || '')
    setCedulaBusqueda(cliente.cedulaCc || '')
    setTerminoPago(cliente.terminoPago || '')
    setSugerenciasClientes([])
    setMostrarSugerencias(false)
  }

  const addItem = () => {
    // Si hay un producto seleccionado
    if (newItemProductoId && newItemCantidad) {
      const producto = productos.find(p => p.id === newItemProductoId)
      if (!producto) {
        alert('Producto no encontrado')
        return
      }

      const cantidad = parseFloat(newItemCantidad)
      const subtotal = cantidad * Number(producto.precioUnitario)

      setItems([...items, {
        productoId: producto.id,
        productoNombre: producto.nombre,
        cantidadM2: cantidad,
        precioUnitario: Number(producto.precioUnitario),
        subtotal,
        esPersonalizado: false,
      }])

      setProductoSearchText('')
      setNewItemProductoId('')
      setNewItemCantidad('')
      setNewItemPrecio('')
      return
    }

    // Producto personalizado (sin seleccionar de la lista)
    if (productoSearchText.trim() && newItemCantidad && newItemPrecio) {
      const cantidad = parseFloat(newItemCantidad)
      const precio = parseFloat(newItemPrecio)
      const subtotal = cantidad * precio

      setItems([...items, {
        productoNombre: productoSearchText,
        cantidadM2: cantidad,
        precioUnitario: precio,
        subtotal,
        esPersonalizado: true,
      }])

      setProductoSearchText('')
      setNewItemProductoId('')
      setNewItemCantidad('')
      setNewItemPrecio('')
      return
    }

    alert('Selecciona un producto existente o ingresa nombre, cantidad y precio para producto personalizado')
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleBuscarProducto = (texto: string) => {
    setProductoSearchText(texto)

    if (texto.trim() === '') {
      setSugerenciasProductos([])
      setMostrarSugerenciasProductos(false)
      return
    }

    const textoLower = texto.toLowerCase()
    const sugerencias = productos.filter(p =>
      p.sku.toLowerCase().includes(textoLower) ||
      p.nombre.toLowerCase().includes(textoLower)
    )

    setSugerenciasProductos(sugerencias)
    setMostrarSugerenciasProductos(true)
  }

  const seleccionarProducto = (producto: Producto) => {
    setProductoSeleccionado(producto)
    setNewItemProductoId(producto.id)
    setProductoSearchText(`${producto.sku} - ${producto.nombre}`)
    setSugerenciasProductos([])
    setMostrarSugerenciasProductos(false)
  }

  const preventWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur()
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const descuentoMonto = (subtotal * descuentoPorcentaje) / 100
    const base = subtotal - descuentoMonto
    const impuestoMonto = (base * impuesto) / 100
    const total = base + impuestoMonto

    return { subtotal, descuentoMonto, impuestoMonto, total }
  }

  const { subtotal, descuentoMonto, impuestoMonto, total } = calculateTotals()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      alert('Agrega al menos un producto')
      return
    }

    // Verificar stock disponible
    let advertencia = ''
    items.forEach(item => {
      if (item.productoId) {
        const producto = productos.find(p => p.id === item.productoId)
        if (producto && item.cantidadM2 > producto.stockActual) {
          advertencia += `\n- ${item.productoNombre}: Stock disponible ${producto.stockActual} m², se venderán ${item.cantidadM2} m²`
        }
      }
    })

    if (advertencia && !window.confirm(`⚠️ Hay productos con stock insuficiente:\n${advertencia}\n\n¿Deseas continuar con la factura?`)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      let finalClienteId = clienteId

      // Crear cliente si es nuevo
      if (!finalClienteId && clienteNombre) {
        const resCliente = await fetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: clienteNombre,
            email: clienteEmail,
            telefono: clienteTelefono,
            direccion: clienteDireccion,
            terminoPago,
            limiteCredito: 0,
            cedulaCc: cedulaBusqueda,
          }),
        })

        if (!resCliente.ok) throw new Error('Error creating cliente')
        const clienteData = await resCliente.json()
        finalClienteId = clienteData.id
      }

      // Crear factura
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: finalClienteId || null,
          terminoPago,
          metodoPago,
          subtotal,
          descuentoPorcentaje,
          descuentoMonto,
          impuesto: impuestoMonto,
          total,
          observaciones,
          items,
        }),
      })

      if (!res.ok) throw new Error('Error creating factura')
      router.push('/admin/facturas')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>

  return (
    <div style={{ padding: '20px', maxWidth: '1000px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin/facturas" style={{ color: '#2563eb', textDecoration: 'none' }}>
          ← Volver a Facturas
        </Link>
      </div>

      <h1 style={{ marginBottom: '20px' }}>Nueva Factura</h1>

      {error && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: '#fee', color: '#c00', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Cédula</label>
            <input
              type="text"
              value={cedulaBusqueda}
              onChange={(e) => handleCedulaBusqueda(e.target.value)}
              placeholder="Ingresa cédula del cliente"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />


            {mostrarSugerencias && cedulaBusqueda.trim() !== '' && (
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
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                {sugerenciasClientes.map(cliente => (
                  <div
                    key={cliente.id}
                    onClick={() => seleccionarCliente(cliente)}
                    style={{
                      padding: '10px',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <div style={{ fontWeight: 'bold' }}>{cliente.nombre}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Cédula: {cliente.cedulaCc}</div>
                  </div>
                ))}
                <div
                  onClick={() => crearClienteNuevo(cedulaBusqueda)}
                  style={{
                    padding: '10px',
                    borderTop: sugerenciasClientes.length > 0 ? '1px solid #eee' : 'none',
                    cursor: 'pointer',
                    color: '#2563eb',
                    backgroundColor: '#f9f9f9'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                >
                  <div style={{ fontWeight: 'bold' }}>➕ Nuevo: {cedulaBusqueda}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Crear cliente con esta cédula</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre</label>
            <input
              type="text"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder={clienteId ? "Se rellena automáticamente" : "Ingresa el nombre del cliente"}
              readOnly={!!clienteId}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                boxSizing: 'border-box',
                backgroundColor: clienteId ? '#f5f5f5' : 'white',
                color: '#333',
                cursor: clienteId ? 'not-allowed' : 'text'
              }}
            />
            {(clienteId || clienteNombre) && (
              <button
                type="button"
                onClick={() => {
                  setClienteId('')
                  setClienteNombre('')
                  setClienteEmail('')
                  setClienteTelefono('')
                  setClienteDireccion('')
                  setCedulaBusqueda('')
                  setTerminoPago('')
                }}
                style={{ marginTop: '5px', padding: '4px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {(clienteId || clienteNombre) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email</label>
              <input
                type="email"
                value={clienteEmail}
                onChange={(e) => setClienteEmail(e.target.value)}
                placeholder="Email del cliente"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Teléfono</label>
              <input
                type="text"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                placeholder="Teléfono del cliente"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dirección</label>
              <textarea
                value={clienteDireccion}
                onChange={(e) => setClienteDireccion(e.target.value)}
                placeholder="Dirección del cliente"
                rows={2}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Término de Pago</label>
            <select
              value={terminoPago}
              onChange={(e) => setTerminoPago(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            >
              <option value="">Selecciona</option>
              <option value="contado">Contado</option>
              <option value="mixto">Mixto</option>
              <option value="credito">Crédito</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Método de Pago</label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            >
              <option value="">Selecciona</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
          <h3 style={{ marginTop: 0 }}>Productos</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', marginBottom: '15px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={productoSearchText}
                onChange={(e) => handleBuscarProducto(e.target.value)}
                placeholder="Buscar por SKU o nombre del producto"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />

              {mostrarSugerenciasProductos && sugerenciasProductos.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  maxHeight: '250px',
                  overflow: 'auto',
                  zIndex: 10,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  marginTop: '2px'
                }}>
                  {sugerenciasProductos.map(producto => (
                    <div
                      key={producto.id}
                      onClick={() => seleccionarProducto(producto)}
                      style={{
                        padding: '10px',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <div style={{ fontWeight: 'bold' }}>{producto.nombre}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        SKU: {producto.sku} | Precio: ${Number(producto.precioUnitario).toFixed(2)} | Stock: {producto.stockActual}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <input
              type="number"
              value={newItemCantidad}
              onChange={(e) => setNewItemCantidad(e.target.value)}
              onWheel={preventWheelChange}
              placeholder="m²"
              step="0.01"
              min="0"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />

            {!newItemProductoId && (
              <input
                type="number"
                value={newItemPrecio}
                onChange={(e) => setNewItemPrecio(e.target.value)}
                onWheel={preventWheelChange}
                placeholder="Precio"
                step="0.01"
                min="0"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            )}

            <button
              type="button"
              onClick={addItem}
              style={{ padding: '8px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Agregar
            </button>
          </div>

          {items.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Producto</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Cantidad (m²)</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Precio Unit.</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Subtotal</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{item.productoNombre}{item.esPersonalizado && <span style={{ fontSize: '12px', color: '#999' }}> (personalizado)</span>}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        value={item.cantidadM2}
                        onChange={(e) => {
                          const newCantidad = parseFloat(e.target.value) || 0
                          const newItems = [...items]
                          newItems[i].cantidadM2 = newCantidad
                          newItems[i].subtotal = newCantidad * newItems[i].precioUnitario
                          setItems(newItems)
                        }}
                        onWheel={preventWheelChange}
                        step="0.01"
                        min="0"
                        style={{ width: '100px', padding: '4px', borderRadius: '3px', border: '1px solid #ddd' }}
                      />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        value={item.precioUnitario}
                        onChange={(e) => {
                          const newPrice = parseFloat(e.target.value) || 0
                          const newItems = [...items]
                          newItems[i].precioUnitario = newPrice
                          newItems[i].subtotal = newItems[i].cantidadM2 * newPrice
                          setItems(newItems)
                        }}
                        onWheel={preventWheelChange}
                        step="0.01"
                        min="0"
                        style={{ width: '100px', padding: '4px', borderRadius: '3px', border: '1px solid #ddd' }}
                      />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>${item.subtotal.toFixed(2)}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Descuento (%)</label>
            <input
              type="number"
              value={descuentoPorcentaje}
              onChange={(e) => setDescuentoPorcentaje(parseFloat(e.target.value) || 0)}
              onWheel={preventWheelChange}
              min="0"
              max="100"
              step="0.01"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Impuesto (%)</label>
            <input
              type="number"
              value={impuesto}
              onChange={(e) => setImpuesto(parseFloat(e.target.value) || 0)}
              onWheel={preventWheelChange}
              min="0"
              max="100"
              step="0.01"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ backgroundColor: '#f0f0f0', padding: '15px', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {descuentoMonto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#dc2626' }}>
              <span>Descuento:</span>
              <span>-${descuentoMonto.toFixed(2)}</span>
            </div>
          )}
          {impuestoMonto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#2563eb' }}>
              <span>Impuesto:</span>
              <span>+${impuestoMonto.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '2px solid #ddd', paddingTop: '10px' }}>
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {saving ? 'Guardando...' : 'Guardar Factura'}
          </button>

          <Link href="/admin/facturas" style={{
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            display: 'inline-block'
          }}>
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
