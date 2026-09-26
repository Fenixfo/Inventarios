'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { apiFetch } from '@/lib/api-client'
import { precioAplicable, tienePrecioBodega } from '@/lib/precios'
import { usePermisos } from '@/components/PermisosProvider'

interface Producto {
  id: string
  sku: string
  nombre: string
  precioUnitario: number
  precioBodega?: number | null
  stockActual: number
}

interface Cliente {
  id: string
  nombre: string
  cedulaCc?: string
  email?: string
  telefono?: string
  direccion?: string
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

interface Props {
  /**
   * `cotizacion` usa el mismo formulario para cotizar: sin abono inicial,
   * sin aviso de stock (no se vende nada) y guarda en /api/cotizaciones.
   */
  modo?: 'factura' | 'cotizacion'
}

export default function InvoiceForm({ modo = 'factura' }: Props) {
  const router = useRouter()
  const { puede } = usePermisos()
  const esCotizacion = modo === 'cotizacion'
  // Sin este permiso la factura nace sin abono: el campo ni se muestra, y
  // el servidor rechaza igual si alguien lo manda por fuera de la pantalla.
  // Una cotización nunca lleva abono.
  const puedeAbonar = !esCotizacion && puede('facturas.abonar')
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)

  // Cliente
  const [clienteId, setClienteId] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteDireccion, setClienteDireccion] = useState('')
  const [cedulaBusqueda, setCedulaBusqueda] = useState('')
  const [sugerenciasClientes, setSugerenciasClientes] = useState<Cliente[]>([])
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)

  // Factura
  // Venta a bodega: cambia la lista de precios que se aplica.
  const [esBodega, setEsBodega] = useState(false)
  const [preguntaBodega, setPreguntaBodega] = useState<boolean | null>(null)
  const [terminoPago, setTerminoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
  const [items, setItems] = useState<FacturaItem[]>([])
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0)
  const [descuentoMonto, setDescuentoMontoState] = useState(0)
  const [impuesto, setImpuesto] = useState(0)
  const [observaciones, setObservaciones] = useState('')
  const [abono, setAbono] = useState(0)

  // Nuevo item
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
        // Obtener usuario actual
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          setUsuarioId(session.user.id)
        }

        const [productosRes, clientesRes] = await Promise.all([
          apiFetch('/api/productos'),
          apiFetch('/api/clientes'),
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

  const seleccionarProductoPersonalizado = (nombre: string) => {
    setProductoSeleccionado(null)
    setNewItemProductoId('')
    setProductoSearchText(nombre)
    setSugerenciasProductos([])
    setMostrarSugerenciasProductos(false)
  }

  /** Precio que corresponde al producto según la lista activa. */
  const precioDe = (producto: Producto, bodega = esBodega): number =>
    precioAplicable(producto, bodega)

  /** Cambia la lista de precios y, si el usuario quiere, recalcula lo ya añadido. */
  const cambiarListaPrecios = (bodega: boolean, recalcular: boolean) => {
    setEsBodega(bodega)
    setPreguntaBodega(null)

    if (!recalcular) return

    setItems(items.map((item) => {
      // Los productos escritos a mano no tienen lista de precios.
      if (!item.productoId) return item

      const producto = productos.find((p) => p.id === item.productoId)
      if (!producto) return item

      const precio = precioDe(producto, bodega)
      return { ...item, precioUnitario: precio, subtotal: item.cantidadM2 * precio }
    }))
  }

  const alMarcarBodega = (bodega: boolean) => {
    // Sin productos añadidos no hay nada que recalcular ni que preguntar.
    if (items.filter((i) => i.productoId).length === 0) {
      setEsBodega(bodega)
      return
    }
    setPreguntaBodega(bodega)
  }

  const addItem = () => {
    if (newItemProductoId && newItemCantidad) {
      const producto = productos.find(p => p.id === newItemProductoId)
      if (!producto) {
        alert('Producto no encontrado')
        return
      }

      const cantidad = parseFloat(newItemCantidad)
      const precio = precioDe(producto)
      const subtotal = cantidad * precio

      setItems([...items, {
        productoId: producto.id,
        productoNombre: producto.nombre,
        cantidadM2: cantidad,
        precioUnitario: precio,
        subtotal,
        esPersonalizado: false,
      }])

      setProductoSearchText('')
      setNewItemProductoId('')
      setNewItemCantidad('')
      setNewItemPrecio('')
      setProductoSeleccionado(null)
      return
    }

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
      setProductoSeleccionado(null)
      return
    }

    alert('Selecciona un producto existente o ingresa nombre, cantidad y precio para producto personalizado')
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItemQuantity = (index: number, newQuantity: string) => {
    const cantidad = parseFloat(newQuantity) || 0
    const item = items[index]
    const newItems = [...items]
    newItems[index] = {
      ...item,
      cantidadM2: cantidad,
      subtotal: cantidad * item.precioUnitario,
    }
    setItems(newItems)
  }

  const updateItemPrice = (index: number, newPrice: string) => {
    const precio = parseFloat(newPrice) || 0
    const item = items[index]
    const newItems = [...items]
    newItems[index] = {
      ...item,
      precioUnitario: precio,
      subtotal: item.cantidadM2 * precio,
    }
    setItems(newItems)
  }

  const preventWheelChange = (e: React.WheelEvent<HTMLInputElement>) => {
    e.currentTarget.blur()
  }

  const formatearDinero = (valor: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor)
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)

    // Usar descuentoMonto si es > 0, de lo contrario calcular desde porcentaje
    let finalDescuentoMonto = descuentoMonto > 0 ? descuentoMonto : (subtotal * descuentoPorcentaje) / 100

    const base = subtotal - finalDescuentoMonto
    const impuestoMonto = (base * impuesto) / 100
    const total = base + impuestoMonto

    return { subtotal, finalDescuentoMonto, impuestoMonto, total }
  }

  const handleDescuentoPorcentajeChange = (value: string) => {
    let porcentaje = parseFloat(value) || 0
    // Redondear a 2 decimales
    porcentaje = Math.round(porcentaje * 100) / 100
    setDescuentoPorcentaje(porcentaje)

    // Calcular monto basado en porcentaje
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    let monto = (subtotal * porcentaje) / 100
    // Redondear a 2 decimales
    monto = Math.round(monto * 100) / 100
    setDescuentoMontoState(monto)
  }

  const handleDescuentoMontoChange = (value: string) => {
    let monto = parseFloat(value) || 0
    // Redondear a 2 decimales
    monto = Math.round(monto * 100) / 100
    setDescuentoMontoState(monto)

    // Calcular porcentaje basado en monto
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    let porcentaje = subtotal > 0 ? (monto / subtotal) * 100 : 0
    // Redondear a 2 decimales
    porcentaje = Math.round(porcentaje * 100) / 100
    setDescuentoPorcentaje(porcentaje)
  }

  const { subtotal, finalDescuentoMonto, impuestoMonto, total } = calculateTotals()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      alert('Agrega al menos un producto')
      return
    }

    // El aviso de stock solo tiene sentido al vender: cotizar no descuenta
    // nada del inventario.
    let advertencia = ''
    if (!esCotizacion) items.forEach(item => {
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

      if (!finalClienteId && clienteNombre) {
        const resCliente = await apiFetch('/api/clientes', {
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

      const res = await apiFetch(esCotizacion ? '/api/cotizaciones' : '/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId,
          clienteId: finalClienteId || null,
          esBodega,
          terminoPago,
          metodoPago,
          subtotal,
          descuentoPorcentaje,
          descuentoMonto: finalDescuentoMonto,
          impuesto: impuestoMonto,
          total,
          ...(esCotizacion ? {} : { anticipo: abono }),
          observaciones,
          items,
        }),
      })

      if (!res.ok) {
        const datos = await res.json().catch(() => ({}))
        throw new Error(datos.error || (esCotizacion ? 'Error al guardar la cotización' : 'Error creating factura'))
      }

      if (esCotizacion) {
        // A la cotización recién guardada, para verla o compartirla.
        const creada = await res.json()
        router.push(`/admin/cotizaciones/${creada.id}`)
      } else {
        router.push('/admin/facturas')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
      {error && (
        <div style={{
          padding: '15px',
          backgroundColor: '#fee',
          color: '#c33',
          borderRadius: '4px',
        }}>
          {error}
        </div>
      )}

      {/* Cliente */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '4px' }}>
        <h3 style={{ marginBottom: '15px' }}>Cliente</h3>
        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Cédula/CC</label>
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
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              marginTop: '2px'
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre</label>
            <input
              type="text"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              readOnly={!!clienteId}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                boxSizing: 'border-box',
                backgroundColor: clienteId ? '#f5f5f5' : 'white',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Email</label>
            <input
              type="email"
              value={clienteEmail}
              onChange={(e) => setClienteEmail(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Teléfono</label>
            <input
              type="text"
              value={clienteTelefono}
              onChange={(e) => setClienteTelefono(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
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
        </div>

        <div style={{ marginTop: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Dirección</label>
          <textarea
            value={clienteDireccion}
            onChange={(e) => setClienteDireccion(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Productos */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>Productos</h3>

          <label
            title="Aplica la lista de precios de bodega a esta factura"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              padding: '8px 14px',
              borderRadius: '6px',
              border: `1px solid ${esBodega ? '#f59e0b' : '#d1d5db'}`,
              backgroundColor: esBodega ? '#fef3c7' : 'white',
            }}
          >
            <input
              type="checkbox"
              checked={esBodega}
              onChange={(e) => alMarcarBodega(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            🏭 Precio de bodega / mayorista
          </label>
        </div>

        {esBodega && (
          <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '10px 12px', marginBottom: '15px', fontSize: '13px' }}>
            Esta factura usa los precios de bodega. Los productos que no tengan uno definido
            se cobran al precio del público.
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Buscar Producto</label>
          <input
            type="text"
            value={productoSearchText}
            onChange={(e) => handleBuscarProducto(e.target.value)}
            placeholder="SKU o nombre del producto"
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
          />

          {mostrarSugerenciasProductos && productoSearchText.trim() !== '' && (
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
                    SKU: {producto.sku} | Stock: {producto.stockActual}m² |{' '}
                    {formatearDinero(precioDe(producto))}
                    {esBodega && !tienePrecioBodega(producto) && ' (sin precio de bodega)'}
                  </div>
                </div>
              ))}
              {productoSearchText.trim() !== '' && (
                <div
                  onClick={() => seleccionarProductoPersonalizado(productoSearchText)}
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    backgroundColor: '#f9f9f9',
                    color: '#2563eb',
                    fontWeight: 'bold'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e3f2fd'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                >
                  + Nuevo: {productoSearchText}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Cantidad (m²)</label>
            <input
              type="number"
              value={newItemCantidad}
              onChange={(e) => setNewItemCantidad(e.target.value)}
              onWheel={preventWheelChange}
              step="0.01"
              min="0"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
          {!productoSeleccionado && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Precio</label>
              <input
                type="number"
                value={newItemPrecio}
                onChange={(e) => setNewItemPrecio(e.target.value)}
                onWheel={preventWheelChange}
                step="0.01"
                min="0"
                placeholder="Precio"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={addItem}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Agregar
            </button>
          </div>
        </div>

        {/* Tabla de items */}
        {items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Producto</th>
                <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Cant. (m²)</th>
                <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Precio Unit.</th>
                <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Subtotal</th>
                <th style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px', fontSize: '12px' }}>{item.productoNombre}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <input
                      type="number"
                      value={item.cantidadM2}
                      onChange={(e) => updateItemQuantity(index, e.target.value)}
                      onWheel={preventWheelChange}
                      step="0.01"
                      min="0"
                      style={{ width: '60px', padding: '4px', borderRadius: '3px', border: '1px solid #ddd', textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <input
                      type="number"
                      value={item.precioUnitario}
                      onChange={(e) => updateItemPrice(index, e.target.value)}
                      onWheel={preventWheelChange}
                      step="0.01"
                      min="0"
                      style={{ width: '70px', padding: '4px', borderRadius: '3px', border: '1px solid #ddd', textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>{formatearDinero(item.subtotal)}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Totales */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '4px' }}>
        <h3 style={{ marginBottom: '15px' }}>Resumen</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Descuento (%)</label>
            <input
              type="number"
              value={descuentoPorcentaje || ''}
              onChange={(e) => handleDescuentoPorcentajeChange(e.target.value)}
              onWheel={preventWheelChange}
              step="0.01"
              min="0"
              max="100"
              placeholder="0.00"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Descuento ($)</label>
            <input
              type="number"
              value={descuentoMonto || ''}
              onChange={(e) => handleDescuentoMontoChange(e.target.value)}
              onWheel={preventWheelChange}
              step="0.01"
              min="0"
              placeholder="0.00"
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
              step="0.01"
              min="0"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', fontFamily: 'monospace' }}>
            <span>Subtotal:</span>
            <span>{formatearDinero(subtotal)}</span>
          </div>
          {finalDescuentoMonto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', color: '#dc2626', fontFamily: 'monospace' }}>
              <span>Descuento ({descuentoPorcentaje.toFixed(2)}%):</span>
              <span>-{formatearDinero(finalDescuentoMonto)}</span>
            </div>
          )}
          {impuestoMonto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', color: '#2563eb', fontFamily: 'monospace' }}>
              <span>Impuesto ({impuesto.toFixed(2)}%):</span>
              <span>+{formatearDinero(impuestoMonto)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '2px solid #ddd', paddingTop: '10px', color: '#2563eb', fontFamily: 'monospace', marginBottom: '15px' }}>
            <span>TOTAL:</span>
            <span>{formatearDinero(total)}</span>
          </div>

          {puedeAbonar && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Abono Inicial ($)</label>
              <input
                type="number"
                value={abono || ''}
                onChange={(e) => {
                  let valor = parseFloat(e.target.value) || 0
                  const montoMaximo = total + 10000
                  if (valor > montoMaximo) {
                    valor = montoMaximo
                  }
                  setAbono(valor)
                }}
                onWheel={preventWheelChange}
                step="100"
                min="0"
                max={total + 10000}
                placeholder="0.00"
                title={`Máximo permitido: ${formatearDinero(total + 10000)}`}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
              {abono > 0 && (
                <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
                  <div>Abono: {formatearDinero(abono)}</div>
                  <div style={{ color: abono > total ? '#dc2626' : '#10b981', fontWeight: 'bold' }}>
                    Saldo pendiente: {formatearDinero(Math.max(0, total - abono))}
                  </div>
                  {abono > total && (
                    <div style={{ color: '#f59e0b', marginTop: '5px', fontSize: '11px' }}>
                      ⚠️ Pagando ${((abono - total) / 1000).toFixed(1)}k de más
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Método de Pago</label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box', marginBottom: '15px' }}
          >
            <option value="">Selecciona método</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="cheque">Cheque</option>
          </select>
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
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="submit"
          disabled={saving || items.length === 0}
          style={{
            padding: '12px 24px',
            backgroundColor: saving || items.length === 0 ? '#999' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving || items.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {esCotizacion
            ? saving ? 'Guardando cotización...' : 'Guardar Cotización'
            : saving ? 'Creando factura...' : 'Crear Factura'}
        </button>
      </div>

      {/* Qué hacer con los productos ya añadidos al cambiar de lista */}
      {preguntaBodega !== null && (
        <div
          onClick={() => setPreguntaBodega(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '520px', width: '100%', padding: '24px' }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '18px' }}>
              {preguntaBodega ? 'Cambiar a precio de bodega' : 'Volver al precio del público'}
            </h3>

            <p style={{ fontSize: '14px', color: '#4b5563', marginTop: 0, marginBottom: '18px' }}>
              Ya tienes {items.filter((i) => i.productoId).length} producto
              {items.filter((i) => i.productoId).length !== 1 ? 's' : ''} en la factura.
              ¿Actualizo sus precios a los de{' '}
              {preguntaBodega ? 'bodega' : 'público'}, o los dejo como están?
            </p>

            {/* Vista previa del cambio, para no decidir a ciegas. */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', marginBottom: '18px', maxHeight: '220px', overflowY: 'auto', fontSize: '13px' }}>
              {items.filter((i) => i.productoId).map((item, i) => {
                const producto = productos.find((p) => p.id === item.productoId)
                const nuevo = producto ? precioDe(producto, preguntaBodega) : item.precioUnitario

                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ color: '#4b5563' }}>{item.productoNombre}</span>
                    <span style={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                      {formatearDinero(item.precioUnitario)}
                      {nuevo !== item.precioUnitario && (
                        <>
                          {' → '}
                          <strong style={{ color: nuevo < item.precioUnitario ? '#059669' : '#dc2626' }}>
                            {formatearDinero(nuevo)}
                          </strong>
                        </>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>

            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 0, marginBottom: '18px' }}>
              Si habías ajustado algún precio a mano, actualizar lo sobrescribe.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setPreguntaBodega(null)}
                style={{ padding: '11px 16px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => cambiarListaPrecios(preguntaBodega, false)}
                style={{ flex: 1, padding: '11px 16px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
              >
                Mantener los actuales
              </button>
              <button
                type="button"
                onClick={() => cambiarListaPrecios(preguntaBodega, true)}
                style={{ flex: 1, padding: '11px 16px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                Actualizar precios
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
