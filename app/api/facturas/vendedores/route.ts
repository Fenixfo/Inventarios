import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, puede } from '@/lib/permisos'

/**
 * Las personas de la tienda a cuyo nombre se puede facturar.
 *
 * Solo las ve quien puede facturar a nombre de otros (dueño, administrador
 * o con el permiso 'facturas.a_nombre_de_otros'); los demás reciben una
 * lista vacía y la pantalla no muestra la caja. El servidor vuelve a
 * comprobar el permiso al crear la factura: esto es solo para pintar la UI.
 */
export async function GET(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.crear')
    if (sinPermiso) return sinPermiso

    if (!puede(usuario, 'facturas.a_nombre_de_otros', tiendaId)) {
      return NextResponse.json({ puede: false, vendedores: [] })
    }

    const relaciones = await prisma.usuarioTienda.findMany({
      where: { tiendaId },
      select: { usuario: { select: { id: true, email: true, nombre: true } } },
    })

    const vendedores = relaciones
      .map(({ usuario: u }) => ({
        id: u.id,
        etiqueta: u.nombre ? `${u.nombre} (${u.email})` : u.email,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))

    return NextResponse.json({ puede: true, yo: usuario.id, vendedores })
  } catch (error) {
    console.error('Error listando vendedores:', error)
    return NextResponse.json({ error: 'No se pudo cargar la lista de usuarios' }, { status: 500 })
  }
}
