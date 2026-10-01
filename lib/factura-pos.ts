import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib'
import { fechaYHora } from '@/lib/fechas'
import { montoEnPalabras } from '@/lib/numero-a-palabras'
import { pesos } from '@/lib/formato'
import type { EmpresaPdf, FacturaPdf } from '@/lib/factura-pdf'

/**
 * La factura en formato tiquete POS de 80 mm, para impresoras térmicas.
 *
 * Es un PDF de una sola hoja de 80 mm de ancho y tan largo como haga falta:
 * el rollo corta donde termina el contenido. Se dibuja con pdf-lib como la
 * factura normal (texto, nada de HTML), así que abre y se imprime desde el
 * mismo visor del navegador.
 */

const MM = 72 / 25.4
const ANCHO = 80 * MM
// El área imprimible real de una térmica de 80 mm es de unos 72 mm.
const MARGEN = 4 * MM
const UTIL = ANCHO - MARGEN * 2
const NEGRO = rgb(0, 0, 0)

/** Mismo criterio que la factura A4: las fuentes estándar solo conocen WinAnsi. */
function limpiar(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/²/g, '2')
    .replace(/[^\x20-\x7E -ÿ]/g, '')
}

/** Parte el texto en líneas que quepan en el ancho; una palabra larga se corta. */
function envolver(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const medir = (t: string) => fuente.widthOfTextAtSize(t, tamano)
  const lineas: string[] = []
  let actual = ''

  for (const palabra of limpiar(texto).split(/\s+/).filter(Boolean)) {
    let resto = palabra
    while (medir(resto) > ancho && resto.length > 1) {
      let corte = resto.length - 1
      while (corte > 1 && medir(resto.slice(0, corte)) > ancho) corte--
      if (actual) {
        lineas.push(actual)
        actual = ''
      }
      lineas.push(resto.slice(0, corte))
      resto = resto.slice(corte)
    }

    const prueba = actual ? `${actual} ${resto}` : resto
    if (medir(prueba) <= ancho) {
      actual = prueba
    } else {
      lineas.push(actual)
      actual = resto
    }
  }

  if (actual) lineas.push(actual)
  return lineas
}

type Orden =
  | { tipo: 'texto'; texto: string; tamano: number; bold: boolean; alinear: 'izq' | 'centro' }
  | { tipo: 'fila'; izq: string; der: string; tamano: number; bold: boolean }
  | { tipo: 'linea' }
  | { tipo: 'espacio'; alto: number }

export async function generarPdfFacturaPos(factura: FacturaPdf, config: EmpresaPdf = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)

  const ordenes: Orden[] = []
  const texto = (t: string, tamano = 8, bold = false, alinear: 'izq' | 'centro' = 'izq') => {
    const fuente = bold ? negrita : normal
    for (const linea of envolver(t, fuente, tamano, UTIL)) {
      ordenes.push({ tipo: 'texto', texto: linea, tamano, bold, alinear })
    }
  }
  const fila = (izq: string, der: string, tamano = 8, bold = false) =>
    ordenes.push({ tipo: 'fila', izq, der, tamano, bold })
  const linea = () => ordenes.push({ tipo: 'linea' })
  const espacio = (alto = 4) => ordenes.push({ tipo: 'espacio', alto })

  // --- Encabezado ---
  texto(config.nombre_empresa || 'BERACA', 12, true, 'centro')
  if (config.eslogan_empresa) texto(config.eslogan_empresa, 7, false, 'centro')
  if (config.nit_empresa) texto(`NIT: ${config.nit_empresa}`, 8, false, 'centro')
  if (config.direccion_empresa) texto(config.direccion_empresa, 8, false, 'centro')
  if (config.telefono_empresa) texto(`Tel: ${config.telefono_empresa}`, 8, false, 'centro')
  espacio()
  linea()

  texto(`FACTURA ${factura.numeroFactura}`, 10, true, 'centro')
  texto(fechaYHora(factura.fecha), 8, false, 'centro')
  if (factura.esBodega) texto('Precio de bodega', 8, true, 'centro')
  espacio(2)

  const cliente = factura.cliente
  texto(`Cliente: ${cliente?.nombre || 'Consumidor final'}`, 8, true)
  if (cliente?.cedulaCc) texto(`CC/NIT: ${cliente.cedulaCc}`)
  if (cliente?.telefono) texto(`Tel: ${cliente.telefono}`)
  if (cliente?.direccion) texto(cliente.direccion)
  if (factura.vendedor && (factura.vendedor.nombre || factura.vendedor.email)) {
    texto(`Vendedor: ${factura.vendedor.nombre || factura.vendedor.email}`)
  }
  if (factura.vendedor?.telefono) texto(`Tel. vendedor: ${factura.vendedor.telefono}`)
  if (factura.terminoPago) texto(`Término: ${factura.terminoPago}`)
  if (factura.metodoPago) texto(`Método: ${factura.metodoPago}`)
  espacio()
  linea()

  // --- Items: nombre arriba, "cantidad x precio" y subtotal debajo ---
  fila('PRODUCTO', 'SUBTOTAL', 7, true)
  espacio(2)
  for (const item of factura.items) {
    texto(item.productoNombre || item.producto?.nombre || '(Sin nombre)', 8, true)
    fila(`${Number(item.cantidadM2).toFixed(2)} m2 x ${pesos(item.precioUnitario)}`, pesos(item.subtotal))
    espacio(3)
  }
  linea()

  // --- Totales ---
  const totalAbonado = Number(factura.anticipo || 0) + (factura.abonos || []).reduce((s, a) => s + Number(a.monto), 0)
  const saldo = Math.max(0, Number(factura.total) - totalAbonado)

  fila('Subtotal', pesos(factura.subtotal))
  if (Number(factura.descuentoMonto) > 0) fila('Descuento', `-${pesos(factura.descuentoMonto)}`)
  if (Number(factura.impuesto) > 0) fila('Impuesto', pesos(factura.impuesto))
  espacio(2)
  fila('TOTAL', pesos(factura.total), 11, true)
  if (totalAbonado > 0) fila('Abonado', pesos(totalAbonado))
  fila(saldo > 0 ? 'SALDO PENDIENTE' : 'PAGADA', pesos(saldo), 9, true)
  espacio()
  texto(`Son: ${montoEnPalabras(factura.total)}`, 7)

  if (factura.observaciones) {
    espacio()
    linea()
    texto('Observaciones:', 7, true)
    texto(factura.observaciones, 7)
  }

  espacio()
  linea()
  espacio(2)
  texto('Gracias por su compra', 9, true, 'centro')

  // --- Altura: se mide todo antes de crear la hoja ---
  const alturaDe = (o: Orden) => {
    if (o.tipo === 'texto' || o.tipo === 'fila') return o.tamano * 1.3
    if (o.tipo === 'linea') return 5
    return o.alto
  }
  const alto = ordenes.reduce((suma, o) => suma + alturaDe(o), 0) + MARGEN * 2

  const pagina = pdf.addPage([ANCHO, alto])
  let y = alto - MARGEN

  for (const o of ordenes) {
    const h = alturaDe(o)

    if (o.tipo === 'texto') {
      const fuente = o.bold ? negrita : normal
      const x = o.alinear === 'centro' ? (ANCHO - fuente.widthOfTextAtSize(o.texto, o.tamano)) / 2 : MARGEN
      pagina.drawText(o.texto, { x, y: y - o.tamano, size: o.tamano, font: fuente, color: NEGRO })
    } else if (o.tipo === 'fila') {
      const fuente = o.bold ? negrita : normal
      const der = limpiar(o.der)
      const anchoDer = fuente.widthOfTextAtSize(der, o.tamano)
      // El valor manda: lo de la izquierda se recorta si no cabe junto a él.
      let izq = limpiar(o.izq)
      while (izq.length > 1 && fuente.widthOfTextAtSize(izq, o.tamano) + anchoDer + 4 > UTIL) izq = izq.slice(0, -1)
      pagina.drawText(izq, { x: MARGEN, y: y - o.tamano, size: o.tamano, font: fuente, color: NEGRO })
      pagina.drawText(der, { x: MARGEN + UTIL - anchoDer, y: y - o.tamano, size: o.tamano, font: fuente, color: NEGRO })
    } else if (o.tipo === 'linea') {
      pagina.drawLine({
        start: { x: MARGEN, y: y - 2.5 },
        end: { x: MARGEN + UTIL, y: y - 2.5 },
        thickness: 0.5,
        color: NEGRO,
        dashArray: [2, 2],
      })
    }

    y -= h
  }

  return pdf.save()
}

export function nombreArchivoFacturaPos(numeroFactura: string): string {
  return `Factura-POS-${numeroFactura}.pdf`
}
