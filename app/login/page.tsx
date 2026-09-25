'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { apiFetch } from '@/lib/api-client'
import Link from 'next/link'
import { Header } from '@/components/Layout/Header'
import {
  recordarSesion,
  marcarInicioSesion,
  DURACION_CORTA_MS,
  DURACION_LARGA_MS,
  describirDuracion,
} from '@/lib/sesion'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sin marcar, la sesión dura una jornada. Va desmarcada por defecto
  // porque el computador del mostrador lo usa más de una persona.
  const [mantener, setMantener] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      // La duración se decide aquí y el reloj empieza ahora: si no, la
      // primera pantalla del panel lo tomaría como inicio.
      recordarSesion(mantener)
      marcarInicioSesion()

      // Sincronizar usuario y obtener roles de BD
      const syncRes = await apiFetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user!.id,
          email: data.user!.email,
        }),
      })

      if (!syncRes.ok) {
        throw new Error('Error al sincronizar usuario')
      }

      const syncData = await syncRes.json()

      // Tener acceso a una tienda es lo que habilita el panel. El nivel
      // (dueño, administrador o usuario con permisos) ya no se decide aquí:
      // cada pantalla comprueba el permiso que le corresponde.
      const tieneAcceso = (syncData.usuario?.tiendas?.length || 0) > 0

      router.push(tieneAcceso ? '/admin' : '/request-access')
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
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
          padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: 'clamp(20px, 6vw, 40px)',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: '30px', textAlign: 'center', fontSize: '24px' }}>
          Inventarios Beraca
        </h1>

        {error && (
          <div
            style={{
              backgroundColor: '#fee',
              color: '#c00',
              padding: '12px',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                fontSize: '14px',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                fontSize: '14px',
              }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Duración de la sesión en este dispositivo */}
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
              marginBottom: '20px',
              padding: '12px',
              border: `1px solid ${mantener ? '#bfdbfe' : '#e5e7eb'}`,
              backgroundColor: mantener ? '#eff6ff' : '#f9fafb',
              borderRadius: '6px',
            }}
          >
            <input
              type="checkbox"
              checked={mantener}
              onChange={(e) => setMantener(e.target.checked)}
              disabled={loading}
              style={{ width: '17px', height: '17px', marginTop: '1px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '14px' }}>
              <strong>Mantén tu sesión iniciada</strong>
              <span style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginTop: '3px' }}>
                {mantener
                  ? `No tendrás que volver a entrar durante ${describirDuracion(DURACION_LARGA_MS)}. Úsalo solo en tu propio dispositivo.`
                  : `La sesión se cierra a las ${describirDuracion(DURACION_CORTA_MS)}. Déjalo así en un equipo compartido.`}
              </span>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#ccc' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
          <p style={{ margin: '10px 0' }}>
            ¿No tienes cuenta?{' '}
            <Link href="/signup" style={{ color: '#2563eb', textDecoration: 'none' }}>
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
      </div>
    </>
  )
}
