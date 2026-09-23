import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'

export async function GET(request: NextRequest) {
  try {
    const { error } = await exigirPermiso(request, 'usuarios.ver')
    if (error) return error

    const usuarios = await prisma.usuario.findMany({
      include: {
        tiendas: {
          include: {
            tienda: { select: { id: true, nombre: true } },
            permisos: { include: { permiso: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Se devuelve el dueño también, marcado: la interfaz lo muestra pero no
    // permite modificarlo.
    return NextResponse.json(
      usuarios.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        tiendas: u.tiendas.map((ut) => ({
          tiendaId: ut.tiendaId,
          tiendaNombre: ut.tienda.nombre,
          esOwner: ut.esOwner,
          esAdmin: ut.esAdmin,
          permisos: ut.permisos.map((pa) => `${pa.permiso.modulo}.${pa.permiso.accion}`),
        })),
      }))
    )
  } catch (error: any) {
    console.error('Error obteniendo usuarios:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener usuarios' },
      { status: 500 }
    )
  }
}
