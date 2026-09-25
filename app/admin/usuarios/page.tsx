'use client'

import { apiFetch } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import Link from 'next/link'

interface AccesoTienda {
  tiendaId: string
  tiendaNombre: string
  esOwner: boolean
  esAdmin: boolean
  permisos: string[]
}

interface Usuario {
  id: string
  email: string
  lastLogin: string | null
  tiendas: AccesoTienda[]
}

interface Accion {
  id: string
  clave: string
  accion: string
  nombre: string
}

interface Modulo {
  modulo: string
  nombre: string
  icono: string
  acciones: Accion[]
}

interface Plantilla {
  id: string
  nombre: string
  descripcion: string
  icono: string
  permisos: string[]
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [soyOwner, setSoyOwner] = useState(false)
  const [miEmail, setMiEmail] = useState<string | null>(null)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Selección en curso: nada se guarda hasta confirmar.
  const [usuariosSel, setUsuariosSel] = useState<Set<string>>(new Set())
  const [permisosSel, setPermisosSel] = useState<Set<string>>(new Set())
  const [nombrarAdmin, setNombrarAdmin] = useState(false)
  // Qué se está confirmando: añadir permisos, quitárselos todos, o sacar
  // a la persona de la tienda.
  const [confirmando, setConfirmando] = useState<'agregar' | 'quitar' | 'sacar' | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargar()
  }, [])

  const cargar = async () => {
    setCargando(true)
    setError(null)

    try {
      const [usuariosRes, permisosRes, sesionRes] = await Promise.all([
        apiFetch('/api/usuarios'),
        apiFetch('/api/permisos'),
        apiFetch('/api/debug/usuario-actual'),
      ])

      if (!usuariosRes.ok) throw new Error('No se pudieron cargar los usuarios')
      if (!permisosRes.ok) throw new Error('No se pudieron cargar los permisos')

      const [datosUsuarios, datosPermisos, sesion] = await Promise.all([
        usuariosRes.json(),
        permisosRes.json(),
        sesionRes.ok ? sesionRes.json() : Promise.resolve({ esOwner: false }),
      ])

      setUsuarios(datosUsuarios)
      setModulos(datosPermisos.modulos || [])
      setPlantillas(datosPermisos.plantillas || [])
      setSoyOwner(Boolean(sesion.esOwner))
      setMiEmail(sesion.email || null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  const alternar = (conjunto: Set<string>, valor: string) => {
    const copia = new Set(conjunto)
    copia.has(valor) ? copia.delete(valor) : copia.add(valor)
    return copia
  }

  const aplicarPlantilla = (p: Plantilla) => {
    setPermisosSel(new Set(p.permisos))
    setNombrarAdmin(p.id === 'administrador')
    setExito(null)
  }

  const limpiar = () => {
    setUsuariosSel(new Set())
    setPermisosSel(new Set())
    setNombrarAdmin(false)
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)

    try {
      const cuerpo: any = {
        usuarioIds: [...usuariosSel],
        permisos: [...permisosSel],
        modo: 'agregar',
      }
      if (soyOwner && nombrarAdmin) cuerpo.esAdmin = true

      const res = await apiFetch('/api/usuarios/permisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'No se pudieron asignar los permisos')

      setExito(
        `Permisos asignados a ${datos.afectados.length} usuario${datos.afectados.length !== 1 ? 's' : ''}`
      )
      setConfirmando(null)
      limpiar()
      await cargar()
    } catch (err: any) {
      setError(err.message)
      setConfirmando(null)
    } finally {
      setGuardando(false)
    }
  }

  /** Deja al usuario sin ningún permiso en la tienda. */
  const quitarTodos = async () => {
    setGuardando(true)
    setError(null)

    try {
      const res = await apiFetch('/api/usuarios/permisos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioIds: [...usuariosSel], todos: true }),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'No se pudieron quitar los permisos')

      const total = datos.afectados.reduce((s: number, a: any) => s + a.quitados, 0)
      const degradados = datos.afectados.filter((a: any) => a.eraAdmin).length

      setExito(
        `Se quitaron ${total} permiso${total !== 1 ? 's' : ''} a ${datos.afectados.length} usuario` +
        `${datos.afectados.length !== 1 ? 's' : ''}` +
        (degradados ? ` · ${degradados} dejó de ser administrador` : '')
      )
      setConfirmando(null)
      limpiar()
      await cargar()
    } catch (err: any) {
      setError(err.message)
      setConfirmando(null)
    } finally {
      setGuardando(false)
    }
  }

  /** Saca a las personas marcadas de la tienda: pierden el acceso, no la cuenta. */
  const sacarDeLaTienda = async () => {
    setGuardando(true)
    setError(null)

    try {
      const res = await apiFetch('/api/usuarios/acceso', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuarioIds: [...usuariosSel] }),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'No se pudo sacar de la tienda')

      const cuantos = datos.afectados.length
      setExito(
        `${cuantos} usuario${cuantos !== 1 ? 's' : ''} ya no tiene${cuantos !== 1 ? 'n' : ''} acceso a la tienda`
      )
      setConfirmando(null)
      limpiar()
      await cargar()
    } catch (err: any) {
      setError(err.message)
      setConfirmando(null)
    } finally {
      setGuardando(false)
    }
  }

  const accesoDe = (u: Usuario) => u.tiendas[0]
  const nivelDe = (u: Usuario) => {
    const a = accesoDe(u)
    if (a?.esOwner) return { texto: 'Dueño', color: '#7c3aed' }
    if (a?.esAdmin) return { texto: 'Administrador', color: '#2563eb' }
    return { texto: 'Usuario', color: '#6b7280' }
  }

  const seleccionables = usuarios.filter((u) => !accesoDe(u)?.esOwner)
  const hayQueGuardar = usuariosSel.size > 0 && (permisosSel.size > 0 || nombrarAdmin)

  const marcados = usuarios.filter((u) => usuariosSel.has(u.id))
  // Solo tiene sentido quitar permisos a quien tiene algo que quitar: o
  // permisos sueltos, o el cargo de administrador.
  const conAlgoQueQuitar = marcados.filter(
    (u) => (accesoDe(u)?.permisos.length || 0) > 0 || accesoDe(u)?.esAdmin
  )
  const adminsMarcados = marcados.filter((u) => accesoDe(u)?.esAdmin)
  const puedeQuitar = conAlgoQueQuitar.length > 0 && (adminsMarcados.length === 0 || soyOwner)

  // Nadie se saca a sí mismo desde aquí: para eso está "salir" en el menú
  // de tiendas, que además avisa de lo que implica.
  const meMarquéAMíMismo = marcados.some((u) => u.email === miEmail)
  const puedeSacar =
    marcados.length > 0 && !meMarquéAMíMismo && (adminsMarcados.length === 0 || soyOwner)

  const tarjeta = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  }

  return (
    <PermissionProtector requiredPermission="usuarios.ver">
      <div style={{ padding: '20px', maxWidth: '1100px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver al Dashboard
          </Link>
        </div>

        <h1 style={{ marginBottom: '6px' }}>Gestión de Usuarios</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '26px' }}>
          Marca los usuarios y los permisos que quieras darles, y confirma al final. Marcando
          solo usuarios puedes dejarlos sin ningún permiso.
        </p>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {exito && (
          <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
            ✅ {exito}
          </div>
        )}

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Cargando...</div>
        ) : (
          <>
            {/* Paso 1: usuarios */}
            <div style={tarjeta}>
              <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '4px' }}>
                1. ¿A quién?
              </h2>
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
                          backgroundColor: usuariosSel.has(u.id) ? '#eff6ff' : 'transparent',
                          opacity: esDueno ? 0.6 : 1,
                        }}
                      >
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={usuariosSel.has(u.id)}
                            disabled={esDueno}
                            onChange={() => setUsuariosSel(alternar(usuariosSel, u.id))}
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

              {seleccionables.length === 0 && (
                <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '14px' }}>
                  No hay usuarios a los que asignar permisos.
                </p>
              )}
            </div>

            {/* Paso 2: permisos */}
            <div style={tarjeta}>
              <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '4px' }}>
                2. ¿Qué puede hacer?
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '16px' }}>
                Empieza con una plantilla y ajusta lo que necesites, o marca los permisos uno por uno.
              </p>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '22px' }}>
                {plantillas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => aplicarPlantilla(p)}
                    disabled={p.id === 'administrador' && !soyOwner}
                    title={
                      p.id === 'administrador' && !soyOwner
                        ? 'Solo el dueño puede nombrar administradores'
                        : p.descripcion
                    }
                    style={{
                      padding: '10px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      cursor: p.id === 'administrador' && !soyOwner ? 'not-allowed' : 'pointer',
                      opacity: p.id === 'administrador' && !soyOwner ? 0.5 : 1,
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>
                      {p.icono} {p.nombre}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '11px', maxWidth: '230px' }}>
                      {p.descripcion}
                    </div>
                  </button>
                ))}
              </div>

              {nombrarAdmin && (
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '12px', marginBottom: '18px', fontSize: '13px' }}>
                  👑 Se nombrará <strong>administrador</strong>, con acceso a todo dentro de la
                  tienda. No podrá retirarte permisos a ti como dueño.
                  <button
                    onClick={() => setNombrarAdmin(false)}
                    style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '12px' }}
                  >
                    quitar
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {modulos.map((m) => (
                  <div key={m.modulo} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '0 0 10px 0' }}>
                      {m.icono} {m.nombre}
                    </p>

                    {m.acciones.map((a) => (
                      <label
                        key={a.clave}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '7px', fontSize: '13px', cursor: 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={permisosSel.has(a.clave)}
                          onChange={() => setPermisosSel(alternar(permisosSel, a.clave))}
                          style={{ cursor: 'pointer', marginTop: '2px' }}
                        />
                        <span>{a.nombre}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Paso 3: confirmar */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingBottom: '40px' }}>
              <button
                onClick={() => setConfirmando('agregar')}
                disabled={!hayQueGuardar}
                style={{
                  padding: '12px 26px',
                  backgroundColor: hayQueGuardar ? '#10b981' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: hayQueGuardar ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}
              >
                Añadir permisos
              </button>

              {usuariosSel.size > 0 && (
                <button
                  onClick={() => setConfirmando('quitar')}
                  disabled={!puedeQuitar}
                  title={
                    !puedeQuitar && adminsMarcados.length > 0 && !soyOwner
                      ? 'Solo el dueño puede retirarle el cargo a un administrador'
                      : !puedeQuitar
                        ? 'Los usuarios marcados no tienen permisos que quitar'
                        : 'Deja sin ningún permiso a los usuarios marcados'
                  }
                  style={{
                    padding: '12px 26px',
                    backgroundColor: puedeQuitar ? '#ef4444' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: puedeQuitar ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                >
                  Quitar permisos
                </button>
              )}

              {usuariosSel.size > 0 && (
                <button
                  onClick={() => setConfirmando('sacar')}
                  disabled={!puedeSacar}
                  title={
                    !puedeSacar && adminsMarcados.length > 0 && !soyOwner
                      ? 'Solo el dueño puede sacar a un administrador'
                      : !puedeSacar
                        ? 'No puedes sacarte a ti mismo desde aquí'
                        : 'Quita el acceso a la tienda, no la cuenta'
                  }
                  style={{
                    padding: '12px 26px',
                    backgroundColor: 'white',
                    color: puedeSacar ? '#b91c1c' : '#9ca3af',
                    border: `1px solid ${puedeSacar ? '#fca5a5' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    cursor: puedeSacar ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                >
                  Sacar de la tienda
                </button>
              )}

              {(usuariosSel.size > 0 || permisosSel.size > 0) && (
                <>
                  <button
                    onClick={limpiar}
                    style={{ padding: '12px 18px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
                  >
                    Limpiar
                  </button>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    {usuariosSel.size} usuario{usuariosSel.size !== 1 ? 's' : ''} ·{' '}
                    {permisosSel.size} permiso{permisosSel.size !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          </>
        )}

        {/* Confirmación de asignación */}
        {confirmando === 'agregar' && (
          <div
            onClick={() => !guardando && setConfirmando(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '560px', width: '100%', maxHeight: '85vh', overflow: 'auto', padding: '24px' }}
            >
              <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '6px' }}>
                Confirmar asignación
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '20px' }}>
                Revisa antes de guardar. Nada se ha modificado todavía.
              </p>

              <div style={{ marginBottom: '18px' }}>
                <p style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                  Se asignará a {usuariosSel.size} usuario{usuariosSel.size !== 1 ? 's' : ''}:
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                  {usuarios
                    .filter((u) => usuariosSel.has(u.id))
                    .map((u) => (
                      <li key={u.id} style={{ marginBottom: '3px' }}>
                        {u.email}
                      </li>
                    ))}
                </ul>
              </div>

              {nombrarAdmin && (
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '12px', marginBottom: '18px', fontSize: '13px' }}>
                  👑 Además {usuariosSel.size === 1 ? 'será nombrado' : 'serán nombrados'}{' '}
                  <strong>administrador{usuariosSel.size !== 1 ? 'es'  : ''}</strong> de la tienda,
                  con acceso a todo.
                </div>
              )}

              {permisosSel.size > 0 && (
                <div style={{ marginBottom: '22px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                    Estos {permisosSel.size} permiso{permisosSel.size !== 1 ? 's' : ''}:
                  </p>

                  {modulos
                    .map((m) => ({
                      ...m,
                      marcadas: m.acciones.filter((a) => permisosSel.has(a.clave)),
                    }))
                    .filter((m) => m.marcadas.length > 0)
                    .map((m) => (
                      <div key={m.modulo} style={{ marginBottom: '8px', fontSize: '13px' }}>
                        <span style={{ fontWeight: 'bold' }}>
                          {m.icono} {m.nombre}:
                        </span>{' '}
                        <span style={{ color: '#4b5563' }}>
                          {m.marcadas.map((a) => a.nombre).join(', ')}
                        </span>
                      </div>
                    ))}
                </div>
              )}

              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>
                Los permisos que ya tuvieran se conservan.
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setConfirmando(null)}
                  disabled={guardando}
                  style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={guardar}
                  disabled={guardando}
                  style={{ flex: 1, padding: '11px', backgroundColor: guardando ? '#9ca3af' : '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: guardando ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                >
                  {guardando ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de salida de la tienda */}
        {confirmando === 'sacar' && (
          <div
            onClick={() => !guardando && setConfirmando(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '560px', width: '100%', maxHeight: '85vh', overflow: 'auto', padding: '24px' }}
            >
              <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '6px' }}>
                Sacar de la tienda
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '20px' }}>
                Revisa antes de guardar. Nada se ha modificado todavía.
              </p>

              <div style={{ marginBottom: '18px' }}>
                <p style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {marcados.length} usuario{marcados.length !== 1 ? 's' : ''} dejará
                  {marcados.length !== 1 ? 'n' : ''} de tener acceso:
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
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

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setConfirmando(null)}
                  disabled={guardando}
                  style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={sacarDeLaTienda}
                  disabled={guardando}
                  style={{ flex: 1, padding: '11px', backgroundColor: guardando ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: guardando ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                >
                  {guardando ? 'Sacando...' : 'Sí, sacar de la tienda'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de retirada */}
        {confirmando === 'quitar' && (
          <div
            onClick={() => !guardando && setConfirmando(null)}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ backgroundColor: 'white', borderRadius: '12px', maxWidth: '560px', width: '100%', maxHeight: '85vh', overflow: 'auto', padding: '24px' }}
            >
              <h2 style={{ fontSize: '18px', marginTop: 0, marginBottom: '6px' }}>
                Quitar todos los permisos
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: 0, marginBottom: '20px' }}>
                Revisa antes de guardar. Nada se ha modificado todavía.
              </p>

              <div style={{ marginBottom: '18px' }}>
                <p style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {conAlgoQueQuitar.length} usuario{conAlgoQueQuitar.length !== 1 ? 's' : ''} quedará
                  {conAlgoQueQuitar.length !== 1 ? 'n' : ''} sin ningún permiso:
                </p>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                  {conAlgoQueQuitar.map((u) => {
                    const acceso = accesoDe(u)
                    return (
                      <li key={u.id} style={{ marginBottom: '4px' }}>
                        {u.email}{' '}
                        <span style={{ color: '#6b7280', fontSize: '13px' }}>
                          ({acceso?.esAdmin
                            ? 'administrador'
                            : `${acceso?.permisos.length || 0} permiso${acceso?.permisos.length !== 1 ? 's' : ''}`})
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {marcados.length > conAlgoQueQuitar.length && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '18px' }}>
                  Los otros {marcados.length - conAlgoQueQuitar.length} marcados ya no tenían
                  permisos, así que no cambian.
                </p>
              )}

              {adminsMarcados.length > 0 && (
                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '6px', padding: '12px', marginBottom: '18px', fontSize: '13px' }}>
                  ⚠️ {adminsMarcados.length === 1 ? 'Uno de ellos es' : `${adminsMarcados.length} de ellos son`}{' '}
                  <strong>administrador</strong>: también se le retira el cargo, porque si no
                  seguiría teniendo acceso a todo.
                </div>
              )}

              <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px', marginBottom: '22px', fontSize: '13px', color: '#991b1b' }}>
                Conservan el acceso a la tienda, pero sin permisos no podrán abrir ninguna
                sección del panel. Para devolvérselos habrá que asignarlos de nuevo.
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setConfirmando(null)}
                  disabled={guardando}
                  style={{ flex: 1, padding: '11px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={quitarTodos}
                  disabled={guardando}
                  style={{ flex: 1, padding: '11px', backgroundColor: guardando ? '#9ca3af' : '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: guardando ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                >
                  {guardando ? 'Quitando...' : 'Sí, quitar todos'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionProtector>
  )
}
