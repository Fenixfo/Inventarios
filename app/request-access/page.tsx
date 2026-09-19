'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { Header } from '@/components/Layout/Header'

interface Tienda {
  id: string
  nombre: string
  descripcion?: string
}

export default function RequestAccessPage() {
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [tiendaAcceso, setTiendaAcceso] = useState<Tienda | null>(null)
  const [selectedTienda, setSelectedTienda] = useState('')
  const [razon, setRazon] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        window.location.href = '/login'
        return
      }

      setUserEmail(session.user.email || '')
      setUserId(session.user.id)

      // Obtener tiendas
      try {
        const res = await fetch('/api/tiendas')
        if (res.ok) {
          const data = await res.json()
          setTiendas(data)
        }
      } catch (error) {
        console.error('Error fetching tiendas:', error)
      }

      // Obtener tiendas a las que ya tiene acceso
      try {
        const usuarioRes = await fetch(`/api/debug/usuario-actual?email=${encodeURIComponent(session.user.email || '')}`)
        if (usuarioRes.ok) {
          const usuario = await usuarioRes.json()
          if (usuario.tiendas && usuario.tiendas.length > 0) {
            setTiendaAcceso(usuario.tiendas[0].tienda)
          }
        }
      } catch (error) {
        console.error('Error fetching user tiendas:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedTienda || !razon.trim()) {
      setMessage({ type: 'error', text: 'Por favor completa todos los campos' })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/solicitudes-acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: userId,
          tiendaId: selectedTienda,
          email: userEmail,
          razon,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      setMessage({ type: 'success', text: '✅ Solicitud enviada. El administrador la revisará pronto.' })
      setRazon('')
      setSelectedTienda('')
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al enviar solicitud' })
    } finally {
      setSubmitting(false)
    }
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
            padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '500px',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: '10px', fontSize: '24px' }}>
          Solicitar Acceso
        </h1>

        {tiendaAcceso ? (
          <div style={{ backgroundColor: '#efe', border: '1px solid #0a0', padding: '15px', borderRadius: '4px', marginBottom: '20px' }}>
            <p style={{ color: '#0a0', marginBottom: '10px', fontWeight: '500' }}>
              ✅ ¡Ya tienes acceso a una tienda!
            </p>
            <p style={{ color: '#0a0', marginBottom: '15px', fontSize: '14px' }}>
              Tienda: <strong>{tiendaAcceso.nombre}</strong>
            </p>
            <Link
              href="/admin"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#0a0',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Ir al Panel de Administración
            </Link>
          </div>
        ) : (
          <p style={{ color: '#666', marginBottom: '30px', fontSize: '14px' }}>
            No tienes acceso a ninguna tienda aún. Selecciona una tienda y explica por qué necesitas acceso.
            El administrador revisará tu solicitud.
          </p>
        )}

        {message && (
          <div
            style={{
              backgroundColor: message.type === 'success' ? '#efe' : '#fee',
              color: message.type === 'success' ? '#0a0' : '#c00',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '14px',
            }}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: '#666' }}>Cargando tiendas...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
                Tienda
              </label>
              <select
                value={selectedTienda}
                onChange={(e) => setSelectedTienda(e.target.value)}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Selecciona una tienda</option>
                {tiendas.map((tienda) => (
                  <option key={tienda.id} value={tienda.id}>
                    {tienda.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
                ¿Por qué necesitas acceso?
              </label>
              <textarea
                value={razon}
                onChange={(e) => setRazon(e.target.value)}
                placeholder="Cuéntale al administrador por qué necesitas acceso..."
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  minHeight: '100px',
                  fontFamily: 'system-ui',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: submitting || loading ? '#ccc' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: submitting || loading ? 'default' : 'pointer',
                marginBottom: '15px',
              }}
            >
              {submitting ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', fontSize: '12px', color: '#666' }}>
          <Link href="/login" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver a login
          </Link>
        </div>
        </div>
      </div>
    </>
  )
}
