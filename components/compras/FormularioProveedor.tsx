'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api-client'

export interface Proveedor {
  id: string
  nombre: string
  nit: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
}

interface Props {
  /** Si viene, se edita ese proveedor; si no, se crea uno nuevo. */
  proveedor?: Proveedor | null
  /** Nombre con el que arranca al crear (por ejemplo lo que se buscó). */
  nombreInicial?: string
  onGuardado: (proveedor: Proveedor) => void
  onCancelar?: () => void
}

/**
 * Crear o editar un proveedor. Solo el nombre es obligatorio.
 *
 * No usa su propio <form>: la pantalla de compra lo muestra dentro de otro
 * formulario y los formularios no se pueden anidar. Enter en un campo guarda.
 */
export function FormularioProveedor({ proveedor, nombreInicial = '', onGuardado, onCancelar }: Props) {
  const [datos, setDatos] = useState({
    nombre: proveedor?.nombre ?? nombreInicial,
    nit: proveedor?.nit ?? '',
    telefono: proveedor?.telefono ?? '',
    email: proveedor?.email ?? '',
    direccion: proveedor?.direccion ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiar = (campo: keyof typeof datos, valor: string) => setDatos((d) => ({ ...d, [campo]: valor }))

  const guardar = async () => {
    if (guardando) return
    if (!datos.nombre.trim()) {
      setError('Escribe el nombre del proveedor')
      return
    }

    setGuardando(true)
    setError(null)

    try {
      const res = await apiFetch(proveedor ? `/api/proveedores/${proveedor.id}` : '/api/proveedores', {
        method: proveedor ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      const cuerpo = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(cuerpo.error || 'No se pudo guardar el proveedor')

      onGuardado(cuerpo as Proveedor)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo guardar el proveedor')
    } finally {
      setGuardando(false)
    }
  }

  // Enter guarda, sin enviar ningún formulario que pudiera contener a este.
  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault()
      guardar()
    }
  }

  return (
    <div className="flex flex-col gap-4" onKeyDown={alTeclear}>
      {error && <div className="alert-box error">{error}</div>}

      <div>
        <label htmlFor="proveedor-nombre" className="field-label">Nombre *</label>
        <input
          id="proveedor-nombre"
          type="text"
          value={datos.nombre}
          onChange={(e) => cambiar('nombre', e.target.value)}
          maxLength={255}
          className="field-input"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="proveedor-nit" className="field-label">NIT</label>
          <input
            id="proveedor-nit"
            type="text"
            value={datos.nit}
            onChange={(e) => cambiar('nit', e.target.value)}
            maxLength={50}
            className="field-input"
          />
        </div>
        <div>
          <label htmlFor="proveedor-telefono" className="field-label">Teléfono</label>
          <input
            id="proveedor-telefono"
            type="text"
            value={datos.telefono}
            onChange={(e) => cambiar('telefono', e.target.value)}
            maxLength={30}
            className="field-input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="proveedor-email" className="field-label">Correo</label>
        <input
          id="proveedor-email"
          type="email"
          value={datos.email}
          onChange={(e) => cambiar('email', e.target.value)}
          maxLength={255}
          className="field-input"
        />
      </div>

      <div>
        <label htmlFor="proveedor-direccion" className="field-label">Dirección</label>
        <textarea
          id="proveedor-direccion"
          value={datos.direccion}
          onChange={(e) => cambiar('direccion', e.target.value)}
          rows={2}
          maxLength={500}
          className="field-textarea"
        />
      </div>

      <div className="flex gap-3 flex-wrap">
        <button type="button" onClick={guardar} disabled={guardando} className="btn-primary">
          {guardando ? 'Guardando...' : proveedor ? 'Guardar cambios' : 'Crear proveedor'}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} disabled={guardando} className="btn-secondary">
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
