import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Sembrando base de datos...')

  // Limpiar datos existentes
  await prisma.abono.deleteMany({})
  await prisma.facturaItem.deleteMany({})
  await prisma.factura.deleteMany({})
  await prisma.producto.deleteMany({})
  await prisma.cliente.deleteMany({})

  console.log('Datos existentes eliminados.')

  // Crear 5 clientes
  const clientes = await Promise.all([
    prisma.cliente.create({
      data: {
        nombre: 'Juan Pérez García',
        email: 'juan@example.com',
        telefono: '3001234567',
        cedulaCc: '1023456789',
        direccion: 'Calle 1 # 10-20, Bogotá',
        terminoPago: '30 días',
        limiteCredito: 1000000,
      },
    }),
    prisma.cliente.create({
      data: {
        nombre: 'María López Rodríguez',
        email: 'maria@example.com',
        telefono: '3107654321',
        cedulaCc: '1087654321',
        direccion: 'Carrera 5 # 45-30, Medellín',
        terminoPago: 'Contado',
        limiteCredito: 500000,
      },
    }),
    prisma.cliente.create({
      data: {
        nombre: 'Carlos Sánchez Martín',
        email: 'carlos@example.com',
        telefono: '3152234567',
        cedulaCc: '1012345678',
        direccion: 'Avenida 10 # 20-50, Cali',
        terminoPago: '15 días',
        limiteCredito: 2000000,
      },
    }),
    prisma.cliente.create({
      data: {
        nombre: 'Ana Martínez González',
        email: 'ana@example.com',
        telefono: '3189876543',
        cedulaCc: '1098765432',
        direccion: 'Paseo 8 # 15-10, Barranquilla',
        terminoPago: 'Contado',
        limiteCredito: 750000,
      },
    }),
    prisma.cliente.create({
      data: {
        nombre: 'Roberto Díaz Flores',
        email: 'roberto@example.com',
        telefono: '3164567890',
        cedulaCc: '1056789012',
        direccion: 'Cra 12 # 30-40, Bucaramanga',
        terminoPago: '60 días',
        limiteCredito: 1500000,
      },
    }),
  ])

  console.log(`${clientes.length} clientes creados.`)

  // Crear 20 productos
  const productos = await Promise.all([
    prisma.producto.create({
      data: {
        sku: 'PORCELANATO-001',
        nombre: 'Porcelanato Blanco 60x60',
        categoria: 'Porcelanatos',
        dimensiones: '60x60cm',
        color: 'Blanco',
        acabado: 'Mate',
        espesorMm: 10.0,
        m2PorCaja: 1.44,
        precioUnitario: 85000,
        costo: 45000,
        stockActual: 50,
        stockMinimo: 10,
        proveedor: 'Proveedor A',
        descripcion: 'Porcelanato de alta durabilidad',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'PORCELANATO-002',
        nombre: 'Porcelanato Gris 60x60',
        categoria: 'Porcelanatos',
        dimensiones: '60x60cm',
        color: 'Gris',
        acabado: 'Brillante',
        espesorMm: 10.0,
        m2PorCaja: 1.44,
        precioUnitario: 95000,
        costo: 50000,
        stockActual: 40,
        stockMinimo: 10,
        proveedor: 'Proveedor A',
        descripcion: 'Porcelanato gris brillante',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'CERAMICA-001',
        nombre: 'Cerámica Beige 30x30',
        categoria: 'Cerámicas',
        dimensiones: '30x30cm',
        color: 'Beige',
        acabado: 'Mate',
        espesorMm: 8.0,
        m2PorCaja: 1.0,
        precioUnitario: 35000,
        costo: 18000,
        stockActual: 100,
        stockMinimo: 20,
        proveedor: 'Proveedor B',
        descripcion: 'Cerámica de uso residencial',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'CERAMICA-002',
        nombre: 'Cerámica Café 30x30',
        categoria: 'Cerámicas',
        dimensiones: '30x30cm',
        color: 'Café',
        acabado: 'Mate',
        espesorMm: 8.0,
        m2PorCaja: 1.0,
        precioUnitario: 38000,
        costo: 19000,
        stockActual: 80,
        stockMinimo: 20,
        proveedor: 'Proveedor B',
        descripcion: 'Cerámica café mate',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'MOSAICO-001',
        nombre: 'Mosaico Decorativo 20x20',
        categoria: 'Mosaicos',
        dimensiones: '20x20cm',
        color: 'Multicolor',
        acabado: 'Brillante',
        espesorMm: 6.0,
        m2PorCaja: 1.0,
        precioUnitario: 42000,
        costo: 22000,
        stockActual: 60,
        stockMinimo: 15,
        proveedor: 'Proveedor C',
        descripcion: 'Mosaico decorativo multicolor',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'PORCELANATO-003',
        nombre: 'Porcelanato Negro 45x45',
        categoria: 'Porcelanatos',
        dimensiones: '45x45cm',
        color: 'Negro',
        acabado: 'Brillante',
        espesorMm: 9.0,
        m2PorCaja: 2.0,
        precioUnitario: 72000,
        costo: 38000,
        stockActual: 35,
        stockMinimo: 10,
        proveedor: 'Proveedor A',
        descripcion: 'Porcelanato negro brillante',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'CERAMICA-003',
        nombre: 'Cerámica Rojo 30x60',
        categoria: 'Cerámicas',
        dimensiones: '30x60cm',
        color: 'Rojo',
        acabado: 'Mate',
        espesorMm: 8.0,
        m2PorCaja: 0.9,
        precioUnitario: 45000,
        costo: 24000,
        stockActual: 55,
        stockMinimo: 15,
        proveedor: 'Proveedor B',
        descripcion: 'Cerámica rojo mate',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'PORCELANATO-004',
        nombre: 'Porcelanato Azul 40x40',
        categoria: 'Porcelanatos',
        dimensiones: '40x40cm',
        color: 'Azul',
        acabado: 'Mate',
        espesorMm: 10.0,
        m2PorCaja: 1.6,
        precioUnitario: 65000,
        costo: 35000,
        stockActual: 45,
        stockMinimo: 10,
        proveedor: 'Proveedor A',
        descripcion: 'Porcelanato azul mate',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'MOSAICO-002',
        nombre: 'Mosaico Blanco 15x15',
        categoria: 'Mosaicos',
        dimensiones: '15x15cm',
        color: 'Blanco',
        acabado: 'Brillante',
        espesorMm: 5.0,
        m2PorCaja: 1.11,
        precioUnitario: 28000,
        costo: 15000,
        stockActual: 120,
        stockMinimo: 30,
        proveedor: 'Proveedor C',
        descripcion: 'Mosaico blanco brillante',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'CERAMICA-004',
        nombre: 'Cerámica Verde 25x25',
        categoria: 'Cerámicas',
        dimensiones: '25x25cm',
        color: 'Verde',
        acabado: 'Mate',
        espesorMm: 7.0,
        m2PorCaja: 1.6,
        precioUnitario: 32000,
        costo: 16000,
        stockActual: 70,
        stockMinimo: 15,
        proveedor: 'Proveedor B',
        descripcion: 'Cerámica verde mate',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'PORCELANATO-005',
        nombre: 'Porcelanato Madera 30x120',
        categoria: 'Porcelanatos',
        dimensiones: '30x120cm',
        color: 'Madera',
        acabado: 'Mate',
        espesorMm: 9.0,
        m2PorCaja: 0.36,
        precioUnitario: 88000,
        costo: 46000,
        stockActual: 30,
        stockMinimo: 8,
        proveedor: 'Proveedor A',
        descripcion: 'Porcelanato efecto madera',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'CERAMICA-005',
        nombre: 'Cerámica Naranja 40x40',
        categoria: 'Cerámicas',
        dimensiones: '40x40cm',
        color: 'Naranja',
        acabado: 'Brillante',
        espesorMm: 8.0,
        m2PorCaja: 1.0,
        precioUnitario: 48000,
        costo: 25000,
        stockActual: 50,
        stockMinimo: 12,
        proveedor: 'Proveedor B',
        descripcion: 'Cerámica naranja brillante',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'MOSAICO-003',
        nombre: 'Mosaico Gris 25x25',
        categoria: 'Mosaicos',
        dimensiones: '25x25cm',
        color: 'Gris',
        acabado: 'Mate',
        espesorMm: 6.0,
        m2PorCaja: 0.64,
        precioUnitario: 35000,
        costo: 18000,
        stockActual: 90,
        stockMinimo: 20,
        proveedor: 'Proveedor C',
        descripcion: 'Mosaico gris mate',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'PORCELANATO-006',
        nombre: 'Porcelanato Rosa 50x50',
        categoria: 'Porcelanatos',
        dimensiones: '50x50cm',
        color: 'Rosa',
        acabado: 'Mate',
        espesorMm: 10.0,
        m2PorCaja: 1.0,
        precioUnitario: 78000,
        costo: 41000,
        stockActual: 25,
        stockMinimo: 8,
        proveedor: 'Proveedor A',
        descripcion: 'Porcelanato rosa mate',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'CERAMICA-006',
        nombre: 'Cerámica Marfil 35x35',
        categoria: 'Cerámicas',
        dimensiones: '35x35cm',
        color: 'Marfil',
        acabado: 'Mate',
        espesorMm: 8.0,
        m2PorCaja: 0.82,
        precioUnitario: 40000,
        costo: 21000,
        stockActual: 65,
        stockMinimo: 15,
        proveedor: 'Proveedor B',
        descripcion: 'Cerámica marfil mate',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'PORCELANATO-007',
        nombre: 'Porcelanato Crema 60x120',
        categoria: 'Porcelanatos',
        dimensiones: '60x120cm',
        color: 'Crema',
        acabado: 'Brillante',
        espesorMm: 11.0,
        m2PorCaja: 0.72,
        precioUnitario: 105000,
        costo: 55000,
        stockActual: 20,
        stockMinimo: 5,
        proveedor: 'Proveedor A',
        descripcion: 'Porcelanato crema brillante',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'MOSAICO-004',
        nombre: 'Mosaico Negro 30x30',
        categoria: 'Mosaicos',
        dimensiones: '30x30cm',
        color: 'Negro',
        acabado: 'Brillante',
        espesorMm: 7.0,
        m2PorCaja: 0.11,
        precioUnitario: 55000,
        costo: 28000,
        stockActual: 40,
        stockMinimo: 10,
        proveedor: 'Proveedor C',
        descripcion: 'Mosaico negro brillante',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'CERAMICA-007',
        nombre: 'Cerámica Turquesa 20x20',
        categoria: 'Cerámicas',
        dimensiones: '20x20cm',
        color: 'Turquesa',
        acabado: 'Mate',
        espesorMm: 7.0,
        m2PorCaja: 2.5,
        precioUnitario: 25000,
        costo: 13000,
        stockActual: 150,
        stockMinimo: 40,
        proveedor: 'Proveedor B',
        descripcion: 'Cerámica turquesa mate',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'PORCELANATO-008',
        nombre: 'Porcelanato Mármol 45x90',
        categoria: 'Porcelanatos',
        dimensiones: '45x90cm',
        color: 'Mármol',
        acabado: 'Brillante',
        espesorMm: 10.0,
        m2PorCaja: 0.9,
        precioUnitario: 92000,
        costo: 48000,
        stockActual: 28,
        stockMinimo: 7,
        proveedor: 'Proveedor A',
        descripcion: 'Porcelanato efecto mármol',
      },
    }),
    prisma.producto.create({
      data: {
        sku: 'CERAMICA-008',
        nombre: 'Cerámica Mostaza 50x50',
        categoria: 'Cerámicas',
        dimensiones: '50x50cm',
        color: 'Mostaza',
        acabado: 'Mate',
        espesorMm: 9.0,
        m2PorCaja: 0.4,
        precioUnitario: 52000,
        costo: 27000,
        stockActual: 35,
        stockMinimo: 10,
        proveedor: 'Proveedor B',
        descripcion: 'Cerámica mostaza mate',
      },
    }),
  ])

  console.log(`${productos.length} productos creados.`)

  // Crear 3 facturas
  const factura1 = await prisma.factura.create({
    data: {
      numeroFactura: `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-001`,
      clienteId: clientes[0].id,
      terminoPago: '30 días',
      metodoPago: 'Crédito',
      subtotal: 170000,
      descuentoPorcentaje: 10,
      descuentoMonto: 17000,
      impuesto: 24360,
      total: 177360,
      anticipo: 50000,
      estado: 'pendiente',
      observaciones: 'Factura de prueba 1',
      items: {
        create: [
          {
            productoId: productos[0].id,
            cantidadM2: 2.0,
            precioUnitario: 85000,
            subtotal: 170000,
          },
        ],
      },
    },
  })

  const factura2 = await prisma.factura.create({
    data: {
      numeroFactura: `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-002`,
      clienteId: clientes[1].id,
      terminoPago: 'Contado',
      metodoPago: 'Contado',
      subtotal: 245000,
      descuentoPorcentaje: 5,
      descuentoMonto: 12250,
      impuesto: 33737.5,
      total: 266487.5,
      anticipo: 100000,
      estado: 'pendiente',
      observaciones: 'Factura de prueba 2 - Compra grande',
      items: {
        create: [
          {
            productoId: productos[1].id,
            cantidadM2: 1.5,
            precioUnitario: 95000,
            subtotal: 142500,
          },
          {
            productoId: productos[2].id,
            cantidadM2: 3.0,
            precioUnitario: 35000,
            subtotal: 105000,
          },
        ],
      },
    },
  })

  // Factura 3 con un producto personalizado (sin productoId)
  const factura3 = await prisma.factura.create({
    data: {
      numeroFactura: `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-003`,
      clienteId: clientes[2].id,
      terminoPago: '15 días',
      metodoPago: 'Transferencia',
      subtotal: 120000,
      descuentoPorcentaje: 0,
      descuentoMonto: 0,
      impuesto: 17040,
      total: 137040,
      anticipo: 30000,
      estado: 'pendiente',
      observaciones: 'Factura con producto personalizado - Baldosas especiales',
      items: {
        create: [
          {
            cantidadM2: 4.0,
            precioUnitario: 30000,
            subtotal: 120000,
          },
        ],
      },
    },
  })

  console.log('3 facturas creadas.')
  console.log('Semilla completada exitosamente!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
