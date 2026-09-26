import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { abonoNuevo, leerCuerpo } from '@/lib/esquemas'

export async function POST(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'facturas.abonar')
    if (sinPermiso) return sinPermiso

    // Un monto en texto o un id inventado antes llegaban a la base; ahora se
    // rechazan aquí con el campo que está mal.
    const { datos, error: invalido } = await leerCuerpo(request, abonoNuevo)
    if (invalido) return invalido
    const { facturaId, monto } = datos

    // El abono se registra a nombre de quien lo hace, que sale del token.
    // Antes venía en ?email=, así que cualquiera podía apuntarle un cobro a
    // otra persona con solo cambiar la URL.
    const usuarioId = usuario.id

    // La factura tiene que ser de esta tienda: si no, se podría abonar a
    // la factura de otro negocio conociendo su identificador.
    const factura = await prisma.factura.findFirst({
      where: { id: facturaId, tiendaId },
    })

    if (!factura) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    // Una liquidada ya está cerrada: un abono más cambiaría lo que se liquidó.
    if (factura.estado === 'liquidado') {
      return NextResponse.json(
        { error: 'La factura ya está liquidada y no admite abonos' },
        { status: 409 }
      )
    }

    // Una anulada no se cobra: el abono quedaría sumando a una venta que no existe.
    if (factura.estado === 'anulado') {
      return NextResponse.json(
        { error: 'La factura está anulada y no admite abonos' },
        { status: 409 }
      )
    }

    // El abono y, si con él se completa el total, el paso a "pagado", en la
    // misma operación. Antes lo decidía la pantalla con un efecto al abrir la
    // factura: lo disparaba quien la estuviera mirando, dos pestañas abiertas
    // lo mandaban dos veces, y sin permiso de abonar no ocurría nunca.
    const { abono, estado } = await prisma.$transaction(async (tx) => {
      const abono = await tx.abono.create({
        data: {
          facturaId,
          monto,
          fecha: new Date(),
          usuarioId,
        },
      })

      if (factura.estado !== 'pendiente') return { abono, estado: factura.estado }

      const { _sum } = await tx.abono.aggregate({ where: { facturaId }, _sum: { monto: true } })
      const abonado = Number(factura.anticipo) + Number(_sum.monto || 0)

      if (abonado < Number(factura.total)) return { abono, estado: factura.estado }

      await tx.factura.update({
        where: { id: facturaId },
        data: { estado: 'pagado', fechaPago: new Date() },
      })
      return { abono, estado: 'pagado' }
    })

    // Registrar en auditoría
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId,
          // Sin la tienda, el registro no aparecía en la auditoría de ninguna.
          tiendaId,
          tablaAfectada: 'abonos',
          registroId: abono.id,
          accion: 'CREATE',
          datosDespues: {
            facturaId,
            monto: Number(abono.monto),
            fecha: abono.fecha.toISOString(),
            usuarioId,
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    // `estado` le dice a la pantalla si con este abono la factura quedó pagada.
    return NextResponse.json({
      monto: Number(abono.monto),
      fecha: abono.fecha.toISOString(),
      estado,
    }, { status: 201 })
  } catch (error) {
    console.error('Error al crear abono:', error)
    return NextResponse.json(
      { error: 'Error al crear abono' },
      { status: 500 }
    )
  }
}
