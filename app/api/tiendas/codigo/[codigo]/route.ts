import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSesion } from '@/lib/permisos'
import { codigoValido, normalizarCodigo } from '@/lib/codigo-tienda'

/**
 * Busca una tienda por su código, para confirmarla antes de pedir acceso.
 *
 * Devuelve lo justo para que quien la pide reconozca el negocio: nombre y
 * ciudad. Nada de quién trabaja ahí ni cuántos productos tiene.
 *
 * Solo exige sesión: quien pide acceso todavía no tiene permisos, que es
 * precisamente el motivo de la solicitud.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ codigo: string }> }
) {
  try {
    const { usuario, error } = await exigirSesion(request)
    if (error) return error

    const { codigo } = await context.params
    const limpio = normalizarCodigo(decodeURIComponent(codigo))

    if (!codigoValido(limpio)) {
      return NextResponse.json(
        { error: 'El código son 6 caracteres, sin la letra O ni el número 0' },
        { status: 400 }
      )
    }

    const tienda = await prisma.tienda.findFirst({
      where: { codigo: limpio, activo: true },
      select: { id: true, nombre: true, ciudad: true },
    })

    if (!tienda) {
      return NextResponse.json(
        { error: 'No hay ninguna tienda con ese código' },
        { status: 404 }
      )
    }

    // Si ya tiene acceso, se le dice aquí en vez de dejar que mande una
    // solicitud que el endpoint siguiente va a rechazar.
    const acceso = await prisma.usuarioTienda.findUnique({
      where: { usuarioId_tiendaId: { usuarioId: usuario.id, tiendaId: tienda.id } },
      select: { id: true },
    })

    const solicitud = await prisma.solicitudAcceso.findFirst({
      where: { usuarioId: usuario.id, tiendaId: tienda.id, estado: 'pendiente' },
      select: { id: true },
    })

    return NextResponse.json({
      ...tienda,
      yaTieneAcceso: Boolean(acceso),
      solicitudPendiente: Boolean(solicitud),
    })
  } catch (error: any) {
    console.error('Error buscando tienda por código:', error)
    return NextResponse.json({ error: 'Error al buscar la tienda' }, { status: 500 })
  }
}
