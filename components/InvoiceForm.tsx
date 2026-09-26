'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { precioAplicable } from '@/lib/precios'
import { calcularTotales, montoDePorcentaje, porcentajeDeMonto } from '@/lib/totales-factura'
import { usePermisos } from '@/components/PermisosProvider'
import { SeccionCliente } from '@/components/factura/SeccionCliente'
import { SeccionProductos } from '@/components/factura/SeccionProductos'
import { SeccionResumen } from '@/components/factura/SeccionResumen'
import { DialogoBodega } from '@/components/factura/DialogoBodega'
import {
  CLIENTE_VACIO,
  type ClienteFormulario,
  type LineaFactura,
  type ProductoFactura,
} from '@/components/factura/tipos'

interface Props {
  /**
   * `cotizacion` usa el mismo formulario para cotizar: sin abono inicial,
   * sin aviso de stock (no se vende nada) y guarda en /api/cotizaciones.
   */
  modo?: 'factura' | 'cotizacion'
}

/**
 * Formulario de factura y cotización.
 *
 * Aquí viven el estado, los totales y el envío; cada parte de la pantalla
 * está en components/factura/. Antes era una sola función de ~1.000 líneas.
 */
export default function InvoiceForm({ modo = 'factura' }: Props) {
  const router = useRouter()
  const { puede } = usePermisos()
  const esCotizacion = modo === 'cotizacion'
  // Sin este permiso la factura nace sin abono: el campo ni se muestra, y
  // el servidor rechaza igual si alguien lo manda por fuera de la pantalla.
  // Una cotización nunca lleva abono.
  const puedeAbonar = !esCotizacion && puede('facturas.abonar')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cliente, setCliente] = useState<ClienteFormulario>(CLIENTE_VACIO)
  const [terminoPago, setTerminoPago] = useState('')

  // Venta a bodega: cambia la lista de precios que se aplica.
  const [esBodega, setEsBodega] = useState(false)
  const [preguntaBodega, setPreguntaBodega] = useState<boolean | null>(null)
  const [lineas, setLineas] = useState<LineaFactura[]>([])
  // Los productos ya añadidos, por id: se buscan en el servidor al escribir,
  // y aquí se recuerdan para recalcular precios de bodega y avisar de stock.
  const [productosElegidos, setProductosElegidos] = useState<Map<string, ProductoFactura>>(new Map())

  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0)
  const [descuentoMonto, setDescuentoMonto] = useState(0)
  const [impuestoPorcentaje, setImpuestoPorcentaje] = useState(0)
  const [metodoPago, setMetodoPago] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [abono, setAbono] = useState(0)

  const totales = calcularTotales(lineas, { descuentoPorcentaje, descuentoMonto, impuestoPorcentaje })

  // --- Líneas ---

  const agregarLinea = (linea: LineaFactura, producto?: ProductoFactura) => {
    setLineas([...lineas, linea])
    if (producto) setProductosElegidos((previos) => new Map(previos).set(producto.id, producto))
  }

  const cambiarLinea = (indice: number, cambios: { cantidadM2?: number; precioUnitario?: number }) => {
    setLineas(lineas.map((linea, i) => {
      if (i !== indice) return linea
      const nueva = { ...linea, ...cambios }
      return { ...nueva, subtotal: nueva.cantidadM2 * nueva.precioUnitario }
    }))
  }

  const quitarLinea = (indice: number) => setLineas(lineas.filter((_, i) => i !== indice))

  // --- Lista de precios ---

  const alMarcarBodega = (bodega: boolean) => {
    // Sin productos añadidos no hay nada que recalcular ni que preguntar.
    if (lineas.filter((l) => l.productoId).length === 0) {
      setEsBodega(bodega)
      return
    }
    setPreguntaBodega(bodega)
  }

  /** Cambia la lista de precios y, si el usuario quiere, recalcula lo ya añadido. */
  const cambiarListaPrecios = (bodega: boolean, recalcular: boolean) => {
    setEsBodega(bodega)
    setPreguntaBodega(null)
    if (!recalcular) return

    setLineas(lineas.map((linea) => {
      // Los productos escritos a mano no tienen lista de precios.
      const producto = linea.productoId ? productosElegidos.get(linea.productoId) : undefined
      if (!producto) return linea

      const precio = precioAplicable(producto, bodega)
      return { ...linea, precioUnitario: precio, subtotal: linea.cantidadM2 * precio }
    }))
  }

  // --- Descuento: el porcentaje y el monto se mantienen sincronizados ---

  const cambiarDescuentoPorcentaje = (valor: string) => {
    const porcentaje = Math.round((parseFloat(valor) || 0) * 100) / 100
    setDescuentoPorcentaje(porcentaje)
    setDescuentoMonto(montoDePorcentaje(totales.subtotal, porcentaje))
  }

  const cambiarDescuentoMonto = (valor: string) => {
    const monto = Math.round((parseFloat(valor) || 0) * 100) / 100
    setDescuentoMonto(monto)
    setDescuentoPorcentaje(porcentajeDeMonto(totales.subtotal, monto))
  }

  // --- Guardar ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (lineas.length === 0) {
      alert('Agrega al menos un producto')
      return
    }

    // El aviso de stock solo tiene sentido al vender: cotizar no descuenta
    // nada del inventario.
    let advertencia = ''
    if (!esCotizacion) {
      for (const linea of lineas) {
        const producto = linea.productoId ? productosElegidos.get(linea.productoId) : undefined
        if (producto && linea.cantidadM2 > producto.stockActual) {
          advertencia += `\n- ${linea.productoNombre}: Stock disponible ${producto.stockActual} m², se venderán ${linea.cantidadM2} m²`
        }
      }
    }

    if (advertencia && !window.confirm(`⚠️ Hay productos con stock insuficiente:\n${advertencia}\n\n¿Deseas continuar con la factura?`)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      let clienteId = cliente.id

      // Un cliente escrito a mano se crea al guardar.
      if (!clienteId && cliente.nombre) {
        const resCliente = await apiFetch('/api/clientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: cliente.nombre,
            email: cliente.email,
            telefono: cliente.telefono,
            direccion: cliente.direccion,
            terminoPago,
            limiteCredito: 0,
            cedulaCc: cliente.cedula,
          }),
        })

        const clienteData = await resCliente.json().catch(() => ({}))
        if (!resCliente.ok) throw new Error(clienteData.error || 'No se pudo crear el cliente')
        clienteId = clienteData.id
      }

      const res = await apiFetch(esCotizacion ? '/api/cotizaciones' : '/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId: clienteId || null,
          esBodega,
          terminoPago,
          metodoPago,
          subtotal: totales.subtotal,
          descuentoPorcentaje,
          descuentoMonto: totales.descuento,
          impuesto: totales.impuesto,
          total: totales.total,
          ...(esCotizacion ? {} : { anticipo: abono }),
          observaciones,
          items: lineas,
        }),
      })

      if (!res.ok) {
        const datos = await res.json().catch(() => ({}))
        throw new Error(datos.error || (esCotizacion ? 'Error al guardar la cotización' : 'No se pudo crear la factura'))
      }

      if (esCotizacion) {
        // A la cotización recién guardada, para verla o compartirla.
        const creada = await res.json()
        router.push(`/admin/cotizaciones/${creada.id}`)
      } else {
        router.push('/admin/facturas')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

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

      <SeccionCliente
        cliente={cliente}
        onCliente={setCliente}
        terminoPago={terminoPago}
        onTerminoPago={setTerminoPago}
      />

      <SeccionProductos
        lineas={lineas}
        esBodega={esBodega}
        onMarcarBodega={alMarcarBodega}
        onAgregar={agregarLinea}
        onCambiarLinea={cambiarLinea}
        onQuitar={quitarLinea}
      />

      <SeccionResumen
        totales={totales}
        descuentoPorcentaje={descuentoPorcentaje}
        descuentoMonto={descuentoMonto}
        onDescuentoPorcentaje={cambiarDescuentoPorcentaje}
        onDescuentoMonto={cambiarDescuentoMonto}
        impuestoPorcentaje={impuestoPorcentaje}
        onImpuestoPorcentaje={setImpuestoPorcentaje}
        puedeAbonar={puedeAbonar}
        abono={abono}
        onAbono={setAbono}
        metodoPago={metodoPago}
        onMetodoPago={setMetodoPago}
        observaciones={observaciones}
        onObservaciones={setObservaciones}
      />

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="submit"
          disabled={saving || lineas.length === 0}
          style={{
            padding: '12px 24px',
            backgroundColor: saving || lineas.length === 0 ? '#999' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving || lineas.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          {esCotizacion
            ? saving ? 'Guardando cotización...' : 'Guardar Cotización'
            : saving ? 'Creando factura...' : 'Crear Factura'}
        </button>
      </div>

      {preguntaBodega !== null && (
        <DialogoBodega
          aBodega={preguntaBodega}
          lineas={lineas}
          productos={productosElegidos}
          onCancelar={() => setPreguntaBodega(null)}
          onElegir={(recalcular) => cambiarListaPrecios(preguntaBodega, recalcular)}
        />
      )}
    </form>
  )
}
