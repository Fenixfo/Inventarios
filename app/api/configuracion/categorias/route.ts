import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { claveImagenCategoria, urlImagenValida } from '@/lib/categoria-imagen'

/**
 * La imagen de portada de cada categoría de la tienda, para el catálogo
 * `/catalogo/<tienda>`. Vive aparte de /api/configuracion porque allí las
 * claves son una lista cerrada, y aquí hay una por categoría.
 */

const schema = z.object({
  categoria: z.string().trim().min(1).max(100),
  imagenUrl: z
    .string()
    .trim()
    .max(500)
    .refine(urlImagenValida, { message: 'La imagen debe ser una URL que empiece por http:// o https://' }),
})

export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'productos.ver')
    if (sinPermiso) return sinPermiso

    const [grupos, registros] = await Promise.all([
      prisma.producto.groupBy({
        by: ['categoria'],
        where: { tiendaId, activo: true },
        _count: { _all: true },
        orderBy: { categoria: 'asc' },
      }),
      prisma.configuracion.findMany({
        where: { tiendaId, clave: { startsWith: 'cat_img_' } },
        select: { clave: true, valor: true },
      }),
    ])

    const config = Object.fromEntries(registros.map((r) => [r.clave, r.valor]))

    return NextResponse.json({
      categorias: grupos.map((g) => ({
        nombre: g.categoria,
        imagenUrl: config[claveImagenCategoria(g.categoria)] || '',
        total: g._count._all,
      })),
    })
  } catch (error) {
    console.error('Error obteniendo imágenes de categorías:', error)
    return NextResponse.json({ error: 'Error al obtener las categorías' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { usuario, tiendaId, error: sinPermiso } = await exigirTienda(request, 'productos.editar')
    if (sinPermiso) return sinPermiso

    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { categoria, imagenUrl } = parsed.data

    // Solo categorías que existen en la tienda: si no, cualquiera podría
    // llenar la configuración de claves sueltas.
    const existe = await prisma.producto.findFirst({
      where: { tiendaId, categoria, activo: true },
      select: { id: true },
    })
    if (!existe) {
      return NextResponse.json({ error: 'Esa categoría no existe en tu tienda' }, { status: 404 })
    }

    const clave = claveImagenCategoria(categoria)

    if (imagenUrl === '') {
      await prisma.configuracion.deleteMany({ where: { tiendaId, clave } })
    } else {
      await prisma.configuracion.upsert({
        where: { tiendaId_clave: { tiendaId, clave } },
        create: { tiendaId, clave, valor: imagenUrl, tipo: 'url', updatedBy: usuario.id },
        update: { valor: imagenUrl, updatedBy: usuario.id },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error guardando imagen de categoría:', error)
    return NextResponse.json({ error: 'Error al guardar la imagen' }, { status: 500 })
  }
}
