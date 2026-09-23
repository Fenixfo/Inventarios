import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso, esOwner, olvidarCache } from '@/lib/permisos'
import { z } from 'zod'

const asignacionSchema = z.object({
  usuarioIds: z.array(z.string().uuid()).min(1, 'Selecciona al menos un usuario'),
  permisos: z.array(z.string()).default([]),
  /** 'agregar' conserva lo que ya tenían; 'reemplazar' deja solo lo enviado. */
  modo: z.enum(['agregar', 'reemplazar']).default('agregar'),
  /** Nombrar o retirar administradores. Solo lo puede hacer el dueño. */
  esAdmin: z.boolean().optional(),
  tiendaId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { usuario: solicitante, error } = await exigirPermiso(request, 'usuarios.gestionar')
    if (error) return error

    const parsed = asignacionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { usuarioIds, permisos, modo, esAdmin } = parsed.data
    const tiendaId = parsed.data.tiendaId || solicitante.tienda?.tiendaId

    if (!tiendaId) {
      return NextResponse.json({ error: 'No hay tienda seleccionada' }, { status: 400 })
    }

    // Solo el dueño nombra o retira administradores.
    if (esAdmin !== undefined && !esOwner(solicitante, tiendaId)) {
      return NextResponse.json(
        { error: 'Solo el dueño de la tienda puede nombrar administradores' },
        { status: 403 }
      )
    }

    const catalogo = await prisma.permiso.findMany()
    const porClave = new Map(catalogo.map((p) => [`${p.modulo}.${p.accion}`, p.id]))

    const desconocidos = permisos.filter((p) => !porClave.has(p))
    if (desconocidos.length) {
      return NextResponse.json(
        { error: `Permisos no reconocidos: ${desconocidos.join(', ')}` },
        { status: 400 }
      )
    }

    const afectados: { email: string; permisos: number }[] = []

    for (const usuarioId of usuarioIds) {
      const objetivo = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, email: true },
      })
      if (!objetivo) continue

      let relacion = await prisma.usuarioTienda.findUnique({
        where: { usuarioId_tiendaId: { usuarioId, tiendaId } },
      })

      // Nadie puede modificar al dueño, ni siquiera un administrador.
      if (relacion?.esOwner) {
        return NextResponse.json(
          { error: `${objetivo.email} es el dueño de la tienda y no se puede modificar` },
          { status: 403 }
        )
      }

      if (!relacion) {
        relacion = await prisma.usuarioTienda.create({
          data: { usuarioId, tiendaId },
        })
      }

      if (esAdmin !== undefined) {
        relacion = await prisma.usuarioTienda.update({
          where: { id: relacion.id },
          data: { esAdmin },
        })
      }

      if (modo === 'reemplazar') {
        await prisma.permisoAsignado.deleteMany({ where: { usuarioTiendaId: relacion.id } })
      }

      for (const clave of permisos) {
        const permisoId = porClave.get(clave)!
        await prisma.permisoAsignado.upsert({
          where: { usuarioTiendaId_permisoId: { usuarioTiendaId: relacion.id, permisoId } },
          create: { usuarioTiendaId: relacion.id, permisoId, asignadoPor: solicitante.id },
          update: {},
        })
      }

      const total = await prisma.permisoAsignado.count({
        where: { usuarioTiendaId: relacion.id },
      })
      afectados.push({ email: objetivo.email, permisos: total })

      // El caché guarda los permisos un minuto; sin esto el cambio tardaría
      // en notarse.
      olvidarCache(objetivo.email)

      try {
        await prisma.auditoria.create({
          data: {
            usuarioId: solicitante.id,
            tablaAfectada: 'permisos_asignados',
            registroId: relacion.id,
            accion: 'UPDATE',
            datosDespues: { usuario: objetivo.email, permisos, modo, esAdmin },
          },
        })
      } catch (auditError) {
        console.error('Error registrando auditoría:', auditError)
      }
    }

    return NextResponse.json({ ok: true, afectados })
  } catch (error: any) {
    console.error('Error asignando permisos:', error)
    return NextResponse.json({ error: 'Error al asignar permisos' }, { status: 500 })
  }
}

/** Quita permisos concretos a varios usuarios. */
export async function DELETE(request: NextRequest) {
  try {
    const { usuario: solicitante, error } = await exigirPermiso(request, 'usuarios.gestionar')
    if (error) return error

    const parsed = asignacionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { usuarioIds, permisos } = parsed.data
    const tiendaId = parsed.data.tiendaId || solicitante.tienda?.tiendaId
    if (!tiendaId) {
      return NextResponse.json({ error: 'No hay tienda seleccionada' }, { status: 400 })
    }

    const catalogo = await prisma.permiso.findMany()
    const ids = permisos
      .map((clave) => catalogo.find((p) => `${p.modulo}.${p.accion}` === clave)?.id)
      .filter(Boolean) as string[]

    for (const usuarioId of usuarioIds) {
      const relacion = await prisma.usuarioTienda.findUnique({
        where: { usuarioId_tiendaId: { usuarioId, tiendaId } },
        include: { usuario: { select: { email: true } } },
      })
      if (!relacion) continue

      if (relacion.esOwner) {
        return NextResponse.json(
          { error: 'No se le pueden retirar permisos al dueño de la tienda' },
          { status: 403 }
        )
      }

      await prisma.permisoAsignado.deleteMany({
        where: { usuarioTiendaId: relacion.id, permisoId: { in: ids } },
      })

      olvidarCache(relacion.usuario.email)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error quitando permisos:', error)
    return NextResponse.json({ error: 'Error al quitar permisos' }, { status: 500 })
  }
}
