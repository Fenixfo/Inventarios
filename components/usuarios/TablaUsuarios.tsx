'use client'

import { accesoDe, estiloTarjeta, type Usuario } from './tipos'

interface Props {
  usuarios: Usuario[]
  seleccionados: Set<string>
  onAlternar: (usuarioId: string) => void
}

const nivelDe = (u: Usuario) => {
  const a = accesoDe(u)
  if (a?.esOwner) return { texto: 'Dueño', color: '#7c3aed' }
  if (a?.esAdmin) return { texto: 'Administrador', color: '#2563eb' }
  return { texto: 'Usuario', color: '#6b7280' }
}

/** Paso 1: a quién se le asignan o quitan permisos. Al dueño no se le tocan. */
export function TablaUsuarios({ usuarios, seleccionados, onAlternar }: Props) {
  const haySeleccionables = usuarios.some((u) => !accesoDe(u)?.esOwner)

  return (
    <div style={estiloTarjeta}>
      <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '4px' }}>1. ¿A quién?</h2>
      <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '16px' }}>
        Puedes marcar varios y asignarles lo mismo de una vez.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '10px', width: '40px' }}></th>
            <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Usuario</th>
            <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Nivel</th>
            <th style={{ padding: '10px', textAlign: 'left', fontSize: '12px' }}>Tienda</th>
            <th style={{ padding: '10px', textAlign: 'right', fontSize: '12px' }}>Permisos</th>
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
                  borderBottom: '1px solid #f3f4f6',
                  backgroundColor: seleccionados.has(u.id) ? '#eff6ff' : 'transparent',
                  opacity: esDueno ? 0.6 : 1,
                }}
              >
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={seleccionados.has(u.id)}
                    disabled={esDueno}
                    onChange={() => onAlternar(u.id)}
                    title={esDueno ? 'Al dueño no se le pueden cambiar los permisos' : ''}
                    style={{ cursor: esDueno ? 'not-allowed' : 'pointer', width: '16px', height: '16px' }}
                  />
                </td>
                <td style={{ padding: '10px', fontSize: '14px' }}>{u.email}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ backgroundColor: nivel.color, color: 'white', padding: '2px 9px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                    {nivel.texto}
                  </span>
                </td>
                <td style={{ padding: '10px', fontSize: '13px', color: '#6b7280' }}>
                  {acceso?.tiendaNombre || '—'}
                </td>
                <td style={{ padding: '10px', textAlign: 'right', fontSize: '13px', color: '#6b7280' }}>
                  {esDueno || acceso?.esAdmin ? 'todos' : acceso?.permisos.length || 0}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!haySeleccionables && (
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '14px' }}>
          No hay usuarios a los que asignar permisos.
        </p>
      )}
    </div>
  )
}
