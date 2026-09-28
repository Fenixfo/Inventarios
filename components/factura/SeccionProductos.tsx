'use client'

import { useState } from 'react'
import { pesos } from '@/lib/formato'
import { precioAplicable, tienePrecioBodega } from '@/lib/precios'
import { useBusquedaRemota } from '@/lib/use-busqueda-remota'
import {
  estiloCampo,
  estiloEtiqueta,
  estiloSeccion,
  estiloSugerencias,
  sinRueda,
  type LineaFactura,
  type ProductoFactura,
} from './tipos'

interface Props {
  lineas: LineaFactura[]
  esBodega: boolean
  onMarcarBodega: (bodega: boolean) => void
  /** Una línea nueva; con `producto` si salió del catálogo. */
  onAgregar: (linea: LineaFactura, producto?: ProductoFactura) => void
  onCambiarLinea: (indice: number, cambios: { cantidadM2?: number; precioUnitario?: number }) => void
  onQuitar: (indice: number) => void
}

/**
 * Productos de la factura: lista de precios (público o bodega), búsqueda en
 * el catálogo y tabla de líneas. También admite productos escritos a mano.
 */
export function SeccionProductos({ lineas, esBodega, onMarcarBodega, onAgregar, onCambiarLinea, onQuitar }: Props) {
  const [texto, setTexto] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [seleccionado, setSeleccionado] = useState<ProductoFactura | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [precioManual, setPrecioManual] = useState('')

  const { resultados: sugerencias } = useBusquedaRemota<ProductoFactura>('/api/productos/buscar', 'productos', texto, 1)

  const precioDe = (producto: ProductoFactura) => precioAplicable(producto, esBodega)

  const buscar = (valor: string) => {
    setTexto(valor)
    setMostrarSugerencias(valor.trim() !== '')
  }

  const elegir = (producto: ProductoFactura) => {
    setSeleccionado(producto)
    setTexto(`${producto.sku} - ${producto.nombre}`)
    setMostrarSugerencias(false)
  }

  const elegirPersonalizado = (nombre: string) => {
    setSeleccionado(null)
    setTexto(nombre)
    setMostrarSugerencias(false)
  }

  const limpiar = () => {
    setTexto('')
    setCantidad('')
    setPrecioManual('')
    setSeleccionado(null)
  }

  const agregar = () => {
    if (seleccionado && cantidad) {
      const cantidadM2 = parseFloat(cantidad)
      const precio = precioDe(seleccionado)

      onAgregar(
        {
          clave: crypto.randomUUID(),
          productoId: seleccionado.id,
          productoNombre: seleccionado.nombre,
          cantidadM2,
          precioUnitario: precio,
          subtotal: cantidadM2 * precio,
          esPersonalizado: false,
        },
        seleccionado
      )
      limpiar()
      return
    }

    if (texto.trim() && cantidad && precioManual) {
      const cantidadM2 = parseFloat(cantidad)
      const precio = parseFloat(precioManual)

      onAgregar({
        clave: crypto.randomUUID(),
        productoNombre: texto,
        cantidadM2,
        precioUnitario: precio,
        subtotal: cantidadM2 * precio,
        esPersonalizado: true,
      })
      limpiar()
      return
    }

    alert('Selecciona un producto existente o ingresa nombre, cantidad y precio para producto personalizado')
  }

  return (
    <div style={estiloSeccion}>
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
            border: `1px solid ${esBodega ? 'var(--gold)' : 'var(--gray-light)'}`,
            backgroundColor: esBodega ? 'var(--status-amber-bg)' : 'var(--white-off)',
          }}
        >
          <input
            type="checkbox"
            checked={esBodega}
            onChange={(e) => onMarcarBodega(e.target.checked)}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          />
          🏭 Precio de bodega / mayorista
        </label>
      </div>

      {esBodega && (
        <div className="alert-box" style={{ marginBottom: '15px', fontSize: '13px' }}>
          Esta factura usa los precios de bodega. Los productos que no tengan uno definido
          se cobran al precio del público.
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: '15px' }}>
        <label style={estiloEtiqueta}>Buscar Producto</label>
        <input
          type="text"
          value={texto}
          onChange={(e) => buscar(e.target.value)}
          placeholder="SKU o nombre del producto"
          style={estiloCampo}
        />

        {mostrarSugerencias && texto.trim() !== '' && (
          <div style={estiloSugerencias}>
            {sugerencias.map((producto) => (
              <div
                key={producto.id}
                onClick={() => elegir(producto)}
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--gray-light)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--beige-light)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ fontWeight: 'bold' }}>{producto.nombre}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>
                  SKU: {producto.sku} | Stock: {producto.stockActual}m² |{' '}
                  {pesos(precioDe(producto))}
                  {esBodega && !tienePrecioBodega(producto) && ' (sin precio de bodega)'}
                </div>
              </div>
            ))}
            <div
              onClick={() => elegirPersonalizado(texto)}
              style={{
                padding: '10px',
                borderBottom: '1px solid var(--gray-light)',
                cursor: 'pointer',
                backgroundColor: 'var(--beige-light)',
                color: 'var(--gold-dark)',
                fontWeight: 'bold'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--beige-light)'}
            >
              + Nuevo: {texto}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', marginBottom: '15px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Cantidad (m²)</label>
          <input
            type="number"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            onWheel={sinRueda}
            step="0.01"
            min="0"
            style={estiloCampo}
          />
        </div>
        {!seleccionado && (
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Precio</label>
            <input
              type="number"
              value={precioManual}
              onChange={(e) => setPrecioManual(e.target.value)}
              onWheel={sinRueda}
              step="0.01"
              min="0"
              placeholder="Precio"
              style={estiloCampo}
            />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" onClick={agregar} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Agregar
          </button>
        </div>
      </div>

      {lineas.length > 0 && (
        <table className="table-luxe" style={{ marginBottom: '15px' }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th style={{ textAlign: 'right' }}>Cant. (m²)</th>
              <th style={{ textAlign: 'right' }}>Precio Unit.</th>
              <th style={{ textAlign: 'right' }}>Subtotal</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea, indice) => (
              <tr key={linea.clave}>
                <td style={{ fontSize: '12px' }}>{linea.productoNombre}</td>
                <td style={{ textAlign: 'right' }}>
                  <input
                    type="number"
                    value={linea.cantidadM2}
                    onChange={(e) => onCambiarLinea(indice, { cantidadM2: parseFloat(e.target.value) || 0 })}
                    onWheel={sinRueda}
                    step="0.01"
                    min="0"
                    style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--gray-light)', textAlign: 'right' }}
                  />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <input
                    type="number"
                    value={linea.precioUnitario}
                    onChange={(e) => onCambiarLinea(indice, { precioUnitario: parseFloat(e.target.value) || 0 })}
                    onWheel={sinRueda}
                    step="0.01"
                    min="0"
                    style={{ width: '70px', padding: '4px', borderRadius: '4px', border: '1px solid var(--gray-light)', textAlign: 'right' }}
                  />
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontFamily: 'monospace' }}>{pesos(linea.subtotal)}</td>
                <td style={{ textAlign: 'center' }}>
                  <button type="button" onClick={() => onQuitar(indice)} className="btn-action danger">
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
