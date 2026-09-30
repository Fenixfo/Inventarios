'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'
import { Header } from '@/components/Layout/Header'

const MINIMO = 8

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  // null = todavía comprobando si el enlace trae una sesión de recuperación.
  const [enlaceValido, setEnlaceValido] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Supabase lee el enlace del correo y crea una sesión temporal; puede
    // tardar un instante, así que se escucha el evento además de consultar.
    const { data: suscripcion } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'PASSWORD_RECOVERY' || (evento === 'SIGNED_IN' && sesion)) setEnlaceValido(true)
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setEnlaceValido(true)
    })

    const limite = setTimeout(() => setEnlaceValido((actual) => actual ?? false), 3000)

    return () => {
      suscripcion.subscription.unsubscribe()
      clearTimeout(limite)
    }
  }, [])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MINIMO) return setError(`La contraseña debe tener al menos ${MINIMO} caracteres`)
    if (password !== confirmar) return setError('Las contraseñas no coinciden')

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      // Se cierra la sesión temporal: la persona entra con la contraseña nueva.
      await supabase.auth.signOut()
      setListo(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch (err: any) {
      setError(err.message || 'No se pudo cambiar la contraseña')
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
          <h1 style={{ margin: '0 0 24px 0', fontSize: '28px', fontWeight: 'bold', textAlign: 'center', color: 'var(--black-primary)' }}>
            Nueva contraseña
          </h1>

          {enlaceValido === null && <p style={{ textAlign: 'center', color: 'var(--gray-secondary)' }}>Verificando enlace...</p>}

          {enlaceValido === false && (
            <div className="alert-box error" style={{ fontSize: '14px' }}>
              El enlace no es válido o ya venció.{' '}
              <Link href="/recuperar" style={{ color: 'var(--gold-dark)', fontWeight: 600 }}>
                Pide uno nuevo
              </Link>
              .
            </div>
          )}

          {listo && (
            <div className="alert-box" style={{ fontSize: '14px' }}>
              Contraseña actualizada. Te llevamos a iniciar sesión...
            </div>
          )}

          {enlaceValido && !listo && (
            <>
              {error && <div className="alert-box error">{error}</div>}

              <form onSubmit={guardar}>
                <div className="mb-5">
                  <label htmlFor="password" className="field-label">Nueva contraseña</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    autoFocus
                    disabled={loading}
                    className="field-input"
                  />
                </div>

                <div className="mb-6">
                  <label htmlFor="confirmar" className="field-label">Repite la contraseña</label>
                  <input
                    id="confirmar"
                    type="password"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    required
                    disabled={loading}
                    className="field-input"
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  {loading ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  )
}
