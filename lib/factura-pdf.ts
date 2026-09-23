import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

/**
 * Genera la factura como archivo PDF de verdad.
 *
 * Aparte del HTML que abre el diálogo de imprimir, hace falta un archivo
 * para poder compartirlo: WhatsApp adjunta archivos, no páginas web.
 *
 * Se dibuja a mano con pdf-lib en vez de convertir el HTML porque eso
 * último exige un navegador completo en el servidor (unos 50 MB), y aquí
 * la maquetación es sencilla y estable.
 */

const A4 = { ancho: 595.28, alto: 841.89 }
const MARGEN = 45

const NEGRO = rgb(0.11, 0.11, 0.12)
const GRIS = rgb(0.45, 0.47, 0.5)
const GRIS_CLARO = rgb(0.9, 0.91, 0.92)
const ROJO = rgb(0.86, 0.15, 0.15)
const VERDE = rgb(0.02, 0.59, 0.41)
const AZUL = rgb(0.15, 0.39, 0.92)

export interface ItemPdf {
  productoNombre?: string | null
  producto?: { sku?: string | null; nombre?: string | null } | null
  cantidadM2: number | string
  precioUnitario: number | string
  subtotal: number | string
}

export interface FacturaPdf {
  numeroFactura: string
  fecha: string | Date
  estado: string
  esBodega?: boolean
  observaciones?: string | null
  subtotal: number | string
  descuentoMonto: number | string
  impuesto: number | string
  total: number | string
  anticipo?: number | string | null
  terminoPago?: string | null
  metodoPago?: string | null
  cliente?: {
    nombre?: string | null
    cedulaCc?: string | null
    telefono?: string | null
    email?: string | null
    direccion?: string | null
  } | null
  usuario?: { email?: string | null } | null
  items: ItemPdf[]
  abonos?: { monto: number | string; fecha: string | Date }[]
}

export interface EmpresaPdf {
  nombre_empresa?: string | null
  eslogan_empresa?: string | null
  nit_empresa?: string | null
  direccion_empresa?: string | null
  telefono_empresa?: string | null
  email_empresa?: string | null
  logo_url?: string | null
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
 * Las fuentes estándar del PDF usan WinAnsi, que no conoce todos los
 * caracteres que puede traer un nombre de producto. Se sustituye lo que no
 * cabe en vez de dejar que la librería falle a mitad del documento.
 */
function limpiar(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/²/g, '2') // m² -> m2
    .replace(/[^\x20-\x7E -ÿ]/g, '')
}

/** Corta el texto con puntos suspensivos para que no invada la columna vecina. */
function recortar(texto: string, fuente: PDFFont, tamano: number, anchoMaximo: number): string {
  const limpio = limpiar(texto)
  if (fuente.widthOfTextAtSize(limpio, tamano) <= anchoMaximo) return limpio

  let corto = limpio
  while (corto.length > 1 && fuente.widthOfTextAtSize(corto + '...', tamano) > anchoMaximo) {
    corto = corto.slice(0, -1)
  }
  return corto + '...'
}

interface Contexto {
  pagina: PDFPage
  normal: PDFFont
  negrita: PDFFont
}

function escribir(
  { pagina, normal, negrita }: Contexto,
  texto: string,
  x: number,
  y: number,
  opciones: { tamano?: number; bold?: boolean; color?: ReturnType<typeof rgb>; derecha?: number } = {}
) {
  const { tamano = 10, bold = false, color = NEGRO, derecha } = opciones
  const fuente = bold ? negrita : normal
  const limpio = limpiar(texto)

  pagina.drawText(limpio, {
    x: derecha !== undefined ? derecha - fuente.widthOfTextAtSize(limpio, tamano) : x,
    y,
    size: tamano,
    font: fuente,
    color,
  })
}

/** Descarga el logo. pdf-lib solo entiende PNG y JPG, no WebP. */
async function cargarLogo(pdf: PDFDocument, url: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null

    const tipo = res.headers.get('content-type') || ''
    const bytes = new Uint8Array(await res.arrayBuffer())

    if (tipo.includes('png')) return await pdf.embedPng(bytes)
    if (tipo.includes('jpeg') || tipo.includes('jpg')) return await pdf.embedJpg(bytes)

    // WebP y demás formatos se omiten: el PDF sale con el nombre de la
    // empresa en texto, que es lo importante.
    return null
  } catch {
    return null
  }
}

export async function generarPdfFactura(
  factura: FacturaPdf,
  config: EmpresaPdf = {}
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const pagina = pdf.addPage([A4.ancho, A4.alto])

  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ctx: Contexto = { pagina, normal, negrita }

  const derecha = A4.ancho - MARGEN
  let y = A4.alto - MARGEN

  const empresa = {
    nombre: config.nombre_empresa || 'BERACA',
    eslogan: config.eslogan_empresa || '',
    nit: config.nit_empresa || '',
    direccion: config.direccion_empresa || '',
    telefono: config.telefono_empresa || '',
    email: config.email_empresa || '',
  }

  // --- Encabezado ---
  if (config.logo_url) {
    const logo = await cargarLogo(pdf, config.logo_url)
    if (logo) {
      const alto = 42
      const ancho = (logo.width / logo.height) * alto
      pagina.drawImage(logo, { x: MARGEN, y: y - alto, width: Math.min(ancho, 150), height: alto })
      y -= alto + 10
    }
  }

  escribir(ctx, empresa.nombre, MARGEN, y, { tamano: 18, bold: true })
  escribir(ctx, 'FACTURA', 0, y, { tamano: 16, bold: true, derecha })
  y -= 16

  if (empresa.eslogan) {
    escribir(ctx, empresa.eslogan, MARGEN, y, { tamano: 9, color: GRIS })
  }
  escribir(ctx, factura.numeroFactura, 0, y, { tamano: 11, bold: true, derecha })
  y -= 13

  const datosEmpresa = [
    empresa.nit && `NIT: ${empresa.nit}`,
    empresa.direccion,
    empresa.telefono && `Tel: ${empresa.telefono}`,
    empresa.email,
  ].filter(Boolean) as string[]

  const fecha = new Date(factura.fecha).toLocaleDateString('es-CO')
  const datosFactura = [
    `Fecha: ${fecha}`,
    `Estado: ${factura.estado.charAt(0).toUpperCase() + factura.estado.slice(1)}`,
    factura.esBodega ? 'Precio de bodega' : '',
  ].filter(Boolean)

  const filas = Math.max(datosEmpresa.length, datosFactura.length)
  for (let i = 0; i < filas; i++) {
    if (datosEmpresa[i]) escribir(ctx, datosEmpresa[i], MARGEN, y, { tamano: 9, color: GRIS })
    if (datosFactura[i]) {
      escribir(ctx, datosFactura[i], 0, y, {
        tamano: 9,
        color: datosFactura[i] === 'Precio de bodega' ? rgb(0.57, 0.25, 0.05) : GRIS,
        bold: datosFactura[i] === 'Precio de bodega',
        derecha,
      })
    }
    y -= 12
  }

  y -= 8
  pagina.drawLine({
    start: { x: MARGEN, y },
    end: { x: derecha, y },
    thickness: 1,
    color: GRIS_CLARO,
  })
  y -= 22

  // --- Cliente ---
  escribir(ctx, 'CLIENTE', MARGEN, y, { tamano: 9, bold: true, color: GRIS })
  y -= 14

  const cliente = factura.cliente
  if (cliente?.nombre) {
    escribir(ctx, cliente.nombre, MARGEN, y, { tamano: 11, bold: true })
    y -= 13

    const datos = [
      cliente.cedulaCc && `CC/NIT: ${cliente.cedulaCc}`,
      cliente.telefono && `Tel: ${cliente.telefono}`,
      cliente.email,
      cliente.direccion,
    ].filter(Boolean) as string[]

    datos.forEach((dato) => {
      escribir(ctx, dato, MARGEN, y, { tamano: 9, color: GRIS })
      y -= 11
    })
  } else {
    escribir(ctx, 'Consumidor final', MARGEN, y, { tamano: 11 })
    y -= 13
  }

  if (factura.terminoPago || factura.metodoPago) {
    const condiciones = [
      factura.terminoPago && `Término: ${factura.terminoPago}`,
      factura.metodoPago && `Método: ${factura.metodoPago}`,
    ]
      .filter(Boolean)
      .join('   ')
    escribir(ctx, condiciones, MARGEN, y, { tamano: 9, color: GRIS })
    y -= 11
  }

  y -= 14

  // --- Tabla de items ---
  const columnas = {
    sku: MARGEN,
    nombre: MARGEN + 70,
    cantidad: MARGEN + 305,
    precio: MARGEN + 385,
    subtotal: derecha,
  }

  pagina.drawRectangle({
    x: MARGEN - 4,
    y: y - 5,
    width: derecha - MARGEN + 8,
    height: 19,
    color: rgb(0.97, 0.97, 0.98),
  })

  escribir(ctx, 'SKU', columnas.sku, y, { tamano: 8, bold: true, color: GRIS })
  escribir(ctx, 'PRODUCTO', columnas.nombre, y, { tamano: 8, bold: true, color: GRIS })
  escribir(ctx, 'CANT.', 0, y, { tamano: 8, bold: true, color: GRIS, derecha: columnas.cantidad + 40 })
  escribir(ctx, 'PRECIO', 0, y, { tamano: 8, bold: true, color: GRIS, derecha: columnas.precio + 70 })
  escribir(ctx, 'SUBTOTAL', 0, y, { tamano: 8, bold: true, color: GRIS, derecha: columnas.subtotal })
  y -= 20

  for (const item of factura.items) {
    // Con muchos items se pasa a otra hoja. Se repite la cabecera mínima
    // para que la segunda página no quede suelta.
    if (y < 180) {
      const nueva = pdf.addPage([A4.ancho, A4.alto])
      ctx.pagina = nueva
      y = A4.alto - MARGEN
      escribir(ctx, `${empresa.nombre} - Factura ${factura.numeroFactura}`, MARGEN, y, {
        tamano: 9,
        color: GRIS,
      })
      y -= 24
    }

    const sku = item.producto?.sku || '-'
    const nombre = item.productoNombre || item.producto?.nombre || '(Sin nombre)'

    escribir(ctx, recortar(sku, normal, 9, 65), columnas.sku, y, { tamano: 9 })
    escribir(ctx, recortar(nombre, normal, 9, 230), columnas.nombre, y, { tamano: 9 })
    escribir(ctx, Number(item.cantidadM2).toFixed(2), 0, y, {
      tamano: 9,
      derecha: columnas.cantidad + 40,
    })
    escribir(ctx, pesos(item.precioUnitario), 0, y, { tamano: 9, derecha: columnas.precio + 70 })
    escribir(ctx, pesos(item.subtotal), 0, y, { tamano: 9, derecha: columnas.subtotal })
    y -= 15

    ctx.pagina.drawLine({
      start: { x: MARGEN, y: y + 4 },
      end: { x: derecha, y: y + 4 },
      thickness: 0.5,
      color: GRIS_CLARO,
    })
  }

  y -= 14

  // --- Totales ---
  const anticipo = Number(factura.anticipo || 0)
  const abonos = (factura.abonos || []).reduce((suma, a) => suma + Number(a.monto), 0)
  const totalAbonado = anticipo + abonos
  const saldo = Math.max(0, Number(factura.total) - totalAbonado)

  const lineasTotales: [string, string, boolean, ReturnType<typeof rgb>][] = [
    ['Subtotal', pesos(factura.subtotal), false, NEGRO],
  ]

  if (Number(factura.descuentoMonto) > 0) {
    lineasTotales.push(['Descuento', `-${pesos(factura.descuentoMonto)}`, false, ROJO])
  }
  if (Number(factura.impuesto) > 0) {
    lineasTotales.push(['Impuesto', pesos(factura.impuesto), false, AZUL])
  }

  lineasTotales.push(['TOTAL', pesos(factura.total), true, NEGRO])

  if (totalAbonado > 0) {
    lineasTotales.push(['Abonado', pesos(totalAbonado), false, VERDE])
  }

  lineasTotales.push([
    saldo > 0 ? 'SALDO PENDIENTE' : 'PAGADA',
    saldo > 0 ? pesos(saldo) : pesos(0),
    true,
    saldo > 0 ? ROJO : VERDE,
  ])

  for (const [etiqueta, valor, bold, color] of lineasTotales) {
    escribir(ctx, etiqueta, 0, y, { tamano: bold ? 11 : 9, bold, color, derecha: derecha - 110 })
    escribir(ctx, valor, 0, y, { tamano: bold ? 11 : 9, bold, color, derecha })
    y -= bold ? 17 : 13
  }

  // --- Abonos ---
  if ((factura.abonos || []).length > 0) {
    y -= 10
    escribir(ctx, 'ABONOS REGISTRADOS', MARGEN, y, { tamano: 9, bold: true, color: GRIS })
    y -= 13

    for (const abono of factura.abonos || []) {
      const cuando = new Date(abono.fecha).toLocaleDateString('es-CO')
      escribir(ctx, cuando, MARGEN, y, { tamano: 9, color: GRIS })
      escribir(ctx, pesos(abono.monto), 0, y, { tamano: 9, derecha: MARGEN + 180 })
      y -= 12
    }
  }

  // --- Observaciones ---
  if (factura.observaciones) {
    y -= 12
    escribir(ctx, 'OBSERVACIONES', MARGEN, y, { tamano: 9, bold: true, color: GRIS })
    y -= 13
    escribir(ctx, recortar(factura.observaciones, normal, 9, derecha - MARGEN), MARGEN, y, {
      tamano: 9,
      color: GRIS,
    })
  }

  // --- Pie ---
  escribir(ctx, 'Gracias por su compra.', MARGEN, MARGEN + 12, { tamano: 9, color: GRIS })
  if (factura.usuario?.email) {
    escribir(ctx, `Atendido por: ${factura.usuario.email}`, 0, MARGEN + 12, {
      tamano: 8,
      color: GRIS,
      derecha,
    })
  }

  return pdf.save()
}

/** Nombre del archivo tal como lo verá quien lo reciba. */
export function nombreArchivoFactura(numeroFactura: string): string {
  return `Factura-${numeroFactura}.pdf`
}
