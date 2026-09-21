import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export async function GET(request: NextRequest) {
  try {
    // Obtener todos los usuarios
    const todosUsuarios = await prisma.usuario.findMany({
      include: {
        roles: true,
        rolesPersonalizados: {
          include: {
            rol: {
              include: {
                permisos: {
                  include: { modulo: true }
                }
              }
            }
          }
        },
        tiendas: {
          include: { tienda: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Filtrar para excluir usuarios con rol Owner
    const usuarios = todosUsuarios.filter(usuario => {
      const tieneRolOwner = usuario.rolesPersonalizados.some(
        ur => ur.rol.nombre === 'Owner'
      )
      return !tieneRolOwner
    })

    return NextResponse.json(usuarios)
  } catch (error: any) {
    console.error('Error obteniendo usuarios:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener usuarios' },
      { status: 500 }
    )
  }
}
