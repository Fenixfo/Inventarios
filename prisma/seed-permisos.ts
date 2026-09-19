import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('\n📋 Creando módulos de permisos...\n')

    const modulos = [
      { modulo: 'productos', nombre: 'Productos', icono: '📦' },
      { modulo: 'clientes', nombre: 'Clientes', icono: '👥' },
      { modulo: 'facturas', nombre: 'Facturas', icono: '📄' },
      { modulo: 'reportes', nombre: 'Reportes', icono: '📈' },
      { modulo: 'auditoria', nombre: 'Auditorías', icono: '🔍' },
      { modulo: 'administrador', nombre: 'Administrador', icono: '⚙️' },
      { modulo: 'roles', nombre: 'Gestión de Roles', icono: '🎭' },
      { modulo: 'usuarios', nombre: 'Gestión de Usuarios', icono: '👨‍💼' },
      { modulo: 'solicitudes-acceso', nombre: 'Solicitudes de Acceso', icono: '✋' },
    ]

    for (const mod of modulos) {
      const existe = await prisma.permisoModulo.findUnique({
        where: { modulo: mod.modulo }
      })

      if (!existe) {
        await prisma.permisoModulo.create({
          data: mod
        })
        console.log(`✅ ${mod.icono} ${mod.nombre}`)
      }
    }

    console.log('\n👤 Creando roles predeterminados...\n')

    // Rol Owner (Admin Principal)
    const rolOwner = await prisma.rolPersonalizado.upsert({
      where: { nombre: 'Owner' },
      update: {},
      create: {
        nombre: 'Owner',
        descripcion: 'Dueño/Administrador Principal - Acceso total',
        esAdmin: true,
        activo: true,
      }
    })
    console.log('✅ Owner (Admin Principal)')

    // Rol Admin
    const rolAdmin = await prisma.rolPersonalizado.upsert({
      where: { nombre: 'Admin' },
      update: {},
      create: {
        nombre: 'Admin',
        descripcion: 'Administrador - Acceso a la mayoría de funciones',
        esAdmin: true,
        activo: true,
      }
    })
    console.log('✅ Admin (Administrador)')

    // Rol User
    const rolUser = await prisma.rolPersonalizado.upsert({
      where: { nombre: 'User' },
      update: {},
      create: {
        nombre: 'User',
        descripcion: 'Usuario - Acceso limitado',
        esAdmin: false,
        activo: true,
      }
    })
    console.log('✅ User (Usuario)')

    // Asignar todos los módulos a Owner
    console.log('\n🔐 Asignando permisos al rol Owner...\n')

    const todosModulos = await prisma.permisoModulo.findMany()

    for (const modulo of todosModulos) {
      const existe = await prisma.permisoRolPersonalizado.findFirst({
        where: {
          rolId: rolOwner.id,
          moduloId: modulo.id
        }
      })

      if (!existe) {
        await prisma.permisoRolPersonalizado.create({
          data: {
            rolId: rolOwner.id,
            moduloId: modulo.id
          }
        })
      }
    }

    console.log(`✅ Owner tiene acceso a todos los ${todosModulos.length} módulos`)

    // Asignar módulos a Admin (todos excepto administrador)
    console.log('\n🔐 Asignando permisos al rol Admin...\n')

    const modulosAdmin = todosModulos.filter(m => m.modulo !== 'administrador')

    for (const modulo of modulosAdmin) {
      const existe = await prisma.permisoRolPersonalizado.findFirst({
        where: {
          rolId: rolAdmin.id,
          moduloId: modulo.id
        }
      })

      if (!existe) {
        await prisma.permisoRolPersonalizado.create({
          data: {
            rolId: rolAdmin.id,
            moduloId: modulo.id
          }
        })
      }
    }

    console.log(`✅ Admin tiene acceso a ${modulosAdmin.length} módulos`)

    // Asignar módulos básicos a User
    console.log('\n🔐 Asignando permisos al rol User...\n')

    const modulosUser = todosModulos.filter(m =>
      ['dashboard', 'productos', 'clientes', 'facturas'].includes(m.modulo)
    )

    for (const modulo of modulosUser) {
      const existe = await prisma.permisoRolPersonalizado.findFirst({
        where: {
          rolId: rolUser.id,
          moduloId: modulo.id
        }
      })

      if (!existe) {
        await prisma.permisoRolPersonalizado.create({
          data: {
            rolId: rolUser.id,
            moduloId: modulo.id
          }
        })
      }
    }

    console.log(`✅ User tiene acceso a ${modulosUser.length} módulos`)

    // Crear/Actualizar usuario admin@beraca.com como Owner
    console.log('\n👤 Configurando usuario admin@beraca.com como Owner...\n')

    let usuario = await prisma.usuario.findUnique({
      where: { email: 'admin@beraca.com' },
      include: { rolesPersonalizados: true }
    })

    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: {
          email: 'admin@beraca.com',
        },
        include: { rolesPersonalizados: true }
      })
    }

    // Verificar si ya tiene el rol Owner
    const tieneRolOwner = usuario.rolesPersonalizados.some(r => r.rolId === rolOwner.id)

    if (!tieneRolOwner) {
      await prisma.usuarioRolPersonalizado.create({
        data: {
          usuarioId: usuario.id,
          rolId: rolOwner.id
        }
      })
      console.log(`✅ admin@beraca.com asignado como Owner`)
    }

    // También crear el rol antiguo para compatibilidad
    console.log('\n🔄 Creando rol "admin" para compatibilidad...\n')

    const tieneRolAdmin = await prisma.usuarioRol.findFirst({
      where: {
        usuarioId: usuario.id,
        rol: 'admin'
      }
    })

    if (!tieneRolAdmin) {
      await prisma.usuarioRol.create({
        data: {
          usuarioId: usuario.id,
          rol: 'admin'
        }
      })
    }

    console.log(`✅ Rol "admin" (legacy) asignado\n`)

    console.log('✅ Configuración de permisos completada')
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
