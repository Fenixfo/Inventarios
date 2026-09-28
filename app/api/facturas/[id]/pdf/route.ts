import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, veTodasLasFacturas } from '@/lib/permisos'
import { generarPdfFactura, nombreArchivoFactura } from '@/lib/factura-pdf'

/**
 * La factura como archivo PDF: para verla, imprimirla, guardarla o
 * compartirla por WhatsApp.
 *
 * Antes, por defecto, se devolvía un HTML para imprimir que la pantalla
 * escribía con document.write en una pestaña del mismo origen que el panel.
 * Ese HTML insertaba sin escapar el nombre del cliente, la dirección, los
 * productos y las observaciones: un cliente creado con código en el nombre
 * lo ejecutaba al abrir la factura, con la sesión de quien la abría. Se
 * retiró; el PDF dibuja texto y no interpreta nada. `?formato=pdf` se sigue
 * aceptando por compatibilidad, pero ya no cambia nada.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.ver')
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

    // El mismo alcance que el detalle: sin 'facturas.ver_todas' solo se
    // descargan las propias. Antes bastaba con tener el enlace de una ajena.
    if (!veTodasLasFacturas(usuario) && factura.usuarioId !== usuario.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver esta factura' },
        { status: 403 }
      )
    }

    const config = Object.fromEntries(registros.map((r) => [r.clave, r.valor || '']))
    config.nombre_empresa = factura.tienda?.nombre || ''

    const bytes = await generarPdfFactura(factura as any, config)

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivoFactura(factura.numeroFactura)}"`,
        'Content-Length': String(bytes.length),
      },
    })
  } catch (error) {
    // El detalle queda en el log del servidor; al navegador no le sirve y
    // puede traer nombres de tablas o de la conexión.
    console.error('Error al generar PDF:', error)
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 })
  }
}
