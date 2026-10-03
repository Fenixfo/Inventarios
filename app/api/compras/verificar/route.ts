import { NextRequest, NextResponse } from 'next/server'
import { exigirTienda } from '@/lib/permisos'
import { compraVerificar, leerCuerpo } from '@/lib/esquemas'
import { clasificarLineas } from '@/lib/compras-clasificar'

/**
 * Clasifica las líneas de una compra mientras se escribe: cada SKU es de un
 * producto que ya existe, es nuevo, o es nuevo pero con un nombre parecido al
 * de otro producto (posible duplicado). No escribe nada.
 */
export async function POST(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'compras.crear')
    if (sinPermiso) return sinPermiso

    const { datos, error: invalido } = await leerCuerpo(request, compraVerificar)
    if (invalido) return invalido

    const estados = await clasificarLineas(tiendaId, datos.lineas)

    // En el mismo orden en que llegaron, con el SKU para que la pantalla los empareje.
    return NextResponse.json({
      resultados: estados.map((estado, i) => ({ sku: datos.lineas[i].sku, ...estado })),
    })
  } catch (error) {
    console.error('Error verificando líneas de compra:', error)
    return NextResponse.json({ error: 'No se pudieron verificar las líneas' }, { status: 500 })
  }
}
