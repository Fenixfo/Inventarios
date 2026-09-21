import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAVES_PUBLICAS = ['whatsapp_pedidos', 'nombre_empresa']

export async function GET() {
  try {
    const registros = await prisma.configuracion.findMany({
      where: { clave: { in: CLAVES_PUBLICAS } },
      select: { clave: true, valor: true },
    })

    const config = Object.fromEntries(registros.map((r) => [r.clave, r.valor]))

    return NextResponse.json({
      whatsappPedidos: config.whatsapp_pedidos || null,
      nombreEmpresa: config.nombre_empresa || 'Beraca',
    })
  } catch (error) {
    console.error('Error fetching configuración pública:', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    )
  }
}
