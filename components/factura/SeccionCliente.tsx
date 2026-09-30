'use client'

import { useState } from 'react'
import { useBusquedaRemota } from '@/lib/use-busqueda-remota'
import {
  CLIENTE_VACIO,
  estiloCampo,
  estiloEtiqueta,
  estiloSeccion,
  estiloSugerencias,
  type ClienteEncontrado,
  type ClienteFormulario,
} from './tipos'

interface Props {
  cliente: ClienteFormulario
  onCliente: (cliente: ClienteFormulario) => void
  terminoPago: string
  onTerminoPago: (termino: string) => void
}

/**
 * Cliente de la factura: se busca por cédula (o nombre) en el servidor y, si
 * no existe, se escriben sus datos y se crea al guardar.
 */
export function SeccionCliente({ cliente, onCliente, terminoPago, onTerminoPago }: Props) {
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  // Plegada por defecto: el cliente es opcional (sin él es "Cliente General")
  // y el formulario ocupa media pantalla. Plegada deja a la vista un resumen.
  const [abierta, setAbierta] = useState(false)

  // Por cédula o nombre, en el servidor: antes se bajaban todos los clientes.
  const { resultados: sugerencias } = useBusquedaRemota<ClienteEncontrado>(
    '/api/clientes/buscar',
    'clientes',
    cliente.cedula,
    2
  )

  const cambiar = (campos: Partial<ClienteFormulario>) => onCliente({ ...cliente, ...campos })

  const buscarCedula = (valor: string) => {
    cambiar({ cedula: valor })
    setMostrarSugerencias(valor.trim() !== '')
  }

  const crearNuevo = (cedula: string) => {
    onCliente({ ...CLIENTE_VACIO, cedula })
    onTerminoPago('')
    setMostrarSugerencias(false)
  }

  const elegir = (encontrado: ClienteEncontrado) => {
    onCliente({
      id: encontrado.id,
      cedula: encontrado.cedulaCc || '',
      nombre: encontrado.nombre,
      email: encontrado.email || '',
      telefono: encontrado.telefono || '',
      direccion: encontrado.direccion || '',
    })
    onTerminoPago(encontrado.terminoPago || '')
    setMostrarSugerencias(false)
  }

  return (
    <div style={estiloSeccion}>
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        aria-controls="seccion-cliente"
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
          font: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'baseline', gap: '12px', minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>Cliente</h3>
          {!abierta && (
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '14px',
                color: 'var(--gray-secondary)',
              }}
            >
              {cliente.nombre
                ? `${cliente.nombre}${cliente.cedula ? ` · ${cliente.cedula}` : ''}`
                : 'Cliente General'}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            color: 'var(--gold-dark)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {abierta ? 'Ocultar ▲' : 'Editar ▼'}
        </span>
      </button>

      <div id="seccion-cliente" hidden={!abierta} style={{ marginTop: abierta ? '15px' : 0 }}>
      <div style={{ position: 'relative', marginBottom: '15px' }}>
        <label style={estiloEtiqueta}>Cédula/CC</label>
        <input
          type="text"
          value={cliente.cedula}
          onChange={(e) => buscarCedula(e.target.value)}
          placeholder="Ingresa cédula del cliente"
          style={estiloCampo}
        />

        {mostrarSugerencias && cliente.cedula.trim() !== '' && (
          <div style={estiloSugerencias}>
            {sugerencias.map((encontrado) => (
              <div
                key={encontrado.id}
                onClick={() => elegir(encontrado)}
                style={{
                  padding: '10px',
                  borderBottom: '1px solid var(--gray-light)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--beige-light)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ fontWeight: 'bold' }}>{encontrado.nombre}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Cédula: {encontrado.cedulaCc}</div>
              </div>
            ))}
            <div
              onClick={() => crearNuevo(cliente.cedula)}
              style={{
                padding: '10px',
                borderTop: sugerencias.length > 0 ? '1px solid var(--gray-light)' : 'none',
                cursor: 'pointer',
                color: 'var(--gold-dark)',
                backgroundColor: 'var(--beige-light)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--beige-light)'}
            >
              <div style={{ fontWeight: 'bold' }}>➕ Nuevo: {cliente.cedula}</div>
              <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Crear cliente con esta cédula</div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <label style={estiloEtiqueta}>Nombre</label>
          <input
            type="text"
            value={cliente.nombre}
            onChange={(e) => cambiar({ nombre: e.target.value })}
            readOnly={!!cliente.id}
            style={{ ...estiloCampo, backgroundColor: cliente.id ? 'var(--beige-light)' : 'var(--white-off)' }}
          />
        </div>
        <div>
          <label style={estiloEtiqueta}>Email</label>
          <input
            type="email"
            value={cliente.email}
            onChange={(e) => cambiar({ email: e.target.value })}
            style={estiloCampo}
          />
        </div>
        <div>
          <label style={estiloEtiqueta}>Teléfono</label>
          <input
            type="text"
            value={cliente.telefono}
            onChange={(e) => cambiar({ telefono: e.target.value })}
            style={estiloCampo}
          />
        </div>
        <div>
          <label style={estiloEtiqueta}>Término de Pago</label>
          <select
            value={terminoPago}
            onChange={(e) => onTerminoPago(e.target.value)}
            style={estiloCampo}
          >
            <option value="">Selecciona</option>
            <option value="contado">Contado</option>
            <option value="mixto">Mixto</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: '15px' }}>
        <label style={estiloEtiqueta}>Dirección</label>
        <textarea
          value={cliente.direccion}
          onChange={(e) => cambiar({ direccion: e.target.value })}
          rows={2}
          style={estiloCampo}
        />
      </div>
      </div>
    </div>
  )
}
