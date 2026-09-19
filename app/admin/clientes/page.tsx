'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Cliente {
  id: string
  nombre: string
  email?: string
  telefono?: string
  cedulaCc?: string
  terminoPago?: string
  limiteCredito: number
  ultimaCompraFecha?: string
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await fetch('/api/clientes')
        if (!res.ok) throw new Error('Error fetching clientes')
        const data = await res.json()
        setClientes(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchClientes()
  }, [])

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Clientes</h1>
        <Link href="/admin/clientes/nuevo" style={{
          padding: '10px 20px',
          backgroundColor: '#2563eb',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '4px'
        }}>
          Nuevo Cliente
        </Link>
      </div>

      {clientes.length === 0 ? (
        <p style={{ color: '#666' }}>No hay clientes registrados</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}>Nombre</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Teléfono</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Cédula</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Término de Pago</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Límite Crédito</th>
              <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{cliente.nombre}</td>
                <td style={{ padding: '10px' }}>{cliente.email || '-'}</td>
                <td style={{ padding: '10px' }}>{cliente.telefono || '-'}</td>
                <td style={{ padding: '10px' }}>{cliente.cedulaCc || '-'}</td>
                <td style={{ padding: '10px' }}>{cliente.terminoPago || '-'}</td>
                <td style={{ padding: '10px', textAlign: 'right' }}>${Number(cliente.limiteCredito).toFixed(2)}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <Link href={`/admin/clientes/${cliente.id}`} style={{
                    color: '#2563eb',
                    textDecoration: 'none',
                    marginRight: '10px'
                  }}>
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
