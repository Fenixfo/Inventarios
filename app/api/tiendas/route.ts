import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirSesion } from '@/lib/permisos'

export async function GET(request: NextRequest) {
  try {
    // Solo exige sesión: la usa /request-access, donde el usuario todavía no
    // tiene permisos y necesita elegir a qué tienda pedir acceso.
    const { error: sinSesion } = await exigirSesion(request)
    if (sinSesion) return sinSesion

    const tiendas = await prisma.tienda.findMany({
      where: { activo: true },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        ciudad: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    })

    return NextResponse.json(tiendas)
  } catch (error: any) {
    console.error('Error fetching tiendas:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener tiendas' },
      { status: 500 }
    )
  }
}
