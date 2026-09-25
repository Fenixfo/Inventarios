import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSesion } from '@/lib/permisos'

/**
 * Las tiendas de quien pregunta.
 *
 * Antes devolvía **todas** las tiendas activas, para que quien pedía acceso
 * eligiera de una lista. Eso era publicar el directorio de negocios
 * registrados; ahora el acceso se pide con el código que comparte el dueño.
 *
 * El código solo se devuelve a quien lo puede compartir —dueño o
 * administrador—, que son quienes deciden a quién dejar entrar.
 */
export async function GET(request: NextRequest) {
  try {
    const { usuario, error: sinSesion } = await exigirSesion(request)
    if (sinSesion) return sinSesion

    const accesos = await prisma.usuarioTienda.findMany({
      where: { usuarioId: usuario.id, tienda: { activo: true } },
      select: {
        esOwner: true,
        esAdmin: true,
        tienda: {
          select: { id: true, nombre: true, ciudad: true, codigo: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(
      accesos.map((a) => ({
        id: a.tienda.id,
        nombre: a.tienda.nombre,
        ciudad: a.tienda.ciudad,
        esOwner: a.esOwner,
        esAdmin: a.esAdmin,
        codigo: a.esOwner || a.esAdmin ? a.tienda.codigo : null,
      }))
    )
  } catch (error: any) {
    console.error('Error fetching tiendas:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener tiendas' },
      { status: 500 }
    )
  }
}
