'use client'

import { apiFetch } from '@/lib/api-client'

import { useState, FormEvent } from 'react'

interface Message {
  type: 'success' | 'error'
  text: string
}

export default function SetupPage() {
  const [email, setEmail] = useState('admin@beraca.com')
  const [password, setPassword] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const handleCreateAdmin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await apiFetch('/api/setup/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-setup-token': setupToken,
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error })
      } else {
        setMessage({ type: 'success', text: 'Usuario admin creado. Ve a /login' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Error desconocido' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', padding: '16px' }}>
      <div style={{ backgroundColor: 'white', padding: 'clamp(20px, 6vw, 40px)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '400px' }}>
        <h1 style={{ marginTop: 0, marginBottom: '30px', textAlign: 'center', fontSize: '24px' }}>Setup - Crear Admin</h1>

        {message && (
          <div style={{ backgroundColor: message.type === 'success' ? '#efe' : '#fee', color: message.type === 'success' ? '#0a0' : '#c00', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontSize: '14px' }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleCreateAdmin}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="setupToken" style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>Setup Token</label>
            <input id="setupToken" type="password" value={setupToken} onChange={(e) => setSetupToken(e.target.value)} placeholder="Token de setup" required disabled={loading} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@beraca.com" required disabled={loading} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>Contraseña</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required disabled={loading} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', backgroundColor: loading ? '#ccc' : '#2563eb', color: 'white', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'default' : 'pointer' }}>
            {loading ? 'Creando...' : 'Crear Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}

