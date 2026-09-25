'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch, tiendaActiva, fijarTiendaActiva } from '@/lib/api-client'
import { invalidarPermisos } from '@/components/PermisosProvider'

interface Tienda {
  id: string
  nombre: string
  ciudad?: string | null
  esOwner: boolean
  esAdmin: boolean
  codigo?: string | null
  activa?: boolean
}

interface Props {
  /** Correo de la sesión, para saber con qué cuenta se está trabajando. */
  email?: string | null
  onCerrarSesion?: () => void
}

/**
 * Menú para moverse entre las tiendas de una persona.
 *
 * La misma cuenta puede ser dueña de un negocio y vendedora en otro, así
 * que junto a cada tienda se indica qué es en ella: sin eso, no se sabe
 * qué se va a poder hacer al entrar.
 *
 * Aquí abajo van también el correo y el cerrar sesión: son cosas de la
 * cuenta, no de la pantalla, y tenerlas en una barra aparte obligaba a
 * llevar dos barras superiores.
 */
export function MenuTiendas({ email, onCerrarSesion }: Props) {
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState<string | null>(null)
  const [saliendo, setSaliendo] = useState<Tienda | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await apiFetch('/api/tiendas')
        if (!res.ok) return

        const datos: Tienda[] = await res.json()
        setTiendas(datos)

        // La activa es la que dice el servidor, no la primera de la lista:
        // sin preferencia guardada, el servidor entra a la tienda donde la
        // persona puede hacer más (la suya propia antes que una donde es
        // vendedora). Suponer la primera mostraba el nombre de una tienda
        // mientras las pantallas trabajaban en otra.
        const delServidor = datos.find((t) => t.activa)?.id || datos[0]?.id || null
        setActiva(delServidor)

        // Se deja fijada para que todas las peticiones manden la cabecera y
        // la tienda no pueda cambiar por su cuenta si cambian los permisos.
        if (delServidor && tiendaActiva() !== delServidor) fijarTiendaActiva(delServidor)
      } catch {
        // Sin el listado el menú no se muestra; el panel sigue funcionando.
      }
    }

    cargar()
  }, [])

  useEffect(() => {
    if (!abierto) return

    const alClicarFuera = (e: MouseEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }

    document.addEventListener('mousedown', alClicarFuera)
    return () => document.removeEventListener('mousedown', alClicarFuera)
  }, [abierto])

  const cambiarA = (id: string) => {
    if (id === activa) {
      setAbierto(false)
      return
    }

    fijarTiendaActiva(id)
    // Los permisos son de la tienda: al cambiar hay que volver a pedirlos,
    // y se recarga entera para que ninguna pantalla quede con datos de la
    // tienda anterior.
    invalidarPermisos()
    window.location.href = '/admin'
  }

  const salir = async () => {
    if (!saliendo) return

    setProcesando(true)
    setError(null)

    try {
      const res = await apiFetch('/api/tiendas/salir', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiendaId: saliendo.id }),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'No se pudo salir de la tienda')

      if (saliendo.id === activa) fijarTiendaActiva(null)
      invalidarPermisos()
      window.location.href = '/admin'
    } catch (err: any) {
      setError(err.message)
      setProcesando(false)
    }
  }

  if (tiendas.length === 0) return null

  const actual = tiendas.find((t) => t.id === activa) || tiendas[0]

  const nivel = (t: Tienda) =>
    t.esOwner ? 'Dueño' : t.esAdmin ? 'Administrador' : 'Usuario'

  return (
    <div ref={contenedor} style={{ position: 'relative' }}>
      <button
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/25"
      >
        🏪
        <span className="max-w-[140px] truncate">{actual?.nombre}</span>
        <span aria-hidden="true">▾</span>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[280px] overflow-hidden rounded-lg bg-white shadow-xl"
        >
          <p className="px-4 pt-3 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Tus tiendas
          </p>

          {tiendas.map((t) => (
            <div
              key={t.id}
              className={`flex items-start justify-between gap-2 px-4 py-2 ${
                t.id === activa ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <button
                onClick={() => cambiarA(t.id)}
                className="flex-1 text-left"
                role="menuitem"
              >
                <span className="block text-sm font-medium text-gray-900">
                  {t.id === activa && <span className="text-blue-600">✓ </span>}
                  {t.nombre}
                </span>
                <span className="block text-xs text-gray-500">
                  {nivel(t)}
                  {t.ciudad ? ` · ${t.ciudad}` : ''}
                </span>
              </button>

              {/* Del negocio propio no se sale: dejaría la tienda sin
                  nadie que la administre. */}
              {!t.esOwner && (
                <button
                  onClick={() => {
                    setSaliendo(t)
                    setAbierto(false)
                  }}
                  className="mt-1 shrink-0 text-xs text-red-600 hover:text-red-800"
                >
                  Salir
                </button>
              )}
            </div>
          ))}

          <div className="mt-1 border-t">
            <a
              href="/tiendas/nueva"
              className="block px-4 py-3 text-sm text-blue-600 no-underline hover:bg-gray-50"
              role="menuitem"
            >
              ➕ Crear una tienda
            </a>
            <a
              href="/request-access"
              className="block px-4 py-3 text-sm text-blue-600 no-underline hover:bg-gray-50"
              role="menuitem"
            >
              ✋ Pedir acceso con un código
            </a>
          </div>

          {(email || onCerrarSesion) && (
            <div className="border-t bg-gray-50 px-4 py-3">
              {email && (
                <p className="mb-2 break-all text-xs text-gray-500">👤 {email}</p>
              )}
              {onCerrarSesion && (
                <button
                  onClick={onCerrarSesion}
                  className="w-full rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
                  role="menuitem"
                >
                  🚪 Cerrar sesión
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {saliendo && (
        <div
          onClick={() => !procesando && setSaliendo(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-white p-6 text-gray-900"
          >
            <h3 className="mb-2 text-lg font-bold">Salir de {saliendo.nombre}</h3>
            <p className="mb-4 text-sm text-gray-600">
              Dejarás de tener acceso a esta tienda y de aparecer en su lista de usuarios. Lo
              que hayas facturado se queda en la tienda, a tu nombre.
            </p>
            <p className="mb-5 text-sm text-gray-600">
              Para volver tendrás que pedir acceso otra vez con el código.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setSaliendo(null)}
                disabled={procesando}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={salir}
                disabled={procesando}
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white"
              >
                {procesando ? 'Saliendo...' : 'Sí, salir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
