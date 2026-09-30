'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'

interface Props {
  /** Vacío = a nombre de quien factura. */
  valor: string
  onCambio: (vendedorId: string) => void
}

/**
 * Caja para facturar a nombre de otra persona de la tienda.
 *
 * Solo aparece si el servidor dice que se puede (dueño, administrador o
 * permiso 'facturas.a_nombre_de_otros'); si no, no pinta nada. La lista y
 * el permiso se vuelven a comprobar al crear la factura.
 */
export function SelectorVendedor({ valor, onCambio }: Props) {
  const [lista, setLista] = useState<{ id: string; etiqueta: string }[]>([])
  const [yo, setYo] = useState('')
  const [puede, setPuede] = useState(false)

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      try {
        const res = await apiFetch('/api/facturas/vendedores')
        if (!res.ok) return

        const datos = await res.json()
        if (!activo || !datos.puede) return

        setLista(datos.vendedores)
        setYo(datos.yo)
        setPuede(true)
      } catch {
        // Sin la lista se factura a nombre propio, como siempre.
      }
    }

    cargar()
    return () => {
      activo = false
    }
  }, [])

  if (!puede) return null

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="vendedor-factura" className="text-sm font-medium" style={{ color: 'var(--gray-secondary)' }}>
        A nombre de
      </label>
      <select
        id="vendedor-factura"
        value={valor || yo}
        onChange={(e) => onCambio(e.target.value === yo ? '' : e.target.value)}
        className="field-select"
        style={{ minWidth: '240px' }}
      >
        {lista.map((v) => (
          <option key={v.id} value={v.id}>
            {v.etiqueta}
            {v.id === yo ? ' (yo)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
