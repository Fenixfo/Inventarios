import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { generarPdfFactura, nombreArchivoFactura } from '@/lib/factura-pdf'
import { fechaYHora, soloFecha, soloHora } from '@/lib/fechas'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await params

    // Las dos consultas son independientes: en secuencia pagaban dos veces
    // la ida y vuelta a la base de datos.
    const [factura, registros] = await Promise.all([
      prisma.factura.findFirst({
        where: { id, tiendaId },
        include: {
          cliente: true,
          usuario: true,
          items: { include: { producto: true } },
          abonos: { orderBy: { fecha: 'asc' } },
          // El nombre que sale en la factura es el de la tienda que la
          // emitió, no una configuración global.
          tienda: { select: { nombre: true } },
        },
      }),
      prisma.configuracion.findMany({
        where: {
          tiendaId,
          clave: {
            in: [
              'eslogan_empresa',
              'nit_empresa',
              'direccion_empresa',
              'telefono_empresa',
              'email_empresa',
              'logo_url',
            ],
          },
        },
        select: { clave: true, valor: true },
      }),
    ])

    if (!factura) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    const config = Object.fromEntries(registros.map((r) => [r.clave, r.valor || '']))
    config.nombre_empresa = factura.tienda?.nombre || ''

    // Con ?formato=pdf se devuelve el archivo, que es lo que se puede
    // adjuntar en WhatsApp. Por defecto sigue saliendo el HTML, que es el
    // que abre el diálogo de imprimir del navegador.
    const { searchParams } = new URL(request.url)

    if (searchParams.get('formato') === 'pdf') {
      const bytes = await generarPdfFactura(factura as any, config)

      return new NextResponse(Buffer.from(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${nombreArchivoFactura(factura.numeroFactura)}"`,
          'Content-Length': String(bytes.length),
        },
      })
    }

    // Generar HTML de la factura
    const html = generarHTML(factura, config)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('Error al generar PDF:', error)
    return NextResponse.json(
      { error: error.message || 'Error al generar PDF' },
      { status: 500 }
    )
  }
}

function formatearEstado(estado: string): string {
  return estado.charAt(0).toUpperCase() + estado.slice(1)
}

function formatearDinero(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor)
}

function generarHTML(factura: any, config: Record<string, string> = {}): string {
  const empresa = {
    nombre: config.nombre_empresa || 'BERACA',
    eslogan: config.eslogan_empresa || 'Distribuidora de Cerámicas y Porcelanatos',
    nit: config.nit_empresa || '',
    direccion: config.direccion_empresa || '',
    telefono: config.telefono_empresa || '',
    email: config.email_empresa || '',
    logo: config.logo_url || '',
  }

  // Con fecha y hora: en un día con varias ventas al mismo cliente, el día
  // solo no distingue una factura de otra.
  const fecha = fechaYHora(factura.fecha)
  const subtotal = Number(factura.subtotal)
  const descuento = Number(factura.descuentoMonto)
  const impuesto = Number(factura.impuesto)
  const total = Number(factura.total)
  const anticipo = Number(factura.anticipo || 0)
  const totalAbonosRegistrados = (factura.abonos || []).reduce((sum: number, abono: any) => sum + Number(abono.monto), 0)
  const totalAbonado = anticipo + totalAbonosRegistrados
  const saldoPendienteCalculado = total - totalAbonado
  const saldoPendiente = Math.max(0, saldoPendienteCalculado)

  const itemsHTML = factura.items
    .map(
      (item: any) => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; text-align: left;">${item.producto?.sku || '—'}</td>
      <td style="padding: 10px; text-align: left;">${item.productoNombre || item.producto?.nombre || '(Sin nombre)'}</td>
      <td style="padding: 10px; text-align: right;">${Number(item.cantidadM2).toFixed(2)}</td>
      <td style="padding: 10px; text-align: right;">${formatearDinero(Number(item.precioUnitario))}</td>
      <td style="padding: 10px; text-align: right;">${formatearDinero(Number(item.subtotal))}</td>
    </tr>
  `
    )
    .join('')

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${factura.numeroFactura}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      line-height: 1.6;
    }

    /* El navegador omite fondos y colores al imprimir salvo que se le fuerce;
       sin esto los encabezados y estados salen en blanco en el PDF. */
    @media print {
      @page {
        size: A4;
        margin: 12mm;
      }

      html, body {
        width: 100%;
        background: white;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .container {
        max-width: 100%;
        padding: 0;
        margin: 0;
      }

      .no-print {
        display: none !important;
      }

      table {
        page-break-inside: auto;
      }

      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }

      thead {
        display: table-header-group;
      }

      .totales, .footer {
        page-break-inside: avoid;
      }
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      background: white;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 40px;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
    }
    .empresa {
      flex: 1;
    }
    .empresa h1 {
      font-size: 28px;
      color: #2563eb;
      margin-bottom: 5px;
    }
    .empresa p {
      font-size: 12px;
      color: #666;
    }
    .factura-info {
      text-align: right;
      flex: 1;
    }
    .factura-info h2 {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
    }
    .factura-info p {
      font-size: 12px;
      margin: 5px 0;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h3 {
      font-size: 12px;
      font-weight: bold;
      color: #2563eb;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section p {
      font-size: 12px;
      line-height: 1.8;
      margin: 5px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background-color: #f0f0f0;
      padding: 10px;
      text-align: left;
      font-size: 12px;
      font-weight: bold;
      border-bottom: 2px solid #2563eb;
    }
    td {
      padding: 10px;
      font-size: 12px;
    }
    .totales {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .totales-box {
      width: 300px;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 20px;
    }
    .totales-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 12px;
    }
    .totales-row.total {
      border-top: 2px solid #2563eb;
      padding-top: 10px;
      font-weight: bold;
      font-size: 14px;
      color: #2563eb;
    }
    .footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 10px;
      color: #999;
    }
    .estado-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .estado-pendiente {
      background-color: #fef3c7;
      color: #92400e;
    }
    .estado-pagado {
      background-color: #dcfce7;
      color: #15803d;
    }
    .estado-entregado {
      background-color: #cffafe;
      color: #0c4a6e;
    }
    .estado-anulado {
      background-color: #fee2e2;
      color: #991b1b;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="empresa">
        ${empresa.logo ? `<img src="${empresa.logo}" alt="${empresa.nombre}" style="max-height: 60px; max-width: 200px; object-fit: contain; margin-bottom: 8px; display: block;">` : ''}
        <h1>${empresa.nombre}</h1>
        <p>${empresa.eslogan}</p>
        ${empresa.nit ? `<p style="font-size: 12px; color: #666;">NIT: ${empresa.nit}</p>` : ''}
        ${empresa.direccion ? `<p style="font-size: 12px; color: #666;">${empresa.direccion}</p>` : ''}
        ${empresa.telefono ? `<p style="font-size: 12px; color: #666;">Tel: ${empresa.telefono}</p>` : ''}
        ${empresa.email ? `<p style="font-size: 12px; color: #666;">${empresa.email}</p>` : ''}
      </div>
      <div class="factura-info">
        <h2>FACTURA</h2>
        <p><strong>${factura.numeroFactura}</strong></p>
        <p>Fecha: ${fecha}</p>
        <p>Estado: <span class="estado-badge estado-${factura.estado}">${formatearEstado(factura.estado)}</span></p>
        ${factura.esBodega ? '<p style="font-size: 12px; color: #92400e; font-weight: bold;">Precio de bodega</p>' : ''}
      </div>
    </div>

    <!-- Cliente y empresa -->
    <div class="row">
      <div class="section">
        <h3>Cliente</h3>
        <p><strong>${factura.cliente?.nombre || 'N/A'}</strong></p>
        <p>Cédula/CC: ${factura.cliente?.cedulaCc || 'N/A'}</p>
        <p>Email: ${factura.cliente?.email || 'N/A'}</p>
        <p>Teléfono: ${factura.cliente?.telefono || 'N/A'}</p>
        <p>Dirección: ${factura.cliente?.direccion || 'N/A'}</p>
      </div>
      <div class="section">
        <h3>Información de Pago</h3>
        <p>Término de Pago: <strong>${factura.terminoPago || 'N/A'}</strong></p>
        <p>Método de Pago: <strong>${factura.metodoPago || 'N/A'}</strong></p>
        ${factura.fechaPago ? `<p>Fecha de Pago: ${fechaYHora(factura.fechaPago)}</p>` : ''}
      </div>
    </div>

    <!-- Tabla de items -->
    <table>
      <thead>
        <tr>
          <th>SKU</th>
          <th>Descripción</th>
          <th>Cantidad (m²)</th>
          <th>Precio Unitario</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHTML}
      </tbody>
    </table>

    <!-- Totales -->
    <div class="totales">
      <div class="totales-box">
        <div class="totales-row">
          <span>Subtotal:</span>
          <span>${formatearDinero(subtotal)}</span>
        </div>
        ${descuento > 0 ? `
          <div class="totales-row">
            <span>Descuento (${factura.descuentoPorcentaje}%):</span>
            <span>-${formatearDinero(descuento)}</span>
          </div>
        ` : ''}
        ${impuesto > 0 ? `
          <div class="totales-row">
            <span>Impuesto:</span>
            <span>${formatearDinero(impuesto)}</span>
          </div>
        ` : ''}
        <div class="totales-row total">
          <span>TOTAL:</span>
          <span>${formatearDinero(total)}</span>
        </div>
        ${anticipo > 0 ? `
          <div class="totales-row">
            <span>Adelanto (Inicial):</span>
            <span style="color: #059669;">${formatearDinero(anticipo)}</span>
          </div>
        ` : ''}
        ${totalAbonosRegistrados > 0 ? `
          <div class="totales-row">
            <span>Abonos Registrados:</span>
            <span style="color: #059669;">${formatearDinero(totalAbonosRegistrados)}</span>
          </div>
        ` : ''}
        ${totalAbonado > 0 ? `
          <div class="totales-row">
            <span>Total Abonado:</span>
            <span style="color: #059669;">${formatearDinero(totalAbonado)}</span>
          </div>
          <div class="totales-row" style="border-top: 1px solid #ddd; padding-top: 8px;">
            <span style="font-weight: bold;">Saldo Pendiente:</span>
            <span style="color: ${saldoPendiente > 0 ? '#dc2626' : '#10b981'}; font-weight: bold;">${formatearDinero(saldoPendiente)}</span>
          </div>
        ` : ''}
      </div>
    </div>

    ${(factura.abonos || []).length > 0 ? `
      <div class="section">
        <h3>Historial de Abonos</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #ddd;">
              <th style="padding: 10px; text-align: left; font-size: 12px;">Fecha</th>
              <th style="padding: 10px; text-align: right; font-size: 12px;">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${(factura.abonos || []).map((abono: any) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; font-size: 12px;">${fechaYHora(abono.fecha)}</td>
                <td style="padding: 10px; text-align: right; font-size: 12px;">${formatearDinero(Number(abono.monto))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${factura.observaciones ? `
      <div class="section">
        <h3>Observaciones</h3>
        <p>${factura.observaciones}</p>
      </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>Generado el ${soloFecha(new Date())} a las ${soloHora(new Date())}</p>
      <p>${empresa.nombre}</p>
    </div>
  </div>

  <div class="no-print" style="position: fixed; top: 16px; right: 16px; display: flex; gap: 8px;">
    <button onclick="window.print()" style="padding: 10px 18px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
      Guardar como PDF
    </button>
  </div>

  <script>
    // Abre el diálogo de impresión una sola vez. El navegador produce un PDF
    // vectorial (texto seleccionable), mejor que rasterizar el HTML.
    (function () {
      var yaImprimio = false;

      function imprimir() {
        if (yaImprimio) return;
        yaImprimio = true;
        setTimeout(function () { window.print() }, 300);
      }

      if (location.search.indexOf('print=0') !== -1) return;

      // Con document.write el evento load puede haber ocurrido ya.
      if (document.readyState === 'complete') {
        imprimir();
      } else {
        window.addEventListener('load', imprimir);
      }
    })();
  </script>
</body>
</html>
  `
}
