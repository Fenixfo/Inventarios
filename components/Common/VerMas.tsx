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
    <div style={{ textAlign: 'center', marginTop: '20px' }}>
      <button
        onClick={onClick}
        disabled={cargando}
        style={{
          padding: '10px 24px',
          backgroundColor: 'white',
          color: '#2563eb',
          border: '1px solid #2563eb',
          borderRadius: '4px',
          cursor: cargando ? 'wait' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {cargando ? 'Cargando...' : `Ver más (${restantes} restantes)`}
      </button>
    </div>
  )
}
