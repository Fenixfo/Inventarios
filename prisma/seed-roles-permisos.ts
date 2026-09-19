import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('\n📋 Creando permisos del sistema...\n')

    // Definir todos los permisos
    const permisos = [
      // Facturas
      { recurso: 'facturas', accion: 'ver', descripcion: 'Ver facturas' },
      { recurso: 'facturas', accion: 'crear', descripcion: 'Crear nuevas facturas' },
      { recurso: 'facturas', accion: 'editar', descripcion: 'Editar facturas' },
      { recurso: 'facturas', accion: 'eliminar', descripcion: 'Anular/eliminar facturas' },

      // Clientes
      { recurso: 'clientes', accion: 'ver', descripcion: 'Ver clientes' },
      { recurso: 'clientes', accion: 'crear', descripcion: 'Crear nuevos clientes' },
      { recurso: 'clientes', accion: 'editar', descripcion: 'Editar clientes' },
      { recurso: 'clientes', accion: 'eliminar', descripcion: 'Eliminar clientes' },

      // Productos
      { recurso: 'productos', accion: 'ver', descripcion: 'Ver productos' },
      { recurso: 'productos', accion: 'crear', descripcion: 'Crear nuevos productos' },
      { recurso: 'productos', accion: 'editar', descripcion: 'Editar productos' },
      { recurso: 'productos', accion: 'eliminar', descripcion: 'Eliminar productos' },

      // Reportes
      { recurso: 'reportes', accion: 'ver', descripcion: 'Ver reportes' },
      { recurso: 'reportes', accion: 'facturacion', descripcion: 'Ver reportes de facturación' },
      { recurso: 'reportes', accion: 'inventario', descripcion: 'Ver reportes de inventario' },

      // Usuarios
      { recurso: 'usuarios', accion: 'ver', descripcion: 'Ver usuarios' },
      { recurso: 'usuarios', accion: 'crear', descripcion: 'Crear nuevos usuarios' },
      { recurso: 'usuarios', accion: 'editar', descripcion: 'Editar usuarios' },
      { recurso: 'usuarios', accion: 'eliminar', descripcion: 'Eliminar usuarios' },
      { recurso: 'usuarios', accion: 'asignarRoles', descripcion: 'Asignar roles a usuarios' },

      // Auditoría
      { recurso: 'auditoria', accion: 'ver', descripcion: 'Ver auditoría' },
      { recurso: 'auditoria', accion: 'eliminar', descripcion: 'Eliminar registros de auditoría' },
    ]

    // Crear permisos
    for (const permiso of permisos) {
      await prisma.permiso.upsert({
        where: { recurso_accion: { recurso: permiso.recurso, accion: permiso.accion } },
        update: { descripcion: permiso.descripcion },
        create: permiso,
      })
    }

    console.log(`✅ ${permisos.length} permisos creados\n`)

    console.log('👥 Creando roles del sistema...\n')

    // Obtener todos los permisos creados
    const todosLosPermisos = await prisma.permiso.findMany()

    // Rol: Administrador (todos los permisos)
    const rolAdmin = await prisma.rol.upsert({
      where: { nombre: 'admin' },
      update: {},
      create: {
        nombre: 'admin',
        descripcion: 'Acceso total al sistema',
        permisos: {
          create: todosLosPermisos.map((p) => ({
            permisoId: p.id,
          })),
        },
      },
    })
    console.log('✅ Rol "admin" creado con todos los permisos')

    // Rol: Vendedor (puede ver/crear facturas y clientes)
    const rolVendedor = await prisma.rol.upsert({
      where: { nombre: 'vendedor' },
      update: {},
      create: {
        nombre: 'vendedor',
        descripcion: 'Puede crear y gestionar facturas y clientes',
        permisos: {
          create: [
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'facturas' && p.accion === 'ver')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'facturas' && p.accion === 'crear')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'facturas' && p.accion === 'editar')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'clientes' && p.accion === 'ver')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'clientes' && p.accion === 'crear')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'clientes' && p.accion === 'editar')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'reportes' && p.accion === 'ver')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'reportes' && p.accion === 'facturacion')!.id },
          ],
        },
      },
    })
    console.log('✅ Rol "vendedor" creado')

    // Rol: Gerente de Inventario
    const rolGerenteInventario = await prisma.rol.upsert({
      where: { nombre: 'gerente_inventario' },
      update: {},
      create: {
        nombre: 'gerente_inventario',
        descripcion: 'Puede gestionar productos y ver reportes de inventario',
        permisos: {
          create: [
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'productos' && p.accion === 'ver')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'productos' && p.accion === 'crear')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'productos' && p.accion === 'editar')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'reportes' && p.accion === 'ver')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'reportes' && p.accion === 'inventario')!.id },
          ],
        },
      },
    })
    console.log('✅ Rol "gerente_inventario" creado')

    // Rol: Auditor
    const rolAuditor = await prisma.rol.upsert({
      where: { nombre: 'auditor' },
      update: {},
      create: {
        nombre: 'auditor',
        descripcion: 'Puede ver auditoría y reportes',
        permisos: {
          create: [
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'auditoria' && p.accion === 'ver')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'reportes' && p.accion === 'ver')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'facturas' && p.accion === 'ver')!.id },
            { permisoId: todosLosPermisos.find((p) => p.recurso === 'clientes' && p.accion === 'ver')!.id },
          ],
        },
      },
    })
    console.log('✅ Rol "auditor" creado')

    console.log('\n✅ Sistema de roles y permisos creado exitosamente')
    console.log('\n📌 Roles disponibles:')
    console.log('   - admin (acceso total)')
    console.log('   - vendedor (facturas y clientes)')
    console.log('   - gerente_inventario (productos y reportes)')
    console.log('   - auditor (auditoría y reportes)')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
