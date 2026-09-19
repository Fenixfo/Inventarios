import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const clientes = await prisma.cliente.findMany()
    const productos = await prisma.producto.findMany()

    if (clientes.length === 0 || productos.length === 0) {
      console.log('No hay clientes o productos disponibles')
      return
    }

    const fecha29Agosto = new Date(2026, 7, 29) // 29 de agosto

    // Función para generar número de factura
    function generarNumeroFactura(fecha: Date): string {
      const year = fecha.getFullYear()
      const month = String(fecha.getMonth() + 1).padStart(2, '0')
      const day = String(fecha.getDate()).padStart(2, '0')
      const datePrefix = `${year}${month}${day}`
      const random = Math.floor(Math.random() * 10000)
      return `${datePrefix}-${String(random).padStart(4, '0')}`
    }

    // Crear factura con 3 productos
    const cliente = clientes[0]
    const productosSeleccionados = [
      productos[0 % productos.length],
      productos[1 % productos.length],
      productos[2 % productos.length],
    ]

    let subtotal = 0
    const items = []

    for (const producto of productosSeleccionados) {
      const cantidadM2 = 5 + Math.random() * 15
      const precioUnitario = Number(producto.precioUnitario)
      const subtotalItem = cantidadM2 * precioUnitario
      subtotal += subtotalItem

      items.push({
        productoId: producto.id,
        cantidadM2,
        precioUnitario,
        subtotal: subtotalItem,
      })
    }

    const descuentoPorcentaje = 0
    const descuentoMonto = 0
    const impuesto = subtotal * 0.19
    const total = subtotal + impuesto

    const numeroFactura = generarNumeroFactura(fecha29Agosto)

    await prisma.factura.create({
      data: {
        numeroFactura,
        clienteId: cliente.id,
        fecha: fecha29Agosto,
        subtotal,
        descuentoPorcentaje,
        descuentoMonto,
        impuesto,
        total,
        anticipo: 0,
        estado: 'pagado',
        terminoPago: 'Contado',
        metodoPago: 'Transferencia',
        observaciones: `Factura de prueba - 29 de agosto`,
        items: {
          create: items,
        },
      },
    })

    console.log(`✅ Factura ${numeroFactura} del 29 de agosto creada exitosamente`)
    console.log(`   Cliente: ${cliente.nombre}`)
    console.log(`   Productos: ${items.length}`)
    console.log(`   Total: $${total.toFixed(2)}`)
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
