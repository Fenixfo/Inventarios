import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso, veTodasLasFacturas } from '@/lib/permisos'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, error: sinPermiso } = await exigirPermiso(request, 'facturas.ver')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

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
    return NextResponse.json(
      { error: error.message || 'Error fetching factura' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'facturas.anular')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    // Obtener factura antes de actualizar
    const facturaBefore = await prisma.factura.findUnique({
      where: { id },
    })

    const facturaAfter = await prisma.factura.update({
      where: { id },
      data: { estado: 'anulado' },
    })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
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
    return NextResponse.json(
      { error: error.message || 'Error deleting factura' },
      { status: 400 }
    )
  }
}
