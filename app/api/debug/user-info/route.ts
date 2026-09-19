import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { roles: true },
    })

    if (!usuario) {
      return NextResponse.json({
        encontrado: false,
        userId,
        mensaje: 'Usuario NO encontrado en tabla Usuario',
      })
    }

    return NextResponse.json({
      encontrado: true,
      userId: usuario.id,
      email: usuario.email,
      roles: usuario.roles.map((r) => r.rol),
      tieneRolAdmin: usuario.roles.some((r) => r.rol === 'admin'),
    })
  } catch (error: any) {
    console.error('Error en debug:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
