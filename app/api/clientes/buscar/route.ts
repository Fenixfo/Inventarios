import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'

/**
 * Búsqueda de clientes mientras se escribe, para el formulario de factura y
 * cotización. Antes el formulario bajaba todos los clientes de la tienda al
 * abrirse para buscar la cédula en el navegador.
 *
 * Por cédula o por nombre, como mucho 10, con los datos que el formulario
 * rellena al elegir uno.
 */

const MAXIMO = 10
const MINIMO = 2

export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, [
      'clientes.ver',
      'facturas.crear',
      'cotizaciones.crear',
    ])
    if (sinPermiso) return sinPermiso

    const texto = (new URL(request.url).searchParams.get('q') || '').trim()
    if (texto.length < MINIMO) return NextResponse.json({ clientes: [] })

    const clientes = await prisma.cliente.findMany({
      where: {
        activo: true,
        tiendaId,
        OR: [
          { cedulaCc: { contains: texto } },
          { nombre: { contains: texto, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        cedulaCc: true,
        email: true,
        telefono: true,
        direccion: true,
        terminoPago: true,
        limiteCredito: true,
      },
      orderBy: { nombre: 'asc' },
      take: MAXIMO,
    })

    return NextResponse.json({
      clientes: clientes.map((c) => ({ ...c, limiteCredito: Number(c.limiteCredito) })),
    })
  } catch (error) {
    console.error('Error buscando clientes:', error)
    return NextResponse.json({ error: 'No se pudieron buscar los clientes' }, { status: 500 })
  }
}
