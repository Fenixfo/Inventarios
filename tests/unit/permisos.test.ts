import { describe, it, expect } from 'vitest'
import {
  puede,
  puedeAlguno,
  esOwner,
  administraTienda,
  veTodasLasFacturas,
  type UsuarioAutenticado,
  type AccesoTienda,
} from '@/lib/permisos'

const TIENDA_A = 'tienda-a'
const TIENDA_B = 'tienda-b'

function acceso(
  tiendaId: string,
  permisos: string[],
  extra: Partial<AccesoTienda> = {}
): AccesoTienda {
  return {
    tiendaId,
    tiendaNombre: tiendaId,
    esOwner: false,
    esAdmin: false,
    permisos,
    ...extra,
  }
}

function usuario(...tiendas: AccesoTienda[]): UsuarioAutenticado {
  return {
    id: 'u1',
    email: 'alguien@ejemplo.com',
    tiendas,
    tienda: tiendas[0] || null,
  }
}

describe('permisos por módulo y acción', () => {
  it('el módulo suelto equivale a la acción ver', () => {
    const u = usuario(acceso(TIENDA_A, ['productos.ver']))
    expect(puede(u, 'productos')).toBe(true)
    expect(puede(u, 'productos.ver')).toBe(true)
  })

  it('ver no habilita crear ni editar', () => {
    const u = usuario(acceso(TIENDA_A, ['productos.ver']))
    expect(puede(u, 'productos.crear')).toBe(false)
    expect(puede(u, 'productos.editar')).toBe(false)
  })

  it('cada acción se concede por separado', () => {
    const u = usuario(acceso(TIENDA_A, ['productos.ver', 'productos.crear']))
    expect(puede(u, 'productos.crear')).toBe(true)
    expect(puede(u, 'productos.editar')).toBe(false)
  })

  it('inventario es independiente de productos', () => {
    const u = usuario(acceso(TIENDA_A, ['productos.ver', 'productos.crear']))
    expect(puede(u, 'inventario.ver')).toBe(false)
    expect(puede(u, 'inventario.movimientos')).toBe(false)
  })

  it('sin sesión no se puede nada', () => {
    expect(puede(null, 'productos.ver')).toBe(false)
  })
})

describe('jerarquía', () => {
  it('el owner puede cualquier cosa sin permisos sueltos', () => {
    const u = usuario(acceso(TIENDA_A, [], { esOwner: true }))
    expect(puede(u, 'productos.crear')).toBe(true)
    expect(puede(u, 'configuracion.editar')).toBe(true)
    expect(puede(u, 'facturas.anular')).toBe(true)
  })

  it('el administrador también puede cualquier cosa', () => {
    const u = usuario(acceso(TIENDA_A, [], { esAdmin: true }))
    expect(puede(u, 'usuarios.gestionar')).toBe(true)
    expect(puede(u, 'auditoria.ver')).toBe(true)
  })

  it('solo el owner se reconoce como owner', () => {
    expect(esOwner(usuario(acceso(TIENDA_A, [], { esOwner: true })))).toBe(true)
    expect(esOwner(usuario(acceso(TIENDA_A, [], { esAdmin: true })))).toBe(false)
  })

  it('owner y administrador administran la tienda; un usuario con permisos no', () => {
    expect(administraTienda(usuario(acceso(TIENDA_A, [], { esOwner: true })))).toBe(true)
    expect(administraTienda(usuario(acceso(TIENDA_A, [], { esAdmin: true })))).toBe(true)
    expect(administraTienda(usuario(acceso(TIENDA_A, ['usuarios.gestionar'])))).toBe(false)
  })

  it('un administrador no puede degradar al owner', () => {
    // La asimetría del modelo: quien administra la tienda no alcanza al owner.
    const admin = usuario(acceso(TIENDA_A, [], { esAdmin: true }))
    expect(administraTienda(admin)).toBe(true)
    expect(esOwner(admin)).toBe(false)
  })
})

describe('permisos por tienda', () => {
  const enDosTiendas = usuario(
    acceso(TIENDA_A, [], { esAdmin: true }),
    acceso(TIENDA_B, ['facturas.ver', 'facturas.crear'])
  )

  it('el mismo usuario puede ser administrador en una tienda y vendedor en otra', () => {
    expect(puede(enDosTiendas, 'productos.crear', TIENDA_A)).toBe(true)
    expect(puede(enDosTiendas, 'productos.crear', TIENDA_B)).toBe(false)
    expect(puede(enDosTiendas, 'facturas.crear', TIENDA_B)).toBe(true)
  })

  it('ser owner de una tienda no da acceso a otra', () => {
    const u = usuario(acceso(TIENDA_A, [], { esOwner: true }))
    expect(puede(u, 'productos.ver', TIENDA_A)).toBe(true)
    expect(puede(u, 'productos.ver', TIENDA_B)).toBe(false)
  })

  it('sin indicar tienda se usa la activa', () => {
    expect(puede(enDosTiendas, 'productos.crear')).toBe(true) // tienda A
  })

  it('una tienda donde no participa no concede nada', () => {
    const u = usuario(acceso(TIENDA_A, ['productos.ver']))
    expect(puede(u, 'productos.ver', 'tienda-ajena')).toBe(false)
  })
})

describe('alcance de facturas', () => {
  it('con facturas.ver solo ve las propias', () => {
    const vendedor = usuario(acceso(TIENDA_A, ['facturas.ver', 'facturas.crear']))
    expect(puede(vendedor, 'facturas.ver')).toBe(true)
    expect(veTodasLasFacturas(vendedor)).toBe(false)
  })

  it('con facturas.ver_todas ve las de toda la tienda', () => {
    const supervisor = usuario(acceso(TIENDA_A, ['facturas.ver', 'facturas.ver_todas']))
    expect(veTodasLasFacturas(supervisor)).toBe(true)
  })

  it('el owner ve todas sin necesidad del permiso', () => {
    expect(veTodasLasFacturas(usuario(acceso(TIENDA_A, [], { esOwner: true })))).toBe(true)
  })

  it('reportes no distingue alcance: quien lo tiene ve toda la tienda', () => {
    const u = usuario(acceso(TIENDA_A, ['reportes.ver']))
    expect(puede(u, 'reportes.ver')).toBe(true)
    expect(puede(u, 'reportes')).toBe(true)
  })
})

describe('puedeAlguno', () => {
  it('basta con uno de los permisos', () => {
    // Facturar necesita leer el catálogo aunque no se administren productos.
    const vendedor = usuario(acceso(TIENDA_A, ['facturas.crear', 'clientes.crear']))
    expect(puedeAlguno(vendedor, ['productos.ver', 'facturas.crear'])).toBe(true)
  })

  it('falla si no tiene ninguno', () => {
    const u = usuario(acceso(TIENDA_A, ['reportes.ver']))
    expect(puedeAlguno(u, ['productos.crear', 'clientes.crear'])).toBe(false)
  })
})

describe('reglas de subida de imágenes', () => {
  it('quien crea productos puede subir su imagen', () => {
    const bodega = usuario(acceso(TIENDA_A, ['productos.ver', 'productos.crear']))
    expect(puede(bodega, 'productos.crear')).toBe(true)
  })

  it('bodega no puede cambiar el logo de la empresa', () => {
    const bodega = usuario(acceso(TIENDA_A, ['productos.ver', 'productos.crear']))
    expect(puede(bodega, 'configuracion.editar')).toBe(false)
  })

  it('tener sesión no basta: hace falta el permiso', () => {
    expect(puede(usuario(acceso(TIENDA_A, [])), 'productos.crear')).toBe(false)
  })
})
