import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'

export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'reportes.ver')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const estadosParam = searchParams.get('estados')

    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)

    // Determinar qué estados filtrar
    const estadosFiltro = estadosParam
      ? estadosParam.split(',').filter((s) => ['pagado', 'entregado', 'pendiente'].includes(s))
      : ['pagado', 'entregado']

    // Las dos consultas son independientes; en secuencia el reporte pagaba
    // dos veces la ida y vuelta a la base de datos.
    const [productos, facturasRecientes] = await Promise.all([
      prisma.producto.findMany({
        where: { activo: true, tiendaId },
        select: {
          id: true,
          sku: true,
          nombre: true,
          categoria: true,
          stockActual: true,
          stockMinimo: true,
          precioUnitario: true,
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

    // Producto IDs con movimiento
    const productosConMovimiento = new Set<string>()
    facturasRecientes.forEach((factura) => {
      factura.items.forEach((item) => {
        if (item.productoId) {
          productosConMovimiento.add(item.productoId)
        }
      })
    })

    // Clasificar productos
    const stockBajo = productos
      .filter((p) => Number(p.stockActual) < Number(p.stockMinimo))
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        sku: p.sku,
        categoria: p.categoria,
        stockActual: Number(p.stockActual),
        stockMinimo: Number(p.stockMinimo),
        diferencia: Number(p.stockActual) - Number(p.stockMinimo),
      }))
      .sort((a, b) => a.diferencia - b.diferencia)

    const rotacion = Array.from(rotacionPorProducto.values())
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

    const sinMovimiento = productos
      .filter((p) => !productosConMovimiento.has(p.id))
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        sku: p.sku,
        categoria: p.categoria,
        stockActual: Number(p.stockActual),
        precioUnitario: Number(p.precioUnitario),
      }))

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
        productosStockBajo: stockBajo.length,
        productosSinMovimiento: sinMovimiento.length,
        valorInventario: Math.round(valorInventario * 100) / 100,
        productosSinCosto,
      },
      stockBajo,
      rotacion,
      sinMovimiento,
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
