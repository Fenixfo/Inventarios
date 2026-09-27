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
          backgroundColor: 'var(--beige-light)',
          padding: '16px',
        }}
      >
        <div className="card" style={{ padding: 'clamp(24px, 6vw, 40px)', width: '100%', maxWidth: '400px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: 'var(--black-primary)' }}>Beraca</h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--gray-secondary)', fontSize: '14px' }}>Gestión de Inventarios</p>
          </div>

          {error && <div className="alert-box error">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="mb-5">
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                disabled={loading}
                className="field-input"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="field-label">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="field-input"
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
                border: `1px solid ${mantener ? 'var(--gold)' : 'var(--gray-light)'}`,
                backgroundColor: mantener ? 'var(--beige-light)' : 'transparent',
                borderRadius: '8px',
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
                <span style={{ display: 'block', color: 'var(--gray-secondary)', fontSize: '12px', marginTop: '3px' }}>
                  {mantener
                    ? `No tendrás que volver a entrar durante ${describirDuracion(DURACION_LARGA_MS)}. Úsalo solo en tu propio dispositivo.`
                    : `La sesión se cierra a las ${describirDuracion(DURACION_CORTA_MS)}. Déjalo así en un equipo compartido.`}
                </span>
              </span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--gray-secondary)' }}>
            <p style={{ margin: '10px 0' }}>
              ¿No tienes cuenta?{' '}
              <Link href="/signup" style={{ color: 'var(--gold-dark)', textDecoration: 'none', fontWeight: 600 }}>
                Regístrate aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
