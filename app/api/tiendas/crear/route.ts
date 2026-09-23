import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'
// Este endpoint es solo para desarrollo
export async function POST(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'configuracion.editar')
    if (sinPermiso) return sinPermiso

    const { nombre, descripcion, ciudad } = await request.json()

    if (!nombre) {
      return NextResponse.json(
        { error: 'nombre es requerido' },
        { status: 400 }
      )
    }

    const tienda = await prisma.tienda.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        ciudad: ciudad || null,
        activo: true,
      },
    })

    return NextResponse.json(tienda, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al crear tienda' },
      { status: 500 }
    )
  }
}
