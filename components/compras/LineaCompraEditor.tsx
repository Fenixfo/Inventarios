'use client'

import { useState } from 'react'
import { ImageUploader } from '@/components/ImageUploader'
import { SelectorCategoria } from '@/components/Common/SelectorCategoria'
import { pesos } from '@/lib/formato'
import type { Parecido } from '@/lib/compras-clasificar'
import { cambiosDeLinea, type CalculoLinea, type LineaEditable } from '@/lib/compras-cliente'

interface Props {
  indice: number
  linea: LineaEditable
  calculo: CalculoLinea
  /** Por qué la línea no se puede guardar, para mostrarlo. */
  problema: string | null
  categorias: string[]
  puedeCrearProductos: boolean
  onCambiar: (parche: Partial<LineaEditable>) => void
  onVerificar: () => void
  onEscogerParecido: (parecido: Parecido) => void
  onCrearNuevo: () => void
  onSubidaImagen: (url: string) => void
  onQuitar?: () => void
}

const etiqueta = {
  existente: { texto: 'Existente', fondo: 'var(--status-green-bg)', color: 'var(--status-green-text)' },
  nuevo: { texto: 'Se creará', fondo: 'var(--beige-light)', color: 'var(--gold-dark)' },
  parecidos: { texto: 'Revisar', fondo: 'var(--status-amber-bg)', color: 'var(--status-amber-text)' },
  verificando: { texto: 'Verificando…', fondo: 'var(--beige-light)', color: 'var(--gray-secondary)' },
  sin_verificar: { texto: 'Sin verificar', fondo: 'var(--beige-light)', color: 'var(--gray-secondary)' },
} as const

/** Un número que no cambia al girar la rueda del ratón mientras se está escribiendo. */
const sinRueda = (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur()

/**
 * Una línea de la compra. Se muestra como tarjeta para que se pueda usar en el
 * teléfono sin desplazamiento horizontal.
 */
export function LineaCompraEditor({
  indice,
  linea: l,
  calculo,
  problema,
  categorias,
  puedeCrearProductos,
  onCambiar,
  onVerificar,
  onEscogerParecido,
  onCrearNuevo,
  onSubidaImagen,
  onQuitar,
}: Props) {
  const id = `linea-${l.clave}`
  // Lo opcional empieza plegado: en el celular cada línea ocupaba demasiado.
  const [abierto, setAbierto] = useState(false)
  const marca = etiqueta[l.estado]
  const esExistente = l.estado === 'existente' && l.producto
  const producto = l.producto
  const cambios = esExistente ? cambiosDeLinea(l) : { completar: {}, diferencias: [] }
  const diferenciaDe = (campo: string) => cambios.diferencias.find((d) => d.campo === campo)

  const campoTexto = (campo: 'dimensiones' | 'color' | 'acabado', rotulo: string, ejemplo?: string) => {
    const dif = esExistente ? diferenciaDe(campo) : undefined
    const actual = esExistente ? (producto![campo] ?? '') : ''
    return (
      <div>
        <label htmlFor={`${id}-${campo}`} className="field-label">{rotulo}</label>
        <input
          id={`${id}-${campo}`}
          type="text"
          value={l[campo]}
          onChange={(e) => onCambiar({ [campo]: e.target.value })}
          placeholder={esExistente ? (actual ? `Tiene: ${actual}` : '') : ejemplo}
          className="field-input"
        />
        {dif && (
          <p className="field-help" style={{ color: 'var(--status-amber-text)' }}>
            El producto ya tiene «{String(dif.actual)}»; no se cambiará.
          </p>
        )}
      </div>
    )
  }

  const campoNumero = (campo: 'espesorMm' | 'm2PorCaja' | 'precioBodega', rotulo: string) => {
    const dif = esExistente ? diferenciaDe(campo) : undefined
    const actual = esExistente ? producto![campo] : null
    return (
      <div>
        <label htmlFor={`${id}-${campo}`} className="field-label">{rotulo}</label>
        <input
          id={`${id}-${campo}`}
          type="number"
          step="0.01"
          min="0"
          value={l[campo]}
          onChange={(e) => onCambiar({ [campo]: e.target.value })}
          onWheel={sinRueda}
          placeholder={esExistente && actual ? `Tiene: ${actual}` : ''}
          className="field-input"
        />
        {dif && (
          <p className="field-help" style={{ color: 'var(--status-amber-text)' }}>
            El producto ya tiene {String(dif.actual)}; no se cambiará.
          </p>
        )}
      </div>
    )
  }

  const pideDatosDeProducto = !esExistente // sin verificar, nuevo o con parecidos

  // Con la sección cerrada se resume lo que hay dentro, para que nada quede
  // escondido sin aviso: cuántos datos se escribieron y si alguno difiere del producto.
  const opcionales = [l.dimensiones, l.color, l.acabado, l.espesorMm, l.m2PorCaja, l.precioBodega, l.descripcion, l.imagenUrl]
  if (pideDatosDeProducto) opcionales.push(l.stockMinimo)
  const completados = opcionales.filter((v) => v.trim() !== '').length
  const nDiferencias = cambios.diferencias.length

  return (
    <div
      style={{
        border: `1px solid ${problema ? 'var(--gold)' : 'var(--gray-light)'}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        backgroundColor: 'var(--white-off)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong>Línea {indice + 1}</strong>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 999,
            backgroundColor: marca.fondo,
            color: marca.color,
            fontWeight: 'bold',
          }}
        >
          {marca.texto}
        </span>
        {esExistente && producto && (
          <span style={{ fontSize: 13 }}>
            {producto.nombre} <span style={{ color: 'var(--gray-secondary)' }}>· {producto.categoria}</span>
          </span>
        )}
        {onQuitar && (
          <button type="button" onClick={onQuitar} className="btn-action danger" style={{ marginLeft: 'auto' }}>
            Quitar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        <div>
          <label htmlFor={`${id}-sku`} className="field-label">SKU *</label>
          <input
            id={`${id}-sku`}
            type="text"
            value={l.sku}
            onChange={(e) => onCambiar({ sku: e.target.value })}
            onBlur={onVerificar}
            maxLength={100}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor={`${id}-cantidad`} className="field-label">Cantidad *</label>
          <input
            id={`${id}-cantidad`}
            type="number"
            step="0.01"
            min="0"
            value={l.cantidad}
            onChange={(e) => onCambiar({ cantidad: e.target.value })}
            onWheel={sinRueda}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor={`${id}-precio`} className="field-label">Precio de factura (por unidad) *</label>
          <input
            id={`${id}-precio`}
            type="number"
            step="0.01"
            min="0"
            value={l.precioFactura}
            onChange={(e) => onCambiar({ precioFactura: e.target.value })}
            onWheel={sinRueda}
            className="field-input"
          />
        </div>
      </div>

      {/* El producto existe: se muestra lo que tiene y se pueden completar sus datos vacíos. */}
      {esExistente && producto && (
        <p style={{ fontSize: 12, color: 'var(--gray-secondary)', margin: '0 0 10px 0' }}>
          Stock actual {producto.stockActual} · Costo actual {producto.costo === null ? '—' : pesos(producto.costo)} · Precio de venta {pesos(producto.precioUnitario)}.
          Solo se completan los datos que el producto tiene vacíos; lo que ya tiene no se cambia.
        </p>
      )}

      {/* El SKU es nuevo pero el nombre se parece al de otro producto. */}
      {l.estado === 'parecidos' && (
        <div
          style={{
            border: '1px solid var(--status-amber-text)',
            backgroundColor: 'var(--status-amber-bg)',
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: 13 }}>
            Ese nombre se parece al de productos que ya tienes. ¿Es alguno de ellos?
          </p>
          {l.parecidos.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 13 }}>
                {p.nombre} <span style={{ color: 'var(--gray-secondary)' }}>· SKU {p.sku}</span>
              </span>
              <button type="button" onClick={() => onEscogerParecido(p)} className="btn-action" style={{ marginLeft: 'auto' }}>
                Es este producto
              </button>
            </div>
          ))}
          <button type="button" onClick={onCrearNuevo} className="btn-secondary" style={{ marginTop: 4 }}>
            No, crear uno nuevo
          </button>
        </div>
      )}

      {pideDatosDeProducto && !puedeCrearProductos && l.estado === 'nuevo' && (
        <p className="alert-box error" style={{ fontSize: 13 }}>
          Este SKU no existe y crear productos nuevos exige el permiso de crear productos, que no tienes.
        </p>
      )}

      {/* Datos del producto nuevo (o a medio escribir). */}
      {pideDatosDeProducto && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-nombre`} className="field-label">Nombre del producto *</label>
            <input
              id={`${id}-nombre`}
              type="text"
              value={l.nombre}
              onChange={(e) => onCambiar({ nombre: e.target.value })}
              onBlur={onVerificar}
              maxLength={255}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Categoría *</label>
            <SelectorCategoria value={l.categoria} onChange={(categoria) => onCambiar({ categoria })} categorias={categorias} />
          </div>
          <div>
            <label htmlFor={`${id}-venta`} className="field-label">Precio al público *</label>
            <input
              id={`${id}-venta`}
              type="number"
              step="0.01"
              min="0"
              value={l.precioUnitario}
              onChange={(e) => onCambiar({ precioUnitario: e.target.value })}
              onWheel={sinRueda}
              className="field-input"
            />
          </div>
        </div>
      )}

      {/* Todo lo opcional va plegado: en un producto nuevo se pide, en uno existente solo completa lo vacío. */}
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls={`${id}-extra`}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          marginBottom: 10,
          background: 'var(--beige-light)',
          border: '1px solid var(--gray-light)',
          borderRadius: 8,
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <span aria-hidden style={{ transition: 'transform 0.2s', transform: abierto ? 'rotate(90deg)' : 'none' }}>›</span>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>Más datos del producto (opcional)</span>
        {!abierto && completados > 0 && (
          <span style={{ fontSize: 12, color: 'var(--status-green-text)' }}>
            {completados} completado{completados === 1 ? '' : 's'}
          </span>
        )}
        {!abierto && nDiferencias > 0 && (
          <span style={{ fontSize: 12, color: 'var(--status-amber-text)' }}>
            ⚠ {nDiferencias} diferencia{nDiferencias === 1 ? '' : 's'}
          </span>
        )}
      </button>

      {/* Se oculta, no se desmonta: así no se pierde el estado de una imagen que se esté subiendo. */}
      <div id={`${id}-extra`} hidden={!abierto}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
        {pideDatosDeProducto && (
          <div>
            <label htmlFor={`${id}-minimo`} className="field-label">Stock mínimo</label>
            <input
              id={`${id}-minimo`}
              type="number"
              step="0.01"
              min="0"
              value={l.stockMinimo}
              onChange={(e) => onCambiar({ stockMinimo: e.target.value })}
              onWheel={sinRueda}
              className="field-input"
            />
          </div>
        )}
        {campoTexto('dimensiones', 'Dimensiones', 'ej: 60x60')}
        {campoTexto('color', 'Color')}
        {campoTexto('acabado', 'Acabado')}
        {campoNumero('espesorMm', 'Espesor (mm)')}
        {campoNumero('m2PorCaja', 'm² por caja')}
        {campoNumero('precioBodega', 'Precio de bodega')}
      </div>

      <div className="mb-3">
        <label htmlFor={`${id}-descripcion`} className="field-label">Descripción</label>
        <textarea
          id={`${id}-descripcion`}
          value={l.descripcion}
          onChange={(e) => onCambiar({ descripcion: e.target.value })}
          rows={2}
          maxLength={2000}
          placeholder={esExistente && producto?.descripcion ? 'El producto ya tiene descripción' : ''}
          className="field-textarea"
        />
      </div>

      {/* La imagen: nuevo sí; existente solo si todavía no tiene (la actual no se reemplaza desde una compra). */}
      {esExistente && producto?.imagenUrl ? (
        <p style={{ fontSize: 12, color: 'var(--gray-secondary)', margin: '0 0 10px 0' }}>
          El producto ya tiene imagen; no se cambia desde una compra.
        </p>
      ) : (
        <div className="mb-3" style={{ maxWidth: 420 }}>
          <ImageUploader
            valor={l.imagenUrl}
            onChange={(imagenUrl) => onCambiar({ imagenUrl })}
            onSubida={onSubidaImagen}
            carpeta="productos"
            etiqueta="Imagen (opcional)"
          />
        </div>
      )}
      </div>

      {/* Costo final: se calcula solo, y se puede ajustar a mano. */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          borderTop: '1px solid var(--gray-light)',
          paddingTop: 10,
        }}
      >
        <div>
          <label htmlFor={`${id}-costo`} className="field-label">Costo final por unidad</label>
          <input
            id={`${id}-costo`}
            type="number"
            step="0.01"
            min="0"
            value={l.costoManual !== '' ? l.costoManual : String(calculo.costoFinal)}
            onChange={(e) => onCambiar({ costoManual: e.target.value })}
            onWheel={sinRueda}
            className="field-input"
            style={{ width: 160 }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-secondary)', flex: 1, minWidth: 200 }}>
          {l.costoManual !== '' ? (
            <>
              Ajustado a mano.{' '}
              <button
                type="button"
                onClick={() => onCambiar({ costoManual: '' })}
                style={{ background: 'none', border: 'none', color: 'var(--gold-dark)', cursor: 'pointer', padding: 0, font: 'inherit' }}
              >
                Volver al calculado
              </button>
            </>
          ) : calculo.costoExtra > 0 ? (
            <>Factura + {pesos(calculo.costoExtra)} de costos adicionales repartidos entre la cantidad.</>
          ) : (
            <>Igual al precio de factura (sin costos adicionales).</>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Total de la línea</div>
          <strong>{pesos(calculo.valorLinea)}</strong>
        </div>
      </div>

      {problema && (
        <p style={{ margin: '8px 0 0 0', fontSize: 13, color: 'var(--status-amber-text)' }}>{problema}</p>
      )}
    </div>
  )
}
