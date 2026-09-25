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

  const campo = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  }

  const etiqueta = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 500,
    fontSize: '14px',
  }

  return (
    <>
      <Header showNav={false} />
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '20px' }}>
        <div
          style={{
            backgroundColor: 'white',
            padding: 'clamp(20px, 6vw, 40px)',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: '560px',
            margin: '0 auto',
          }}
        >
          {creada ? (
            <>
              <h1 style={{ marginTop: 0, fontSize: '24px' }}>Tienda creada</h1>
              <p style={{ color: '#4b5563', fontSize: '14px' }}>
                <strong>{creada.nombre}</strong> ya existe y eres su dueño.
              </p>

              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', margin: '20px 0' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#166534' }}>
                  Este es el código de tu tienda. Compártelo con quien quieras que trabaje
                  contigo: es lo que necesita para pedirte acceso.
                </p>
                <code
                  style={{
                    display: 'inline-block',
                    fontSize: '26px',
                    fontWeight: 'bold',
                    letterSpacing: '6px',
                    backgroundColor: 'white',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                  }}
                >
                  {creada.codigo}
                </code>
              </div>

              <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
                El logo y los datos que hayas dejado en blanco se completan desde
                Configuración, dentro del panel.
              </p>

              <button
                onClick={() => router.push('/admin')}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Entrar al panel
              </button>
            </>
          ) : (
            <>
              <h1 style={{ marginTop: 0, marginBottom: '8px', fontSize: '24px' }}>
                Crear una tienda
              </h1>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
                Quedarás como dueño: acceso a todo y nadie te lo puede quitar. Solo el nombre
                es obligatorio.
              </p>

              {error && (
                <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={etiqueta}>Nombre de la tienda *</label>
                <input
                  value={datos.nombre}
                  onChange={(e) => actualizar('nombre', e.target.value)}
                  placeholder="Cerámicas del Norte"
                  autoFocus
                  style={campo}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={etiqueta}>Ciudad</label>
                  <input
                    value={datos.ciudad}
                    onChange={(e) => actualizar('ciudad', e.target.value)}
                    placeholder="Bogotá"
                    style={campo}
                  />
                </div>
                <div>
                  <label style={etiqueta}>NIT</label>
                  <input
                    value={datos.nit_empresa}
                    onChange={(e) => actualizar('nit_empresa', e.target.value)}
                    style={campo}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={etiqueta}>Eslogan</label>
                <input
                  value={datos.eslogan_empresa}
                  onChange={(e) => actualizar('eslogan_empresa', e.target.value)}
                  placeholder="Distribuidora de cerámicas y porcelanatos"
                  style={campo}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={etiqueta}>Dirección</label>
                <input
                  value={datos.direccion_empresa}
                  onChange={(e) => actualizar('direccion_empresa', e.target.value)}
                  style={campo}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={etiqueta}>Teléfono</label>
                  <input
                    value={datos.telefono_empresa}
                    onChange={(e) => actualizar('telefono_empresa', e.target.value)}
                    style={campo}
                  />
                </div>
                <div>
                  <label style={etiqueta}>Correo</label>
                  <input
                    type="email"
                    value={datos.email_empresa}
                    onChange={(e) => actualizar('email_empresa', e.target.value)}
                    style={campo}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={etiqueta}>WhatsApp para pedidos</label>
                <input
                  value={datos.whatsapp_pedidos}
                  onChange={(e) => actualizar('whatsapp_pedidos', e.target.value)}
                  placeholder="573001234567"
                  style={campo}
                />
                <small style={{ color: '#6b7280', fontSize: '12px' }}>
                  Con indicativo de país. Es el número al que llegan los pedidos del catálogo.
                </small>
              </div>

              <button
                onClick={crear}
                disabled={guardando}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: guardando ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: guardando ? 'wait' : 'pointer',
                  marginBottom: '14px',
                }}
              >
                {guardando ? 'Creando...' : 'Crear la tienda'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '13px' }}>
                <Link href="/request-access" style={{ color: '#2563eb', textDecoration: 'none' }}>
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
