'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'
import { soloFecha } from '@/lib/fechas'
import { pesos } from '@/lib/formato'
import { usePermisos } from '@/components/PermisosProvider'

interface CompraDelProducto {
  compraId: string
  fecha: string
  numeroFacturaProveedor: string | null
  estado: 'registrada' | 'anulada'
  proveedor: string
  cantidad: number
  precioFactura: number
  costoFinal: number
}

/**
 * Las compras en las que aparece un producto, para la ficha del producto.
 *
 * Es un complemento: si quien edita el producto no puede ver compras, o la
 * consulta falla, no se muestra nada y la edición sigue funcionando igual.
 */
export function HistorialDeCompras({ productoId }: { productoId: string }) {
  const { puede } = usePermisos()
  const autorizado = puede('compras.ver')

  const [compras, setCompras] = useState<CompraDelProducto[] | null>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (!autorizado) return

    let cancelado = false
    apiFetch(`/api/productos/${productoId}/compras`)
      .then(async (res) => {
        if (!res.ok) throw new Error('sin acceso')
        const datos = await res.json()
        if (!cancelado) setCompras(datos.compras || [])
      })
      .catch(() => {
        if (!cancelado) setFallo(true)
      })

    return () => {
      cancelado = true
    }
  }, [productoId, autorizado])

  // Sin permiso o con un error, la sección simplemente no aparece.
  if (!autorizado || fallo || compras === null) return null

  return (
    <section style={{ marginTop: 32 }} aria-label="Historial de compras">
      <h2 className="card-title mb-3" style={{ fontSize: 16 }}>Historial de compras</h2>

      {compras.length === 0 ? (
        <p style={{ color: 'var(--gray-secondary)' }}>Este producto todavía no aparece en ninguna compra.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table-luxe">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Factura</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th style={{ textAlign: 'right' }}>Precio de factura</th>
                <th style={{ textAlign: 'right' }}>Costo final</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => (
                <tr key={c.compraId} style={{ opacity: c.estado === 'anulada' ? 0.65 : 1 }}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link href={`/admin/compras/${c.compraId}`} style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
                      {soloFecha(c.fecha)}
                    </Link>
                  </td>
                  <td>{c.proveedor}</td>
                  <td>{c.numeroFacturaProveedor || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{c.cantidad}</td>
                  <td style={{ textAlign: 'right' }}>{pesos(c.precioFactura)}</td>
                  <td style={{ textAlign: 'right' }}>{pesos(c.costoFinal)}</td>
                  <td>
                    {c.estado === 'anulada' ? (
                      <span style={{ color: 'var(--status-red-solid)', fontWeight: 'bold' }}>Anulada</span>
                    ) : (
                      'Registrada'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
