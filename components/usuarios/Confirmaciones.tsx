'use client'

import type { ReactNode } from 'react'
import { accesoDe, type Modulo, type Usuario } from './tipos'

const plural = (n: number, s = 's') => (n !== 1 ? s : '')

interface PropsMarco {
  titulo: string
  children: ReactNode
  guardando: boolean
  onCancelar: () => void
  onConfirmar: () => void
  textoConfirmar: string
  textoGuardando: string
  colorConfirmar: string
}

/**
 * Pop-up común de las tres confirmaciones: nada se guarda hasta pulsar el
 * botón final, y mientras se guarda no se puede cerrar.
 */
function MarcoConfirmacion({
  titulo,
  children,
  guardando,
  onCancelar,
  onConfirmar,
  textoConfirmar,
  textoGuardando,
  colorConfirmar,
}: PropsMarco) {
  return (
    <div
      onClick={() => !guardando && onCancelar()}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '560px', width: '100%', maxHeight: '85vh', overflow: 'auto', padding: '24px' }}
      >
        <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '6px' }}>{titulo}</h2>
        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '20px' }}>
          Revisa antes de guardar. Nada se ha modificado todavía.
        </p>

        {children}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onCancelar}
            disabled={guardando}
            style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={guardando}
            style={{ flex: 1, padding: '11px', backgroundColor: guardando ? '#9ca3af' : colorConfirmar, color: 'white', border: 'none', borderRadius: '6px', cursor: guardando ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            {guardando ? textoGuardando : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

interface PropsAccion {
  guardando: boolean
  onCancelar: () => void
  onConfirmar: () => void
}

const estiloTituloLista = { fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }
const estiloLista = { margin: 0, paddingLeft: '20px', fontSize: '14px' }

interface PropsAsignacion extends PropsAccion {
  marcados: Usuario[]
  permisos: Set<string>
  modulos: Modulo[]
  nombrarAdmin: boolean
}

/** Añadir permisos (y quizá el cargo de administrador) a los marcados. */
export function ConfirmarAsignacion({
  marcados,
  permisos,
  modulos,
  nombrarAdmin,
  ...accion
}: PropsAsignacion) {
  const n = marcados.length

  // Los permisos elegidos, agrupados por módulo para leerlos de un vistazo.
  const porModulo = modulos
    .map((m) => ({ ...m, marcadas: m.acciones.filter((a) => permisos.has(a.clave)) }))
    .filter((m) => m.marcadas.length > 0)

  return (
    <MarcoConfirmacion
      titulo="Confirmar asignación"
      textoConfirmar="Confirmar"
      textoGuardando="Guardando..."
      colorConfirmar="#10b981"
      {...accion}
    >
      <div style={{ marginBottom: '18px' }}>
        <p style={estiloTituloLista}>
          Se asignará a {n} usuario{plural(n)}:
        </p>
        <ul style={estiloLista}>
          {marcados.map((u) => (
            <li key={u.id} style={{ marginBottom: '3px' }}>
              {u.email}
            </li>
          ))}
        </ul>
      </div>

      {nombrarAdmin && (
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '12px', marginBottom: '18px', fontSize: '13px' }}>
          👑 Además {n === 1 ? 'será nombrado' : 'serán nombrados'}{' '}
          <strong>administrador{plural(n, 'es')}</strong> de la tienda, con acceso a todo.
        </div>
      )}

      {permisos.size > 0 && (
        <div style={{ marginBottom: '22px' }}>
          <p style={estiloTituloLista}>
            Estos {permisos.size} permiso{plural(permisos.size)}:
          </p>

          {porModulo.map((m) => (
            <div key={m.modulo} style={{ marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ fontWeight: 'bold' }}>
                {m.icono} {m.nombre}:
              </span>{' '}
              <span style={{ color: '#4b5563' }}>{m.marcadas.map((a) => a.nombre).join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
        Los permisos que ya tuvieran se conservan.
      </p>
    </MarcoConfirmacion>
  )
}

interface PropsSalida extends PropsAccion {
  marcados: Usuario[]
}

/** Sacar a los marcados de la tienda: pierden el acceso, no la cuenta. */
export function ConfirmarSalida({ marcados, ...accion }: PropsSalida) {
  const n = marcados.length

  return (
    <MarcoConfirmacion
      titulo="Sacar de la tienda"
      textoConfirmar="Sí, sacar de la tienda"
      textoGuardando="Sacando..."
      colorConfirmar="#dc2626"
      {...accion}
    >
      <div style={{ marginBottom: '18px' }}>
        <p style={estiloTituloLista}>
          {n} usuario{plural(n)} dejará{plural(n, 'n')} de tener acceso:
        </p>
        <ul style={estiloLista}>
          {marcados.map((u) => (
            <li key={u.id} style={{ marginBottom: '4px' }}>
              {u.email}
              {accesoDe(u)?.esAdmin && (
                <span style={{ color: '#6b7280', fontSize: '13px' }}> (administrador)</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', marginBottom: '14px', fontSize: '13px', color: '#991b1b' }}>
        Se les quita el acceso a esta tienda y desaparecen del listado. Para volver
        tendrán que pedir acceso otra vez con el código.
      </div>

      <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
        No se borra su cuenta: la cuenta es de la persona, no de la tienda, y puede
        seguir trabajando en otras. Lo que hayan facturado se queda aquí, a su nombre.
      </p>
    </MarcoConfirmacion>
  )
}

interface PropsRetiro extends PropsAccion {
  marcados: Usuario[]
  /** Los marcados que tienen permisos sueltos o el cargo de administrador. */
  conAlgoQueQuitar: Usuario[]
  cuantosAdmins: number
}

/** Dejar sin ningún permiso a los marcados, conservando su acceso a la tienda. */
export function ConfirmarRetiro({
  marcados,
  conAlgoQueQuitar,
  cuantosAdmins,
  ...accion
}: PropsRetiro) {
  const n = conAlgoQueQuitar.length

  return (
    <MarcoConfirmacion
      titulo="Quitar todos los permisos"
      textoConfirmar="Sí, quitar todos"
      textoGuardando="Quitando..."
      colorConfirmar="#ef4444"
      {...accion}
    >
      <div style={{ marginBottom: '18px' }}>
        <p style={estiloTituloLista}>
          {n} usuario{plural(n)} quedará{plural(n, 'n')} sin ningún permiso:
        </p>
        <ul style={estiloLista}>
          {conAlgoQueQuitar.map((u) => {
            const acceso = accesoDe(u)
            const cuantos = acceso?.permisos.length || 0
            return (
              <li key={u.id} style={{ marginBottom: '4px' }}>
                {u.email}{' '}
                <span style={{ color: '#6b7280', fontSize: '13px' }}>
                  ({acceso?.esAdmin ? 'administrador' : `${cuantos} permiso${plural(cuantos)}`})
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {marcados.length > n && (
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '18px' }}>
          Los otros {marcados.length - n} marcados ya no tenían permisos, así que no cambian.
        </p>
      )}

      {cuantosAdmins > 0 && (
        <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '12px', marginBottom: '18px', fontSize: '13px' }}>
          ⚠️ {cuantosAdmins === 1 ? 'Uno de ellos es' : `${cuantosAdmins} de ellos son`}{' '}
          <strong>administrador</strong>: también se le retira el cargo, porque si no
          seguiría teniendo acceso a todo.
        </div>
      )}

      <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', marginBottom: '22px', fontSize: '13px', color: '#991b1b' }}>
        Conservan el acceso a la tienda, pero sin permisos no podrán abrir ninguna
        sección del panel. Para devolvérselos habrá que asignarlos de nuevo.
      </div>
    </MarcoConfirmacion>
  )
}
