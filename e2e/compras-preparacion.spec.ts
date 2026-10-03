import { test, expect } from '@playwright/test'
import {
  ADMIN,
  CUENTA_B,
  hayCredenciales,
  iniciarSesionUI,
  prisma,
  tiendaDeAdmin,
  tiendaPropiaDe,
  trabajarEnTienda,
} from './ayudas-compras'

/**
 * Prepara las cuentas para probar el módulo de compras, usando las pantallas de
 * la aplicación como lo haría una persona. Se puede repetir: cada paso mira
 * antes si ya está hecho y, si es así, se salta.
 *
 *   1. Se registra la cuenta B desde la pantalla de registro.
 *   2. B crea su propia tienda (así queda como dueña de una segunda tienda).
 *   3. B pide acceso a la tienda de pruebas A con su código.
 *   4. La administradora de A aprueba la solicitud.
 *
 * Al terminar, B está en dos tiendas: la suya y A. Lo que sigue (permisos,
 * aislamiento entre tiendas) lo usan las demás pruebas de compras.
 */

test.describe.configure({ mode: 'serial' })

test.skip(!hayCredenciales, 'Faltan E2E_USER, E2E_PASSWORD, E2E_USER2 o E2E_PASSWORD2')

test('1. registra la cuenta B desde la pantalla de registro', async ({ page }) => {
  const existe = await prisma.usuario.findUnique({ where: { email: CUENTA_B.email! } })
  test.skip(Boolean(existe), 'La cuenta B ya está registrada')

  await page.goto('/signup')
  await page.locator('#nombre').fill('Cuenta de pruebas de compras')
  await page.locator('#email').fill(CUENTA_B.email!)
  await page.locator('#password').fill(CUENTA_B.clave!)
  await page.locator('#confirmPassword').fill(CUENTA_B.clave!)
  await page.locator('button[type="submit"]').click()

  await expect(page.getByText(/Registro exitoso/)).toBeVisible()
  await page.waitForURL(/\/login/)

  expect(await prisma.usuario.findUnique({ where: { email: CUENTA_B.email! } })).not.toBeNull()
})

test('2. B crea su propia tienda', async ({ page }) => {
  test.skip(Boolean(await tiendaPropiaDe(CUENTA_B)), 'B ya tiene su tienda')

  await iniciarSesionUI(page, CUENTA_B)
  await page.goto('/tiendas/nueva')
  await page.getByPlaceholder('Cerámicas del Norte').fill(`TEST Compras B ${Date.now().toString().slice(-6)}`)
  await page.getByRole('button', { name: /crear/i }).last().click()

  await expect(page.getByRole('heading', { name: 'Tienda creada' })).toBeVisible({ timeout: 30000 })
  expect(await tiendaPropiaDe(CUENTA_B)).not.toBeNull()
})

test('3. B pide acceso a la tienda de pruebas A con su código', async ({ page }) => {
  const tiendaA = await tiendaDeAdmin()
  const yaEsMiembro = await prisma.usuarioTienda.findFirst({
    where: { usuario: { email: CUENTA_B.email }, tiendaId: tiendaA },
  })
  const yaPidio = await prisma.solicitudAcceso.findFirst({
    where: { tiendaId: tiendaA, usuario: { email: CUENTA_B.email }, estado: 'pendiente' },
  })
  test.skip(Boolean(yaEsMiembro || yaPidio), 'B ya es miembro de A o ya tiene una solicitud pendiente')

  const { codigo } = await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaA }, select: { codigo: true } })

  await iniciarSesionUI(page, CUENTA_B)
  await page.goto('/request-access')
  await page.getByPlaceholder('AB3K9M').fill(codigo)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.locator('textarea').fill('Pruebas automáticas del módulo de compras')
  await page.getByRole('button', { name: /Pedir acceso a/ }).click()

  await expect
    .poll(
      async () =>
        prisma.solicitudAcceso.count({
          where: { tiendaId: tiendaA, usuario: { email: CUENTA_B.email }, estado: 'pendiente' },
        }),
      { timeout: 30000 }
    )
    .toBe(1)
})

test('4. la administradora de A aprueba la solicitud', async ({ page, context }) => {
  const tiendaA = await tiendaDeAdmin()
  const yaEsMiembro = await prisma.usuarioTienda.findFirst({
    where: { usuario: { email: CUENTA_B.email }, tiendaId: tiendaA },
  })
  test.skip(Boolean(yaEsMiembro), 'B ya es miembro de A')

  await trabajarEnTienda(context, tiendaA)
  await iniciarSesionUI(page, ADMIN)
  await page.goto('/admin/solicitudes-acceso')

  const fila = page.locator('div', { hasText: CUENTA_B.email! }).filter({ has: page.getByRole('button', { name: /Aprobar/ }) }).last()
  await fila.getByRole('button', { name: /Aprobar/ }).click()

  await expect
    .poll(
      async () =>
        prisma.usuarioTienda.count({ where: { usuario: { email: CUENTA_B.email }, tiendaId: tiendaA } }),
      { timeout: 30000 }
    )
    .toBe(1)
})

test('5. B queda en dos tiendas: la suya y la de pruebas', async () => {
  const accesos = await prisma.usuarioTienda.findMany({
    where: { usuario: { email: CUENTA_B.email } },
    select: { tiendaId: true, esOwner: true },
  })

  expect(accesos).toHaveLength(2)
  expect(accesos.filter((a) => a.esOwner)).toHaveLength(1)
  expect(accesos.some((a) => !a.esOwner)).toBe(true)
})
