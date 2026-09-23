import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'
// POST: Asignar rol a usuario
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'usuarios.gestionar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    const { rol } = await request.json()

    if (!rol) {
      return NextResponse.json(
        { error: 'Rol es requerido' },
        { status: 400 }
      )
    }

    const rolesValidos = ['admin', 'user']
    if (!rolesValidos.includes(rol)) {
      return NextResponse.json(
        { error: `Rol debe ser uno de: ${rolesValidos.join(', ')}` },
        { status: 400 }
      )
    }

    // Verificar si el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { roles: true }
    })

    if (!usuario) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si ya tiene el rol
    const tieneRol = usuario.roles.some(r => r.rol === rol)
    if (tieneRol) {
      return NextResponse.json(
        { error: 'El usuario ya tiene este rol' },
        { status: 400 }
      )
    }

    // Asignar rol
    await prisma.usuarioRol.create({
      data: {
        usuarioId: id,
        rol
      }
    })

    // Retornar usuario actualizado
    const usuarioActualizado = await prisma.usuario.findUnique({
      where: { id },
      include: {
        roles: true,
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

// DELETE: Remover rol de usuario
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'usuarios.gestionar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    const { rol } = await request.json()

    if (!rol) {
      return NextResponse.json(
        { error: 'Rol es requerido' },
        { status: 400 }
      )
    }

    // Verificar que el usuario tenga el rol
    const usuarioRol = await prisma.usuarioRol.findFirst({
      where: {
        usuarioId: id,
        rol
      }
    })

    if (!usuarioRol) {
      return NextResponse.json(
        { error: 'El usuario no tiene este rol' },
        { status: 404 }
      )
    }

    // Remover rol
    await prisma.usuarioRol.delete({
      where: { id: usuarioRol.id }
    })

    // Retornar usuario actualizado
    const usuarioActualizado = await prisma.usuario.findUnique({
      where: { id },
      include: {
        roles: true,
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
