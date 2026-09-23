import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'
// POST: Asignar rol personalizado a usuario
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'usuarios.gestionar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    const { rolId } = await request.json()

    if (!rolId) {
      return NextResponse.json(
        { error: 'Rol ID es requerido' },
        { status: 400 }
      )
    }

    // Verificar que el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id }
    })

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el rol existe
    const rol = await prisma.rolPersonalizado.findUnique({
      where: { id: rolId }
    })

    if (!rol) {
      return NextResponse.json(
        { error: 'Rol no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si ya tiene el rol
    const yaAsignado = await prisma.usuarioRolPersonalizado.findFirst({
      where: {
        usuarioId: id,
        rolId
      }
    })

    if (yaAsignado) {
      return NextResponse.json(
        { error: 'El usuario ya tiene este rol' },
        { status: 400 }
      )
    }

    // Asignar rol
    await prisma.usuarioRolPersonalizado.create({
      data: {
        usuarioId: id,
        rolId
      }
    })

    // Retornar usuario actualizado
    const usuarioActualizado = await prisma.usuario.findUnique({
      where: { id },
      include: {
        roles: true,
        rolesPersonalizados: {
          include: { rol: { include: { permisos: { include: { modulo: true } } } } }
        },
        tiendas: { include: { tienda: true } }
      }
    })

    return NextResponse.json(usuarioActualizado)
  } catch (error: any) {
    console.error('Error asignando rol:', error)
    return NextResponse.json(
      { error: error.message || 'Error al asignar rol' },
      { status: 500 }
    )
  }
}

// DELETE: Remover rol personalizado de usuario
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'usuarios.gestionar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    const { rolId } = await request.json()

    if (!rolId) {
      return NextResponse.json(
        { error: 'Rol ID es requerido' },
        { status: 400 }
      )
    }

    // Verificar que la asignación existe
    const asignacion = await prisma.usuarioRolPersonalizado.findFirst({
      where: {
        usuarioId: id,
        rolId
      }
    })

    if (!asignacion) {
      return NextResponse.json(
        { error: 'El usuario no tiene este rol' },
        { status: 404 }
      )
    }

    // Remover rol
    await prisma.usuarioRolPersonalizado.delete({
      where: { id: asignacion.id }
    })

    // Retornar usuario actualizado
    const usuarioActualizado = await prisma.usuario.findUnique({
      where: { id },
      include: {
        roles: true,
        rolesPersonalizados: {
          include: { rol: { include: { permisos: { include: { modulo: true } } } } }
        },
        tiendas: { include: { tienda: true } }
      }
    })

    return NextResponse.json(usuarioActualizado)
  } catch (error: any) {
    console.error('Error removiendo rol:', error)
    return NextResponse.json(
      { error: error.message || 'Error al remover rol' },
      { status: 500 }
    )
  }
}
