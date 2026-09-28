'use client'

import { useEffect, useRef, useState } from 'react'
import { useBusquedaRemota } from '@/lib/use-busqueda-remota'

export interface ProductoOpcion {
  id: string
  sku: string
  nombre: string
  stockActual: number
}

interface Props {
  value: string
  onChange: (id: string) => void
  /** Recibe el producto elegido completo (con su stock), o null al quitarlo. */
  onElegir?: (producto: ProductoOpcion | null) => void
  /** Texto cuando no hay nada elegido; también es la opción para quitar la selección. */
  placeholder?: string
  /** Añade "(stock: N)" al nombre, útil en el formulario de movimientos. */
  mostrarStock?: boolean
  ancho?: string
}

/** Lo que devuelve como mucho la búsqueda; si llegan todos, puede haber más. */
const MAXIMO_RESULTADOS = 10

function etiqueta(p: ProductoOpcion, conStock: boolean) {
  const base = `${p.sku} - ${p.nombre}`
  return conStock ? `${base} (stock: ${p.stockActual})` : base
}

/**
 * Selector de producto con búsqueda por escritura.
 *
 * Un <select> obliga a recorrer la lista entera, y con el catálogo real son
 * más de cien productos: aquí se escribe parte del nombre o del SKU y la
 * lista se reduce mientras se teclea.
 *
 * Busca en el servidor (/api/productos/buscar): antes la pantalla bajaba el
 * catálogo entero para filtrarlo aquí. Al abrirse sin texto muestra los
 * primeros 10 por nombre.
 */
export function SelectorProducto({
  value,
  onChange,
  onElegir,
  placeholder = 'Todos',
  mostrarStock = false,
  ancho = '260px',
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)

  // El elegido se recuerda aquí para mostrar su nombre con la lista cerrada:
  // ya no hay un catálogo completo donde buscarlo.
  const [elegido, setElegido] = useState<ProductoOpcion | null>(null)
  const seleccionado = value && elegido?.id === value ? elegido : null

  // Busca cada palabra suelta en el servidor, así "gris 30" encuentra
  // "Pared Mancha Gris 30*60" sin escribirlo en orden. Solo con la lista abierta.
  const { resultados: visibles } = useBusquedaRemota<ProductoOpcion>(
    '/api/productos/buscar',
    'productos',
    busqueda,
    0,
    abierto
  )

  useEffect(() => {
    if (!abierto) return

    const alClicarFuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false)
        setBusqueda('')
      }
    }

    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [abierto])

  const elegir = (id: string) => {
    const producto = visibles.find((p) => p.id === id) || null
    setElegido(producto)
    onChange(id)
    onElegir?.(producto)
    setAbierto(false)
    setBusqueda('')
  }

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAbierto(true)
      setResaltado((i) => Math.min(i + 1, visibles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const elegido = visibles[resaltado]
      if (elegido) elegir(elegido.id)
    } else if (e.key === 'Escape') {
      setAbierto(false)
      setBusqueda('')
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    paddingRight: value ? '30px' : '12px',
    border: '1px solid var(--gray-light)',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--white-off)',
    color: 'var(--black-primary)',
  }

  return (
    // maxWidth evita que el ancho fijo desborde en una pantalla estrecha.
    <div ref={contenedor} style={{ position: 'relative', width: ancho, maxWidth: '100%' }}>
      <input
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls="lista-productos"
        aria-autocomplete="list"
        value={abierto ? busqueda : seleccionado ? etiqueta(seleccionado, mostrarStock) : ''}
        placeholder={placeholder}
        onFocus={() => {
          setAbierto(true)
          setBusqueda('')
          setResaltado(0)
        }}
        onChange={(e) => {
          setBusqueda(e.target.value)
          setAbierto(true)
          setResaltado(0)
        }}
        onKeyDown={alTeclear}
        style={inputStyle}
      />

      {value && !abierto && (
        <button
          type="button"
          onClick={() => elegir('')}
          aria-label="Quitar producto seleccionado"
          style={{
            position: 'absolute',
            right: '6px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--gray-secondary)',
            fontSize: '16px',
            lineHeight: 1,
            padding: '2px 4px',
          }}
        >
          ×
        </button>
      )}

      {abierto && (
        <ul
          id="lista-productos"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            margin: 0,
            padding: '4px 0',
            listStyle: 'none',
            backgroundColor: 'var(--white-off)',
            border: '1px solid var(--gray-light)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            maxHeight: '260px',
            overflowY: 'auto',
          }}
        >
          <li
            role="option"
            aria-selected={!value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => elegir('')}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--gray-secondary)',
              borderBottom: '1px solid var(--gray-light)',
            }}
          >
            {placeholder}
          </li>

          {visibles.length === 0 ? (
            <li style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--gray-secondary)' }}>
              Ningún producto coincide
            </li>
          ) : (
            visibles.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={p.id === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setResaltado(i)}
                onClick={() => elegir(p.id)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  backgroundColor: i === resaltado ? 'var(--beige-light)' : 'transparent',
                  fontWeight: p.id === value ? 'bold' : 'normal',
                }}
              >
                {etiqueta(p, mostrarStock)}
              </li>
            ))
          )}

          {visibles.length >= MAXIMO_RESULTADOS && (
            <li style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--gray-secondary)' }}>
              Se muestran los primeros {MAXIMO_RESULTADOS}: escribe para afinar la búsqueda
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
