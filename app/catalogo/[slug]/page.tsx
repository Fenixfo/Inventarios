'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/hooks/useCart'
import { pesos } from '@/lib/formato'
import type { Producto } from '@/components/catalogo/tipos'
import { FichaProducto } from '@/components/catalogo/FichaProducto'
import { DialogoCantidad } from '@/components/catalogo/DialogoCantidad'
import { DialogoOtraTienda } from '@/components/catalogo/DialogoOtraTienda'

/**
 * Catálogo de una sola tienda, por categorías: `/catalogo/<tienda>`.
 *
 * Primero se elige una categoría (cada una con su imagen) y dentro salen sus
 * productos en lista. Comparte el carrito y el pedido por WhatsApp con el
 * catálogo de la portada.
 */

interface Categoria {
  nombre: string
  imagenUrl: string | null
  total: number
}

interface DatosTienda {
  tienda: { id: string; nombre: string } | null
  categorias: Categoria[]
}

const POR_TANDA = 9

export default function CatalogoTiendaPage() {
  // useSearchParams exige un Suspense por encima: sin él, Next no puede
  // generar la página de antemano.
  return (
    <Suspense fallback={<p className="text-center py-12">Cargando catálogo...</p>}>
      <CatalogoTienda />
    </Suspense>
  )
}

function CatalogoTienda() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const buscandoEn = useSearchParams()
  // La categoría vive en la URL: así el botón "atrás" del navegador vuelve a
  // las categorías en vez de salirse del catálogo.
  const categoria = buscandoEn.get('categoria') || ''

  const { carrito, agregarAlCarrito, tiendaDelCarrito, esDeOtraTienda, vaciarCarrito } = useCart()

  const [datos, setDatos] = useState<DatosTienda | null>(null)
  const [errorTienda, setErrorTienda] = useState<string | null>(null)

  const [productos, setProductos] = useState<Producto[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [textoBusqueda, setTextoBusqueda] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [detalle, setDetalle] = useState<Producto | null>(null)
  const [aAgregar, setAAgregar] = useState<Producto | null>(null)
  const [cambioDeTienda, setCambioDeTienda] = useState<Producto | null>(null)

  const tiendaId = datos?.tienda?.id
  const viendoProductos = Boolean(categoria || busqueda)

  // Las categorías con su imagen.
  useEffect(() => {
    const control = new AbortController()
    fetch(`/api/productos/catalogo/tienda/${encodeURIComponent(slug)}`, { signal: control.signal })
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el catálogo')
        return res.json()
      })
      .then(setDatos)
      .catch((err) => {
        if (!control.signal.aborted) setErrorTienda(err.message)
      })
    return () => control.abort()
  }, [slug])

  // Los productos de la categoría elegida, o los de la búsqueda.
  useEffect(() => {
    if (!tiendaId || !viendoProductos) return

    const control = new AbortController()
    const params = new URLSearchParams({ tienda: tiendaId, limite: String(POR_TANDA), desde: '0' })
    if (categoria) params.set('categoria', categoria)
    if (busqueda) params.set('busqueda', busqueda)

    setCargando(true)
    setError(null)
    fetch(`/api/productos/catalogo?${params}`, { signal: control.signal })
      .then((res) => {
        if (!res.ok) throw new Error('No se pudieron cargar los productos')
        return res.json()
      })
      .then((d) => {
        setProductos(d.productos)
        setTotal(d.total)
      })
      .catch((err) => {
        if (!control.signal.aborted) setError(err.message)
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false)
      })
    return () => control.abort()
  }, [tiendaId, categoria, busqueda, viendoProductos])

  const verMas = async () => {
    if (!tiendaId) return
    const params = new URLSearchParams({
      tienda: tiendaId,
      limite: String(POR_TANDA),
      desde: String(productos.length),
    })
    if (categoria) params.set('categoria', categoria)
    if (busqueda) params.set('busqueda', busqueda)

    setCargando(true)
    try {
      const res = await fetch(`/api/productos/catalogo?${params}`)
      if (!res.ok) throw new Error('No se pudieron cargar más productos')
      const d = await res.json()
      setProductos((previos) => [...previos, ...d.productos])
      setTotal(d.total)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar más productos')
    } finally {
      setCargando(false)
    }
  }

  const irACategoria = (nombre: string) => {
    setBusqueda('')
    setTextoBusqueda('')
    router.push(`/catalogo/${slug}?categoria=${encodeURIComponent(nombre)}`)
  }

  const irAInicio = () => {
    setBusqueda('')
    setTextoBusqueda('')
    router.push(`/catalogo/${slug}`)
  }

  /** Menos de tres letras no se busca, igual que en el catálogo de la portada. */
  const buscar = () => {
    const texto = textoBusqueda.trim()
    if (texto.length > 0 && texto.length < 3) return
    setBusqueda(texto)
    if (categoria) router.push(`/catalogo/${slug}`)
  }

  const abrirModalAgregar = (producto: Producto) => {
    setDetalle(null)
    // Un carrito con productos de dos negocios no se podría enviar.
    if (esDeOtraTienda(producto.tienda?.id)) {
      setCambioDeTienda(producto)
      return
    }
    setAAgregar(producto)
  }

  const empezarPedidoNuevo = () => {
    if (!cambioDeTienda) return
    vaciarCarrito()
    setAAgregar(cambioDeTienda)
    setCambioDeTienda(null)
  }

  const confirmarAgregar = (producto: Producto, cantidad: number) => {
    agregarAlCarrito(
      { ...producto, tiendaId: producto.tienda?.id, tiendaNombre: producto.tienda?.nombre },
      cantidad
    )
    setAAgregar(null)
  }

  if (errorTienda) return <div className="alert-box error m-4">{errorTienda}</div>
  if (!datos) return <p className="text-center py-12" style={{ color: 'var(--gray-secondary)' }}>Cargando catálogo...</p>
  if (!datos.tienda) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--gray-secondary)' }}>
        <p className="text-lg">No encontramos este catálogo.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--white-off)' }}>
      {/* Barra superior: buscador y carrito */}
      <header
        className="sticky top-0 z-30 flex items-center justify-center gap-4 px-4 py-3"
        style={{ backgroundColor: 'var(--black-primary)' }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            buscar()
          }}
          className="flex-1"
          style={{ maxWidth: 600 }}
        >
          <input
            type="search"
            value={textoBusqueda}
            onChange={(e) => {
              setTextoBusqueda(e.target.value)
              if (e.target.value === '') setBusqueda('')
            }}
            placeholder="Buscar producto..."
            aria-label="Buscar producto"
            className="field-input w-full"
            style={{ borderRadius: 10 }}
          />
        </form>

        <Link
          href="/carrito"
          aria-label="Ver carrito"
          className="relative flex h-11 w-11 items-center justify-center rounded-full text-xl"
          style={{ backgroundColor: 'var(--gold)', color: 'var(--black-primary)' }}
        >
          🛒
          {carrito.totalCantidad > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold"
              style={{ backgroundColor: 'var(--white-off)', color: 'var(--black-primary)' }}
            >
              {carrito.totalCantidad}
            </span>
          )}
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-center text-2xl sm:text-4xl font-bold mb-8" style={{ color: 'var(--black-primary)' }}>
          {datos.tienda.nombre}
        </h1>

        {/* Dónde está el visitante: "Categorías › Pisos" */}
        <nav aria-label="Ruta" className="mb-6 flex items-center gap-2 text-sm">
          <button
            onClick={irAInicio}
            disabled={!viendoProductos}
            style={{ color: viendoProductos ? 'var(--gold-dark)' : 'var(--black-primary)', fontWeight: 600, background: 'none', border: 'none', cursor: viendoProductos ? 'pointer' : 'default', padding: 0 }}
          >
            Categorías
          </button>
          {categoria && (
            <>
              <span style={{ color: 'var(--gray-secondary)' }}>›</span>
              <span style={{ fontWeight: 600 }}>{categoria}</span>
            </>
          )}
          {busqueda && (
            <>
              <span style={{ color: 'var(--gray-secondary)' }}>›</span>
              <span style={{ fontWeight: 600 }}>Resultados para “{busqueda}”</span>
            </>
          )}
        </nav>

        {tiendaDelCarrito?.nombre && tiendaDelCarrito.nombre !== datos.tienda.nombre && (
          <div className="alert-box mb-6">
            Tu pedido es de <strong>{tiendaDelCarrito.nombre}</strong>. Para pedirle a otra tienda
            tendrás que empezar un pedido nuevo.
          </div>
        )}

        {!viendoProductos ? (
          datos.categorias.length === 0 ? (
            <p className="text-center py-12" style={{ color: 'var(--gray-secondary)' }}>
              Esta tienda aún no tiene productos disponibles.
            </p>
          ) : (
            <div data-testid="categorias" className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              {datos.categorias.map((c) => (
                <button
                  key={c.nombre}
                  onClick={() => irACategoria(c.nombre)}
                  className="rounded-2xl text-left transition hover:-translate-y-0.5"
                  style={{ backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', overflow: 'hidden', border: 'none', cursor: 'pointer' }}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ aspectRatio: '4 / 3', backgroundColor: 'var(--beige-light)' }}
                  >
                    {c.imagenUrl ? (
                      <img src={c.imagenUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span style={{ fontSize: 36 }}>🗂️</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold" style={{ color: 'var(--black-primary)', margin: 0 }}>{c.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--gray-secondary)', margin: '2px 0 0 0' }}>
                      {c.total} producto{c.total !== 1 ? 's' : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            {error && <div className="alert-box error mb-6">{error}</div>}

            {!cargando && productos.length === 0 && !error && (
              <p className="text-center py-12" style={{ color: 'var(--gray-secondary)' }}>
                {busqueda ? `Ningún producto coincide con “${busqueda}”` : 'No hay productos disponibles en esta categoría'}
              </p>
            )}

            <div data-testid="productos" className="flex flex-col gap-4">
              {productos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDetalle(p)}
                  className="flex items-center gap-4 rounded-2xl p-4 text-left transition hover:-translate-y-0.5"
                  style={{ backgroundColor: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', border: 'none', cursor: 'pointer' }}
                >
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: 'var(--beige-light)' }}>
                    {p.imagenUrl ? (
                      <img src={p.imagenUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span>🧱</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-bold uppercase" style={{ color: 'var(--black-primary)', margin: 0 }}>{p.nombre}</p>
                    <p className="text-sm" style={{ color: 'var(--gray-secondary)', margin: '2px 0 0 0' }}>
                      {[p.dimensiones, p.color, p.acabado].filter(Boolean).join(' · ') || `SKU ${p.sku}`}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: 'var(--black-primary)', margin: 0 }}>
                      {pesos(p.precioUnitario)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--gray-secondary)', margin: 0 }}>por m²</p>
                  </div>
                </button>
              ))}
            </div>

            {cargando && (
              <p className="text-center py-6" style={{ color: 'var(--gray-secondary)' }}>Cargando productos...</p>
            )}

            {!cargando && productos.length < total && (
              <div className="mt-8 text-center">
                <button onClick={verMas} className="btn-secondary">
                  Ver más (quedan {total - productos.length})
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {cambioDeTienda && (
        <DialogoOtraTienda
          producto={cambioDeTienda}
          tiendaDelCarrito={tiendaDelCarrito?.nombre}
          onSeguir={() => setCambioDeTienda(null)}
          onEmpezarPedidoNuevo={empezarPedidoNuevo}
        />
      )}

      {detalle && (
        <FichaProducto
          producto={detalle}
          onCerrar={() => setDetalle(null)}
          onAgregar={() => abrirModalAgregar(detalle)}
        />
      )}

      {aAgregar && (
        <DialogoCantidad
          producto={aAgregar}
          onAgregar={(cantidad) => confirmarAgregar(aAgregar, cantidad)}
          onCerrar={() => setAAgregar(null)}
        />
      )}
    </div>
  )
}
