import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')

    const where: any = {
      activo: true,
      stockActual: {
        gt: 0
      }
    }
    if (categoria) {
      where.categoria = categoria
    }

    const productos = await prisma.producto.findMany({
      where,
      select: {
        id: true,
        imagenUrl: true,
        nombre: true,
        sku: true,
        categoria: true,
        dimensiones: true,
        color: true,
        acabado: true,
        m2PorCaja: true,
        precioUnitario: true,
      },
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json(productos)
  } catch (error) {
    console.error('Error fetching catálogo:', error)
    return NextResponse.json(
      { error: 'Error al obtener catálogo' },
      { status: 500 }
    )
  }
}
