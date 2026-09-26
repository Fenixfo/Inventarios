'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { BuscadorEnter } from '@/components/Common/BuscadorEnter'
import { useListaPaginada } from '@/lib/use-lista-paginada'

interface Cliente {
  id: string
  nombre: string
  email?: string
  telefono?: string
  cedulaCc?: string
  terminoPago?: string
  limiteCredito: number
}

export default function ClientesPage() {
  const [busqueda, setBusqueda] = useState('')

  // Los 10 más recientes y el resto con "Ver más". La búsqueda va al
  // servidor: filtrar en pantalla solo miraría los 10 cargados.
  const { items: clientes, total, cargando, cargandoMas, error, verMas, hayMas } =
    useListaPaginada<Cliente>('/api/clientes', 'clientes', { busqueda })

  return (
    <PermissionProtector requiredPermission="clientes">
      <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

      <div style={{ marginBottom: '20px', maxWidth: '500px' }}>
        <BuscadorEnter
          onBuscar={setBusqueda}
          etiqueta="Buscar"
          placeholder="Cédula o nombre"
        />
      </div>

      {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}

      {cargando ? (
        <p style={{ color: '#666' }}>Cargando...</p>
      ) : clientes.length === 0 ? (
        <p style={{ color: '#666' }}>
          {busqueda ? 'No se encontraron clientes con ese criterio de búsqueda' : 'No hay clientes registrados'}
        </p>
      ) : (
        <>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 10px 0' }}>
            {busqueda
              ? `Mostrando ${clientes.length} de ${total} que coinciden`
              : `Mostrando los ${clientes.length} más recientes de ${total}`}
          </p>

          <div style={{ overflowX: 'auto' }}>
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
                      }}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hayMas && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <button
                onClick={verMas}
                disabled={cargandoMas}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'white',
                  color: '#2563eb',
                  border: '1px solid #2563eb',
                  borderRadius: '4px',
                  cursor: cargandoMas ? 'wait' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {cargandoMas ? 'Cargando...' : `Ver más (${total - clientes.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </PermissionProtector>
  )
}
