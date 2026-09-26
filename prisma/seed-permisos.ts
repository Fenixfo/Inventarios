import { PrismaClient } from '@prisma/client'

/**
 * Catálogo de permisos de la tienda.
 *
 * Es la lista de lo que se puede conceder a alguien, no quién lo tiene:
 * las concesiones viven en `permisos_asignados` y son por tienda.
 *
 * El script es idempotente —hace upsert por módulo+acción—, así que se
 * puede volver a correr para añadir un permiso nuevo sin tocar los que ya
 * están asignados.
 *
 *   npm run seed
 */

const prisma = new PrismaClient()

/** `orden` deja hueco entre módulos para poder intercalar sin renumerar. */
const PERMISOS = [
  { orden: 10, modulo: 'productos', accion: 'ver', nombre: 'Ver productos' },
  { orden: 11, modulo: 'productos', accion: 'crear', nombre: 'Crear productos' },
  { orden: 12, modulo: 'productos', accion: 'editar', nombre: 'Editar productos' },

  { orden: 20, modulo: 'inventario', accion: 'ver', nombre: 'Ver inventario' },
  { orden: 21, modulo: 'inventario', accion: 'movimientos', nombre: 'Registrar movimientos' },
  { orden: 22, modulo: 'inventario', accion: 'editar', nombre: 'Editar movimientos' },

  { orden: 30, modulo: 'clientes', accion: 'ver', nombre: 'Ver clientes' },
  { orden: 31, modulo: 'clientes', accion: 'crear', nombre: 'Crear clientes' },
  { orden: 32, modulo: 'clientes', accion: 'editar', nombre: 'Editar clientes' },

  // Facturas es el único módulo donde el alcance se distingue: por defecto
  // cada quien ve lo suyo, y ver_todas abre la tienda entera.
  { orden: 40, modulo: 'facturas', accion: 'ver', nombre: 'Ver sus propias facturas' },
  { orden: 41, modulo: 'facturas', accion: 'ver_todas', nombre: 'Ver las facturas de toda la tienda' },
  { orden: 42, modulo: 'facturas', accion: 'crear', nombre: 'Crear facturas' },
  { orden: 43, modulo: 'facturas', accion: 'anular', nombre: 'Anular facturas' },
  { orden: 44, modulo: 'facturas', accion: 'abonar', nombre: 'Abonar y cambiar estado (pagada/entregada)' },

  // Cotizaciones siguen el mismo alcance que facturas: cada quien las suyas,
  // y ver_todas abre la tienda entera.
  { orden: 45, modulo: 'cotizaciones', accion: 'ver', nombre: 'Ver sus propias cotizaciones' },
  { orden: 46, modulo: 'cotizaciones', accion: 'ver_todas', nombre: 'Ver las cotizaciones de toda la tienda' },
  { orden: 47, modulo: 'cotizaciones', accion: 'crear', nombre: 'Crear cotizaciones' },

  // Reportes no distingue autoría: quien lo tiene ve las cifras completas.
  { orden: 50, modulo: 'reportes', accion: 'ver', nombre: 'Ver reportes de la tienda' },

  // Liquidar es el cierre de las facturas cobradas de un vendedor y fija lo
  // que se le paga: va aparte de facturar y de ver reportes.
  { orden: 55, modulo: 'liquidaciones', accion: 'ver', nombre: 'Ver liquidaciones' },
  { orden: 56, modulo: 'liquidaciones', accion: 'crear', nombre: 'Liquidar facturas' },

  { orden: 60, modulo: 'auditoria', accion: 'ver', nombre: 'Ver auditoría' },

  { orden: 70, modulo: 'usuarios', accion: 'ver', nombre: 'Ver usuarios' },
  { orden: 71, modulo: 'usuarios', accion: 'gestionar', nombre: 'Crear y editar usuarios' },

  { orden: 80, modulo: 'configuracion', accion: 'ver', nombre: 'Ver configuración' },
  { orden: 81, modulo: 'configuracion', accion: 'editar', nombre: 'Editar configuración' },

  { orden: 90, modulo: 'solicitudes-acceso', accion: 'ver', nombre: 'Ver solicitudes de acceso' },
  { orden: 91, modulo: 'solicitudes-acceso', accion: 'gestionar', nombre: 'Aprobar o rechazar solicitudes' },
]

async function main() {
  console.log(`\nSincronizando ${PERMISOS.length} permisos...\n`)

  for (const permiso of PERMISOS) {
    await prisma.permiso.upsert({
      where: { modulo_accion: { modulo: permiso.modulo, accion: permiso.accion } },
      create: permiso,
      update: { nombre: permiso.nombre, orden: permiso.orden },
    })
  }

  const total = await prisma.permiso.count()
  console.log(`Catálogo con ${total} permisos.`)

  // Un permiso que esté en la base y no aquí quedó huérfano: el script no
  // lo borra por su cuenta, porque puede haber gente con él asignado.
  const enBase = await prisma.permiso.findMany({ select: { modulo: true, accion: true } })
  const declarados = new Set(PERMISOS.map((p) => `${p.modulo}.${p.accion}`))
  const sobrantes = enBase
    .map((p) => `${p.modulo}.${p.accion}`)
    .filter((clave) => !declarados.has(clave))

  if (sobrantes.length) {
    console.log(`\nEn la base pero no en este archivo: ${sobrantes.join(', ')}`)
  }
}

main()
  .catch((error) => {
    console.error('Error sembrando permisos:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
