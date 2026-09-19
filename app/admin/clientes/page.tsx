'use client'

import { apiFetch } from '@/lib/api-client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'

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
  const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchCedula, setSearchCedula] = useState('')

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await apiFetch('/api/clientes')
        if (!res.ok) throw new Error('Error fetching clientes')
        const data = await res.json()
        setClientes(data)
        setFilteredClientes(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchClientes()
  }, [])

  const handleSearch = (value: string) => {
    setSearchCedula(value)
    if (value.trim() === '') {
      setFilteredClientes(clientes)
    } else {
      const termino = value.toLowerCase()
      const filtered = clientes.filter(c =>
        c.cedulaCc?.toLowerCase().includes(termino) ||
        c.nombre?.toLowerCase().includes(termino)
      )
      setFilteredClientes(filtered)
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Cargando...</div>
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>

  return (
    <PermissionProtector requiredPermission="clientes">
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

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por cédula o nombre..."
          value={searchCedula}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '10px 12px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            fontSize: '14px'
          }}
        />
        {searchCedula && (
          <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#666' }}>
            Se encontraron {filteredClientes.length} resultado(s)
          </p>
        )}
      </div>

      {clientes.length === 0 ? (
        <p style={{ color: '#666' }}>No hay clientes registrados</p>
      ) : filteredClientes.length === 0 ? (
        <p style={{ color: '#666' }}>No se encontraron clientes con ese criterio de búsqueda</p>
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
            {filteredClientes.map((cliente) => (
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
    </PermissionProtector>
  )
}

