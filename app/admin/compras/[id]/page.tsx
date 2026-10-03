'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { fechaYHora, soloFecha } from '@/lib/fechas'
import { pesos } from '@/lib/formato'
import { PermissionProtector } from '@/components/PermissionProtector'
import { usePermisos } from '@/components/PermisosProvider'

interface Detalle {
  id: string
  fecha: string
  numeroFacturaProveedor: string | null
  estado: 'registrada' | 'anulada'
  metodoReparto: 'valor' | 'cantidad'
  observaciones: string | null
  proveedor: { id: string; nombre: string; nit: string | null }
  autor: string | null
  subtotal: number
  totalExtras: number
  total: number
  anuladaPor: string | null
  anuladaEn: string | null
  motivoAnulacion: string | null
  costosExtra: { id: string; concepto: string; valor: number }[]
  items: {
    id: string
    productoId: string
    sku: string
    productoNombre: string
    productoCreado: boolean
    cantidad: number
    precioFactura: number
    costoExtra: number
    costoFinal: number
    costoEditado: boolean
  }[]
}

export default function CompraPage() {
  const params = useParams()
  const id = params.id as string
  const { puede } = usePermisos()

  const [compra, setCompra] = useState<Detalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Anular
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorAnular, setErrorAnular] = useState<string | null>(null)
  const [recienAnulada, setRecienAnulada] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/compras/${id}`)
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(datos.error || 'Compra no encontrada')
      setCompra(datos)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compra no encontrada')
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  const anular = async () => {
    if (enviando) return
    if (!motivo.trim()) return setErrorAnular('Escribe el motivo de la anulación.')

    if (
      !window.confirm(
        '¿Anular esta compra?\n\nSe restará del inventario el stock que sumó. El costo de los productos NO se restaura: tendrás que revisarlo.'
      )
    ) {
      return
    }

    setEnviando(true)
    setErrorAnular(null)

    try {
      const res = await apiFetch(`/api/compras/${id}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      })
      const datos = await res.json().catch(() => ({}))
      // Si falta stock, el mensaje del servidor dice qué producto y cuánto.
      if (!res.ok) throw new Error(datos.error || 'No se pudo anular la compra')

      setAnulando(false)
      setMotivo('')
      setRecienAnulada(true)
      await cargar()
    } catch (err) {
      setErrorAnular(err instanceof Error ? err.message : 'No se pudo anular la compra')
    } finally {
      setEnviando(false)
    }
  }

  const celda = { padding: '6px 8px', fontSize: 13 }

  return (
    <PermissionProtector requiredPermission="compras">
      <div className="card" style={{ maxWidth: 1000 }}>
        <div className="mb-4">
          <Link href="/admin/compras" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Compras
          </Link>
        </div>

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : error || !compra ? (
          <p style={{ color: 'var(--status-red-solid)' }}>{error || 'Compra no encontrada'}</p>
        ) : (
          <>
            <div className="card-header">
              <div>
                <h1 className="card-title" style={{ fontSize: 20, margin: 0 }}>
                  Compra a {compra.proveedor.nombre}
                  {compra.estado === 'anulada' && (
                    <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--status-red-solid)' }}>ANULADA</span>
                  )}
                </h1>
                <p style={{ margin: '4px 0 0 0', color: 'var(--gray-secondary)', fontSize: 14 }}>
                  {soloFecha(compra.fecha)}
                  {compra.numeroFacturaProveedor && ` · Factura ${compra.numeroFacturaProveedor}`}
                  {compra.proveedor.nit && ` · NIT ${compra.proveedor.nit}`}
                  {compra.autor && ` · registrada por ${compra.autor}`}
                </p>
              </div>

              {puede('compras.anular') && compra.estado === 'registrada' && !anulando && (
                <button type="button" onClick={() => setAnulando(true)} className="btn-action danger">
                  Anular compra
                </button>
              )}
            </div>

            {recienAnulada && (
              <div className="alert-box">
                Compra anulada: el stock que sumó ya se restó del inventario. <strong>Revisa el costo de los
                productos</strong>: la anulación no lo restaura.
              </div>
            )}

            {anulando && (
              <div
                className="mb-5"
                style={{ border: '1px solid var(--status-red-solid)', borderRadius: 8, padding: 16, backgroundColor: 'var(--white-off)' }}
              >
                <h2 className="card-title mb-2" style={{ fontSize: 15 }}>Anular esta compra</h2>
                <p className="mb-3 text-sm" style={{ color: 'var(--gray-secondary)' }}>
                  Se restará del inventario el stock que sumó cada línea. Si algún producto ya se vendió y no
                  alcanza, no se anula nada. El costo de los productos no se restaura.
                </p>
                {errorAnular && <div className="alert-box error">{errorAnular}</div>}
                <label htmlFor="motivo-anulacion" className="field-label">Motivo *</label>
                <textarea
                  id="motivo-anulacion"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  className="field-textarea mb-3"
                />
                <div className="flex gap-3 flex-wrap">
                  <button type="button" onClick={anular} disabled={enviando} className="btn-primary">
                    {enviando ? 'Anulando...' : 'Confirmar anulación'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnulando(false)
                      setErrorAnular(null)
                    }}
                    disabled={enviando}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {compra.estado === 'anulada' && (
              <p style={{ backgroundColor: 'var(--beige-light)', padding: 12, borderRadius: 8 }}>
                <strong>Anulada</strong>
                {compra.anuladaEn && ` el ${fechaYHora(compra.anuladaEn)}`}
                {compra.anuladaPor && ` por ${compra.anuladaPor}`}
                {compra.motivoAnulacion && <>. <strong>Motivo:</strong> {compra.motivoAnulacion}</>}
              </p>
            )}

            <div
              style={{ backgroundColor: 'var(--status-green-bg)', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, margin: '16px 0' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Subtotal de la factura</div><strong>{pesos(compra.subtotal)}</strong></div>
                <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Costos adicionales</div><strong>{pesos(compra.totalExtras)}</strong></div>
                <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Total</div><strong style={{ fontSize: 18 }}>{pesos(compra.total)}</strong></div>
              </div>
            </div>

            {compra.observaciones && (
              <p style={{ backgroundColor: 'var(--beige-light)', padding: 12, borderRadius: 8 }}>
                <strong>Observaciones:</strong> {compra.observaciones}
              </p>
            )}

            <h2 className="card-title mb-3" style={{ fontSize: 16 }}>Productos ({compra.items.length})</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th style={celda}>Producto</th>
                    <th style={{ ...celda, textAlign: 'right' }}>Cantidad</th>
                    <th style={{ ...celda, textAlign: 'right' }}>Precio de factura</th>
                    <th style={{ ...celda, textAlign: 'right' }}>Costos adicionales</th>
                    <th style={{ ...celda, textAlign: 'right' }}>Costo final</th>
                  </tr>
                </thead>
                <tbody>
                  {compra.items.map((i) => (
                    <tr key={i.id}>
                      <td style={celda}>
                        <Link href={`/admin/productos/${i.productoId}`} style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
                          {i.productoNombre}
                        </Link>
                        <div style={{ fontSize: 11, color: 'var(--gray-secondary)' }}>
                          SKU {i.sku}
                          {i.productoCreado && ' · creado en esta compra'}
                        </div>
                      </td>
                      <td style={{ ...celda, textAlign: 'right' }}>{i.cantidad}</td>
                      <td style={{ ...celda, textAlign: 'right' }}>{pesos(i.precioFactura)}</td>
                      <td style={{ ...celda, textAlign: 'right' }}>{i.costoExtra > 0 ? pesos(i.costoExtra) : '—'}</td>
                      <td style={{ ...celda, textAlign: 'right', fontWeight: 'bold' }}>
                        {pesos(i.costoFinal)}
                        {i.costoEditado && <div style={{ fontSize: 11, fontWeight: 'normal', color: 'var(--gray-secondary)' }}>ajustado a mano</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {compra.costosExtra.length > 0 && (
              <>
                <h2 className="card-title mb-3 mt-5" style={{ fontSize: 16 }}>
                  Costos adicionales (repartidos por {compra.metodoReparto === 'valor' ? 'valor' : 'cantidad'})
                </h2>
                <table className="table-luxe">
                  <tbody>
                    {compra.costosExtra.map((e) => (
                      <tr key={e.id}>
                        <td style={celda}>{e.concepto}</td>
                        <td style={{ ...celda, textAlign: 'right' }}>{pesos(e.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
