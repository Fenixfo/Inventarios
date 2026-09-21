import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// GET: Obtener roles disponibles para asignar a un usuario
export async function GET(
  _request: any,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    // Obtener usuario con sus roles actuales
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        rolesPersonalizados: true
      }
    })

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Obtener todos los roles disponibles (excepto Owner)
    const rolesDisponibles = await prisma.rolPersonalizado.findMany({
      where: {
        activo: true,
        nombre: { not: 'Owner' }
      },
      include: {
        permisos: { include: { modulo: true } }
      },
      orderBy: { nombre: 'asc' }
    })

    // Marcar cuáles roles ya tiene el usuario
    const rolesConEstado = rolesDisponibles.map(rol => ({
      ...rol,
      asignado: usuario.rolesPersonalizados.some(ur => ur.rolId === rol.id)
    }))

    return NextResponse.json(rolesConEstado)
  } catch (error: any) {
    console.error('Error obteniendo roles disponibles:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener roles disponibles' },
      { status: 500 }
    )
  }
}
