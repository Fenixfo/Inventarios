'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/api-client'

interface Props {
  onCerrar: () => void
  onIrALogin: () => void
}

/**
 * Modal de registro de la portada. Misma lógica que app/signup/page.tsx.
 *
 * Al terminar no redirige a /login (aquí ya estamos en la portada): muestra
 * el éxito y ofrece pasar directo al modal de inicio de sesión.
 */
export function RegisterModal({ onCerrar, onIrALogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccess(true)
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || 'Error al registrarse')
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
        aria-label="Registrarse"
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
          Registrarse
        </h1>
        <p style={{ margin: '0 0 24px 0', textAlign: 'center', color: 'var(--gray-secondary)', fontSize: '14px' }}>
          Crea tu tienda en Beraca
        </p>

        {error && <div className="alert-box error">{error}</div>}

        {success ? (
          <>
            <div className="alert-box success">✅ Cuenta creada. Ya puedes iniciar sesión.</div>
            <button onClick={onIrALogin} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
              Iniciar sesión
            </button>
          </>
        ) : (
          <>
            <form onSubmit={handleSignup}>
              <div className="mb-4">
                <label htmlFor="reg-email" className="field-label">Email</label>
                <input
                  id="reg-email"
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
                <label htmlFor="reg-password" className="field-label">Contraseña</label>
                <input
                  id="reg-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="field-input"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="reg-confirm" className="field-label">Confirmar Contraseña</label>
                <input
                  id="reg-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="field-input"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Registrando...' : 'Registrarse'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <span style={{ color: 'var(--gray-secondary)', fontSize: '14px' }}>¿Ya tienes cuenta? </span>
              <button
                onClick={onIrALogin}
                style={{ color: 'var(--gold-dark)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
              >
                Inicia sesión aquí
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
