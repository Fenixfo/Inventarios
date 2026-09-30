'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { mensajeFactura } from '@/lib/whatsapp'
import { fechaYHora } from '@/lib/fechas'
import { apiFetch } from '@/lib/api-client'
import { pesos } from '@/lib/formato'
import { abrirPdfEnPestana, compartirPdf } from '@/lib/pdf-navegador'
import { PermissionProtector } from '@/components/PermissionProtector'
import { usePermisos } from '@/components/PermisosProvider'
import { DialogoEnvioWhatsApp } from '@/components/Common/DialogoEnvioWhatsApp'
import { PanelPagos, type AbonoRegistrado } from '@/components/factura/PanelPagos'

interface FacturaItem {
  id: string
  productoNombre?: string | null
  producto?: {
    nombre: string
  } | null
  cantidadM2: number
  precioUnitario: number
  subtotal: number
}

interface Factura {
  id: string
  numeroFactura: string
  cliente?: {
    nombre: string
    telefono?: string | null
  }
  /** Quién la registró. */
  usuario?: {
    id: string
    email: string
    nombre?: string | null
  }
  /** A nombre de quién se vendió. */
  vendedor?: {
    id: string
    email: string
    nombre?: string | null
    telefono?: string | null
  }
  fecha: string
  terminoPago?: string
  metodoPago?: string
  subtotal: number
  descuentoPorcentaje: number
  descuentoMonto: number
  impuesto: number
  total: number
  anticipo: number
  contraEntrega: number
  estado: string
  esBodega?: boolean
  observaciones?: string
  items: FacturaItem[]
}

const COLORES_ESTADO: Record<string, string> = {
  pagado: 'var(--status-blue-text)',
  entregado: 'var(--status-teal-text)',
  anulado: 'var(--status-red-solid)',
  // El final de una factura cobrada: ya se repartió la ganancia.
  liquidado: 'var(--status-indigo-text)',
  pendiente: 'var(--status-amber-text)',
}

const formatearEstado = (estado: string) => estado.charAt(0).toUpperCase() + estado.slice(1)

const estiloBoton = (fondo: string): React.CSSProperties => ({
  padding: '10px 20px',
  backgroundColor: fondo,
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 600,
})

/**
 * Detalle de una factura: datos, productos, pagos y acciones.
 *
 * Los pagos están en components/factura/PanelPagos y el envío por WhatsApp
 * en components/Common/DialogoEnvioWhatsApp (compartido con la cotización).
 * Antes todo vivía aquí, en una función de ~900 líneas.
 */
export default function FacturaPage() {
  const params = useParams()
  const id = params.id as string
  const { puede } = usePermisos()
  // Sin este permiso se ve la factura pero no se puede abonar ni cambiar el
  // estado a pagada/entregada; anular sigue aparte, con facturas.anular.
  const puedeAbonar = puede('facturas.abonar')

  const [factura, setFactura] = useState<Factura | null>(null)
  const [abonos, setAbonos] = useState<AbonoRegistrado[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [envioWhatsApp, setEnvioWhatsApp] = useState(false)

  useEffect(() => {
    const fetchFactura = async () => {
      try {
        // El usuario sale del token: el ?email= que se mandaba ya no se usaba.
        const res = await apiFetch(`/api/facturas/${id}`)
        if (!res.ok) {
          throw new Error(res.status === 403 ? 'No tienes permiso para ver esta factura' : 'Factura no encontrada')
        }
        setFactura(await res.json())

        const abonosRes = await apiFetch(`/api/abonos/${id}`)
        if (abonosRes.ok) {
          const abonosData: AbonoRegistrado[] = await abonosRes.json()
          setAbonos((abonosData || []).map((a) => ({ ...a, monto: Number(a.monto) })))
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la factura')
      } finally {
        setLoading(false)
      }
    }

    fetchFactura()
  }, [id])

  // Cuando un abono completa el total, el servidor pasa la factura a
  // "pagado" en la misma operación y lo dice en la respuesta. Antes lo
  // decidía un efecto al abrir la factura: lo disparaba quien la estuviera
  // mirando, y dos pestañas abiertas mandaban el cambio dos veces.
  const reflejarEstado = (estadoNuevo?: string) => {
    if (!estadoNuevo) return
    setFactura((previa) => (previa ? { ...previa, estado: estadoNuevo } : previa))
  }

  /** Registra un abono. Devuelve true si quedó guardado. */
  const registrarAbono = async (monto: number): Promise<boolean> => {
    if (!factura) return false

    setSaving(true)
    setError(null)

    try {
      // Quién abona sale del token: el ?email= que se mandaba ya no se usaba.
      const res = await apiFetch('/api/abonos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facturaId: factura.id, monto }),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'Error al agregar abono')

      setAbonos((previos) => [...previos, { monto: Number(datos.monto), fecha: datos.fecha }])
      // Si este abono completó el total, el servidor ya la marcó pagada.
      reflejarEstado(datos.estado)
      return true
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al agregar abono')
      return false
    } finally {
      setSaving(false)
    }
  }

  const cambiarEstado = async (estadoNuevo: string) => {
    if (!factura) return

    setSaving(true)
    setError(null)

    try {
      const res = await apiFetch('/api/facturas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...factura, estado: estadoNuevo }),
      })

      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error || 'No se pudo cambiar el estado')
      setFactura(datos)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado')
    } finally {
      setSaving(false)
    }
  }

  const anular = async () => {
    if (!window.confirm('¿Anular esta factura?')) return
    await cambiarEstado('anulado')
  }

  if (loading) return <div className="card" style={{ color: 'var(--gray-secondary)' }}>Cargando...</div>
  if (!factura) return <div className="card" style={{ color: 'var(--status-red-solid)' }}>{error || 'Factura no encontrada'}</div>

  const totalAbonado = Number(factura.anticipo || 0) + abonos.reduce((suma, a) => suma + Number(a.monto), 0)
  const saldoPendiente = Number(factura.total) - totalAbonado

  /**
   * Marcar la factura como pagada salda lo que falte.
   *
   * Antes el estado pasaba a "pagado" pero el saldo seguía mostrando deuda:
   * la factura se daba por cobrada sin que ese dinero apareciera en ningún
   * abono, así que los totales de caja no cuadraban con los estados.
   */
  const marcarPagado = async () => {
    // Ya saldada (por ejemplo, una de antes de este cambio): solo el estado.
    if (saldoPendiente <= 0) await cambiarEstado('pagado')
    else await registrarAbono(saldoPendiente)
  }

  /**
   * Abre el PDF en una pestaña nueva, el mismo archivo que se comparte.
   *
   * Antes se pedía un HTML y se escribía con document.write en una pestaña
   * del mismo origen que el panel, con los datos del cliente sin escapar:
   * un nombre con código se ejecutaba al abrir la factura.
   */
  const descargarPdf = async () => {
    try {
      await abrirPdfEnPestana(`/api/facturas/${id}/pdf`, 'Generando la factura…')
    } catch (err: unknown) {
      alert('Error al generar el PDF: ' + (err instanceof Error ? err.message : ''))
    }
  }

  return (
    <PermissionProtector requiredPermission="facturas">
      <div className="card" style={{ maxWidth: 900 }}>
        <div className="mb-4">
          <Link href="/admin/facturas" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Facturas
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 10px 0', color: 'var(--black-primary)' }}>{factura.numeroFactura}</h1>
            <p style={{ margin: '5px 0', color: 'var(--gray-secondary)' }}>{fechaYHora(factura.fecha)}</p>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Marca por qué los precios de esta factura son distintos. */}
            {factura.esBodega && <span className="badge badge-amber" style={{ padding: '8px 12px', fontSize: 14 }}>🏭 Precio de bodega</span>}
            <span
              className="badge"
              style={{ padding: '8px 12px', fontSize: 14, backgroundColor: COLORES_ESTADO[factura.estado] || COLORES_ESTADO.pendiente, color: 'white' }}
            >
              {formatearEstado(factura.estado)}
            </span>
          </div>
        </div>

        {error && <div className="alert-box error">{error}</div>}

        <div style={{ backgroundColor: 'var(--beige-light)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p style={{ margin: '0 0 5px 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>CLIENTE</p>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{factura.cliente?.nombre || 'Cliente General'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>VENDEDOR</p>
              <p style={{ margin: 0 }}>
                {factura.vendedor?.nombre || factura.vendedor?.email || factura.usuario?.email || '-'}
              </p>
              {factura.vendedor?.telefono && (
                <p style={{ margin: '2px 0 0 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>
                  Tel: {factura.vendedor.telefono}
                </p>
              )}
              {/* Si la registró otra persona a su nombre, se deja a la vista. */}
              {factura.vendedor && factura.usuario && factura.vendedor.id !== factura.usuario.id && (
                <p style={{ margin: '2px 0 0 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>
                  Registrada por {factura.usuario.nombre || factura.usuario.email}
                </p>
              )}
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>TÉRMINO DE PAGO</p>
              <p style={{ margin: 0 }}>{factura.terminoPago || '-'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', color: 'var(--gray-secondary)', fontSize: '12px' }}>MÉTODO DE PAGO</p>
              <p style={{ margin: 0 }}>{factura.metodoPago || '-'}</p>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table className="table-luxe">
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ textAlign: 'right' }}>Cantidad (m²)</th>
                <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {factura.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.productoNombre || item.producto?.nombre || '(Personalizado)'}</td>
                  <td style={{ textAlign: 'right' }}>{Number(item.cantidadM2).toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{pesos(item.precioUnitario)}</td>
                  <td style={{ textAlign: 'right' }}>{pesos(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ backgroundColor: 'var(--beige-light)', padding: '15px', borderRadius: '8px', marginBottom: '20px', maxWidth: '400px', marginLeft: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Subtotal:</span>
            <span>{pesos(factura.subtotal)}</span>
          </div>
          {factura.descuentoMonto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'var(--status-red-solid)' }}>
              <span>Descuento ({factura.descuentoPorcentaje}%):</span>
              <span>-{pesos(factura.descuentoMonto)}</span>
            </div>
          )}
          {factura.impuesto > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'var(--status-blue-text)' }}>
              <span>Impuesto:</span>
              <span>+{pesos(factura.impuesto)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', borderTop: '2px solid var(--gray-light)', paddingTop: '10px', color: 'var(--gold-dark)' }}>
            <span>Total:</span>
            <span>{pesos(factura.total)}</span>
          </div>
        </div>

        {factura.observaciones && (
          <div style={{ backgroundColor: 'var(--beige-light)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 5px 0', color: 'var(--gray-secondary)', fontWeight: 'bold' }}>Observaciones:</p>
            <p style={{ margin: 0 }}>{factura.observaciones}</p>
          </div>
        )}

        <PanelPagos
          total={Number(factura.total)}
          anticipo={Number(factura.anticipo || 0)}
          abonos={abonos}
          puedeAbonar={factura.estado === 'pendiente' && puedeAbonar}
          guardando={saving}
          onRegistrarAbono={registrarAbono}
        />

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
          {factura.estado === 'pendiente' && (
            <>
              {puedeAbonar && (
                <button
                  onClick={marcarPagado}
                  disabled={saving}
                  title={
                    saldoPendiente > 0
                      ? `Se registrará un abono de ${pesos(saldoPendiente)} para dejar el saldo en cero`
                      : 'La factura ya está saldada'
                  }
                  style={estiloBoton('var(--status-green-text)')}
                >
                  {saving
                    ? 'Procesando...'
                    : saldoPendiente > 0
                      ? `Marcar como Pagado (abona ${pesos(saldoPendiente)})`
                      : 'Marcar como Pagado'}
                </button>
              )}

              <button onClick={anular} disabled={saving} style={estiloBoton('var(--status-red-solid)')}>
                {saving ? 'Procesando...' : 'Anular Factura'}
              </button>
            </>
          )}

          {factura.estado === 'pagado' && puedeAbonar && (
            <button onClick={() => cambiarEstado('entregado')} disabled={saving} style={estiloBoton('var(--status-teal-text)')}>
              {saving ? 'Procesando...' : 'Marcar como Entregado'}
            </button>
          )}

          <button onClick={descargarPdf} style={estiloBoton('var(--gold-dark)')}>
            Descargar PDF
          </button>

          <button onClick={() => setEnvioWhatsApp(true)} style={{ ...estiloBoton('#25d366'), fontWeight: 'bold' }}>
            Enviar factura por WhatsApp
          </button>
        </div>

        {envioWhatsApp && (
          <DialogoEnvioWhatsApp
            documento={`la factura ${factura.numeroFactura}`}
            sinTelefono="Esta factura no tiene teléfono registrado."
            telefonoCliente={factura.cliente?.telefono}
            nombreCliente={factura.cliente?.nombre}
            mensaje={mensajeFactura(factura, { totalAbonado, saldoPendiente })}
            onCompartirPdf={() => compartirPdf(`/api/facturas/${id}/pdf`, `Factura-${factura.numeroFactura}.pdf`)}
            onCerrar={() => setEnvioWhatsApp(false)}
          />
        )}
      </div>
    </PermissionProtector>
  )
}
