import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, veTodasLasFacturas } from '@/lib/permisos'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    const factura = await prisma.factura.findFirst({
      where: { id, tiendaId },
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
        { error: 'Factura not found' },
        { status: 404 }
      )
    }

    // Sin 'facturas.ver_todas' solo se pueden abrir las facturas propias.
    if (!veTodasLasFacturas(usuario) && factura.usuarioId !== usuario.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver esta factura' },
        { status: 403 }
      )
    }

    return NextResponse.json(factura)
  } catch (error: any) {
    // El detalle queda en el log del servidor; al navegador va un texto genérico.
    console.error('Error en /api/facturas/[id]:', error)
    return NextResponse.json(
      { error: 'No se pudo obtener la factura' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.anular')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    // Obtener factura antes de actualizar
    const facturaBefore = await prisma.factura.findFirst({
      where: { id, tiendaId },
    })

    if (!facturaBefore) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    // Una liquidada ya repartió su ganancia: anularla la dejaría descuadrada.
    if (facturaBefore.estado === 'liquidado') {
      return NextResponse.json(
        { error: 'La factura ya está liquidada y no se puede anular' },
        { status: 409 }
      )
    }

    const facturaAfter = await prisma.factura.update({
      where: { id },
      data: { estado: 'anulado' },
    })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          // Quién anuló y en qué tienda: sin esto el registro no tenía autor
          // ni aparecía en la auditoría de ninguna tienda.
          usuarioId: usuario.id,
          tiendaId,
          tablaAfectada: 'facturas',
          registroId: id,
          accion: 'UPDATE',
          datosAntes: {
            estado: facturaBefore?.estado,
          },
          datosDespues: {
            estado: facturaAfter.estado,
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    // El detalle queda en el log del servidor; al navegador va un texto genérico.
    console.error('Error en /api/facturas/[id]:', error)
    return NextResponse.json(
      { error: 'No se pudo anular la factura' },
      { status: 400 }
    )
  }
}
