'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { Header } from '@/components/Layout/Header'

export default function RecuperarPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      // Un correo que no existe no se distingue de uno que sí: así nadie
      // puede averiguar qué cuentas hay. Solo se avisa de fallos reales
      // (límite de envíos, sin conexión).
      if (resetError && resetError.status !== 400 && resetError.status !== 422) throw resetError

      setEnviado(true)
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar el correo')
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
          <h1 style={{ margin: '0 0 6px 0', fontSize: '28px', fontWeight: 'bold', textAlign: 'center', color: 'var(--black-primary)' }}>
            Recuperar contraseña
          </h1>
          <p style={{ margin: '0 0 24px 0', textAlign: 'center', color: 'var(--gray-secondary)', fontSize: '14px' }}>
            Te enviaremos un enlace para crear una nueva.
          </p>

          {error && <div className="alert-box error">{error}</div>}

          {enviado ? (
            <div className="alert-box" style={{ fontSize: '14px' }}>
              Si el correo está registrado, recibirás un enlace para cambiar tu contraseña. Revisa también la carpeta de spam.
            </div>
          ) : (
            <form onSubmit={enviar}>
              <div className="mb-5">
                <label htmlFor="email" className="field-label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  autoFocus
                  disabled={loading}
                  className="field-input"
                />
              </div>

              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
          )}

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px' }}>
            <Link href="/login" style={{ color: 'var(--gold-dark)', textDecoration: 'none', fontWeight: 600 }}>
              ← Volver a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
