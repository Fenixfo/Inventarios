'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { apiFetch } from '@/lib/api-client'
import {
  recordarSesion,
  marcarInicioSesion,
  DURACION_CORTA_MS,
  DURACION_LARGA_MS,
  describirDuracion,
} from '@/lib/sesion'

interface Props {
  onCerrar: () => void
  onIrARegistro: () => void
}

/**
 * Modal de inicio de sesión de la portada.
 *
 * Misma lógica que app/login/page.tsx (esa página se conserva para enlaces
 * directos, ej. cuando una sesión vencida redirige a /login). Aquí vive
 * como modal porque así es como el visitante que llega a "/" entra: sin
 * salir de la portada ni del catálogo.
 */
export function LoginModal({ onCerrar, onIrARegistro }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

      recordarSesion(mantener)
      marcarInicioSesion()

      const syncRes = await apiFetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: data.user!.id,
          email: data.user!.email,
        }),
      })

      if (!syncRes.ok) throw new Error('Error al sincronizar usuario')

      const syncData = await syncRes.json()
      const tieneAcceso = (syncData.usuario?.tiendas?.length || 0) > 0

      router.push(tieneAcceso ? '/admin' : '/request-access')
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Iniciar sesión"
        className="card popup-in"
        style={{ maxWidth: 440, width: '100%', margin: '32px 0' }}
      >
        <button
          onClick={onCerrar}
          className="flex items-center gap-2 mb-5 font-medium"
          style={{ color: 'var(--gray-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ← Cerrar
        </button>

        <h1 style={{ margin: '0 0 6px 0', fontSize: '32px', fontWeight: 'bold', textAlign: 'center', color: 'var(--black-primary)' }}>
          Inicia Sesión
        </h1>
        <p style={{ margin: '0 0 24px 0', textAlign: 'center', color: 'var(--gray-secondary)', fontSize: '14px' }}>
          Entra a administrar tu tienda
        </p>

        {error && <div className="alert-box error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="login-email" className="field-label">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              disabled={loading}
              autoFocus
              className="field-input"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="login-password" className="field-label">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              className="field-input"
            />
          </div>

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
              <strong>Mantener sesión iniciada</strong>
              <span style={{ display: 'block', color: 'var(--gray-secondary)', fontSize: '12px', marginTop: '3px' }}>
                {mantener
                  ? `No tendrás que volver a entrar durante ${describirDuracion(DURACION_LARGA_MS)}.`
                  : `La sesión se cierra a las ${describirDuracion(DURACION_CORTA_MS)}.`}
              </span>
            </span>
          </label>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '18px' }}>
          <span style={{ color: 'var(--gray-secondary)', fontSize: '14px' }}>¿No tienes cuenta? </span>
          <button
            onClick={onIrARegistro}
            style={{ color: 'var(--gold-dark)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
          >
            Regístrate aquí
          </button>
        </div>
      </div>
    </div>
  )
}
