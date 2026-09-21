import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export async function GET() {
  try {
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
