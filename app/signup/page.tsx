'use client'

import { apiFetch } from '@/lib/api-client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import Link from 'next/link'
import { Header } from '@/components/Layout/Header'

export default function SignupPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

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
        body: JSON.stringify({ email, password, nombre, telefono }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error)
      }

      setSuccess(true)
      setNombre('')
      setTelefono('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        router.push('/login?registered=true')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Error al registrarse')
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
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: 'var(--black-primary)' }}>Registrarse</h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--gray-secondary)', fontSize: '14px' }}>Únete a Beraca</p>
          </div>

          {error && <div className="alert-box error">{error}</div>}
          {success && <div className="alert-box success">✅ Registro exitoso. Redirigiendo al login...</div>}

          <form onSubmit={handleSignup}>
            <div className="mb-5">
              <label htmlFor="nombre" className="field-label">Nombre (opcional)</label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                maxLength={120}
                disabled={loading}
                className="field-input"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="telefono" className="field-label">Teléfono (opcional)</label>
              <input
                id="telefono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="300 123 4567"
                maxLength={30}
                disabled={loading}
                className="field-input"
              />
            </div>

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

            <div className="mb-5">
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

            <div className="mb-6">
              <label htmlFor="confirmPassword" className="field-label">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
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

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--gray-secondary)' }}>
            <p style={{ margin: '10px 0' }}>
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" style={{ color: 'var(--gold-dark)', textDecoration: 'none', fontWeight: 600 }}>
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
