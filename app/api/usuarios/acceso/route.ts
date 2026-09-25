import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda, esOwner, olvidarCache } from '@/lib/permisos'
import { z } from 'zod'

const schema = z.object({
  usuarioIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos un usuario'),
})

/**
 * Saca a alguien de la tienda.
 *
 * No borra su cuenta —esa es de la persona, no de la tienda— sino el
 * vínculo con este negocio: deja de aparecer en el listado y pierde el
 * acceso. Para volver tendrá que pedirlo otra vez con el código.
 *
 * Es distinto de quitarle todos los permisos: eso deja a alguien dentro
 * pero sin poder abrir nada, que es lo que se hace con quien está de
 * vacaciones o en revisión.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { usuario: solicitante, tiendaId, error } = await exigirTienda(
      request,
      'usuarios.gestionar'
    )
    if (error) return error

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { usuarioIds } = parsed.data
    const afectados: { email: string }[] = []

    for (const usuarioId of usuarioIds) {
      const relacion = await prisma.usuarioTienda.findUnique({
        where: { usuarioId_tiendaId: { usuarioId, tiendaId } },
        include: { usuario: { select: { email: true } } },
      })
      if (!relacion) continue

      // Al dueño no lo saca nadie, ni siquiera él mismo: se comprueba antes
      // que lo de salirse solo, porque a un dueño no le sirve el consejo de
      // usar el menú — de su propia tienda no puede salir por ningún lado.
      if (relacion.esOwner) {
        return NextResponse.json(
          { error: 'No se puede sacar al dueño de su propia tienda' },
          { status: 403 }
        )
      }

      if (usuarioId === solicitante.id) {
        return NextResponse.json(
          { error: 'Para salirte tú de la tienda, usa la opción de salir en el menú de tiendas' },
          { status: 400 }
        )
      }

      // A un administrador solo lo saca el dueño, igual que solo el dueño
      // puede retirarle el cargo.
      if (relacion.esAdmin && !esOwner(solicitante, tiendaId)) {
        return NextResponse.json(
          {
            error: `${relacion.usuario.email} es administrador: solo el dueño puede sacarlo de la tienda`,
          },
          { status: 403 }
        )
      }

      await prisma.$transaction([
        // Los permisos asignados se van con el vínculo, por la cascada.
        prisma.usuarioTienda.delete({ where: { id: relacion.id } }),
        // Y también las solicitudes anteriores: si quedaran, la persona no
        // podría volver a pedir acceso porque el sistema vería una ya
        // resuelta y la rechazaría.
        prisma.solicitudAcceso.deleteMany({ where: { usuarioId, tiendaId } }),
      ])

      afectados.push({ email: relacion.usuario.email })
      olvidarCache(relacion.usuario.email)

      try {
        await prisma.auditoria.create({
          data: {
            usuarioId: solicitante.id,
            tiendaId,
            tablaAfectada: 'usuarios_tiendas',
            registroId: relacion.id,
            accion: 'DELETE',
            datosAntes: {
              usuario: relacion.usuario.email,
              esAdmin: relacion.esAdmin,
            },
          },
        })
      } catch (auditError) {
        console.error('Error registrando auditoría:', auditError)
      }
    }

    return NextResponse.json({ ok: true, afectados })
  } catch (error: any) {
    console.error('Error sacando de la tienda:', error)
    return NextResponse.json({ error: 'Error al sacar de la tienda' }, { status: 500 })
  }
}
