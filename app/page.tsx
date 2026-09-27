'use client'

import { Header } from '@/components/Layout/Header'
import { useCart } from '@/hooks/useCart'
import { useState } from 'react'
import Link from 'next/link'
import type { Producto } from '@/components/catalogo/tipos'
import { useCatalogo } from '@/components/catalogo/useCatalogo'
import { FiltrosCatalogo } from '@/components/catalogo/FiltrosCatalogo'
import { TarjetaProducto } from '@/components/catalogo/TarjetaProducto'
import { FichaProducto } from '@/components/catalogo/FichaProducto'
import { DialogoCantidad } from '@/components/catalogo/DialogoCantidad'
import { DialogoOtraTienda } from '@/components/catalogo/DialogoOtraTienda'

export default function Catalogo() {
  const { carrito, agregarAlCarrito, tiendaDelCarrito, esDeOtraTienda, vaciarCarrito } = useCart()
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

  return (
    <>
      <Header compact={true} showLogo={false} />
      <main className="min-h-screen bg-gray-50 py-6 sm:py-12">
        <div className="max-w-7xl mx-auto px-4">
          {/* Botón del carrito. En móvil queda fijo abajo a la derecha:
              arriba obligaría a subir toda la lista para llegar a él. */}
          <div className="hidden sm:flex justify-end mb-6">
            <Link
              href="/carrito"
              className="relative bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium transition flex items-center gap-2"
            >
              🛒 Carrito
              {carrito.totalCantidad > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-red-600 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {carrito.totalCantidad}
                </span>
              )}
            </Link>
          </div>

          {/* Encabezado */}
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-4">
              Catálogo de Productos
            </h1>
            <p className="text-base sm:text-xl text-gray-600">
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
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Tu pedido es de <strong>{tiendaDelCarrito.nombre}</strong>. Para pedirle a otra
              tienda tendrás que empezar un pedido nuevo.
            </div>
          )}

          {/* Estado de carga */}
          {loading && (
            <div className="text-center py-12 text-gray-600">
              <p className="text-lg">Cargando productos...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Cuántos resultados hay, y si es una muestra o el listado entero */}
          {!loading && !error && productos.length > 0 && (
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-gray-600">
                {/* Sin filtros el total es la muestra misma, así que no
                    aporta decir "de cuántos". */}
                {esMuestra
                  ? `${productos.length} producto${productos.length !== 1 ? 's' : ''}`
                  : `${productos.length} de ${total} producto${total !== 1 ? 's' : ''}`}
                {busqueda && ` para “${busqueda}”`}
              </p>

              {esMuestra && (
                <p className="text-sm text-gray-500">
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
              <button
                onClick={verMas}
                disabled={cargandoMas}
                className="px-8 py-3 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400 transition"
              >
                {cargandoMas
                  ? 'Cargando...'
                  : `Ver más (quedan ${total - productos.length})`}
              </button>
            </div>
          )}

          {/* Sin productos */}
          {!loading && productos.length === 0 && !error && (
            <div className="text-center py-12 text-gray-600">
              {busqueda ? (
                <>
                  <p className="text-lg">
                    Ningún producto coincide con “{busqueda}”
                  </p>
                  <button
                    onClick={limpiarBusqueda}
                    className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 transition"
                  >
                    Borrar búsqueda
                  </button>
                </>
              ) : (
                <p className="text-lg">No hay productos disponibles en esta categoría</p>
              )}
            </div>
          )}
        </div>

        {/* Carrito flotante en móvil, siempre a mano */}
        <Link
          href="/carrito"
          aria-label="Ver carrito"
          className="sm:hidden fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-2xl text-white shadow-lg active:bg-red-700"
        >
          🛒
          {carrito.totalCantidad > 0 && (
            <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow-400 px-1 text-xs font-bold text-red-600">
              {carrito.totalCantidad}
            </span>
          )}
        </Link>

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
    </>
  )
}
