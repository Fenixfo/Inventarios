'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { ImageUploader } from '@/components/ImageUploader'

interface CategoriaConImagen {
  nombre: string
  imagenUrl: string
  total: number
}

/**
 * La imagen que sale en la portada del catálogo `/catalogo/<tienda>` para
 * cada categoría. Cada cambio se guarda solo: no hay botón aparte.
 */
export function ImagenesCategorias() {
  const [categorias, setCategorias] = useState<CategoriaConImagen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Al pegar una dirección, el uploader avisa en cada tecla: se espera a que
  // pare de escribir para no mandar una URL a medias por cada letra.
  const pendientes = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const pendientesAlSalir = pendientes.current
    ;(async () => {
      try {
        const res = await apiFetch('/api/configuracion/categorias')
        const datos = await res.json()
        if (!res.ok) throw new Error(datos.error || 'No se pudieron cargar las categorías')
        setCategorias(datos.categorias)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las categorías')
      } finally {
        setCargando(false)
      }
    })()

    return () => Object.values(pendientesAlSalir).forEach(clearTimeout)
  }, [])

  const guardar = async (nombre: string, imagenUrl: string) => {
    try {
      const res = await apiFetch('/api/configuracion/categorias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: nombre, imagenUrl }),
      })
      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'No se pudo guardar la imagen')
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la imagen')
    }
  }

  const cambiar = (nombre: string, imagenUrl: string) => {
    setCategorias((previas) => previas.map((c) => (c.nombre === nombre ? { ...c, imagenUrl } : c)))

    clearTimeout(pendientes.current[nombre])
    pendientes.current[nombre] = setTimeout(() => guardar(nombre, imagenUrl), 600)
  }

  if (cargando) return <p style={{ color: 'var(--gray-secondary)' }}>Cargando categorías...</p>

  return (
    <div>
      {error && <div className="alert-box error">{error}</div>}

      {categorias.length === 0 ? (
        <p style={{ color: 'var(--gray-secondary)', margin: 0 }}>
          Aún no hay productos con categoría.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {categorias.map((categoria) => (
            <ImageUploader
              key={categoria.nombre}
              etiqueta={`${categoria.nombre} · ${categoria.total} producto${categoria.total !== 1 ? 's' : ''}`}
              valor={categoria.imagenUrl}
              onChange={(url) => cambiar(categoria.nombre, url)}
              carpeta="productos"
            />
          ))}
        </div>
      )}
    </div>
  )
}
