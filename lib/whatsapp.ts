import { fechaYHora } from '@/lib/fechas'
import { montoEnPalabras } from '@/lib/numero-a-palabras'

/**
 * Enlaces de WhatsApp.
 *
 * WhatsApp no permite adjuntar archivos desde un enlace: solo se puede
 * abrir una conversación con un texto ya escrito. Por eso la factura se
 * envía como resumen, y el PDF se adjunta a mano si hace falta.
 */

const INDICATIVO_COLOMBIA = '57'

/**
 * Deja el número como lo espera wa.me: solo dígitos y con indicativo.
 *
 * Los teléfonos de los clientes se guardan como los escribió cada quien
 * ("300 123 4567", "+57 300-123-4567", "3001234567"). A los de diez
 * dígitos se les antepone el 57, que es lo que hay en Colombia; los que ya
 * traen indicativo se respetan tal cual, por si algún cliente es de fuera.
 *
 * Devuelve null si no parece un número utilizable, para no abrir WhatsApp
 * apuntando a una conversación que no existe.
 */
export function normalizarTelefono(valor: string | null | undefined): string | null {
  if (!valor) return null

  const digitos = valor.replace(/\D/g, '')

  if (digitos.length === 10) return `${INDICATIVO_COLOMBIA}${digitos}`
  if (digitos.length >= 11 && digitos.length <= 15) return digitos

  return null
}

/**
 * Enlace para abrir WhatsApp.
 *
 * Sin número devuelve el enlace "suelto": WhatsApp abre con el mensaje
 * escrito y deja elegir el destinatario. Es lo que se usa cuando la
 * factura no tiene teléfono.
 */
export function enlaceWhatsApp(numero: string | null, mensaje: string): string {
  const texto = encodeURIComponent(mensaje)
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`
}

export interface ItemFactura {
  productoNombre?: string | null
  cantidadM2: number | string
  precioUnitario: number | string
  subtotal: number | string
}

export interface FacturaParaMensaje {
  numeroFactura: string
  fecha: string | Date
  total: number | string
  cliente?: { nombre?: string | null } | null
  items?: ItemFactura[]
  esBodega?: boolean
}

function pesos(valor: number | string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(valor))
}

/**
 * Resumen de la factura para mandar por chat.
 *
 * Los asteriscos son el formato de negrita de WhatsApp. Se incluyen el
 * total abonado y el saldo porque es lo primero que pregunta el cliente.
 */
export function mensajeFactura(
  factura: FacturaParaMensaje,
  opciones: {
    empresa?: string
    totalAbonado?: number
    saldoPendiente?: number
    /** Una cotización no lleva abonos ni saldo: no se ha vendido nada. */
    tipo?: 'factura' | 'cotizacion'
  } = {}
): string {
  const { empresa = 'Beraca', tipo = 'factura' } = opciones
  const esCotizacion = tipo === 'cotizacion'
  const totalAbonado = esCotizacion ? undefined : opciones.totalAbonado
  const saldoPendiente = esCotizacion ? undefined : opciones.saldoPendiente

  const fecha = fechaYHora(factura.fecha)

  const lineas = [
    `*${empresa.toUpperCase()}*`,
    `*${esCotizacion ? 'Cotización' : 'Factura'} ${factura.numeroFactura}*`,
    `Fecha: ${fecha}`,
  ]

  if (factura.cliente?.nombre) lineas.push(`Cliente: ${factura.cliente.nombre}`)

  if (factura.items?.length) {
    lineas.push('', '*Detalle:*')
    factura.items.forEach((item, i) => {
      lineas.push(
        `${i + 1}. ${item.productoNombre || 'Producto'}`,
        `   ${Number(item.cantidadM2)} × ${pesos(item.precioUnitario)} = ${pesos(item.subtotal)}`
      )
    })
  }

  lineas.push('', `*TOTAL: ${pesos(factura.total)}*`, `Son: ${montoEnPalabras(factura.total)}`)

  if (totalAbonado !== undefined && totalAbonado > 0) {
    lineas.push(`Abonado: ${pesos(totalAbonado)}`)
  }

  if (saldoPendiente !== undefined) {
    lineas.push(
      saldoPendiente > 0
        ? `*Saldo pendiente: ${pesos(saldoPendiente)}*`
        : '*Factura cancelada en su totalidad*'
    )
  }

  lineas.push(
    '',
    esCotizacion ? 'Quedamos atentos a su confirmación.' : 'Gracias por su compra.'
  )

  return lineas.join('\n')
}
