import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Crea el usuario en la base la primera vez que entra, y devuelve su acceso.
 *
 * Se llama al iniciar sesión. Una sola consulta: antes hacía dos seguidas y
 * arrastraba relaciones del modelo de roles que ya no existe, lo que contra
 * una base en otra región costaba unos tres segundos.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'userId y email son requeridos' },
        { status: 400 }
      )
    }

    const incluirAcceso = {
      tiendas: {
        include: { tienda: { select: { id: true, nombre: true } } },
      },
    }

    let usuario = await prisma.usuario.findUnique({
      where: { email },
      include: incluirAcceso,
    })

    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: { id: userId, email },
        include: incluirAcceso,
      })
    } else if (usuario.id !== userId) {
      // El usuario cambió de identificador en Supabase (por ejemplo, si se
      // recreó la cuenta con el mismo correo).
      usuario = await prisma.usuario.update({
        where: { email },
        data: { id: userId },
        include: incluirAcceso,
      })
    }

    return NextResponse.json({
      usuario: {
        id: usuario.id,
        email: usuario.email,
        tiendas: usuario.tiendas.map((ut) => ({
          id: ut.tienda.id,
          nombre: ut.tienda.nombre,
          esOwner: ut.esOwner,
          esAdmin: ut.esAdmin,
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
