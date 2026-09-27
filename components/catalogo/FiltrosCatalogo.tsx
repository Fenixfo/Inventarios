'use client'

import type { TiendaCatalogo } from './tipos'

interface Props {
  textoBusqueda: string
  onTextoBusqueda: (texto: string) => void
  onBuscar: () => void
  onLimpiarBusqueda: () => void
  categorias: string[]
  categoria: string
  onCategoria: (categoria: string) => void
  tiendas: TiendaCatalogo[]
  tienda: string
  onTienda: (tiendaId: string) => void
}

/** Búsqueda por nombre y listas de categoría y tienda del catálogo. */
export function FiltrosCatalogo({
  textoBusqueda,
  onTextoBusqueda,
  onBuscar,
  onLimpiarBusqueda,
  categorias,
  categoria,
  onCategoria,
  tiendas,
  tienda,
  onTienda,
}: Props) {
  const texto = textoBusqueda.trim()
  const muyCorto = texto.length > 0 && texto.length < 3

  return (
    <div className="card mb-6 sm:mb-8">
      <label htmlFor="buscar" className="field-label">
        Buscar por nombre:
      </label>

      {/* La búsqueda la hace el servidor y se lanza al pulsar Enter,
          no en cada tecla: así se busca en el catálogo entero sin
          mandar una consulta por letra. */}
      <div className="mb-2 flex gap-2">
        <div className="relative flex-1">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--gray-secondary)' }}
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            id="buscar"
            type="search"
            value={textoBusqueda}
            onChange={(e) => onTextoBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onBuscar()
              if (e.key === 'Escape') onLimpiarBusqueda()
            }}
            placeholder="Ej: carrara, porcelanato, café…"
            className="field-input"
            style={{ paddingLeft: 40, paddingRight: 40 }}
          />
          {textoBusqueda && (
            <button
              onClick={onLimpiarBusqueda}
              // Nombre distinto al del botón del mensaje "sin
              // resultados": dos controles con el mismo nombre se
              // anuncian igual y no hay forma de distinguirlos.
              aria-label="Limpiar el campo de búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xl leading-none"
              style={{ color: 'var(--gray-secondary)' }}
            >
              ×
            </button>
          )}
        </div>

        <button onClick={onBuscar} disabled={muyCorto} className="btn-primary">
          Buscar
        </button>
      </div>

      <p className="field-help mb-6">
        {muyCorto
          ? 'Escribe al menos 3 letras.'
          : 'Pulsa Enter para buscar. Se busca en todo el catálogo, también en los productos sin foto, y respeta los filtros que tengas puestos.'}
      </p>

      {/* Listas desplegables y no botones: con muchas categorías o
          muchas tiendas, las hileras de botones empujaban los
          productos fuera de la pantalla. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="categoria" className="field-label">
            Categoría
          </label>
          <select
            id="categoria"
            value={categoria}
            onChange={(e) => onCategoria(e.target.value)}
            className="field-select capitalize"
            style={{ width: '100%' }}
          >
            <option value="">Todas las categorías</option>
            {categorias.map((cat) => (
              <option key={cat} value={cat} className="capitalize">
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* El de tiendas solo cuando hay más de una: con una sola no
            dice nada y ocupa sitio. */}
        {tiendas.length > 1 && (
          <div>
            <label htmlFor="tienda" className="field-label">
              Tienda
            </label>
            <select
              id="tienda"
              value={tienda}
              onChange={(e) => onTienda(e.target.value)}
              className="field-select"
              style={{ width: '100%' }}
            >
              <option value="">Todas las tiendas</option>
              {tiendas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
