import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirTienda } from '@/lib/permisos'
import { diaColombiano } from '@/lib/fechas'
export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'reportes.ver')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get('periodo') || 'mes' // hoy, semana, mes, personalizado
    const fechaInicio = searchParams.get('fechaInicio')
    const fechaFin = searchParams.get('fechaFin')

    let desde: Date
    let hasta: Date = new Date()

    // Definir rango de fechas según período
    switch (periodo) {
      case 'hoy':
        desde = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
        break
      case 'semana':
        desde = new Date(hasta)
        desde.setDate(hasta.getDate() - 7)
        break
      case 'mes':
        desde = new Date(hasta)
        desde.setMonth(hasta.getMonth() - 1)
        break
      case 'personalizado':
        if (!fechaInicio || !fechaFin) {
          return NextResponse.json(
            { error: 'Debe proporcionar fechaInicio y fechaFin para período personalizado' },
            { status: 400 }
          )
        }
        desde = new Date(fechaInicio)
        hasta = new Date(fechaFin)
        break
      default:
        desde = new Date(hasta)
        desde.setMonth(hasta.getMonth() - 1)
    }

    // A diferencia del listado de facturas, los reportes no distinguen autoría:
    // quien tiene el permiso ve las cifras de toda la tienda.

    // Determinar qué estados filtrar
    const estadosParam = searchParams.get('estados')
    const estadosFiltro = estadosParam
      ? estadosParam.split(',').filter((s) => ['pagado', 'entregado', 'pendiente'].includes(s))
      : ['pagado', 'entregado']

    // Obtener facturas en el rango
    const facturas = await prisma.factura.findMany({
      where: {
        tiendaId,
        fecha: {
          gte: desde,
          lte: hasta,
        },
        estado: { in: estadosFiltro },

      },
      include: {
        cliente: true,
        items: {
          include: {
            producto: true,
          },
        },
      },
    })

    // Calcular métricas
    const totalVendido = facturas.reduce((sum, f) => sum + Number(f.total), 0)
    const numeroFacturas = facturas.length
    const promedioPorFactura = numeroFacturas > 0 ? totalVendido / numeroFacturas : 0

    // Cliente con más ventas
    const ventasPorCliente = new Map<string, { nombre: string; total: number; cantidad: number }>()
    facturas.forEach((factura) => {
      const clienteNombre = factura.cliente?.nombre || 'Cliente General'
      const actual = ventasPorCliente.get(clienteNombre) || {
        nombre: clienteNombre,
        total: 0,
        cantidad: 0,
      }
      actual.total += Number(factura.total)
      actual.cantidad += 1
      ventasPorCliente.set(clienteNombre, actual)
    })

    const clienteTop = Array.from(ventasPorCliente.values()).sort(
      (a, b) => b.total - a.total
    )[0] || null

    // Ventas por día (para gráfico)
    const ventasPorDia = new Map<string, number>()
    facturas.forEach((factura) => {
      // El día al que pertenece la venta aquí: una de las 8 de la noche
      // es del 24, aunque en UTC ya sea el 25.
      const fecha = diaColombiano(factura.fecha)
      const actual = ventasPorDia.get(fecha) || 0
      ventasPorDia.set(fecha, actual + Number(factura.total))
    })

    const ventasPorDiaArray = Array.from(ventasPorDia.entries())
      .map(([fecha, total]) => ({
        fecha,
        total: Math.round(total * 100) / 100,
      }))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

    // Productos más vendidos
    const ventasPorProducto = new Map<string, { nombre: string; cantidad: number; ingresos: number }>()
    facturas.forEach((factura) => {
      factura.items.forEach((item) => {
        const productoNombre = item.producto?.nombre || '(Personalizado)'
        const actual = ventasPorProducto.get(productoNombre) || {
          nombre: productoNombre,
          cantidad: 0,
          ingresos: 0,
        }
        actual.cantidad += Number(item.cantidadM2)
        actual.ingresos += Number(item.subtotal)
        ventasPorProducto.set(productoNombre, actual)
      })
    })

    const productosTop = Array.from(ventasPorProducto.values())
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 10)

    return NextResponse.json({
      periodo: {
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
      },
      metricas: {
        totalVendido: Math.round(totalVendido * 100) / 100,
        numeroFacturas,
        promedioPorFactura: Math.round(promedioPorFactura * 100) / 100,
        clienteTop,
      },
      ventasPorDia: ventasPorDiaArray,
      productosTop,
    })
  } catch (error: any) {
    console.error('Error en reportes de facturación:', error)
    return NextResponse.json(
      { error: error.message || 'Error al generar reporte' },
      { status: 500 }
    )
  }
}
