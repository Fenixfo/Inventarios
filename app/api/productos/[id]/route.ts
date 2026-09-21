import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
        // Verificar si tiene permiso "productos"
        const tienePermisoProductos = usuario.rolesPersonalizados?.some((ur: any) =>
          ur.rol.permisos.some((p: any) => p.modulo.modulo === 'productos')
        )

        // Si no tiene permiso, bloquear acceso
        if (!tienePermisoProductos) {
          return NextResponse.json(
            { error: 'No tienes permiso para ver productos' },
            { status: 403 }
          )
        }
      }
    }

    const producto = await prisma.producto.findUnique({
      where: { id },
    })

    if (!producto) {
      return NextResponse.json(
        { error: 'Producto not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(producto)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error fetching producto' },
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

    await prisma.producto.update({
      where: { id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error deleting producto' },
      { status: 400 }
    )
  }
}
