import type { BrowserContext, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

/**
 * Lo común de las pruebas del módulo de compras: las dos cuentas de prueba,
 * el inicio de sesión, la tienda activa y las llamadas a la API.
 *
 * Las credenciales llegan por variables de entorno, nunca escritas aquí:
 *   E2E_USER / E2E_PASSWORD     la cuenta administradora de la tienda de prueba (A)
 *   E2E_USER2 / E2E_PASSWORD2   una segunda cuenta de pruebas (B), con tienda propia
 *
 * Todo lo que estas pruebas crean lleva el prefijo TEST- o E2E- y no se borra.
 */

export const prisma = new PrismaClient()
export const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000'

export interface Cuenta {
  email: string
  clave: string
}

export const ADMIN: Partial<Cuenta> = { email: process.env.E2E_USER, clave: process.env.E2E_PASSWORD }
export const CUENTA_B: Partial<Cuenta> = { email: process.env.E2E_USER2, clave: process.env.E2E_PASSWORD2 }

export const hayCredenciales = Boolean(ADMIN.email && ADMIN.clave && CUENTA_B.email && CUENTA_B.clave)

/** Dónde recuerda la aplicación la tienda en la que se trabaja (lib/api-client.ts). */
const CLAVE_TIENDA_ACTIVA = 'beraca.tienda'

/** Inicia sesión por la pantalla de login, como lo haría una persona. */
export async function iniciarSesionUI(page: Page, cuenta: Partial<Cuenta>) {
  await page.goto('/login')
  await page.locator('#email').fill(cuenta.email!)
  await page.locator('#password').fill(cuenta.clave!)
  await page.getByRole('button', { name: /ingresar|iniciar|entrar/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45000 })
}

/** Hace que el navegador arranque trabajando en esa tienda (como si se hubiera elegido en el menú). */
export async function trabajarEnTienda(context: BrowserContext, tiendaId: string) {
  await context.addInitScript(
    ([clave, id]) => {
      try {
        localStorage.setItem(clave, id)
      } catch {
        // Sin almacenamiento, el servidor usa la primera tienda del usuario.
      }
    },
    [CLAVE_TIENDA_ACTIVA, tiendaId]
  )
}

/** La tienda de la cuenta administradora: la misma que elegiría el servidor sin cabecera. */
export async function tiendaDeAdmin(): Promise<string> {
  const accesos = await prisma.usuarioTienda.findMany({
    where: { usuario: { email: ADMIN.email } },
    include: { permisos: true },
    orderBy: { createdAt: 'asc' },
  })
  if (accesos.length === 0) throw new Error(`${ADMIN.email} no tiene acceso a ninguna tienda`)

  const capacidad = (a: (typeof accesos)[number]) => (a.esOwner ? 1000 : a.esAdmin ? 500 : a.permisos.length)
  return [...accesos].sort((x, y) => capacidad(y) - capacidad(x))[0].tiendaId
}

/** La tienda propia (de la que es dueña) de una cuenta. */
export async function tiendaPropiaDe(cuenta: Partial<Cuenta>): Promise<string | null> {
  const acceso = await prisma.usuarioTienda.findFirst({
    where: { usuario: { email: cuenta.email }, esOwner: true },
    select: { tiendaId: true },
  })
  return acceso?.tiendaId ?? null
}

/** Un token de sesión, para llamar a la API sin pasar por la pantalla. */
export async function tokenDe(cuenta: Partial<Cuenta>): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o la clave anónima')

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon },
    body: JSON.stringify({ email: cuenta.email, password: cuenta.clave }),
  })
  const datos = await res.json()
  if (!res.ok || !datos.access_token) {
    throw new Error(`No se pudo iniciar sesión como ${cuenta.email}: ${datos.error_description || res.status}`)
  }
  return datos.access_token
}

/** Llama a la API como esa sesión y trabajando en esa tienda. */
export async function llamar(
  token: string,
  tiendaId: string | null,
  ruta: string,
  opciones: { method?: string; cuerpo?: unknown } = {}
) {
  const res = await fetch(`${BASE}${ruta}`, {
    method: opciones.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(tiendaId && { 'x-tienda-id': tiendaId }),
    },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  })
  return { status: res.status, cuerpo: await res.json().catch(() => null) }
}

/**
 * Deja a un usuario con exactamente esos permisos en esa tienda, como lo haría
 * el administrador desde la gestión de usuarios (modo "reemplazar").
 */
export async function fijarPermisos(tokenAdmin: string, tiendaId: string, usuarioId: string, permisos: string[]) {
  const r = await llamar(tokenAdmin, tiendaId, '/api/usuarios/permisos', {
    method: 'POST',
    cuerpo: { usuarioIds: [usuarioId], permisos, modo: 'reemplazar' },
  })
  if (r.status !== 200) throw new Error(`No se pudieron fijar los permisos (${r.status}): ${JSON.stringify(r.cuerpo)}`)
}
