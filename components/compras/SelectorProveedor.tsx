'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { MINIMO_BUSQUEDA } from '@/lib/paginacion'
import { usePermisos } from '@/components/PermisosProvider'
import { FormularioProveedor, type Proveedor } from '@/components/compras/FormularioProveedor'

interface Props {
  valor: Proveedor | null
  onChange: (proveedor: Proveedor | null) => void
  /** El rótulo del campo. */
  etiqueta?: string
  /** false para usarlo solo como filtro, sin ofrecer crear proveedores. */
  permitirCrear?: boolean
}

/**
 * Elegir el proveedor de una compra: se busca por nombre o NIT entre los de la
 * tienda, o se crea uno nuevo sin salir de la pantalla.
 */
export function SelectorProveedor({ valor, onChange, etiqueta = 'Proveedor *', permitirCrear = true }: Props) {
  const { puede } = usePermisos()
  const puedeCrear = permitirCrear && puede('compras.crear')

  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [resultados, setResultados] = useState<Proveedor[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  // Busca al escribir, con una pausa para no consultar en cada letra. Con menos
  // letras de las mínimas se muestran los primeros por orden alfabético.
  useEffect(() => {
    if (!abierto || valor) return

    let cancelado = false
    const limpio = texto.trim()
    const espera = setTimeout(async () => {
      setBuscando(true)
      setError(null)
      try {
        const params = new URLSearchParams({ limite: '8' })
        if (limpio.length >= MINIMO_BUSQUEDA) params.set('busqueda', limpio)

        const res = await apiFetch(`/api/proveedores?${params.toString()}`)
        const datos = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(datos.error || 'No se pudieron cargar los proveedores')
        if (!cancelado) setResultados(datos.proveedores || [])
      } catch (err) {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores')
      } finally {
        if (!cancelado) setBuscando(false)
      }
    }, 300)

    return () => {
      cancelado = true
      clearTimeout(espera)
    }
  }, [texto, abierto, valor])

  const elegir = (proveedor: Proveedor) => {
    onChange(proveedor)
    setAbierto(false)
    setCreando(false)
    setTexto('')
  }

  if (valor) {
    return (
      <div>
        <span className="field-label">{etiqueta}</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            border: '1px solid var(--gray-light)',
            borderRadius: 8,
            padding: '8px 12px',
            backgroundColor: 'var(--beige-light)',
          }}
        >
          <strong>{valor.nombre}</strong>
          {valor.nit && <span style={{ color: 'var(--gray-secondary)', fontSize: 13 }}>NIT {valor.nit}</span>}
          <button type="button" onClick={() => onChange(null)} className="btn-action" style={{ marginLeft: 'auto' }}>
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <label htmlFor="proveedor-buscar" className="field-label">{etiqueta}</label>
      <input
        id="proveedor-buscar"
        type="text"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setAbierto(true)
        }}
        onFocus={() => setAbierto(true)}
        placeholder="Busca por nombre o NIT"
        autoComplete="off"
        className="field-input"
      />

      {abierto && !creando && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: 2,
            backgroundColor: 'var(--white-off)',
            border: '1px solid var(--gray-light)',
            borderRadius: 8,
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            maxHeight: 280,
            overflow: 'auto',
          }}
        >
          {buscando && <div style={{ padding: 10, color: 'var(--gray-secondary)' }}>Buscando...</div>}
          {error && <div style={{ padding: 10, color: 'var(--status-red-solid)' }}>{error}</div>}

          {!buscando && !error && resultados.length === 0 && (
            <div style={{ padding: 10, color: 'var(--gray-secondary)' }}>No hay proveedores con ese nombre.</div>
          )}

          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegir(p)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: 10,
                border: 'none',
                borderBottom: '1px solid var(--gray-light)',
                background: 'transparent',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{p.nombre}</div>
              {p.nit && <div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>NIT {p.nit}</div>}
            </button>
          ))}

          <div style={{ display: 'flex', gap: 8, padding: 8, backgroundColor: 'var(--beige-light)' }}>
            {puedeCrear && (
              <button type="button" onClick={() => setCreando(true)} className="btn-action">
                + Crear proveedor{texto.trim() ? ` «${texto.trim()}»` : ''}
              </button>
            )}
            <button type="button" onClick={() => setAbierto(false)} className="btn-action" style={{ marginLeft: 'auto' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {creando && (
        <div
          style={{
            marginTop: 8,
            border: '1px solid var(--gray-light)',
            borderRadius: 8,
            padding: 16,
            backgroundColor: 'var(--white-off)',
          }}
        >
          <h3 className="card-title mb-3" style={{ fontSize: 15 }}>Nuevo proveedor</h3>
          <FormularioProveedor nombreInicial={texto.trim()} onGuardado={elegir} onCancelar={() => setCreando(false)} />
        </div>
      )}
    </div>
  )
}
