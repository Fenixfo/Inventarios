import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    // Verificar permisos si se proporciona email
    if (email) {
      const usuario = await prisma.usuario.findUnique({
        where: { email },
        include: { rolesPersonalizados: { include: { rol: { include: { permisos: { include: { modulo: true } } } } } } }
      })

      if (usuario) {
        // Verificar si tiene permiso "reportes"
        const tienePermisoReportes = usuario.rolesPersonalizados?.some((ur: any) =>
          ur.rol.permisos.some((p: any) => p.modulo.modulo === 'reportes')
        )

        // Si no tiene permiso, bloquear acceso
        if (!tienePermisoReportes) {
          return NextResponse.json(
            { error: 'No tienes permiso para ver reportes' },
            { status: 403 }
          )
        }
      }
    }

    // Obtener todos los productos activos
    const productos = await prisma.producto.findMany({
      where: { activo: true },
    })

    // Obtener facturas pagadas de los últimos 30 días para calcular rotación
    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)

    const facturasRecientes = await prisma.factura.findMany({
      where: {
        fecha: {
          gte: hace30Dias,
        },
        estado: 'pagado',
      },
      include: {
        items: {
          include: {
            producto: true,
          },
        },
      },
    })

    // Calcular rotación por producto (últimos 30 días)
    const rotacionPorProducto = new Map<
      string,
      { nombre: string; cantidad: number; ingresos: number }
    >()

    facturasRecientes.forEach((factura) => {
      factura.items.forEach((item) => {
        const productoNombre = item.producto?.nombre || '(Personalizado)'
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
    const valorInventario = productos.reduce(
      (sum, p) => sum + Number(p.stockActual) * Number(p.precioUnitario),
      0
    )

    return NextResponse.json({
      metricas: {
        totalProductos,
        productosActivos,
        productosStockBajo: stockBajo.length,
        productosSinMovimiento: sinMovimiento.length,
        valorInventario: Math.round(valorInventario * 100) / 100,
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
