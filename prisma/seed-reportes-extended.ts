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

    // Fechas para las pruebas
    const ayer = new Date(2026, 8, 18) // 18 de septiembre
    const hace15Dias = new Date(2026, 8, 4) // 4 de septiembre
    const quinceDAgosto = new Date(2026, 7, 15) // 15 de agosto

    // Función para generar número de factura
    function generarNumeroFactura(fecha: Date): string {
      const year = fecha.getFullYear()
      const month = String(fecha.getMonth() + 1).padStart(2, '0')
      const day = String(fecha.getDate()).padStart(2, '0')
      const datePrefix = `${year}${month}${day}`
      const random = Math.floor(Math.random() * 10000)
      return `${datePrefix}-${String(random).padStart(4, '0')}`
    }

    // Función para crear factura con productos específicos
    async function crearFacturaConProductos(
      fecha: Date,
      clienteIndex: number,
      productosIndices: number[]
    ) {
      const cliente = clientes[clienteIndex % clientes.length]
      let subtotal = 0
      const items = []

      // Crear items con productos específicos
      for (const prodIndex of productosIndices) {
        const producto = productos[prodIndex % productos.length]
        const cantidadM2 = 2 + Math.random() * 15
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

      const descuentoPorcentaje = Math.random() > 0.7 ? 5 : 0
      const descuentoMonto = (subtotal * descuentoPorcentaje) / 100
      const impuesto = (subtotal - descuentoMonto) * 0.19
      const total = subtotal - descuentoMonto + impuesto

      const numeroFactura = generarNumeroFactura(fecha)

      await prisma.factura.create({
        data: {
          numeroFactura,
          clienteId: cliente.id,
          fecha,
          subtotal,
          descuentoPorcentaje,
          descuentoMonto,
          impuesto,
          total,
          anticipo: 0,
          estado: 'pagado',
          terminoPago: 'Contado',
          metodoPago: 'Transferencia',
          observaciones: `Factura de prueba - ${fecha.toLocaleDateString()}`,
          items: {
            create: items,
          },
        },
      })

      console.log(`✅ Factura ${numeroFactura} con ${items.length} productos`)
    }

    console.log('\n📅 Creando facturas adicionales con variedad de productos...\n')

    // Crear 15 facturas de diferentes fechas con variedad de productos
    const fechas = [ayer, hace15Dias, quinceDAgosto]

    for (let i = 0; i < 5; i++) {
      for (const fecha of fechas) {
        // Crear factura con 2-4 productos diferentes
        const numProductos = 2 + Math.floor(Math.random() * 3)
        const productosIndices = Array.from(
          { length: numProductos },
          () => Math.floor(Math.random() * productos.length)
        )

        await crearFacturaConProductos(fecha, i, productosIndices)
      }
    }

    console.log('\n✅ Todas las facturas extendidas fueron creadas')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
