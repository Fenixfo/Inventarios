import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSesion } from '@/lib/permisos'
import { leerCuerpo, perfilNuevo } from '@/lib/esquemas'

/**
 * El perfil de la propia cuenta: nombre y teléfono.
 *
 * No pide ningún permiso, solo sesión: cada persona edita lo suyo. La fila
 * que se lee y se cambia sale siempre del token, nunca del cuerpo, así que
 * nadie puede tocar el perfil de otro.
 */
export async function GET(request: NextRequest) {
  try {
    const { usuario, error: sinSesion } = await exigirSesion(request)
    if (sinSesion) return sinSesion

    const perfil = await prisma.usuario.findUnique({
      where: { id: usuario.id },
      select: { email: true, nombre: true, telefono: true },
    })

    return NextResponse.json(perfil ?? { email: usuario.email, nombre: null, telefono: null })
  } catch (error) {
    console.error('Error leyendo el perfil:', error)
    return NextResponse.json({ error: 'Error al leer el perfil' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { usuario, error: sinSesion } = await exigirSesion(request)
    if (sinSesion) return sinSesion

    const { datos, error: invalido } = await leerCuerpo(request, perfilNuevo)
    if (invalido) return invalido

    const perfil = await prisma.usuario.update({
      where: { id: usuario.id },
      data: { nombre: datos.nombre, telefono: datos.telefono },
      select: { email: true, nombre: true, telefono: true },
    })

    return NextResponse.json(perfil)
  } catch (error) {
    console.error('Error guardando el perfil:', error)
    return NextResponse.json({ error: 'Error al guardar el perfil' }, { status: 500 })
  }
}
