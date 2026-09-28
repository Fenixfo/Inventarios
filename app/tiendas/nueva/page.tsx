'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { apiFetch, fijarTiendaActiva } from '@/lib/api-client'
import { invalidarPermisos } from '@/components/PermisosProvider'
import { Header } from '@/components/Layout/Header'

/**
 * Crear una tienda.
 *
 * Pide lo mismo que la configuración, pero solo el nombre es obligatorio:
 * quien está empezando no tiene por qué tener el NIT a mano, y todo lo
 * demás se completa después desde el panel.
 */
export default function NuevaTiendaPage() {
  const router = useRouter()

  const [datos, setDatos] = useState({
    nombre: '',
    ciudad: '',
    eslogan_empresa: '',
    nit_empresa: '',
    direccion_empresa: '',
    telefono_empresa: '',
    email_empresa: '',
    whatsapp_pedidos: '',
  })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creada, setCreada] = useState<{ nombre: string; codigo: string } | null>(null)

  useEffect(() => {
    const comprobarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) window.location.href = '/login'
    }
    comprobarSesion()
  }, [])

  const actualizar = (campo: string, valor: string) =>
    setDatos((previo) => ({ ...previo, [campo]: valor }))

  const crear = async () => {
    setError(null)

    if (datos.nombre.trim().length < 2) {
      setError('Ponle un nombre a la tienda')
      return
    }

    setGuardando(true)

    try {
      const res = await apiFetch('/api/tiendas/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la tienda')

      // Se entra a trabajar en la tienda recién creada, y se tira el caché
      // de permisos para que el panel la reconozca de inmediato.
      fijarTiendaActiva(data.id)
      invalidarPermisos()

      setCreada({ nombre: data.nombre, codigo: data.codigo })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <Header showNav={false} />
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--beige-light)', padding: '20px' }}>
        <div className="card" style={{ padding: 'clamp(24px, 6vw, 40px)', width: '100%', maxWidth: '560px', margin: '0 auto' }}>
          {creada ? (
            <>
              <h1 style={{ marginTop: 0, fontSize: '24px', color: 'var(--black-primary)' }}>Tienda creada</h1>
              <p style={{ color: 'var(--gray-secondary)', fontSize: '14px' }}>
                <strong>{creada.nombre}</strong> ya existe y eres su dueño.
              </p>

              <div className="alert-box success" style={{ margin: '20px 0' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>
                  Este es el código de tu tienda. Compártelo con quien quieras que trabaje
                  contigo: es lo que necesita para pedirte acceso.
                </p>
                <code
                  style={{
                    display: 'inline-block',
                    fontSize: '26px',
                    fontWeight: 'bold',
                    letterSpacing: '6px',
                    backgroundColor: 'var(--white-off)',
                    color: 'var(--black-primary)',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                  }}
                >
                  {creada.codigo}
                </code>
              </div>

              <p style={{ color: 'var(--gray-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                El logo y los datos que hayas dejado en blanco se completan desde
                Configuración, dentro del panel.
              </p>

              <button onClick={() => router.push('/admin')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Entrar al panel
              </button>
            </>
          ) : (
            <>
              <h1 style={{ marginTop: 0, marginBottom: '8px', fontSize: '24px', color: 'var(--black-primary)' }}>
                Crear una tienda
              </h1>
              <p style={{ color: 'var(--gray-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                Quedarás como dueño: acceso a todo y nadie te lo puede quitar. Solo el nombre
                es obligatorio.
              </p>

              {error && <div className="alert-box error">{error}</div>}

              <div className="mb-4">
                <label className="field-label">Nombre de la tienda *</label>
                <input
                  value={datos.nombre}
                  onChange={(e) => actualizar('nombre', e.target.value)}
                  placeholder="Cerámicas del Norte"
                  autoFocus
                  className="field-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="field-label">Ciudad</label>
                  <input
                    value={datos.ciudad}
                    onChange={(e) => actualizar('ciudad', e.target.value)}
                    placeholder="Bogotá"
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">NIT</label>
                  <input value={datos.nit_empresa} onChange={(e) => actualizar('nit_empresa', e.target.value)} className="field-input" />
                </div>
              </div>

              <div className="mb-4">
                <label className="field-label">Eslogan</label>
                <input
                  value={datos.eslogan_empresa}
                  onChange={(e) => actualizar('eslogan_empresa', e.target.value)}
                  placeholder="Distribuidora de cerámicas y porcelanatos"
                  className="field-input"
                />
              </div>

              <div className="mb-4">
                <label className="field-label">Dirección</label>
                <input value={datos.direccion_empresa} onChange={(e) => actualizar('direccion_empresa', e.target.value)} className="field-input" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="field-label">Teléfono</label>
                  <input value={datos.telefono_empresa} onChange={(e) => actualizar('telefono_empresa', e.target.value)} className="field-input" />
                </div>
                <div>
                  <label className="field-label">Correo</label>
                  <input
                    type="email"
                    value={datos.email_empresa}
                    onChange={(e) => actualizar('email_empresa', e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="field-label">WhatsApp para pedidos</label>
                <input
                  value={datos.whatsapp_pedidos}
                  onChange={(e) => actualizar('whatsapp_pedidos', e.target.value)}
                  placeholder="573001234567"
                  className="field-input"
                />
                <p className="field-help">Con indicativo de país. Es el número al que llegan los pedidos del catálogo.</p>
              </div>

              <button onClick={crear} disabled={guardando} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '14px' }}>
                {guardando ? 'Creando...' : 'Crear la tienda'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '13px' }}>
                <Link href="/request-access" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
                  ¿Te dieron un código? Pide acceso a una tienda existente
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
