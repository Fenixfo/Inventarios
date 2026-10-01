// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

/**
 * Pruebas de seguridad de la API (OWASP API Security Top 10) sobre lo
 * último que se añadió: perfil de la cuenta, facturar a nombre de otros,
 * liquidación por vendedor y registro con nombre y teléfono.
 *
 * Método de la skill `api-security-tester`: cada prueba lleva el ID de la
 * matriz (TC-xx) y la categoría OWASP, y junto a cada ataque bloqueado va el
 * caso positivo que confirma que lo legítimo sigue funcionando.
 *
 * Corren contra la BD real y el servidor de desarrollo, como el resto de la
 * integración. Se crean dos cuentas de Supabase (`…@seguridad.local`) con
 * permisos mínimos y se borran de Auth al terminar; las filas de la base
 * quedan, con el mismo criterio que `api.test.ts`.
 *
 * SOLO contra un entorno propio: usa la clave de servicio de Supabase.
 */

const prisma = new PrismaClient()
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SUFIJO = Date.now().toString().slice(-8)
const CLAVE = `Seg-${SUFIJO}-aA1!`

interface Cuenta {
  id: string
  email: string
  headers: Record<string, string>
}

let tiendaId: string
let admin: Cuenta
let vendedor: Cuenta // solo facturas.ver + facturas.crear
let otro: Cuenta // en la tienda, sin permisos de facturación
const authCreados: string[] = []

async function token(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ email, password }),
  })
  const datos = await res.json()
  if (!res.ok || !datos.access_token) throw new Error(`Sin sesión para ${email}: ${datos.error_description || res.status}`)
  return datos.access_token
}

function cabeceras(t: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, 'x-tienda-id': tiendaId }
}

async function llamar(cuenta: Pick<Cuenta, 'headers'> | null, ruta: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    ...init,
    headers: { ...(cuenta ? cuenta.headers : { 'Content-Type': 'application/json' }), ...init.headers },
  })
  const texto = await res.text()
  let data: any = null
  try {
    data = JSON.parse(texto)
  } catch {
    data = texto
  }
  return { status: res.status, data }
}

/** Crea la cuenta en Supabase Auth y en la base, dentro de la tienda de pruebas. */
async function crearCuenta(prefijo: string, permisos: string[]): Promise<Cuenta> {
  const email = `${prefijo}-${SUFIJO}@seguridad.local`

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` },
    body: JSON.stringify({ email, password: CLAVE, email_confirm: true }),
  })
  const creada = await res.json()
  if (!res.ok) throw new Error(`No se pudo crear ${email}: ${creada.msg || res.status}`)
  authCreados.push(creada.id)

  await prisma.usuario.create({ data: { id: creada.id, email } })
  await prisma.usuarioTienda.create({ data: { usuarioId: creada.id, tiendaId } })

  if (permisos.length > 0) {
    const r = await llamar(admin, '/api/usuarios/permisos', {
      method: 'POST',
      body: JSON.stringify({ usuarioIds: [creada.id], permisos, modo: 'agregar' }),
    })
    if (r.status !== 200) throw new Error(`No se pudieron asignar permisos a ${email}: ${r.status}`)
  }

  return { id: creada.id, email, headers: cabeceras(await token(email, CLAVE)) }
}

const itemsFactura = [
  { productoNombre: `SEG-${SUFIJO}`, cantidadM2: 1, precioUnitario: 10000, subtotal: 10000 },
]

function cuerpoFactura(extra: Record<string, unknown> = {}) {
  return JSON.stringify({ subtotal: 10000, total: 10000, items: itemsFactura, ...extra })
}

beforeAll(async () => {
  if (!SUPABASE_URL || !ANON || !SERVICIO) throw new Error('Faltan las variables de Supabase en .env')

  const tokenAdmin = await token(process.env.E2E_USER!, process.env.E2E_PASSWORD!)

  // La misma tienda que elige api.test.ts: donde la cuenta de pruebas puede más.
  const accesos = await prisma.usuarioTienda.findMany({
    where: { usuario: { email: process.env.E2E_USER } },
    include: { permisos: true, usuario: { select: { id: true } } },
  })
  const capacidad = (a: (typeof accesos)[number]) => (a.esOwner ? 1000 : a.esAdmin ? 500 : a.permisos.length)
  const mejor = [...accesos].sort((x, y) => capacidad(y) - capacidad(x))[0]
  tiendaId = mejor.tiendaId

  admin = { id: mejor.usuario.id, email: process.env.E2E_USER!, headers: cabeceras(tokenAdmin) }
  vendedor = await crearCuenta('seg-vendedor', ['facturas.ver', 'facturas.crear'])
  otro = await crearCuenta('seg-otro', ['facturas.ver'])
}, 120000)

afterAll(async () => {
  // Las cuentas de pruebas dejan de poder entrar; en la base quedan las filas.
  for (const id of authCreados) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` },
    }).catch(() => {})
  }
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// API2 · Autenticación rota
// ---------------------------------------------------------------------------
describe('API2 · sin sesión o con token falso', () => {
  const rutas: [string, string, string?][] = [
    ['TC-01', 'GET /api/usuarios/perfil'],
    ['TC-02', 'PUT /api/usuarios/perfil', '{"nombre":"x"}'],
    ['TC-03', 'GET /api/facturas/vendedores'],
    ['TC-04', 'POST /api/facturas', '{}'],
    ['TC-05', 'GET /api/liquidaciones/pendientes'],
  ]

  for (const [id, etiqueta, cuerpo] of rutas) {
    const [metodo, ruta] = etiqueta.split(' ')

    it(`${id} ${etiqueta} sin token → 401`, async () => {
      const { status } = await llamar(null, ruta, { method: metodo, body: cuerpo })
      expect(status).toBe(401)
    })

    it(`${id}b ${etiqueta} con token inventado → 401`, async () => {
      const { status } = await llamar(
        { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer abc.def.ghi' } },
        ruta,
        { method: metodo, body: cuerpo }
      )
      expect(status).toBe(401)
    })
  }

  it('TC-06 JWT con alg "none" → 401', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const falso = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: admin.id, email: admin.email, role: 'authenticated' })}.`
    const { status } = await llamar(
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${falso}` } },
      '/api/usuarios/perfil'
    )
    expect(status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// API1 / API3 · perfil: solo el propio, y sin asignación masiva
// ---------------------------------------------------------------------------
describe('API1/API3 · perfil de la cuenta', () => {
  it('TC-10 positivo: cada cuenta guarda y lee su propio perfil', async () => {
    const put = await llamar(vendedor, '/api/usuarios/perfil', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'Vendedor Seguridad', telefono: '300 123 4567' }),
    })
    expect(put.status).toBe(200)

    const get = await llamar(vendedor, '/api/usuarios/perfil')
    expect(get.data).toMatchObject({ email: vendedor.email, nombre: 'Vendedor Seguridad', telefono: '300 123 4567' })
  })

  it('TC-11 BOLA: mandar el id/correo de otro no cambia el perfil ajeno', async () => {
    const antes = await prisma.usuario.findUnique({ where: { id: otro.id } })

    const { status } = await llamar(vendedor, '/api/usuarios/perfil', {
      method: 'PUT',
      body: JSON.stringify({ id: otro.id, usuarioId: otro.id, email: otro.email, nombre: 'Intruso', telefono: '3009998888' }),
    })
    expect(status).toBe(200)

    const despues = await prisma.usuario.findUnique({ where: { id: otro.id } })
    expect(despues!.nombre).toBe(antes!.nombre)
    expect(despues!.telefono).toBe(antes!.telefono)
  })

  it('TC-12 mass assignment: correo, id y último acceso del cuerpo se ignoran', async () => {
    const antes = await prisma.usuario.findUnique({ where: { id: vendedor.id } })

    await llamar(vendedor, '/api/usuarios/perfil', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'Mismo', email: 'otro@seguridad.local', id: admin.id, lastLogin: '2000-01-01T00:00:00Z' }),
    })

    const despues = await prisma.usuario.findUnique({ where: { id: vendedor.id } })
    expect(despues!.email).toBe(antes!.email)
    expect(despues!.id).toBe(antes!.id)
    expect(despues!.lastLogin?.getTime() ?? null).toBe(antes!.lastLogin?.getTime() ?? null)
  })

  it('TC-13 el perfil no devuelve campos internos', async () => {
    const { data } = await llamar(vendedor, '/api/usuarios/perfil')
    expect(Object.keys(data).sort()).toEqual(['email', 'nombre', 'telefono'])
  })

  it('TC-14 teléfono con letras → 400', async () => {
    const { status } = await llamar(vendedor, '/api/usuarios/perfil', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'Ok', telefono: 'abc-def-ghi' }),
    })
    expect(status).toBe(400)
  })

  it('TC-15 nombre de 121 caracteres → 400', async () => {
    const { status } = await llamar(vendedor, '/api/usuarios/perfil', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'a'.repeat(121) }),
    })
    expect(status).toBe(400)
  })

  it('TC-16 SQLi en el nombre se guarda como texto y la tabla sigue ahí', async () => {
    const carga = `'; DROP TABLE usuarios;--`
    const { status } = await llamar(vendedor, '/api/usuarios/perfil', {
      method: 'PUT',
      body: JSON.stringify({ nombre: carga, telefono: '3001234567' }),
    })
    expect(status).toBe(200)

    const fila = await prisma.usuario.findUnique({ where: { id: vendedor.id } })
    expect(fila!.nombre).toBe(carga)
  })

  it('TC-17 XSS almacenado: la API lo devuelve como JSON, no como HTML', async () => {
    const carga = '<script>alert(1)</script>'
    await llamar(vendedor, '/api/usuarios/perfil', { method: 'PUT', body: JSON.stringify({ nombre: carga }) })

    const res = await fetch(`${BASE}/api/usuarios/perfil`, { headers: vendedor.headers })
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')

    // Queda un nombre sano para las pruebas siguientes.
    await llamar(vendedor, '/api/usuarios/perfil', {
      method: 'PUT',
      body: JSON.stringify({ nombre: 'Vendedor Seguridad', telefono: '300 123 4567' }),
    })
  })

  it('TC-18 nombre y teléfono se pueden borrar con vacío', async () => {
    const { status, data } = await llamar(otro, '/api/usuarios/perfil', {
      method: 'PUT',
      body: JSON.stringify({ nombre: '  ', telefono: '' }),
    })
    expect(status).toBe(200)
    expect(data.nombre).toBeNull()
    expect(data.telefono).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// API5 · BFLA: facturar a nombre de otros
// ---------------------------------------------------------------------------
describe('API5 · facturar a nombre de otros', () => {
  it('TC-20 sin el permiso, la lista de usuarios llega vacía (no se filtra nadie)', async () => {
    const { status, data } = await llamar(vendedor, '/api/facturas/vendedores')
    expect(status).toBe(200)
    expect(data).toEqual({ puede: false, vendedores: [] })
  })

  it('TC-21 positivo: el administrador ve a los usuarios de su tienda', async () => {
    const { status, data } = await llamar(admin, '/api/facturas/vendedores')
    expect(status).toBe(200)
    expect(data.puede).toBe(true)
    const ids = data.vendedores.map((v: any) => v.id)
    expect(ids).toContain(vendedor.id)
    expect(ids).toContain(otro.id)
  })

  it('TC-22 sin el permiso, facturar a nombre de otro → 403 y no se crea nada', async () => {
    const antes = await prisma.factura.count({ where: { tiendaId, usuarioId: vendedor.id } })

    const { status } = await llamar(vendedor, '/api/facturas', {
      method: 'POST',
      body: cuerpoFactura({ vendedorId: otro.id }),
    })
    expect(status).toBe(403)

    const despues = await prisma.factura.count({ where: { tiendaId, usuarioId: vendedor.id } })
    expect(despues).toBe(antes)
  })

  it('TC-23 positivo: sin el permiso, facturar a su propio nombre funciona', async () => {
    const { status, data } = await llamar(vendedor, '/api/facturas', {
      method: 'POST',
      body: cuerpoFactura({ vendedorId: vendedor.id }),
    })
    expect(status).toBe(201)
    expect(data.vendedorId).toBe(vendedor.id)
    expect(data.usuarioId).toBe(vendedor.id)
  })

  it('TC-24 sin vendedorId, la factura queda a nombre de quien la registra', async () => {
    const { status, data } = await llamar(vendedor, '/api/facturas', { method: 'POST', body: cuerpoFactura() })
    expect(status).toBe(201)
    expect(data.vendedorId).toBe(vendedor.id)
  })

  it('TC-25 el permiso no se puede conceder a sí mismo sin tenerlo (escalada)', async () => {
    const { status } = await llamar(vendedor, '/api/usuarios/permisos', {
      method: 'POST',
      body: JSON.stringify({ usuarioIds: [vendedor.id], permisos: ['facturas.a_nombre_de_otros'], modo: 'agregar' }),
    })
    // Sin 'usuarios.gestionar' ni el permiso, no puede otorgárselo.
    expect([401, 403]).toContain(status)

    const tiene = await prisma.permisoAsignado.count({
      where: {
        usuarioTienda: { usuarioId: vendedor.id, tiendaId },
        permiso: { modulo: 'facturas', accion: 'a_nombre_de_otros' },
      },
    })
    expect(tiene).toBe(0)
  })

  it('TC-26 vendedorId que no es UUID → 400', async () => {
    const { status } = await llamar(admin, '/api/facturas', {
      method: 'POST',
      body: cuerpoFactura({ vendedorId: "1' OR '1'='1" }),
    })
    expect(status).toBe(400)
  })

  it('TC-27 BOLA entre tiendas: vendedorId de alguien que no trabaja aquí → 400', async () => {
    const ajeno = await prisma.usuario.create({ data: { email: `seg-ajeno-${SUFIJO}@seguridad.local` }, select: { id: true } })

    const { status } = await llamar(admin, '/api/facturas', {
      method: 'POST',
      body: cuerpoFactura({ vendedorId: ajeno.id }),
    })
    expect(status).toBe(400)

    const creada = await prisma.factura.count({ where: { vendedorId: ajeno.id } })
    expect(creada).toBe(0)
  })

  it('TC-28 positivo: con permiso (administrador) se factura a nombre de otro y queda registrado quién la hizo', async () => {
    const { status, data } = await llamar(admin, '/api/facturas', {
      method: 'POST',
      body: cuerpoFactura({ vendedorId: otro.id }),
    })
    expect(status).toBe(201)
    expect(data.vendedorId).toBe(otro.id)
    expect(data.usuarioId).toBe(admin.id)
  })

  it('TC-29 el usuarioId del cuerpo sigue sin servir para suplantar a nadie', async () => {
    const { status, data } = await llamar(vendedor, '/api/facturas', {
      method: 'POST',
      body: cuerpoFactura({ usuarioId: otro.id }),
    })
    expect(status).toBe(201)
    expect(data.usuarioId).toBe(vendedor.id)
    expect(data.vendedorId).toBe(vendedor.id)
  })
})

// ---------------------------------------------------------------------------
// API1 · visibilidad de facturas por vendedor
// ---------------------------------------------------------------------------
describe('API1 · quién ve qué factura', () => {
  let facturaDeOtro: string // registrada por el admin a nombre de "otro"
  let facturaAjena: string // del admin, sin relación con "otro"

  beforeAll(async () => {
    const a = await llamar(admin, '/api/facturas', { method: 'POST', body: cuerpoFactura({ vendedorId: otro.id }) })
    facturaDeOtro = a.data.id
    const b = await llamar(admin, '/api/facturas', { method: 'POST', body: cuerpoFactura() })
    facturaAjena = b.data.id
  }, 60000)

  it('TC-30 positivo: ve la factura hecha a su nombre aunque la registró otro', async () => {
    const { status } = await llamar(otro, `/api/facturas/${facturaDeOtro}`)
    expect(status).toBe(200)
  })

  it('TC-31 BOLA: no ve la factura de alguien más → 403', async () => {
    const { status } = await llamar(otro, `/api/facturas/${facturaAjena}`)
    expect(status).toBe(403)
  })

  it('TC-32 BOLA en el PDF: tampoco se descarga la ajena', async () => {
    const res = await fetch(`${BASE}/api/facturas/${facturaAjena}/pdf`, { headers: otro.headers })
    expect(res.status).toBe(403)
  })

  it('TC-33 el listado solo trae las propias y las hechas a su nombre', async () => {
    const { data } = await llamar(otro, '/api/facturas')
    const ids = data.map((f: any) => f.id)
    expect(ids).toContain(facturaDeOtro)
    expect(ids).not.toContain(facturaAjena)
  })

  it('TC-34 la búsqueda no amplía el alcance (el filtro de propias se mantiene)', async () => {
    const { data } = await llamar(otro, '/api/facturas?limite=50&busqueda=zzz-no-existe-zzz')
    expect(data.facturas).toEqual([])

    const todas = await llamar(otro, '/api/facturas?limite=200')
    const ids = todas.data.facturas.map((f: any) => f.id)
    expect(ids).not.toContain(facturaAjena)
  })
})

// ---------------------------------------------------------------------------
// API5/API6 · liquidación por vendedor
// ---------------------------------------------------------------------------
describe('API5/API6 · liquidación por vendedor', () => {
  let facturaId: string

  beforeAll(async () => {
    // Factura a nombre de "otro", registrada por el admin y cobrada.
    const c = await llamar(admin, '/api/facturas', {
      method: 'POST',
      body: cuerpoFactura({ vendedorId: otro.id, anticipo: 10000 }),
    })
    facturaId = c.data.id
  }, 60000)

  it('TC-40 sin permiso de liquidar, el vendedor no ve lo pendiente → 403', async () => {
    const { status } = await llamar(vendedor, '/api/liquidaciones/pendientes')
    expect(status).toBe(403)
  })

  it('TC-41 la factura aparece bajo el vendedor elegido, no bajo quien la registró', async () => {
    const lista = await llamar(admin, '/api/liquidaciones/pendientes')
    const ids = lista.data.vendedores.map((v: any) => v.id)
    expect(ids).toContain(otro.id)

    const deOtro = await llamar(admin, `/api/liquidaciones/pendientes?vendedorId=${otro.id}`)
    expect(deOtro.data.facturas.map((f: any) => f.id)).toContain(facturaId)

    const delAdmin = await llamar(admin, `/api/liquidaciones/pendientes?vendedorId=${admin.id}`)
    expect(delAdmin.data.facturas.map((f: any) => f.id)).not.toContain(facturaId)
  })

  it('TC-42 no se puede liquidar esa factura a quien solo la registró → 409', async () => {
    const { status } = await llamar(admin, '/api/liquidaciones', {
      method: 'POST',
      body: JSON.stringify({ vendedorId: admin.id, facturaIds: [facturaId], porcentaje: 30, costos: {} }),
    })
    expect(status).toBe(409)

    const f = await prisma.factura.findUnique({ where: { id: facturaId } })
    expect(f!.estado).not.toBe('liquidado')
  })
})

// ---------------------------------------------------------------------------
// API4 / API6 · registro con nombre y teléfono
// ---------------------------------------------------------------------------
describe('API4/API6 · registro con nombre y teléfono', () => {
  const emails: string[] = []

  afterAll(async () => {
    // Las cuentas de registro no deben quedar vivas en Auth.
    for (const email of emails) {
      const u = await prisma.usuario.findUnique({ where: { email } })
      if (u) {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
          method: 'DELETE',
          headers: { apikey: SERVICIO, Authorization: `Bearer ${SERVICIO}` },
        }).catch(() => {})
      }
    }
  })

  it('TC-50 teléfono inválido → 400 y no se crea la cuenta', async () => {
    const email = `seg-reg-mal-${SUFIJO}@seguridad.local`
    emails.push(email)

    const { status } = await llamar(null, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: CLAVE, nombre: 'Prueba', telefono: 'no-es-telefono' }),
    })
    expect(status).toBe(400)

    // Validar antes de crear: no queda una cuenta a medias en la base.
    expect(await prisma.usuario.findUnique({ where: { email } })).toBeNull()
  })

  it('TC-51 positivo: con nombre y teléfono válidos se guardan', async () => {
    const email = `seg-reg-ok-${SUFIJO}@seguridad.local`
    emails.push(email)

    const { status } = await llamar(null, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: CLAVE, nombre: '  Ana Prueba ', telefono: '+57 300 111 2222' }),
    })
    expect(status).toBe(201)

    const fila = await prisma.usuario.findUnique({ where: { email } })
    expect(fila!.nombre).toBe('Ana Prueba')
    expect(fila!.telefono).toBe('+57 300 111 2222')
  })

  it('TC-52 positivo: nombre y teléfono siguen siendo opcionales', async () => {
    const email = `seg-reg-vacio-${SUFIJO}@seguridad.local`
    emails.push(email)

    const { status } = await llamar(null, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: CLAVE }),
    })
    expect(status).toBe(201)

    const fila = await prisma.usuario.findUnique({ where: { email } })
    expect(fila!.nombre).toBeNull()
    expect(fila!.telefono).toBeNull()
  })

  it('TC-53 el registro no deja elegir rol ni permisos por el cuerpo', async () => {
    const email = `seg-reg-rol-${SUFIJO}@seguridad.local`
    emails.push(email)

    const { status } = await llamar(null, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: CLAVE, role: 'admin', esAdmin: true, esOwner: true, tiendaId }),
    })
    expect(status).toBe(201)

    const fila = await prisma.usuario.findUnique({ where: { email }, include: { tiendas: true } })
    expect(fila!.tiendas).toHaveLength(0)
  })
})
