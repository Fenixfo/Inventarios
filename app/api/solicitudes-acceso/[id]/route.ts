import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(
      request,
      'solicitudes-acceso.gestionar'
    )
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    const { estado, comentarioAdmin } = await request.json()

    if (!estado || !['aprobado', 'rechazado'].includes(estado)) {
      return NextResponse.json(
        { error: 'Estado debe ser "aprobado" o "rechazado"' },
        { status: 400 }
      )
    }

    // La solicitud tiene que ser de esta tienda: si no, se podría aprobar
    // el acceso de alguien a un negocio ajeno.
    const solicitud = await prisma.solicitudAcceso.findFirst({
      where: { id, tiendaId },
    })

    if (!solicitud) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      )
    }

    // Actualizar solicitud
    const actualizada = await prisma.solicitudAcceso.update({
      where: { id },
      data: {
        estado,
        // Quién respondió sale del token, no del cuerpo.
        respondidoPor: usuario.id,
        respondidoEn: new Date(),
        comentarioAdmin: comentarioAdmin || null,
      },
      include: {
        usuario: true,
        tienda: true,
      },
    })

    // Si está aprobada, crear relación UsuarioTienda
    if (estado === 'aprobado') {
      await prisma.usuarioTienda.upsert({
        where: {
          usuarioId_tiendaId: {
            usuarioId: solicitud.usuarioId,
            tiendaId: solicitud.tiendaId,
          },
        },
        update: {},
        create: {
          usuarioId: solicitud.usuarioId,
          tiendaId: solicitud.tiendaId,
        },
      })
    }

    return NextResponse.json(actualizada)
  } catch (error: any) {
    console.error('Error actualizando solicitud:', error)
    return NextResponse.json(
      { error: error.message || 'Error al actualizar solicitud' },
      { status: 500 }
    )
  }
}
