'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { apiFetch } from '@/lib/api-client'
import { Header } from '@/components/Layout/Header'
import { codigoValido, normalizarCodigo, LARGO_CODIGO } from '@/lib/codigo-tienda'

interface MiTienda {
  id: string
  nombre: string
}

interface TiendaEncontrada {
  id: string
  nombre: string
  ciudad?: string | null
  yaTieneAcceso: boolean
  solicitudPendiente: boolean
}

/**
 * Pedir acceso a una tienda con el código que comparte su dueño.
 *
 * Antes se elegía de una lista con todas las tiendas registradas; eso era
 * publicar el directorio de negocios. Ahora sin el código no se llega a
 * ninguna tienda.
 */
export default function RequestAccessPage() {
  const [misTiendas, setMisTiendas] = useState<MiTienda[]>([])
  const [codigo, setCodigo] = useState('')
  const [encontrada, setEncontrada] = useState<TiendaEncontrada | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [razon, setRazon] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const cargar = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        window.location.href = '/login'
        return
      }

      try {
        const res = await apiFetch('/api/tiendas')
        if (res.ok) setMisTiendas(await res.json())
      } catch (error) {
        console.error('Error cargando tiendas:', error)
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [])

  const buscarPorCodigo = async () => {
    const limpio = normalizarCodigo(codigo)
    setMessage(null)
    setEncontrada(null)

    if (!codigoValido(limpio)) {
      setMessage({
        type: 'error',
        text: `El código son ${LARGO_CODIGO} caracteres. No lleva la letra O ni el número 0.`,
      })
      return
    }

    setBuscando(true)

    try {
      const res = await apiFetch(`/api/tiendas/codigo/${limpio}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'No se pudo buscar la tienda')

      setEncontrada(data)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setBuscando(false)
    }
  }

  const enviarSolicitud = async () => {
    if (!encontrada) return

    if (!razon.trim()) {
      setMessage({ type: 'error', text: 'Cuéntale al dueño por qué necesitas acceso' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      // Solo viajan el código y el motivo: quién pide sale del token.
      const res = await apiFetch('/api/solicitudes-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: normalizarCodigo(codigo), razon }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setMessage({
        type: 'success',
        text: `Solicitud enviada a ${encontrada.nombre}. Te avisarán cuando la revisen.`,
      })
      setRazon('')
      setCodigo('')
      setEncontrada(null)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al enviar la solicitud' })
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box' as const,
  }

  return (
    <>
      <Header showNav={false} />
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          padding: '20px',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            padding: 'clamp(20px, 6vw, 40px)',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            width: '100%',
            maxWidth: '500px',
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: '10px', fontSize: '24px' }}>
            Pedir acceso a una tienda
          </h1>

          {misTiendas.length > 0 && (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
              <p style={{ color: '#166534', margin: '0 0 10px 0', fontSize: '14px' }}>
                Ya trabajas en {misTiendas.length === 1 ? 'la tienda' : 'las tiendas'}{' '}
                <strong>{misTiendas.map((t) => t.nombre).join(', ')}</strong>.
              </p>
              <Link
                href="/admin"
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Ir al panel
              </Link>
            </div>
          )}

          <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
            Pídele el código de {LARGO_CODIGO} caracteres al dueño de la tienda. Con él puedes
            solicitar entrar; él decide si te deja y qué puedes hacer.
          </p>

          {message && (
            <div
              style={{
                backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fee2e2',
                color: message.type === 'success' ? '#166534' : '#b91c1c',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '14px',
              }}
            >
              {message.text}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', color: '#666' }}>Cargando...</div>
          ) : (
            <>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
                Código de la tienda
              </label>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value.toUpperCase())
                    setEncontrada(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && buscarPorCodigo()}
                  placeholder="AB3K9M"
                  maxLength={LARGO_CODIGO + 2}
                  autoFocus
                  style={{
                    ...inputStyle,
                    fontFamily: 'monospace',
                    fontSize: '20px',
                    letterSpacing: '4px',
                    textAlign: 'center',
                  }}
                />
                <button
                  onClick={buscarPorCodigo}
                  disabled={buscando}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: buscando ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: buscando ? 'wait' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {buscando ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              {/* La tienda se confirma antes de mandar nada: con un código
                  mal dictado se pediría acceso al negocio equivocado. */}
              {encontrada && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px' }}>
                    {encontrada.nombre}
                  </p>
                  {encontrada.ciudad && (
                    <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '13px' }}>
                      {encontrada.ciudad}
                    </p>
                  )}

                  {encontrada.yaTieneAcceso ? (
                    <p style={{ margin: '12px 0 0 0', color: '#166534', fontSize: '14px' }}>
                      Ya tienes acceso a esta tienda.
                    </p>
                  ) : encontrada.solicitudPendiente ? (
                    <p style={{ margin: '12px 0 0 0', color: '#92400e', fontSize: '14px' }}>
                      Ya enviaste una solicitud y está pendiente de respuesta.
                    </p>
                  ) : (
                    <>
                      <label style={{ display: 'block', margin: '16px 0 8px 0', fontWeight: '500', fontSize: '14px' }}>
                        ¿Por qué necesitas acceso?
                      </label>
                      <textarea
                        value={razon}
                        onChange={(e) => setRazon(e.target.value)}
                        placeholder="Trabajo en el mostrador y necesito facturar..."
                        disabled={submitting}
                        style={{ ...inputStyle, minHeight: '90px', fontFamily: 'inherit' }}
                      />

                      <button
                        onClick={enviarSolicitud}
                        disabled={submitting}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: submitting ? '#9ca3af' : '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: submitting ? 'wait' : 'pointer',
                        }}
                      >
                        {submitting ? 'Enviando...' : `Pedir acceso a ${encontrada.nombre}`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* La otra salida para quien llega sin tienda: montar la suya. */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '18px', marginTop: '4px', marginBottom: '18px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 10px 0' }}>
              ¿No trabajas en la tienda de nadie?
            </p>
            <Link
              href="/tiendas/nueva"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                border: '1px solid #2563eb',
                color: '#2563eb',
                textDecoration: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Crear mi propia tienda
            </Link>
          </div>

          <div style={{ textAlign: 'center', fontSize: '12px', color: '#666' }}>
            <Link href="/login" style={{ color: '#2563eb', textDecoration: 'none' }}>
              ← Volver al login
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
