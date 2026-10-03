import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { leerCuerpo, proveedorNuevo } from '@/lib/esquemas'

const esId = (id: string) => z.string().uuid().safeParse(id).success

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, ['compras.ver', 'compras.crear'])
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    if (!esId(id)) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    // Con la tienda en el where, el de otra tienda responde "no encontrado".
    const proveedor = await prisma.proveedor.findFirst({ where: { id, tiendaId } })
    if (!proveedor) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    return NextResponse.json(proveedor)
  } catch (error) {
    console.error('Error obteniendo proveedor:', error)
    return NextResponse.json({ error: 'No se pudo obtener el proveedor' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'compras.crear')
    if (sinPermiso) return sinPermiso

    const { id } = await context.params
    if (!esId(id)) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    const { datos, error: invalido } = await leerCuerpo(request, proveedorNuevo)
    if (invalido) return invalido

    // Se comprueba que sea de esta tienda antes de modificarlo.
    const propio = await prisma.proveedor.findFirst({ where: { id, tiendaId }, select: { id: true } })
    if (!propio) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    // Editar el proveedor no toca las compras ya registradas con él: guardan
    // el enlace por id, no una copia de sus datos.
    const proveedor = await prisma.proveedor.update({ where: { id }, data: datos })
    return NextResponse.json(proveedor)
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya hay un proveedor con ese NIT en esta tienda' }, { status: 409 })
    }

    console.error('Error editando proveedor:', error)
    return NextResponse.json({ error: 'No se pudo actualizar el proveedor' }, { status: 500 })
  }
}
