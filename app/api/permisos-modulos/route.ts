import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET: Obtener todos los módulos de permisos
export async function GET() {
  try {
    const modulos = await prisma.permisoModulo.findMany({
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
