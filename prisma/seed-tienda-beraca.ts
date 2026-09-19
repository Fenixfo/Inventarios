import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('\n🏪 Creando tienda Beraca...\n')

    // Crear tienda
    const tienda = await prisma.tienda.upsert({
      where: { nombre: 'Beraca' },
      update: {},
      create: {
        nombre: 'Beraca',
        descripcion: 'Tienda principal de Inventarios Beraca - Distribuidor de cerámicas y tejas',
        ciudad: 'Bogotá',
        pais: 'Colombia',
        activo: true,
      },
    })

    console.log(`✅ Tienda creada: ${tienda.nombre}`)
    console.log(`   ID: ${tienda.id}`)
    console.log(`   Descripción: ${tienda.descripcion}`)

    // Crear o obtener usuario admin@beraca.com
    console.log(`\n👤 Configurando usuario admin@beraca.com...\n`)

    let usuario = await prisma.usuario.findUnique({
      where: { email: 'admin@beraca.com' },
      include: { roles: true }
    })

    if (!usuario) {
      console.log('   Creando usuario...')
      usuario = await prisma.usuario.create({
        data: {
          email: 'admin@beraca.com',
        },
        include: { roles: true }
      })
      console.log(`✅ Usuario creado: ${usuario.email}`)
    }

    // Asignar rol admin si no lo tiene
    const tieneRolAdmin = usuario.roles.some(r => r.rol === 'admin')
    if (!tieneRolAdmin) {
      console.log('   Asignando rol de administrador...')
      await prisma.usuarioRol.create({
        data: {
          usuarioId: usuario.id,
          rol: 'admin',
        },
      })
      console.log(`✅ Rol admin asignado`)
    }

    // Verificar si ya está asociado
    const yaAsociado = await prisma.usuarioTienda.findUnique({
      where: {
        usuarioId_tiendaId: {
          usuarioId: usuario.id,
          tiendaId: tienda.id,
        },
      },
    })

    if (yaAsociado) {
      console.log(`✅ Usuario ya está asociado con la tienda`)
    } else {
      await prisma.usuarioTienda.create({
        data: {
          usuarioId: usuario.id,
          tiendaId: tienda.id,
        },
      })
      console.log(`✅ Usuario asociado exitosamente`)
    }

    console.log(`\n📋 Resumen:`)
    console.log(`   Tienda: ${tienda.nombre} (ID: ${tienda.id})`)
    console.log(`   Usuario: ${usuario.email} (ID: ${usuario.id})`)
    console.log(`\n✅ Configuración completada`)
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
