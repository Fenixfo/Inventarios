import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
// GET: Obtener todos los módulos de permisos
export async function GET() {
  try {
    const modulos = await prisma.permisoModulo.findMany({
      where: {
        modulo: {
          notIn: ['dashboard']
        }
      },
      orderBy: { modulo: 'asc' }
    })

    return NextResponse.json(modulos)
  } catch (error: any) {
    console.error('Error obteniendo módulos:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener módulos' },
      { status: 500 }
    )
  }
}
