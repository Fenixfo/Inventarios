import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json()

    console.log(`\n🔍 DEBUG SYNC: userId=${userId}, email=${email}`)

    // Verificar si el usuario ya existe
    let usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        roles: true,
      },
    })

    console.log(`Usuario en BD: ${usuario ? 'SÍ' : 'NO'}`)
    if (usuario) {
      console.log(`Roles: ${usuario.roles.map((r) => r.rol).join(', ')}`)
    }

    // Si no existe, crearlo
    if (!usuario) {
      console.log('Creando nuevo usuario...')
      usuario = await prisma.usuario.create({
        data: {
          id: userId,
          email,
        },
        include: {
          roles: true,
        },
      })
      console.log('Usuario creado')
    }

    // Retornar usuario con sus roles
    const response = {
      usuario: {
        id: usuario.id,
        email: usuario.email,
        roles: usuario.roles.map((r) => r.rol),
      },
    }

    console.log(`Response: ${JSON.stringify(response)}`)
    console.log(`¿Tiene admin? ${response.usuario.roles.includes('admin')}`)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error sincronizando usuario:', error)
    return NextResponse.json(
      { error: error.message || 'Error al sincronizar usuario' },
      { status: 500 }
    )
  }
}
