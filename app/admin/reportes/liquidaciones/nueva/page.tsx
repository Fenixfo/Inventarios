'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { fechaYHora } from '@/lib/fechas'
import { PermissionProtector } from '@/components/PermissionProtector'
import { pesos } from '@/lib/formato'
import {
  costoDeItem,
  PORCENTAJE_POR_DEFECTO,
  porcentajeValido,
  totalesDeLiquidacion,
} from '@/lib/liquidacion'

interface Vendedor {
  id: string
  email: string
  facturas: number
}

interface Item {
  id: string
  nombre: string
  cantidadM2: number
  precioUnitario: number
  subtotal: number
  cantidadConCosto: number
  costoUnitario: number | null
  pendiente: number
  productoExiste: boolean
  costoSugerido: number | null
}

interface Factura {
  id: string
  numeroFactura: string
  fecha: string
  estado: string
  cliente: string | null
  venta: number
  impuesto: number
  total: number
  items: Item[]
}

const celda = { padding: '6px 8px', fontSize: '12px' }

export default function NuevaLiquidacionPage() {
  const router = useRouter()

  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [vendedorId, setVendedorId] = useState('')
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [totalPendientes, setTotalPendientes] = useState(0)
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  // Costo unitario de lo vendido sin stock, por línea. Texto, como lo escribe la persona.
  const [costos, setCostos] = useState<Record<string, string>>({})
  const [porcentaje, setPorcentaje] = useState(String(PORCENTAJE_POR_DEFECTO))
  const [observaciones, setObservaciones] = useState('')

  const [cargando, setCargando] = useState(true)
  const [cargandoFacturas, setCargandoFacturas] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await apiFetch('/api/liquidaciones/pendientes')
        const datos = await res.json()
        if (!res.ok) throw new Error(datos.error || 'No se pudo cargar')
        setVendedores(datos.vendedores || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  const elegirVendedor = async (id: string) => {
    setVendedorId(id)
    setFacturas([])
    setSeleccionadas(new Set())
    setCostos({})
    setError(null)
    if (!id) return

    setCargandoFacturas(true)
    try {
      const res = await apiFetch(`/api/liquidaciones/pendientes?vendedorId=${id}`)
      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'No se pudieron cargar las facturas')

      const lista: Factura[] = datos.facturas || []
      setFacturas(lista)
      setTotalPendientes(datos.total || 0)
      // Todas marcadas: lo normal es liquidar todo lo que el vendedor tiene cobrado.
      setSeleccionadas(new Set(lista.map((f) => f.id)))

      // Lo vendido sin stock arranca con el costo actual del producto, si
      // existe (aunque tenga stock 0). Uno personalizado queda vacío.
      const iniciales: Record<string, string> = {}
      for (const f of lista) {
        for (const item of f.items) {
          if (item.pendiente > 0 && item.costoSugerido !== null) iniciales[item.id] = String(item.costoSugerido)
        }
      }
      setCostos(iniciales)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargandoFacturas(false)
    }
  }

  const alternar = (id: string) => {
    const nuevas = new Set(seleccionadas)
    if (nuevas.has(id)) nuevas.delete(id)
    else nuevas.add(id)
    setSeleccionadas(nuevas)
  }

  const costoPuesto = (itemId: string): number | null => {
    const texto = costos[itemId]
    if (texto === undefined || texto.trim() === '') return null
    const valor = Number(texto)
    return Number.isFinite(valor) && valor >= 0 ? valor : null
  }

  // Costo de cada factura con lo escrito hasta ahora; null si falta alguno.
  const costoDe = (f: Factura): number | null => {
    let suma = 0
    for (const item of f.items) {
      const valor = costoDeItem(item, costoPuesto(item.id))
      if (valor === null) return null
      suma += valor
    }
    return suma
  }

  const pct = Number(porcentaje)
  const elegidas = facturas.filter((f) => seleccionadas.has(f.id))
  const incompletas = elegidas.filter((f) => costoDe(f) === null)

  // Se calcula en cada render: son unas pocas facturas y memorizarlo no
  // servía, porque `elegidas` es una lista nueva cada vez.
  const totales = totalesDeLiquidacion(
    elegidas.map((f) => ({ venta: f.venta, costo: costoDe(f) ?? 0 })),
    porcentajeValido(pct) ? pct : 0
  )

  const puedeGuardar =
    elegidas.length > 0 && incompletas.length === 0 && porcentajeValido(pct) && !guardando

  const guardar = async () => {
    if (!puedeGuardar) return
    if (!window.confirm(
      `¿Liquidar ${elegidas.length} factura${elegidas.length !== 1 ? 's' : ''}? ` +
      `Se pagarán ${pesos(totales.pagoVendedor)} al vendedor y las facturas quedarán como liquidadas, sin poder cambiarse.`
    )) return

    setGuardando(true)
    setError(null)

    try {
      // Solo el costo de lo que estaba pendiente en las facturas elegidas.
      const costosEnviados: Record<string, number> = {}
      for (const f of elegidas) {
        for (const item of f.items) {
          if (item.pendiente > 0) costosEnviados[item.id] = costoPuesto(item.id)!
        }
      }

      const res = await apiFetch('/api/liquidaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendedorId,
          facturaIds: elegidas.map((f) => f.id),
          porcentaje: pct,
          costos: costosEnviados,
          observaciones,
        }),
      })

      const datos = await res.json()
      if (!res.ok) {
        throw new Error(datos.faltan ? `${datos.error}: ${datos.faltan.join(', ')}` : datos.error)
      }

      router.push(`/admin/reportes/liquidaciones/${datos.id}`)
    } catch (err: any) {
      setError(err.message || 'No se pudo liquidar')
      setGuardando(false)
    }
  }

  return (
    <PermissionProtector requiredPermission="liquidaciones.crear">
      <div className="card" style={{ maxWidth: 1100 }}>
        <div className="mb-4">
          <Link href="/admin/reportes/liquidaciones" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Liquidaciones
          </Link>
        </div>

        <h1 className="card-title mb-1" style={{ fontSize: 20 }}>Nueva liquidación</h1>
        <p className="mb-5 text-sm" style={{ color: 'var(--gray-secondary)' }}>
          Solo facturas pagadas o entregadas que aún no se han liquidado. Ganancia = venta sin
          impuesto − costo.
        </p>

        {error && <div className="alert-box error">{error}</div>}

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : vendedores.length === 0 ? (
          <p style={{ color: 'var(--gray-secondary)' }}>No hay facturas cobradas pendientes de liquidar.</p>
        ) : (
          <>
            <div className="flex gap-4 flex-wrap mb-5">
              <div>
                <label htmlFor="vendedor" className="field-label">Vendedor</label>
                <select
                  id="vendedor"
                  value={vendedorId}
                  onChange={(e) => elegirVendedor(e.target.value)}
                  className="field-select"
                  style={{ minWidth: '260px' }}
                >
                  <option value="">Elige un vendedor…</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.email} — {v.facturas} factura{v.facturas !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="porcentaje" className="field-label">Porcentaje del vendedor</label>
                <input
                  id="porcentaje"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={`field-input ${porcentajeValido(pct) ? '' : 'has-error'}`}
                  style={{ width: '110px' }}
                />{' '}
                %
              </div>
            </div>

            {cargandoFacturas && <p style={{ color: 'var(--gray-secondary)' }}>Cargando facturas...</p>}

            {facturas.length > 0 && (
              <>
                {totalPendientes > facturas.length && (
                  <p className="alert-box" style={{ fontSize: '13px' }}>
                    Se muestran las {facturas.length} más antiguas de {totalPendientes}. Las demás
                    quedan para la siguiente liquidación.
                  </p>
                )}

                {facturas.map((f) => {
                  const costo = costoDe(f)
                  const marcada = seleccionadas.has(f.id)

                  return (
                    <div
                      key={f.id}
                      style={{
                        border: `1px solid ${marcada && costo === null ? 'var(--gold)' : 'var(--gray-light)'}`,
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '12px',
                        opacity: marcada ? 1 : 0.55,
                        backgroundColor: 'var(--white-off)',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', cursor: 'pointer', marginBottom: '8px' }}>
                        <input type="checkbox" checked={marcada} onChange={() => alternar(f.id)} />
                        <strong>{f.numeroFactura}</strong>
                        <span style={{ color: 'var(--gray-secondary)', fontSize: '13px' }}>{fechaYHora(f.fecha)}</span>
                        <span style={{ fontSize: '13px' }}>{f.cliente || 'Cliente General'}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '13px' }}>
                          Venta {pesos(f.venta)} · Costo {costo === null ? '—' : pesos(costo)} · Ganancia{' '}
                          <strong style={{ color: costo !== null && f.venta - costo < 0 ? 'var(--status-red-solid)' : 'var(--status-green-text)' }}>
                            {costo === null ? '—' : pesos(f.venta - costo)}
                          </strong>
                        </span>
                      </label>

                      <div style={{ overflowX: 'auto' }}>
                        <table className="table-luxe">
                          <thead>
                            <tr>
                              <th style={celda}>Producto</th>
                              <th style={{ ...celda, textAlign: 'right' }}>Vendido</th>
                              <th style={{ ...celda, textAlign: 'right' }}>Con stock (costo al facturar)</th>
                              <th style={{ ...celda, textAlign: 'right' }}>Sin stock · costo unitario</th>
                              <th style={{ ...celda, textAlign: 'right' }}>Costo línea</th>
                            </tr>
                          </thead>
                          <tbody>
                            {f.items.map((item) => {
                              const valor = costoDeItem(item, costoPuesto(item.id))
                              const falta = item.pendiente > 0 && costoPuesto(item.id) === null

                              return (
                                <tr key={item.id}>
                                  <td style={celda}>
                                    {item.nombre}
                                    {!item.productoExiste && (
                                      <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--gray-secondary)' }}>(personalizado)</span>
                                    )}
                                  </td>
                                  <td style={{ ...celda, textAlign: 'right' }}>{item.cantidadM2}</td>
                                  <td style={{ ...celda, textAlign: 'right', color: 'var(--gray-secondary)' }}>
                                    {item.cantidadConCosto > 0
                                      ? `${item.cantidadConCosto} × ${pesos(item.costoUnitario ?? 0)}`
                                      : '—'}
                                  </td>
                                  <td style={{ ...celda, textAlign: 'right' }}>
                                    {item.pendiente > 0 ? (
                                      <span style={{ whiteSpace: 'nowrap' }}>
                                        {item.pendiente} ×{' '}
                                        <input
                                          type="number"
                                          min="0"
                                          step="100"
                                          aria-label={`Costo unitario de ${item.nombre} sin stock`}
                                          value={costos[item.id] ?? ''}
                                          onChange={(e) => setCostos({ ...costos, [item.id]: e.target.value })}
                                          onWheel={(e) => e.currentTarget.blur()}
                                          placeholder="Costo"
                                          disabled={!marcada}
                                          style={{
                                            width: '100px',
                                            padding: '4px 6px',
                                            border: `1px solid ${falta && marcada ? 'var(--gold)' : 'var(--gray-light)'}`,
                                            borderRadius: '4px',
                                            textAlign: 'right',
                                          }}
                                        />
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--gray-secondary)' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ ...celda, textAlign: 'right', fontWeight: 'bold' }}>
                                    {valor === null ? '—' : pesos(valor)}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}

                <div className="mb-4">
                  <label htmlFor="observaciones" className="field-label">Observaciones (opcional)</label>
                  <textarea
                    id="observaciones"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={2}
                    className="field-textarea"
                  />
                </div>

                <div style={{ backgroundColor: 'var(--status-green-bg)', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                    <div><div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Facturas</div><strong>{elegidas.length}</strong></div>
                    <div><div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Venta sin impuesto</div><strong>{pesos(totales.totalVenta)}</strong></div>
                    <div><div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Costo</div><strong>{pesos(totales.totalCosto)}</strong></div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Ganancia</div>
                      <strong style={{ color: totales.totalGanancia < 0 ? 'var(--status-red-solid)' : 'inherit' }}>{pesos(totales.totalGanancia)}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--gray-secondary)' }}>Pago al vendedor ({porcentajeValido(pct) ? pct : '—'}%)</div>
                      <strong style={{ fontSize: '18px', color: 'var(--status-green-text)' }}>{pesos(totales.pagoVendedor)}</strong>
                    </div>
                  </div>
                  {totales.totalGanancia < 0 && (
                    <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: 'var(--status-amber-text)' }}>
                      En conjunto se vendió a pérdida: no hay comisión, pero tampoco se le descuenta
                      nada al vendedor.
                    </p>
                  )}
                </div>

                {incompletas.length > 0 && (
                  <p style={{ fontSize: '13px', color: 'var(--status-amber-text)' }}>
                    Falta el costo de lo vendido sin stock en {incompletas.length} factura
                    {incompletas.length !== 1 ? 's' : ''} marcada{incompletas.length !== 1 ? 's' : ''} (en naranja).
                  </p>
                )}

                <button onClick={guardar} disabled={!puedeGuardar} className="btn-primary">
                  {guardando ? 'Liquidando...' : `Liquidar ${elegidas.length} factura${elegidas.length !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
