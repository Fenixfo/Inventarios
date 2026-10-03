import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { leerPagina, MINIMO_BUSQUEDA } from '@/lib/paginacion'
import { leerCuerpo, proveedorNuevo } from '@/lib/esquemas'

/**
 * Proveedores de la tienda, para el módulo de compras. No se comparten entre
 * tiendas: la tienda sale siempre de la sesión, nunca del cuerpo.
 */

export async function GET(request: NextRequest) {
  try {
    // Quien registra compras necesita buscar proveedores aunque no pueda
    // administrar compras.
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, ['compras.ver', 'compras.crear'])
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const { limite, desde } = leerPagina(searchParams)
    const busqueda = (searchParams.get('busqueda') || '').trim()

    const where: any = { tiendaId }

    // Por nombre (sin distinguir mayúsculas) o por NIT.
    if (busqueda.length >= MINIMO_BUSQUEDA) {
      where.OR = [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { nit: { contains: busqueda } },
      ]
    }

    const [proveedores, total] = await Promise.all([
      prisma.proveedor.findMany({
        where,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        take: limite,
        skip: desde,
      }),
      prisma.proveedor.count({ where }),
    ])

    return NextResponse.json({ proveedores, total })
  } catch (error) {
    console.error('Error listando proveedores:', error)
    return NextResponse.json({ error: 'No se pudieron obtener los proveedores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'compras.crear')
    if (sinPermiso) return sinPermiso

    const { datos, error: invalido } = await leerCuerpo(request, proveedorNuevo)
    if (invalido) return invalido

    const proveedor = await prisma.proveedor.create({
      // La tienda sale de la sesión: el esquema ya descarta cualquier otra.
      data: { tiendaId, ...datos },
    })

    return NextResponse.json(proveedor, { status: 201 })
  } catch (error: any) {
    // Choque de índice único: aquí solo puede ser el NIT, único por tienda.
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya hay un proveedor con ese NIT en esta tienda' }, { status: 409 })
    }

    console.error('Error creando proveedor:', error)
    return NextResponse.json({ error: 'No se pudo crear el proveedor' }, { status: 500 })
  }
}
