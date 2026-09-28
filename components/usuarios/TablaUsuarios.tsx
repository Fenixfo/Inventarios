'use client'

import { accesoDe, estiloTarjeta, type Usuario } from './tipos'

interface Props {
  usuarios: Usuario[]
  seleccionados: Set<string>
  onAlternar: (usuarioId: string) => void
}

const nivelDe = (u: Usuario) => {
  const a = accesoDe(u)
  if (a?.esOwner) return { texto: 'Dueño', color: 'var(--gold-dark)' }
  if (a?.esAdmin) return { texto: 'Administrador', color: 'var(--status-blue-text)' }
  return { texto: 'Usuario', color: 'var(--gray-secondary)' }
}

/** Paso 1: a quién se le asignan o quitan permisos. Al dueño no se le tocan. */
export function TablaUsuarios({ usuarios, seleccionados, onAlternar }: Props) {
  const haySeleccionables = usuarios.some((u) => !accesoDe(u)?.esOwner)

  return (
    <div style={estiloTarjeta}>
      <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '4px', color: 'var(--black-primary)' }}>1. ¿A quién?</h2>
      <p style={{ fontSize: '13px', color: 'var(--gray-secondary)', marginTop: 0, marginBottom: '16px' }}>
        Puedes marcar varios y asignarles lo mismo de una vez.
      </p>

      <table className="table-luxe">
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>Usuario</th>
            <th>Nivel</th>
            <th>Tienda</th>
            <th style={{ textAlign: 'right' }}>Permisos</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => {
            const acceso = accesoDe(u)
            const nivel = nivelDe(u)
            const esDueno = Boolean(acceso?.esOwner)

            return (
              <tr
                key={u.id}
                style={{
                  backgroundColor: seleccionados.has(u.id) ? 'rgba(212, 175, 55, 0.1)' : undefined,
                  opacity: esDueno ? 0.6 : 1,
                }}
              >
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={seleccionados.has(u.id)}
                    disabled={esDueno}
                    onChange={() => onAlternar(u.id)}
                    title={esDueno ? 'Al dueño no se le pueden cambiar los permisos' : ''}
                    style={{ cursor: esDueno ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                  />
                </td>
                <td style={{ fontSize: '14px' }}>{u.email}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: nivel.color, color: 'white' }}>
                    {nivel.texto}
                  </span>
                </td>
                <td style={{ fontSize: '13px', color: 'var(--gray-secondary)' }}>
                  {acceso?.tiendaNombre || '—'}
                </td>
                <td style={{ textAlign: 'right', fontSize: '13px', color: 'var(--gray-secondary)' }}>
                  {esDueno || acceso?.esAdmin ? 'todos' : acceso?.permisos.length || 0}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!haySeleccionables && (
        <p style={{ fontSize: '13px', color: 'var(--gray-secondary)', marginTop: '14px' }}>
          No hay usuarios a los que asignar permisos.
        </p>
      )}
    </div>
  )
}
