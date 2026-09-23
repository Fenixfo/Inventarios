'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface ProductoOpcion {
  id: string
  sku: string
  nombre: string
  stockActual?: number
}

interface Props {
  productos: ProductoOpcion[]
  value: string
  onChange: (id: string) => void
  /** Texto cuando no hay nada elegido; también es la opción para quitar la selección. */
  placeholder?: string
  /** Añade "(stock: N)" al nombre, útil en el formulario de movimientos. */
  mostrarStock?: boolean
  ancho?: string
}

const MAXIMO_VISIBLE = 50

function etiqueta(p: ProductoOpcion, conStock: boolean) {
  const base = `${p.sku} - ${p.nombre}`
  return conStock && p.stockActual !== undefined ? `${base} (stock: ${p.stockActual})` : base
}

/**
 * Selector de producto con búsqueda por escritura.
 *
 * Un <select> obliga a recorrer la lista entera, y con el catálogo real son
 * más de cien productos: aquí se escribe parte del nombre o del SKU y la
 * lista se reduce mientras se teclea.
 */
export function SelectorProducto({
  productos,
  value,
  onChange,
  placeholder = 'Todos',
  mostrarStock = false,
  ancho = '260px',
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)

  const seleccionado = productos.find((p) => p.id === value) || null

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return productos

    // Se buscan todas las palabras sueltas, así "gris 30" encuentra
    // "Pared Mancha Gris 30*60" sin escribirlo en orden.
    const palabras = texto.split(/\s+/)
    return productos.filter((p) => {
      const campo = `${p.sku} ${p.nombre}`.toLowerCase()
      return palabras.every((w) => campo.includes(w))
    })
  }, [productos, busqueda])

  const visibles = filtrados.slice(0, MAXIMO_VISIBLE)

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
    onChange(id)
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
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div ref={contenedor} style={{ position: 'relative', width: ancho }}>
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
            color: '#6b7280',
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
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
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
              color: '#6b7280',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            {placeholder}
          </li>

          {visibles.length === 0 ? (
            <li style={{ padding: '10px 12px', fontSize: '13px', color: '#9ca3af' }}>
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
                  backgroundColor: i === resaltado ? '#eff6ff' : 'transparent',
                  fontWeight: p.id === value ? 'bold' : 'normal',
                }}
              >
                {etiqueta(p, mostrarStock)}
              </li>
            ))
          )}

          {filtrados.length > MAXIMO_VISIBLE && (
            <li style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af' }}>
              y {filtrados.length - MAXIMO_VISIBLE} más — escribe para afinar la búsqueda
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
