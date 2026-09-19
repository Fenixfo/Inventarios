import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: true,
        usuario: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    })

    if (!factura) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Generar HTML de la factura
    const html = generarHTML(factura)

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

function generarHTML(factura: any): string {
  const fecha = new Date(factura.fecha).toLocaleDateString('es-CO')
  const subtotal = Number(factura.subtotal)
  const descuento = Number(factura.descuentoMonto)
  const impuesto = Number(factura.impuesto)
  const total = Number(factura.total)

  const itemsHTML = factura.items
    .map(
      (item: any) => `
    <tr style="border-bottom: 1px solid #ddd;">
      <td style="padding: 10px; text-align: left;">${item.producto?.sku || 'PERSONALIZADO'}</td>
      <td style="padding: 10px; text-align: left;">${item.producto?.nombre || '(Personalizado)'}</td>
      <td style="padding: 10px; text-align: right;">${Number(item.cantidadM2).toFixed(2)}</td>
      <td style="padding: 10px; text-align: right;">$${Number(item.precioUnitario).toFixed(2)}</td>
      <td style="padding: 10px; text-align: right;">$${Number(item.subtotal).toFixed(2)}</td>
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
        <h1>BERACA</h1>
        <p>Distribuidora de Cerámicas y Porcelanatos</p>
      </div>
      <div class="factura-info">
        <h2>FACTURA</h2>
        <p><strong>${factura.numeroFactura}</strong></p>
        <p>Fecha: ${fecha}</p>
        <p>Estado: <span class="estado-badge estado-${factura.estado}">${factura.estado.toUpperCase()}</span></p>
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
        ${factura.fechaPago ? `<p>Fecha de Pago: ${new Date(factura.fechaPago).toLocaleDateString('es-CO')}</p>` : ''}
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
          <span>$${subtotal.toFixed(2)}</span>
        </div>
        ${descuento > 0 ? `
          <div class="totales-row">
            <span>Descuento (${factura.descuentoPorcentaje}%):</span>
            <span>-$${descuento.toFixed(2)}</span>
          </div>
        ` : ''}
        ${impuesto > 0 ? `
          <div class="totales-row">
            <span>Impuesto:</span>
            <span>$${impuesto.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="totales-row total">
          <span>TOTAL:</span>
          <span>$${total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    ${factura.observaciones ? `
      <div class="section">
        <h3>Observaciones</h3>
        <p>${factura.observaciones}</p>
      </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <p>Generado el ${new Date().toLocaleDateString('es-CO')} a las ${new Date().toLocaleTimeString('es-CO')}</p>
      <p>Plataforma de Gestión de Inventarios Beraca</p>
    </div>
  </div>

  <script>
    // Auto-print o download cuando se carga
    window.addEventListener('load', function() {
      // Opción 1: Abrir diálogo de impresión
      // window.print();

      // Opción 2: Usar html2canvas y jsPDF en frontend
      // (si prefieres generar PDF en browser)
    });
  </script>
</body>
</html>
  `
}
