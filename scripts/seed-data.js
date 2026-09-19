#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')
require('dotenv').config()

const prisma = new PrismaClient()

async function seedData() {
  try {
    console.log('🌱 Sembrando datos de prueba...\n')

    // Clientes
    const clientes = [
      {
        nombre: 'Construcción Garcia SA',
        email: 'contacto@construcciongarcia.com',
        telefono: '+57 300 123 4567',
        cedulaCc: '901234567-8',
        direccion: 'Calle 45 #23-15, Medellín',
        terminoPago: 'crédito',
        limiteCredito: 5000000,
      },
      {
        nombre: 'Tienda de Materiales Del Centro',
        email: 'info@tiendacentro.com',
        telefono: '+57 312 456 7890',
        cedulaCc: '823456789-0',
        direccion: 'Carrera 50 #12-34, Bogotá',
        terminoPago: 'mixto',
        limiteCredito: 3000000,
      },
      {
        nombre: 'Distribuidora La Frontera',
        email: 'ventas@lafrontera.co',
        telefono: '+57 320 789 0123',
        cedulaCc: '734567890-1',
        direccion: 'Avenida Caracas 100, Cali',
        terminoPago: 'contado',
        limiteCredito: 0,
      },
      {
        nombre: 'Decoraciones y Acabados Premium',
        email: 'admin@decoracionespremium.com',
        telefono: '+57 301 234 5678',
        cedulaCc: '645678901-2',
        direccion: 'Paseo Peatonal 80, Barranquilla',
        terminoPago: 'crédito',
        limiteCredito: 2500000,
      },
      {
        nombre: 'Casa de Azulejos y Pisos',
        email: 'contacto@casaazulejos.com',
        telefono: '+57 310 567 8901',
        cedulaCc: '556789012-3',
        direccion: 'Calle Principal 200, Santa Marta',
        terminoPago: 'mixto',
        limiteCredito: 1500000,
      },
    ]

    console.log('📝 Creando clientes...')
    for (const cliente of clientes) {
      await prisma.cliente.create({ data: cliente })
      console.log(`  ✓ ${cliente.nombre}`)
    }

    // Productos
    const productos = [
      // Cerámica (5)
      { sku: 'CER-001', nombre: 'Cerámica Blanca Mate 30x30', categoria: 'Cerámica', dimensiones: '30x30', color: 'Blanco', acabado: 'Mate', espesorMm: 7.5, m2PorCaja: 1.5, precioUnitario: 45000, costo: 22000, stockActual: 150, stockMinimo: 20, proveedor: 'Cerámica Nacional', descripcion: 'Baldosa de cerámica blanca mate' },
      { sku: 'CER-002', nombre: 'Cerámica Gris Claro 40x40', categoria: 'Cerámica', dimensiones: '40x40', color: 'Gris', acabado: 'Mate', espesorMm: 8, m2PorCaja: 2.5, precioUnitario: 55000, costo: 27000, stockActual: 120, stockMinimo: 15, proveedor: 'Cerámica Nacional', descripcion: 'Baldosa de cerámica gris claro' },
      { sku: 'CER-003', nombre: 'Cerámica Beige Brillo 20x20', categoria: 'Cerámica', dimensiones: '20x20', color: 'Beige', acabado: 'Brillo', espesorMm: 6.5, m2PorCaja: 1, precioUnitario: 35000, costo: 17000, stockActual: 200, stockMinimo: 25, proveedor: 'Cerámica Nacional', descripcion: 'Baldosa pequeña cerámica beige' },
      { sku: 'CER-004', nombre: 'Cerámica Negra Brillante 45x45', categoria: 'Cerámica', dimensiones: '45x45', color: 'Negro', acabado: 'Brillo', espesorMm: 8.5, m2PorCaja: 3, precioUnitario: 65000, costo: 32000, stockActual: 80, stockMinimo: 10, proveedor: 'Cerámica Premium', descripcion: 'Baldosa grande cerámica negra' },
      { sku: 'CER-005', nombre: 'Cerámica Crema Texturada 35x35', categoria: 'Cerámica', dimensiones: '35x35', color: 'Crema', acabado: 'Texturado', espesorMm: 7, m2PorCaja: 2, precioUnitario: 48000, costo: 24000, stockActual: 110, stockMinimo: 15, proveedor: 'Cerámica Nacional', descripcion: 'Baldosa texturada color crema' },

      // Porcellanato (8)
      { sku: 'POR-001', nombre: 'Porcellanato Blanco Rectificado 60x60', categoria: 'Porcellanato', dimensiones: '60x60', color: 'Blanco', acabado: 'Pulido', espesorMm: 9, m2PorCaja: 4, precioUnitario: 85000, costo: 42000, stockActual: 200, stockMinimo: 20, proveedor: 'Porcellanato Premium', descripcion: 'Porcellanato blanco pulido rectificado' },
      { sku: 'POR-002', nombre: 'Porcellanato Gris Oscuro 45x45', categoria: 'Porcellanato', dimensiones: '45x45', color: 'Gris Oscuro', acabado: 'Mate', espesorMm: 8.5, m2PorCaja: 3, precioUnitario: 75000, costo: 37000, stockActual: 150, stockMinimo: 15, proveedor: 'Porcellanato Premium', descripcion: 'Porcellanato gris oscuro mate' },
      { sku: 'POR-003', nombre: 'Porcellanato Mármol Blanco 80x80', categoria: 'Porcellanato', dimensiones: '80x80', color: 'Blanco', acabado: 'Pulido', espesorMm: 10, m2PorCaja: 5, precioUnitario: 120000, costo: 60000, stockActual: 80, stockMinimo: 10, proveedor: 'Porcellanato Lujo', descripcion: 'Porcellanato tipo mármol grande' },
      { sku: 'POR-004', nombre: 'Porcellanato Madera 30x120', categoria: 'Porcellanato', dimensiones: '30x120', color: 'Caramelo', acabado: 'Mate', espesorMm: 8, m2PorCaja: 3.6, precioUnitario: 95000, costo: 47000, stockActual: 100, stockMinimo: 12, proveedor: 'Porcellanato Premium', descripcion: 'Porcellanato tipo madera formato largo' },
      { sku: 'POR-005', nombre: 'Porcellanato Negro Brillante 40x40', categoria: 'Porcellanato', dimensiones: '40x40', color: 'Negro', acabado: 'Brillante', espesorMm: 8, m2PorCaja: 2.5, precioUnitario: 68000, costo: 34000, stockActual: 120, stockMinimo: 15, proveedor: 'Porcellanato Premium', descripcion: 'Porcellanato negro brillante' },
      { sku: 'POR-006', nombre: 'Porcellanato Cemento 60x60', categoria: 'Porcellanato', dimensiones: '60x60', color: 'Gris', acabado: 'Mate', espesorMm: 9, m2PorCaja: 4, precioUnitario: 78000, costo: 39000, stockActual: 140, stockMinimo: 15, proveedor: 'Porcellanato Premium', descripcion: 'Porcellanato efecto cemento' },
      { sku: 'POR-007', nombre: 'Porcellanato Travertino 45x45', categoria: 'Porcellanato', dimensiones: '45x45', color: 'Beige', acabado: 'Antideslizante', espesorMm: 9, m2PorCaja: 3, precioUnitario: 82000, costo: 41000, stockActual: 90, stockMinimo: 12, proveedor: 'Porcellanato Premium', descripcion: 'Porcellanato travertino antideslizante' },
      { sku: 'POR-008', nombre: 'Porcellanato Piedra Natural 50x50', categoria: 'Porcellanato', dimensiones: '50x50', color: 'Gris', acabado: 'Mate', espesorMm: 9.5, m2PorCaja: 3.5, precioUnitario: 92000, costo: 46000, stockActual: 70, stockMinimo: 10, proveedor: 'Porcellanato Lujo', descripcion: 'Porcellanato piedra natural' },

      // Baldosa (7)
      { sku: 'BAL-001', nombre: 'Baldosa Calcárea Blanca 25x25', categoria: 'Baldosa', dimensiones: '25x25', color: 'Blanco', acabado: 'Mate', espesorMm: 6, m2PorCaja: 1.5, precioUnitario: 28000, costo: 14000, stockActual: 250, stockMinimo: 30, proveedor: 'Baldosas Nacionales', descripcion: 'Baldosa calcárea blanca' },
      { sku: 'BAL-002', nombre: 'Baldosa Roja Artesanal 30x30', categoria: 'Baldosa', dimensiones: '30x30', color: 'Rojo', acabado: 'Rustico', espesorMm: 8, m2PorCaja: 2, precioUnitario: 42000, costo: 21000, stockActual: 160, stockMinimo: 20, proveedor: 'Baldosas Artesanales', descripcion: 'Baldosa roja artesanal rustica' },
      { sku: 'BAL-003', nombre: 'Baldosa Terracota 40x40', categoria: 'Baldosa', dimensiones: '40x40', color: 'Terracota', acabado: 'Rustico', espesorMm: 9, m2PorCaja: 2.5, precioUnitario: 52000, costo: 26000, stockActual: 130, stockMinimo: 15, proveedor: 'Baldosas Artesanales', descripcion: 'Baldosa terracota rustica' },
      { sku: 'BAL-004', nombre: 'Baldosa Gris Claro 33x33', categoria: 'Baldosa', dimensiones: '33x33', color: 'Gris', acabado: 'Mate', espesorMm: 7.5, m2PorCaja: 2, precioUnitario: 38000, costo: 19000, stockActual: 180, stockMinimo: 20, proveedor: 'Baldosas Nacionales', descripcion: 'Baldosa gris claro mate' },
      { sku: 'BAL-005', nombre: 'Baldosa Negra Pulida 40x40', categoria: 'Baldosa', dimensiones: '40x40', color: 'Negro', acabado: 'Pulido', espesorMm: 8, m2PorCaja: 2.5, precioUnitario: 58000, costo: 29000, stockActual: 100, stockMinimo: 12, proveedor: 'Baldosas Premium', descripcion: 'Baldosa negra pulida' },
      { sku: 'BAL-006', nombre: 'Baldosa Miel 30x30', categoria: 'Baldosa', dimensiones: '30x30', color: 'Miel', acabado: 'Mate', espesorMm: 7, m2PorCaja: 1.5, precioUnitario: 35000, costo: 17500, stockActual: 170, stockMinimo: 20, proveedor: 'Baldosas Nacionales', descripcion: 'Baldosa color miel' },
      { sku: 'BAL-007', nombre: 'Baldosa Marfil 25x50', categoria: 'Baldosa', dimensiones: '25x50', color: 'Marfil', acabado: 'Brillante', espesorMm: 6.5, m2PorCaja: 2, precioUnitario: 44000, costo: 22000, stockActual: 120, stockMinimo: 15, proveedor: 'Baldosas Nacionales', descripcion: 'Baldosa marfil brillante formato rectangular' },
    ]

    console.log('\n📦 Creando productos...')
    for (const producto of productos) {
      await prisma.producto.create({ data: producto })
      console.log(`  ✓ ${producto.nombre}`)
    }

    console.log('\n✅ ¡Datos de prueba creados exitosamente!')
    console.log(`   - ${clientes.length} clientes`)
    console.log(`   - ${productos.length} productos`)
    console.log('\nPuedes acceder a:')
    console.log('  - http://localhost:3000/admin/clientes')
    console.log('  - http://localhost:3000/admin/productos\n')

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

seedData()
