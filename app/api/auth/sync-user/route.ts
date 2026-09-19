import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId y email son requeridos' },
        { status: 400 }
      )
    }

    // Verificar si el usuario ya existe
    let usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        roles: true,
      },
    })

    // Si no existe, crearlo
    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: {
          id: userId,
          email,
        },
        include: {
          roles: true,
        },
      })
    }

    // Retornar usuario con sus roles
    return NextResponse.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        roles: usuario.roles.map((r) => r.rol),
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
