import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Crea el usuario en la base la primera vez que entra, y devuelve su acceso.
 *
 * Se llama al iniciar sesión. El correo y el identificador salen del token,
 * nunca del cuerpo de la petición: antes se aceptaban tal cual, así que
 * cualquiera sin sesión podía crear filas de usuario a voluntad, o pedir
 * que la fila de otro correo pasara a apuntar a su propia cuenta.
 *
 * Una sola consulta: antes hacía dos seguidas y arrastraba relaciones del
 * modelo de roles que ya no existe, lo que contra una base en otra región
 * costaba unos tres segundos.
 */

/** Valida el token contra Supabase y devuelve a quién pertenece. */
async function duenoDelToken(token: string): Promise<{ id: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    })
    if (!res.ok) return null

    const usuario = await res.json()
    if (!usuario?.id || !usuario?.email) return null

    return { id: usuario.id, email: usuario.email }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
    }

    const dueno = await duenoDelToken(token)
    if (!dueno) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
    }

    const { id: userId, email } = dueno

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
      // La cuenta se recreó en Supabase con el mismo correo. El cambio solo
      // se hace porque el token demuestra que ese correo es de quien pide.
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
