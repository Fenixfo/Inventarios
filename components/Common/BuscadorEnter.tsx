'use client'

import { useState } from 'react'
import { MINIMO_BUSQUEDA } from '@/lib/paginacion'

interface Props {
  /** Se llama al pulsar Enter o Buscar: con el texto, o '' al limpiar. */
  onBuscar: (texto: string) => void
  placeholder?: string
  etiqueta?: string
}

/**
 * Buscador que consulta al servidor al pulsar Enter, no en cada tecla.
 *
 * Es el mismo comportamiento del catálogo público: con los listados por
 * páginas, filtrar lo que ya está en pantalla solo miraría los 10 cargados,
 * así que la búsqueda tiene que ir a la base, y una consulta por letra sería
 * demasiado. Menos de tres letras no se busca.
 */
export function BuscadorEnter({ onBuscar, placeholder = 'Buscar por nombre', etiqueta = 'Buscar' }: Props) {
  const [texto, setTexto] = useState('')

  const limpio = texto.trim()
  const muyCorto = limpio.length > 0 && limpio.length < MINIMO_BUSQUEDA

  const buscar = () => {
    if (muyCorto) return
    onBuscar(limpio)
  }

  const limpiar = () => {
    setTexto('')
    onBuscar('')
  }

  return (
    <div>
      <label htmlFor="buscador-enter" className="field-label">
        {etiqueta}
      </label>

      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            id="buscador-enter"
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') buscar()
              if (e.key === 'Escape') limpiar()
            }}
            placeholder={placeholder}
            className="filter-input"
            style={{ paddingRight: 30 }}
          />
          {texto && (
            <button
              onClick={limpiar}
              aria-label="Limpiar la búsqueda"
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'none',
                color: 'var(--gray-secondary)',
                fontSize: '18px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>

        <button onClick={buscar} disabled={muyCorto} className="btn-primary">
          Buscar
        </button>
      </div>

      <p className="field-help">
        {muyCorto ? `Escribe al menos ${MINIMO_BUSQUEDA} letras.` : 'Pulsa Enter para buscar.'}
      </p>
    </div>
  )
}
