import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CLAVES_PUBLICAS = ['whatsapp_pedidos']

/**
 * Datos que el catálogo necesita sin que nadie haya iniciado sesión: a qué
 * WhatsApp van los pedidos y cómo se llama la tienda.
 *
 * Con `?tienda=<id>` responde por esa tienda. Sin parámetro devuelve la más
 * antigua, que es la del catálogo de la portada; cuando cada tienda tenga
 * su propia URL (TASK-49) el parámetro pasará a ser lo normal.
 */
export async function GET(request: NextRequest) {
  try {
    const pedida = request.nextUrl.searchParams.get('tienda')

    const tienda = pedida
      ? await prisma.tienda.findFirst({
          where: { id: pedida, activo: true },
          select: { id: true, nombre: true },
        })
      : await prisma.tienda.findFirst({
          where: { activo: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, nombre: true },
        })

    if (!tienda) {
      return NextResponse.json({ whatsappPedidos: null, nombreEmpresa: null })
    }

    const registros = await prisma.configuracion.findMany({
      where: { tiendaId: tienda.id, clave: { in: CLAVES_PUBLICAS } },
      select: { clave: true, valor: true },
    })

    const config = Object.fromEntries(registros.map((r) => [r.clave, r.valor]))

    return NextResponse.json({
      whatsappPedidos: config.whatsapp_pedidos || null,
      nombreEmpresa: tienda.nombre,
    })
  } catch (error) {
    console.error('Error fetching configuración pública:', error)
    return NextResponse.json(
      { error: 'Error al obtener configuración' },
      { status: 500 }
    )
  }
}
