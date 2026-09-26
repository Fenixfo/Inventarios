import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { leerPagina, POR_PAGINA } from '@/lib/paginacion'
import { estadosDeVenta } from '@/lib/liquidacion'

export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'reportes.ver')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const estadosParam = searchParams.get('estados')

    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)

    // Determinar qué estados filtrar
    // Las liquidadas ya estaban cobradas: cuentan con las pagadas y entregadas
    // (si no, liquidar haría bajar las ventas del reporte).
    const estadosFiltro = estadosDeVenta(
      estadosParam
        ? estadosParam.split(',').filter((s) => ['pagado', 'entregado', 'pendiente'].includes(s))
        : ['pagado', 'entregado']
    )

    // "Sin movimiento" = productos activos que no aparecen en ninguna factura
    // de los últimos 30 días con los estados elegidos. Se resuelve en la
    // base y por páginas: antes se mandaba la lista entera (175 productos en
    // Beraca) para que la pantalla los pintara todos de una vez.
    const sinMovimientoWhere = {
      activo: true,
      tiendaId,
      NOT: {
        facturasItems: {
          some: { factura: { tiendaId, fecha: { gte: hace30Dias }, estado: { in: estadosFiltro } } },
        },
      },
    }

    const paginaSinMovimiento = (limite: number, desde: number) =>
      Promise.all([
        prisma.producto.findMany({
          where: sinMovimientoWhere,
          select: {
            id: true,
            nombre: true,
            sku: true,
            categoria: true,
            stockActual: true,
            precioUnitario: true,
          },
          // El id desempata dos productos con el mismo nombre, para que una
          // página no repita ni se salte ninguno.
          orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
          take: limite,
          skip: desde,
        }),
        prisma.producto.count({ where: sinMovimientoWhere }),
      ]).then(([filas, total]) => ({
        filas: filas.map((p) => ({
          ...p,
          stockActual: Number(p.stockActual),
          precioUnitario: Number(p.precioUnitario),
        })),
        total,
      }))

    // Stock bajo, también por páginas y del más crítico al menos: mayor
    // déficit frente al mínimo primero. Compara dos columnas y ordena por su
    // diferencia, que Prisma no sabe expresar; por eso va en SQL.
    const paginaStockBajo = (limite: number, desde: number) =>
      Promise.all([
        prisma.$queryRaw<
          { id: string; nombre: string; sku: string; categoria: string; stock_actual: number; stock_minimo: number }[]
        >`
          SELECT id, nombre, sku, categoria,
                 stock_actual::float AS stock_actual,
                 stock_minimo::float AS stock_minimo
            FROM public.productos
           WHERE activo AND tienda_id = ${tiendaId}::uuid AND stock_actual < stock_minimo
           ORDER BY (stock_actual - stock_minimo) ASC, nombre ASC, id ASC
           LIMIT ${limite} OFFSET ${desde}`,
        prisma.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n
            FROM public.productos
           WHERE activo AND tienda_id = ${tiendaId}::uuid AND stock_actual < stock_minimo`,
      ]).then(([filas, [{ n }]]) => ({
        filas: filas.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          sku: p.sku,
          categoria: p.categoria,
          stockActual: Number(p.stock_actual),
          stockMinimo: Number(p.stock_minimo),
          diferencia: Number(p.stock_actual) - Number(p.stock_minimo),
        })),
        total: n,
      }))

    // "Ver más" de una sección: solo la página pedida, sin recalcular el
    // resto del reporte.
    const seccion = searchParams.get('seccion')
    if (seccion === 'sinMovimiento' || seccion === 'stockBajo') {
      const { limite, desde } = leerPagina(searchParams)
      const { filas, total } =
        seccion === 'sinMovimiento'
          ? await paginaSinMovimiento(limite, desde)
          : await paginaStockBajo(limite, desde)
      return NextResponse.json({ [seccion]: filas, total })
    }

    // Las consultas son independientes; en secuencia el reporte pagaba cada
    // ida y vuelta a la base de datos por separado.
    const [productos, facturasRecientes, primeraSinMovimiento, primeraStockBajo] = await Promise.all([
      // Solo lo que usan las métricas de arriba: las secciones ya no salen
      // de esta lista, sino de sus propias consultas por páginas.
      prisma.producto.findMany({
        where: { activo: true, tiendaId },
        select: {
          stockActual: true,
          costo: true,
        },
      }),
      prisma.factura.findMany({
        where: {
          tiendaId,
          fecha: { gte: hace30Dias },
          estado: { in: estadosFiltro },
        },
        select: {
          items: {
            select: {
              productoId: true,
              productoNombre: true,
              cantidadM2: true,
              subtotal: true,
              producto: { select: { nombre: true } },
            },
          },
        },
      }),
      paginaSinMovimiento(POR_PAGINA, 0),
      paginaStockBajo(POR_PAGINA, 0),
    ])

    // Calcular rotación por producto (últimos 30 días)
    const rotacionPorProducto = new Map<
      string,
      { nombre: string; cantidad: number; ingresos: number }
    >()

    facturasRecientes.forEach((factura) => {
      factura.items.forEach((item) => {
        const productoNombre = item.productoNombre || item.producto?.nombre || '(Personalizado)'
        const actual = rotacionPorProducto.get(productoNombre) || {
          nombre: productoNombre,
          cantidad: 0,
          ingresos: 0,
        }
        actual.cantidad += Number(item.cantidadM2)
        actual.ingresos += Number(item.subtotal)
        rotacionPorProducto.set(productoNombre, actual)
      })
    })

    const rotacion = Array.from(rotacionPorProducto.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

    // Calcular métricas
    const totalProductos = productos.length
    const productosActivos = productos.filter((p) => Number(p.stockActual) > 0).length
    // El inventario se valora al costo, que es lo que realmente está
    // inmovilizado en bodega; a precio de venta la cifra incluye un margen
    // que todavía no se ha ganado. Sin costo cargado, ese producto no suma.
    const valorInventario = productos.reduce(
      (sum, p) => sum + Number(p.stockActual) * Number(p.costo || 0),
      0
    )

    const productosSinCosto = productos.filter((p) => !p.costo).length

    return NextResponse.json({
      metricas: {
        totalProductos,
        productosActivos,
        productosStockBajo: primeraStockBajo.total,
        productosSinMovimiento: primeraSinMovimiento.total,
        valorInventario: Math.round(valorInventario * 100) / 100,
        productosSinCosto,
      },
      // Los primeros 10 de cada sección; el resto con ?seccion=…&desde=10.
      stockBajo: primeraStockBajo.filas,
      rotacion,
      // Los primeros 10; el resto con ?seccion=sinMovimiento&desde=10.
      sinMovimiento: primeraSinMovimiento.filas,
      periodo: {
        desde: hace30Dias.toISOString(),
        hasta: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Error en reportes de inventario:', error)
    return NextResponse.json(
      { error: error.message || 'Error al generar reporte de inventario' },
      { status: 500 }
    )
  }
}
