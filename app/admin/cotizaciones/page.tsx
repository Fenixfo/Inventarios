'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PermissionProtector } from '@/components/PermissionProtector'
import { BuscadorEnter } from '@/components/Common/BuscadorEnter'
import { usePermisos } from '@/components/PermisosProvider'
import { fechaYHora } from '@/lib/fechas'
import { useListaPaginada } from '@/lib/use-lista-paginada'

interface Cotizacion {
  id: string
  numeroCotizacion: string
  fecha: string
  total: number
  cliente?: { nombre: string; cedulaCc?: string } | null
  usuario?: { email: string } | null
}

export default function CotizacionesPage() {
  const { puede } = usePermisos()
  const [busqueda, setBusqueda] = useState('')

  // Las 10 más recientes y el resto con "Ver más". La búsqueda va al
  // servidor, y quien no ve las de toda la tienda busca entre las suyas.
  const { items: cotizaciones, total, cargando, cargandoMas, error, verMas, hayMas } =
    useListaPaginada<Cotizacion>('/api/cotizaciones', 'cotizaciones', { busqueda })

  return (
    <PermissionProtector requiredPermission="cotizaciones">
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>Cotizaciones</h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '13px' }}>
              No descuentan inventario ni llevan abonos: solo quedan guardadas.
            </p>
          </div>
          {puede('cotizaciones.crear') && (
            <Link href="/admin/cotizaciones/nueva" style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
            }}>
              Nueva Cotización
            </Link>
          )}
        </div>

        <div style={{ marginBottom: '20px', maxWidth: '500px' }}>
          <BuscadorEnter
            onBuscar={setBusqueda}
            etiqueta="Buscar"
            placeholder="Número, cliente o cédula"
          />
        </div>

        {error && <p style={{ color: '#dc2626' }}>Error: {error}</p>}

        {cargando ? (
          <p style={{ color: '#666' }}>Cargando...</p>
        ) : cotizaciones.length === 0 ? (
          <p style={{ color: '#666' }}>
            {busqueda ? 'No hay cotizaciones que coincidan con la búsqueda' : 'Aún no hay cotizaciones'}
          </p>
        ) : (
          <>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 10px 0' }}>
              {busqueda
                ? `Mostrando ${cotizaciones.length} de ${total} que coinciden`
                : `Mostrando las ${cotizaciones.length} más recientes de ${total}`}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Número</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Cliente</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Fecha y hora</th>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Vendedor</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}><strong>{c.numeroCotizacion}</strong></td>
                      <td style={{ padding: '10px' }}>{c.cliente?.nombre || 'Cliente General'}</td>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{fechaYHora(c.fecha)}</td>
                      <td style={{ padding: '10px', color: '#6b7280' }}>{c.usuario?.email || '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>${Number(c.total).toFixed(2)}</td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <Link href={`/admin/cotizaciones/${c.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                          Ver
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
                  {cargandoMas ? 'Cargando...' : `Ver más (${total - cotizaciones.length} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
