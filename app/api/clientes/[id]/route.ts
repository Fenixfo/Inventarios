import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    // Verificar permisos si se proporciona email
    if (email) {
      const usuario = await prisma.usuario.findUnique({
        where: { email },
        include: { rolesPersonalizados: { include: { rol: { include: { permisos: { include: { modulo: true } } } } } } }
      })

      if (usuario) {
        // Verificar si tiene permiso "clientes"
        const tienePermisoClientes = usuario.rolesPersonalizados?.some((ur: any) =>
          ur.rol.permisos.some((p: any) => p.modulo.modulo === 'clientes')
        )

        // Si no tiene permiso, bloquear acceso
        if (!tienePermisoClientes) {
          return NextResponse.json(
            { error: 'No tienes permiso para ver clientes' },
            { status: 403 }
          )
        }
      }
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id },
    })

    if (!cliente) {
      return NextResponse.json(
        { error: 'Cliente not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(cliente)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching cliente' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params

    await prisma.cliente.update({
      where: { id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error deleting cliente' },
      { status: 400 }
    )
  }
}
