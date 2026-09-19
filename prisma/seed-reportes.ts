import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Obtener clientes y productos para las pruebas
    const clientes = await prisma.cliente.findMany({ take: 5 })
    const productos = await prisma.producto.findMany({ take: 10 })

    if (clientes.length === 0 || productos.length === 0) {
      console.log('No hay clientes o productos disponibles')
      return
    }

    const hoy = new Date(2026, 8, 19) // 19 de septiembre
    const ayer = new Date(2026, 8, 18) // 18 de septiembre
    const quinceDAgosto = new Date(2026, 7, 15) // 15 de agosto

    // Función para generar número de factura
    function generarNumeroFactura(fecha: Date): string {
      const year = fecha.getFullYear()
      const month = String(fecha.getMonth() + 1).padStart(2, '0')
      const day = String(fecha.getDate()).padStart(2, '0')
      const datePrefix = `${year}${month}${day}`
      const random = Math.floor(Math.random() * 1000)
      return `${datePrefix}-${String(random).padStart(3, '0')}`
    }

    // Función para crear factura
    async function crearFactura(fecha: Date, clienteIndex: number, cantidad: number = 1) {
      const cliente = clientes[clienteIndex % clientes.length]
      const subtotal = 500000 + Math.random() * 2000000
      const descuentoPorcentaje = Math.random() > 0.7 ? 10 : 0
      const descuentoMonto = (subtotal * descuentoPorcentaje) / 100
      const impuesto = (subtotal - descuentoMonto) * 0.19
      const total = subtotal - descuentoMonto + impuesto

      const numeroFactura = generarNumeroFactura(fecha)

      // Crear items
      const items = []
      for (let i = 0; i < cantidad; i++) {
        const producto = productos[i % productos.length]
        const cantidadM2 = 5 + Math.random() * 20
        const precioUnitario = Number(producto.precioUnitario)
        const subtotalItem = cantidadM2 * precioUnitario

        items.push({
          productoId: producto.id,
          cantidadM2,
          precioUnitario: precioUnitario,
          subtotal: subtotalItem,
        })
      }

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

      console.log(`✅ Factura creada: ${numeroFactura}`)
    }

    // Crear 3 facturas de ayer
    console.log('\n📅 Creando 3 facturas de ayer (18/09/2026)...')
    await crearFactura(ayer, 0, 2)
    await crearFactura(ayer, 1, 3)
    await crearFactura(ayer, 2, 2)

    // Crear 3 facturas del 15 de agosto
    console.log('\n📅 Creando 3 facturas del 15/08/2026...')
    await crearFactura(quinceDAgosto, 3, 2)
    await crearFactura(quinceDAgosto, 4, 2)
    await crearFactura(quinceDAgosto, 0, 3)

    console.log('\n✅ Todas las facturas de prueba fueron creadas exitosamente')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
