'use client'

import { estiloTarjeta, type Modulo, type Plantilla } from './tipos'

interface Props {
  plantillas: Plantilla[]
  modulos: Modulo[]
  seleccionados: Set<string>
  onAlternar: (clave: string) => void
  onPlantilla: (plantilla: Plantilla) => void
  /** Si se va a nombrar administrador (lo marca la plantilla "administrador"). */
  nombrarAdmin: boolean
  onQuitarAdmin: () => void
  /** Solo el dueño puede nombrar administradores. */
  soyOwner: boolean
}

/** Paso 2: qué puede hacer. Una plantilla como punto de partida o permisos sueltos. */
export function SelectorPermisos({
  plantillas,
  modulos,
  seleccionados,
  onAlternar,
  onPlantilla,
  nombrarAdmin,
  onQuitarAdmin,
  soyOwner,
}: Props) {
  return (
    <div style={estiloTarjeta}>
      <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '4px', color: 'var(--black-primary)' }}>
        2. ¿Qué puede hacer?
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--gray-secondary)', marginTop: 0, marginBottom: '16px' }}>
        Empieza con una plantilla y ajusta lo que necesites, o marca los permisos uno por uno.
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '22px' }}>
        {plantillas.map((p) => {
          const vedada = p.id === 'administrador' && !soyOwner

          return (
            <button
              key={p.id}
              onClick={() => onPlantilla(p)}
              disabled={vedada}
              title={vedada ? 'Solo el dueño puede nombrar administradores' : p.descripcion}
              style={{
                padding: '10px 16px',
                border: '1px solid var(--gray-light)',
                borderRadius: '8px',
                backgroundColor: 'var(--white-off)',
                cursor: vedada ? 'not-allowed' : 'pointer',
                opacity: vedada ? 0.5 : 1,
                fontSize: '13px',
                fontFamily: 'inherit',
                textAlign: 'left',
                color: 'var(--black-primary)',
              }}
            >
              <div style={{ fontWeight: 'bold' }}>
                {p.icono} {p.nombre}
              </div>
              <div style={{ color: 'var(--gray-secondary)', fontSize: '11px', maxWidth: '230px' }}>
                {p.descripcion}
              </div>
            </button>
          )
        })}
      </div>

      {nombrarAdmin && (
        <div className="alert-box" style={{ marginBottom: '18px' }}>
          👑 Se nombrará <strong>administrador</strong>, con acceso a todo dentro de la
          tienda. No podrá retirarte permisos a ti como dueño.
          <button
            onClick={onQuitarAdmin}
            style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--gold-dark)', cursor: 'pointer', fontSize: '12px' }}
          >
            quitar
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {modulos.map((m) => (
          <div key={m.modulo} style={{ border: '1px solid var(--gray-light)', borderRadius: '8px', padding: '14px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '0 0 10px 0', color: 'var(--black-primary)' }}>
              {m.icono} {m.nombre}
            </p>

            {m.acciones.map((a) => (
              <label
                key={a.clave}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '7px', fontSize: '13px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={seleccionados.has(a.clave)}
                  onChange={() => onAlternar(a.clave)}
                  style={{ cursor: 'pointer', marginTop: '2px' }}
                />
                <span>{a.nombre}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
