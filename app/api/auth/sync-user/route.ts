import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId y email son requeridos' },
        { status: 400 }
      )
    }

    // Buscar usuario por email primero (ya que el email es el identificador único en Supabase Auth)
    let usuario = await prisma.usuario.findUnique({
      where: { email },
      include: {
        roles: true,
        rolesPersonalizados: {
          include: { rol: true },
        },
      },
    })

    // Si no existe, crear nuevo usuario con el ID de Supabase
    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: {
          id: userId,
          email,
        },
        include: {
          roles: true,
          rolesPersonalizados: {
            include: { rol: true },
          },
        },
      })
    } else if (usuario.id !== userId) {
      // Si existe pero con diferente ID de Supabase, actualizar el ID
      // Esto maneja el caso de un usuario que cambió de ID en Supabase
      await prisma.usuario.update({
        where: { email },
        data: { id: userId },
      })
      usuario.id = userId
    }

    // Obtener tiendas del usuario
    const usuarioTiendas = await prisma.usuarioTienda.findMany({
      where: { usuarioId: usuario.id },
      include: { tienda: true },
    })

    // Retornar usuario con sus roles y tiendas
    return NextResponse.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        roles: usuario.roles.map((r) => r.rol),
        rolesPersonalizados: usuario.rolesPersonalizados.map((r) => r.rol.nombre),
        tiendas: usuarioTiendas.map((ut) => ({
          id: ut.tienda.id,
          nombre: ut.tienda.nombre,
        })),
      },
    })
  } catch (error: any) {
    console.error('Error sincronizando usuario:', error)
    return NextResponse.json(
      { error: error.message || 'Error al sincronizar usuario' },
      { status: 500 }
    )
  }
}
