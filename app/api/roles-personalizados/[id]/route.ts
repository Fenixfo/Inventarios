import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'
// PATCH: Actualizar rol personalizado
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'usuarios.gestionar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    const { nombre, descripcion, permisoIds } = await request.json()

    // Verificar que el rol existe
    const rol = await prisma.rolPersonalizado.findUnique({
      where: { id }
    })

    if (!rol) {
      return NextResponse.json(
        { error: 'Rol no encontrado' },
        { status: 404 }
      )
    }

    // Actualizar rol
    const rolActualizado = await prisma.rolPersonalizado.update({
      where: { id },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion !== undefined && { descripcion: descripcion || null }),
      },
      include: {
        permisos: { include: { modulo: true } }
      }
    })

    // Actualizar permisos si se pasan
    if (permisoIds && Array.isArray(permisoIds)) {
      // Eliminar permisos existentes
      await prisma.permisoRolPersonalizado.deleteMany({
        where: { rolId: id }
      })

      // Agregar nuevos permisos
      for (const moduloId of permisoIds) {
        await prisma.permisoRolPersonalizado.create({
          data: {
            rolId: id,
            moduloId
          }
        })
      }
    }

    // Obtener rol actualizado
    const rolFinal = await prisma.rolPersonalizado.findUnique({
      where: { id },
      include: {
        permisos: { include: { modulo: true } }
      }
    })

    return NextResponse.json(rolFinal)
  } catch (error: any) {
    console.error('Error actualizando rol:', error)
    return NextResponse.json(
      { error: error.message || 'Error al actualizar rol' },
      { status: 500 }
    )
  }
}

// DELETE: Eliminar rol personalizado
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'usuarios.gestionar')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params

    // Verificar que el rol existe
    const rol = await prisma.rolPersonalizado.findUnique({
      where: { id }
    })

    if (!rol) {
      return NextResponse.json(
        { error: 'Rol no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si hay usuarios asignados
    const usuariosAsignados = await prisma.usuarioRolPersonalizado.count({
      where: { rolId: id }
    })

    if (usuariosAsignados > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar el rol. Hay ${usuariosAsignados} usuario(s) asignado(s)` },
        { status: 400 }
      )
    }

    // Eliminar permisos
    await prisma.permisoRolPersonalizado.deleteMany({
      where: { rolId: id }
    })

    // Eliminar rol
    await prisma.rolPersonalizado.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Rol eliminado correctamente' })
  } catch (error: any) {
    console.error('Error eliminando rol:', error)
    return NextResponse.json(
      { error: error.message || 'Error al eliminar rol' },
      { status: 500 }
    )
  }
}
