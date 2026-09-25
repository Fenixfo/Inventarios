'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (categoria: string) => void
  /** Las que ya usa la tienda. Cada tienda tiene las suyas. */
  categorias: string[]
  placeholder?: string
}

/**
 * Campo de categoría con búsqueda y creación.
 *
 * Antes era una lista cerrada de tres opciones, así que para vender algo
 * que no fuera baldosa, cerámica o porcelanato había que tocar el código.
 * Ahora se escribe: si la categoría existe se elige de la lista, y si no,
 * se ofrece crearla.
 *
 * Las categorías son de cada tienda: no hay un catálogo común, cada negocio
 * organiza sus productos como quiera.
 */
export function SelectorCategoria({
  value,
  onChange,
  categorias,
  placeholder = 'Escribe o elige una categoría',
}: Props) {
  const [texto, setTexto] = useState(value)
  const [abierto, setAbierto] = useState(false)
  const [resaltado, setResaltado] = useState(0)
  const contenedor = useRef<HTMLDivElement>(null)

  // Si el formulario cambia el valor por fuera (al cargar un producto para
  // editarlo), el campo tiene que reflejarlo.
  useEffect(() => {
    setTexto(value)
  }, [value])

  const normalizar = (v: string) =>
    v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

  const coincidencias = useMemo(() => {
    const buscado = normalizar(texto)
    if (!buscado) return categorias

    return categorias.filter((c) => normalizar(c).includes(buscado))
  }, [categorias, texto])

  /** ¿Lo escrito ya existe tal cual? Entonces no hay nada que crear. */
  const yaExiste = categorias.some((c) => normalizar(c) === normalizar(texto))
  const puedeCrear = texto.trim().length > 0 && !yaExiste

  // Las opciones que se pueden recorrer con las flechas: las existentes y,
  // al final, la de crear.
  const opciones = [...coincidencias, ...(puedeCrear ? ['__nueva__'] : [])]

  useEffect(() => {
    if (!abierto) return

    const alClicarFuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false)
        // Lo escrito se conserva: si se escribió una categoría nueva y se
        // pulsa fuera, se toma como elegida en vez de perderse.
        onChange(texto.trim())
      }
    }

    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [abierto, texto, onChange])

  const elegir = (categoria: string) => {
    setTexto(categoria)
    onChange(categoria)
    setAbierto(false)
  }

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAbierto(true)
      setResaltado((i) => Math.min(i + 1, opciones.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setResaltado((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // No se envía el formulario: en un campo con lista, Enter elige.
      e.preventDefault()
      const elegida = opciones[resaltado]
      if (elegida === '__nueva__') elegir(texto.trim())
      else if (elegida) elegir(elegida)
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  const itemStyle = (activo: boolean) => ({
    padding: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    backgroundColor: activo ? '#eff6ff' : 'white',
    borderBottom: '1px solid #eee',
  })

  return (
    <div ref={contenedor} style={{ position: 'relative' }}>
      <input
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        value={texto}
        placeholder={placeholder}
        onFocus={() => {
          setAbierto(true)
          setResaltado(0)
        }}
        onChange={(e) => {
          setTexto(e.target.value)
          setAbierto(true)
          setResaltado(0)
          // Se avisa en cada tecla: así el formulario tiene el valor aunque
          // se guarde sin haber elegido de la lista.
          onChange(e.target.value)
        }}
        onKeyDown={alTeclear}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          fontSize: '14px',
        }}
      />

      {abierto && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            maxHeight: '220px',
            overflow: 'auto',
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            marginTop: '2px',
          }}
        >
          {coincidencias.map((categoria, i) => (
            <div
              key={categoria}
              role="option"
              aria-selected={categoria === value}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setResaltado(i)}
              onClick={() => elegir(categoria)}
              style={itemStyle(i === resaltado)}
            >
              <span style={{ textTransform: 'capitalize' }}>{categoria}</span>
            </div>
          ))}

          {puedeCrear && (
            <div
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setResaltado(coincidencias.length)}
              onClick={() => elegir(texto.trim())}
              style={{
                ...itemStyle(resaltado === coincidencias.length),
                borderBottom: 'none',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>➕ {texto.trim()}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Nueva categoría</div>
            </div>
          )}

          {coincidencias.length === 0 && !puedeCrear && (
            <div style={{ padding: '10px', fontSize: '13px', color: '#9ca3af' }}>
              Esta tienda todavía no tiene categorías. Escribe una para crearla.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
