import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // Verificar token de setup
    const token = request.headers.get('x-setup-token')
    if (token !== process.env.SETUP_TOKEN) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    const { usuarioId, rol } = await request.json()

    if (!usuarioId || !rol) {
      return NextResponse.json(
        { error: 'usuarioId y rol son requeridos' },
        { status: 400 }
      )
    }

    // Verificar que el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: {
        roles: true,
      },
    })

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si ya tiene el rol
    const tieneRol = usuario.roles.some((r) => r.rol === rol)
    if (tieneRol) {
      return NextResponse.json(
        { message: 'El usuario ya tiene este rol' },
        { status: 200 }
      )
    }

    // Asignar rol
    await prisma.usuarioRol.create({
      data: {
        usuarioId,
        rol,
      },
    })

    return NextResponse.json(
      { message: 'Rol asignado exitosamente', usuario: usuario.email },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error asignando rol:', error)
    return NextResponse.json(
      { error: error.message || 'Error al asignar rol' },
      { status: 500 }
    )
  }
}

// GET para listar todos los usuarios con sus roles
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-setup-token')
    if (token !== process.env.SETUP_TOKEN) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    const usuarios = await prisma.usuario.findMany({
      include: {
        roles: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(usuarios)
  } catch (error: any) {
    console.error('Error listando usuarios:', error)
    return NextResponse.json(
      { error: error.message || 'Error al listar usuarios' },
      { status: 500 }
    )
  }
}
