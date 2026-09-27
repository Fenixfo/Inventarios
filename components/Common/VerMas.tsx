'use client'

interface Props {
  /** Cuántos quedan por traer; se muestra en el botón. */
  restantes: number
  cargando: boolean
  onClick: () => void
}

/**
 * Botón "Ver más" de los listados del panel.
 *
 * Estaba copiado con los mismos estilos en seis pantallas: un cambio de
 * estilo o de texto había que hacerlo seis veces.
 */
export function VerMas({ restantes, cargando, onClick }: Props) {
  return (
    <div style={{ textAlign: 'center' }}>
      <button onClick={onClick} disabled={cargando} className="btn-ver-mas">
        {cargando ? 'Cargando...' : `Ver más (${restantes} restantes)`}
      </button>
    </div>
  )
}
