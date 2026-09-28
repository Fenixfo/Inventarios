'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { BuscadorEnter } from '@/components/Common/BuscadorEnter'
import { useListaPaginada } from '@/lib/use-lista-paginada'
import { pesos } from '@/lib/formato'
import { VerMas } from '@/components/Common/VerMas'

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
      <div className="card">
        <div className="card-header">
          <h1 className="card-title" style={{ fontSize: 20 }}>Clientes</h1>
          <Link href="/admin/clientes/nuevo" className="btn-primary">
            + Nuevo Cliente
          </Link>
        </div>

        <div className="mb-5" style={{ maxWidth: 500 }}>
          <BuscadorEnter onBuscar={setBusqueda} etiqueta="Buscar" placeholder="Cédula o nombre" />
        </div>

        {error && <p style={{ color: 'var(--status-red-solid)' }}>Error: {error}</p>}

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : clientes.length === 0 ? (
          <p style={{ color: 'var(--gray-secondary)' }}>
            {busqueda ? 'No se encontraron clientes con ese criterio de búsqueda' : 'No hay clientes registrados'}
          </p>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: 'var(--gray-secondary)' }}>
              {busqueda
                ? `Mostrando ${clientes.length} de ${total} que coinciden`
                : `Mostrando los ${clientes.length} más recientes de ${total}`}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Cédula</th>
                    <th>Término de Pago</th>
                    <th style={{ textAlign: 'right' }}>Límite Crédito</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td>{cliente.nombre}</td>
                      <td>{cliente.email || '-'}</td>
                      <td>{cliente.telefono || '-'}</td>
                      <td>{cliente.cedulaCc || '-'}</td>
                      <td>{cliente.terminoPago || '-'}</td>
                      <td style={{ textAlign: 'right' }}>{pesos(cliente.limiteCredito)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/admin/clientes/${cliente.id}`} className="btn-action">
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hayMas && (
              <VerMas restantes={total - clientes.length} cargando={cargandoMas} onClick={verMas} />
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
