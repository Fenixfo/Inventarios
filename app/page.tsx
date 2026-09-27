'use client'

import { Header } from '@/components/Layout/Header'
import { useCart } from '@/hooks/useCart'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Producto } from '@/components/catalogo/tipos'
import { useCatalogo } from '@/components/catalogo/useCatalogo'
import { FiltrosCatalogo } from '@/components/catalogo/FiltrosCatalogo'
import { TarjetaProducto } from '@/components/catalogo/TarjetaProducto'
import { FichaProducto } from '@/components/catalogo/FichaProducto'
import { DialogoCantidad } from '@/components/catalogo/DialogoCantidad'
import { DialogoOtraTienda } from '@/components/catalogo/DialogoOtraTienda'
import { LoginModal } from '@/components/auth/LoginModal'
import { RegisterModal } from '@/components/auth/RegisterModal'

export default function Catalogo() {
  const { carrito, agregarAlCarrito, tiendaDelCarrito, esDeOtraTienda, vaciarCarrito } = useCart()
  const [loginAbierto, setLoginAbierto] = useState(false)
  const [registroAbierto, setRegistroAbierto] = useState(false)
  // Botón "▲" flotante: aparece al bajar al catálogo, igual que en la portada
  // de referencia, para volver a la portada sin tener que hacer scroll a mano.
  const [mostrarSubir, setMostrarSubir] = useState(false)
  const {
    productos,
    total,
    loading,
    cargandoMas,
    error,
    categorias,
    categoriaFiltro,
    setCategoriaFiltro,
    tiendas,
    tiendaFiltro,
    setTiendaFiltro,
    busqueda,
    setBusqueda,
    esMuestra,
    verMas,
  } = useCatalogo()
  // Lo que hay escrito en el buscador. La búsqueda de verdad (`busqueda`)
  // solo cambia al pulsar Enter o "Buscar": si no, cada tecla dispararía
  // una consulta al servidor.
  const [textoBusqueda, setTextoBusqueda] = useState('')
  // Avisa antes de mezclar tiendas en el mismo carrito.
  const [cambioDeTienda, setCambioDeTienda] = useState<Producto | null>(null)
  // El producto del pop-up de cantidad; null si está cerrado.
  const [aAgregar, setAAgregar] = useState<Producto | null>(null)
  // Ficha ampliada: se abre al pulsar la tarjeta y es independiente del
  // pop-up de cantidad, que sigue saliendo desde el botón del carrito.
  const [detalle, setDetalle] = useState<Producto | null>(null)

  /** Lanza la búsqueda. Menos de tres letras no se busca. */
  const buscar = () => {
    const texto = textoBusqueda.trim()
    if (texto.length > 0 && texto.length < 3) return

    setBusqueda(texto)
  }

  const limpiarBusqueda = () => {
    setTextoBusqueda('')
    setBusqueda('')
  }

  const abrirModalAgregar = (producto: Producto) => {
    setDetalle(null)

    // Cada tienda recibe los pedidos en su propio WhatsApp, así que un
    // carrito con productos de dos negocios no se podría enviar.
    if (esDeOtraTienda(producto.tienda?.id)) {
      setCambioDeTienda(producto)
      return
    }

    setAAgregar(producto)
  }

  /** Vacía lo que había y empieza el pedido en la tienda nueva. */
  const empezarPedidoNuevo = () => {
    if (!cambioDeTienda) return

    vaciarCarrito()
    setAAgregar(cambioDeTienda)
    setCambioDeTienda(null)
  }

  const confirmarAgregar = (producto: Producto, cantidad: number) => {
    agregarAlCarrito(
      {
        ...producto,
        tiendaId: producto.tienda?.id,
        tiendaNombre: producto.tienda?.nombre,
      },
      cantidad
    )
    setAAgregar(null)
  }

  const irAlCatalogo = () => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' })
  const irArriba = () => document.getElementById('portada')?.scrollIntoView({ behavior: 'smooth' })

  useEffect(() => {
    const alHacerScroll = () => {
      const catalogo = document.getElementById('catalogo')
      if (!catalogo) return
      setMostrarSubir(window.scrollY > catalogo.offsetTop - 100)
    }
    window.addEventListener('scroll', alHacerScroll)
    return () => window.removeEventListener('scroll', alHacerScroll)
  }, [])

  return (
    <>
      <Header compact={true} showLogo={false} />

      {/* Portada: primero lo que ve quien llega al sitio, antes del catálogo. */}
      <section
        id="portada"
        className="flex items-center justify-center p-4"
        style={{ minHeight: '100vh', backgroundColor: 'var(--beige-light)' }}
      >
        <div style={{ width: '100%', maxWidth: 440 }} className="text-center">
          <h1 style={{ margin: '0 0 8px 0', fontSize: 'clamp(48px, 10vw, 72px)', fontWeight: 'bold', color: 'var(--black-primary)' }}>
            Beraca
          </h1>
          <p style={{ margin: '0 0 32px 0', fontSize: 18, color: 'var(--gray-secondary)' }}>
            Gestión de Inventarios
          </p>

          <p style={{ margin: '0 0 32px 0', fontSize: 16, color: 'var(--black-primary)', lineHeight: 1.6 }}>
            Controla tu inventario, crea facturas y gestiona tus ventas en un solo lugar
          </p>

          <div className="flex flex-col gap-3 mb-8">
            <button onClick={() => setLoginAbierto(true)} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '13px' }}>
              Iniciar Sesión
            </button>
            <button onClick={() => setRegistroAbierto(true)} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '13px' }}>
              Registrarse
            </button>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--gray-light)' }} />
            <span style={{ color: 'var(--gray-secondary)', fontSize: 14 }}>O</span>
            <div style={{ flex: 1, height: 1, backgroundColor: 'var(--gray-light)' }} />
          </div>

          <button
            onClick={irAlCatalogo}
            style={{ color: 'var(--gold-dark)', fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            Ver catálogo sin crear cuenta ↓
          </button>
        </div>
      </section>

      <main id="catalogo" className="min-h-screen py-6 sm:py-12" style={{ backgroundColor: 'var(--white-off)' }}>
        <div className="max-w-7xl mx-auto px-4">
          {/* Botón del carrito. En móvil queda fijo abajo a la derecha:
              arriba obligaría a subir toda la lista para llegar a él. */}
          <div className="hidden sm:flex justify-end mb-6">
            <Link href="/carrito" className="relative btn-primary">
              🛒 Carrito
              {carrito.totalCantidad > 0 && (
                <span
                  className="absolute -top-2 -right-2 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--black-primary)', color: 'var(--gold)' }}
                >
                  {carrito.totalCantidad}
                </span>
              )}
            </Link>
          </div>

          {/* Encabezado */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-4" style={{ color: 'var(--black-primary)' }}>
              Catálogo de Productos
            </h1>
            <p className="text-base sm:text-xl" style={{ color: 'var(--gray-secondary)' }}>
              Baldosas, cerámicas y porcelanatos de alta calidad
            </p>
          </div>

          <FiltrosCatalogo
            textoBusqueda={textoBusqueda}
            onTextoBusqueda={setTextoBusqueda}
            onBuscar={buscar}
            onLimpiarBusqueda={limpiarBusqueda}
            categorias={categorias}
            categoria={categoriaFiltro}
            onCategoria={setCategoriaFiltro}
            tiendas={tiendas}
            tienda={tiendaFiltro}
            onTienda={setTiendaFiltro}
          />

          {/* A quién se le está comprando: el pedido va a esa tienda. */}
          {tiendaDelCarrito?.nombre && (
            <div className="alert-box mb-6" style={{ marginBottom: 24 }}>
              Tu pedido es de <strong>{tiendaDelCarrito.nombre}</strong>. Para pedirle a otra
              tienda tendrás que empezar un pedido nuevo.
            </div>
          )}

          {/* Estado de carga */}
          {loading && (
            <div className="text-center py-12" style={{ color: 'var(--gray-secondary)' }}>
              <p className="text-lg">Cargando productos...</p>
            </div>
          )}

          {/* Error */}
          {error && <div className="alert-box error mb-6">{error}</div>}

          {/* Cuántos resultados hay, y si es una muestra o el listado entero */}
          {!loading && !error && productos.length > 0 && (
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
                {/* Sin filtros el total es la muestra misma, así que no
                    aporta decir "de cuántos". */}
                {esMuestra
                  ? `${productos.length} producto${productos.length !== 1 ? 's' : ''}`
                  : `${productos.length} de ${total} producto${total !== 1 ? 's' : ''}`}
                {busqueda && ` para “${busqueda}”`}
              </p>

              {esMuestra && (
                <p className="text-sm" style={{ color: 'var(--gray-secondary)' }}>
                  Lo más reciente de cada tienda. Elige una categoría o una tienda para ver
                  todo.
                </p>
              )}
            </div>
          )}

          {/* Grid de productos. Lleva data-testid porque en la página hay
              más de una rejilla y las pruebas necesitan señalar esta. La
              búsqueda la hace el servidor: lo que llega ya viene filtrado. */}
          {!loading && productos.length > 0 && (
            <div
              data-testid="productos"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {productos.map((producto) => (
                <TarjetaProducto
                  key={producto.id}
                  producto={producto}
                  mostrarTienda={tiendas.length > 1}
                  onVerDetalle={() => setDetalle(producto)}
                  onAgregar={() => abrirModalAgregar(producto)}
                />
              ))}
            </div>
          )}

          {/* Ver más: solo al filtrar o buscar, y solo si queda algo por
              traer. La portada sin filtros es una muestra fija. */}
          {!loading && !esMuestra && productos.length < total && (
            <div className="mt-8 text-center">
              <button onClick={verMas} disabled={cargandoMas} className="btn-secondary">
                {cargandoMas
                  ? 'Cargando...'
                  : `Ver más (quedan ${total - productos.length})`}
              </button>
            </div>
          )}

          {/* Sin productos */}
          {!loading && productos.length === 0 && !error && (
            <div className="text-center py-12" style={{ color: 'var(--gray-secondary)' }}>
              {busqueda ? (
                <>
                  <p className="text-lg">
                    Ningún producto coincide con “{busqueda}”
                  </p>
                  <button onClick={limpiarBusqueda} className="btn-secondary mt-4">
                    Borrar búsqueda
                  </button>
                </>
              ) : (
                <p className="text-lg">No hay productos disponibles en esta categoría</p>
              )}
            </div>
          )}
        </div>

        {/* Carrito flotante en móvil, siempre a mano. A la izquierda, como
            en la portada de referencia: a la derecha va el botón "subir". */}
        <Link
          href="/carrito"
          aria-label="Ver carrito"
          className="sm:hidden fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-lg"
          style={{ backgroundColor: 'var(--gold)', color: 'var(--black-primary)' }}
        >
          🛒
          {carrito.totalCantidad > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold"
              style={{ backgroundColor: 'var(--black-primary)', color: 'var(--gold)' }}
            >
              {carrito.totalCantidad}
            </span>
          )}
        </Link>

        {/* Volver a la portada, visible solo al haber bajado al catálogo. */}
        {mostrarSubir && (
          <button
            onClick={irArriba}
            aria-label="Volver arriba"
            className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold shadow-lg"
            style={{ backgroundColor: 'var(--gold)', color: 'var(--black-primary)' }}
          >
            ↑
          </button>
        )}

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
      </main>

      {loginAbierto && (
        <LoginModal
          onCerrar={() => setLoginAbierto(false)}
          onIrARegistro={() => {
            setLoginAbierto(false)
            setRegistroAbierto(true)
          }}
        />
      )}

      {registroAbierto && (
        <RegisterModal
          onCerrar={() => setRegistroAbierto(false)}
          onIrALogin={() => {
            setRegistroAbierto(false)
            setLoginAbierto(true)
          }}
        />
      )}
    </>
  )
}
