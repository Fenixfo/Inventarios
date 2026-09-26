import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, puede } from '@/lib/permisos'
import { generarPdfFactura, nombreArchivoCotizacion } from '@/lib/factura-pdf'

/**
 * La cotización como archivo PDF: para descargarla o adjuntarla en WhatsApp.
 * Mismo formato que la factura, sin estado, abonos ni saldo.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'cotizaciones.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await params

    const [cotizacion, registros] = await Promise.all([
      prisma.cotizacion.findFirst({
        where: { id, tiendaId },
        include: {
          cliente: true,
          usuario: true,
          items: { include: { producto: true }, orderBy: { createdAt: 'asc' } },
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

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    // El mismo alcance que el detalle: sin ver_todas, solo las propias.
    if (!puede(usuario, 'cotizaciones.ver_todas') && cotizacion.usuarioId !== usuario.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver esta cotización' },
        { status: 403 }
      )
    }

    const config = Object.fromEntries(registros.map((r) => [r.clave, r.valor || '']))
    config.nombre_empresa = cotizacion.tienda?.nombre || ''

    const bytes = await generarPdfFactura(
      {
        ...(cotizacion as any),
        numeroFactura: cotizacion.numeroCotizacion,
        estado: '',
      },
      config,
      { tipo: 'cotizacion' }
    )

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivoCotizacion(cotizacion.numeroCotizacion)}"`,
        'Content-Length': String(bytes.length),
      },
    })
  } catch (error: any) {
    console.error('Error al generar el PDF de la cotización:', error)
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 })
  }
}
