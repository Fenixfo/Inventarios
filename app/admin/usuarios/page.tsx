'use client'

import { apiFetch } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import Link from 'next/link'
import {
  accesoDe,
  alternar,
  type Modulo,
  type Plantilla,
  type Usuario,
} from '@/components/usuarios/tipos'
import { TablaUsuarios } from '@/components/usuarios/TablaUsuarios'
import { SelectorPermisos } from '@/components/usuarios/SelectorPermisos'
import {
  ConfirmarAsignacion,
  ConfirmarRetiro,
  ConfirmarSalida,
} from '@/components/usuarios/Confirmaciones'

/** Lo que devuelve DELETE /api/usuarios/permisos por cada persona. */
interface Retirado {
  quitados: number
  eraAdmin: boolean
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

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

  /**
   * Manda un cambio de permisos o de acceso. Si sale bien, anuncia el
   * resultado, limpia la selección y recarga el listado; si no, muestra el
   * error. En los dos casos cierra la confirmación.
   */
  const enviar = async <T,>(
    url: string,
    metodo: 'POST' | 'DELETE',
    cuerpo: object,
    fallo: string,
    mensajeDeExito: (afectados: T[]) => string
  ) => {
    setGuardando(true)
    setError(null)

    try {
      const res = await apiFetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || fallo)

      setExito(mensajeDeExito(datos.afectados))
      setConfirmando(null)
      limpiar()
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : fallo)
      setConfirmando(null)
    } finally {
      setGuardando(false)
    }
  }

  const guardar = () =>
    enviar(
      '/api/usuarios/permisos',
      'POST',
      {
        usuarioIds: [...usuariosSel],
        permisos: [...permisosSel],
        modo: 'agregar',
        ...(soyOwner && nombrarAdmin ? { esAdmin: true } : {}),
      },
      'No se pudieron asignar los permisos',
      (afectados) =>
        `Permisos asignados a ${afectados.length} usuario${afectados.length !== 1 ? 's' : ''}`
    )

  /** Deja al usuario sin ningún permiso en la tienda. */
  const quitarTodos = () =>
    enviar<Retirado>(
      '/api/usuarios/permisos',
      'DELETE',
      { usuarioIds: [...usuariosSel], todos: true },
      'No se pudieron quitar los permisos',
      (afectados) => {
        const total = afectados.reduce((s, a) => s + a.quitados, 0)
        const degradados = afectados.filter((a) => a.eraAdmin).length

        return (
          `Se quitaron ${total} permiso${total !== 1 ? 's' : ''} a ${afectados.length} usuario` +
          `${afectados.length !== 1 ? 's' : ''}` +
          (degradados ? ` · ${degradados} dejó de ser administrador` : '')
        )
      }
    )

  /** Saca a las personas marcadas de la tienda: pierden el acceso, no la cuenta. */
  const sacarDeLaTienda = () =>
    enviar(
      '/api/usuarios/acceso',
      'DELETE',
      { usuarioIds: [...usuariosSel] },
      'No se pudo sacar de la tienda',
      ({ length: cuantos }) =>
        `${cuantos} usuario${cuantos !== 1 ? 's' : ''} ya no tiene${cuantos !== 1 ? 'n' : ''} acceso a la tienda`
    )

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

  const cancelar = () => setConfirmando(null)

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
            <TablaUsuarios
              usuarios={usuarios}
              seleccionados={usuariosSel}
              onAlternar={(id) => setUsuariosSel(alternar(usuariosSel, id))}
            />

            <SelectorPermisos
              plantillas={plantillas}
              modulos={modulos}
              seleccionados={permisosSel}
              onAlternar={(clave) => setPermisosSel(alternar(permisosSel, clave))}
              onPlantilla={aplicarPlantilla}
              nombrarAdmin={nombrarAdmin}
              onQuitarAdmin={() => setNombrarAdmin(false)}
              soyOwner={soyOwner}
            />

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

        {confirmando === 'agregar' && (
          <ConfirmarAsignacion
            marcados={marcados}
            permisos={permisosSel}
            modulos={modulos}
            nombrarAdmin={nombrarAdmin}
            guardando={guardando}
            onCancelar={cancelar}
            onConfirmar={guardar}
          />
        )}

        {confirmando === 'sacar' && (
          <ConfirmarSalida
            marcados={marcados}
            guardando={guardando}
            onCancelar={cancelar}
            onConfirmar={sacarDeLaTienda}
          />
        )}

        {confirmando === 'quitar' && (
          <ConfirmarRetiro
            marcados={marcados}
            conAlgoQueQuitar={conAlgoQueQuitar}
            cuantosAdmins={adminsMarcados.length}
            guardando={guardando}
            onCancelar={cancelar}
            onConfirmar={quitarTodos}
          />
        )}
      </div>
    </PermissionProtector>
  )
}
