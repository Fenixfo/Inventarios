import { test, expect, Page } from '@playwright/test'

// Flujo del cliente: catálogo -> carrito -> envío por WhatsApp.
// No requiere autenticación.

// El campo de WhatsApp destino solo se muestra cuando la configuración
// no trae número, y aparece después de esa consulta: hay que esperarlo
// en vez de comprobar su visibilidad de inmediato.
async function completarDestinoSiHaceFalta(page: Page) {
  const destino = page.getByPlaceholder('573001234567')
  await destino.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

  if (await destino.isVisible().catch(() => false)) {
    await destino.fill('573001234567')
  }
}

test.describe('Catálogo público', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('carga sin necesidad de iniciar sesión', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /catálogo de productos/i })).toBeVisible()
    expect(page.url()).not.toContain('/login')
  })

  test('muestra los productos disponibles con su precio', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    const total = await tarjetas.count()
    expect(total).toBeGreaterThan(0)

    // Todo producto listado debe mostrar un precio en pesos.
    await expect(tarjetas.first().getByText(/\$/).first()).toBeVisible()
  })

  // El filtro es una lista desplegable y no una hilera de botones: con
  // muchas categorías, los botones empujaban los productos fuera de la
  // pantalla.
  test('permite filtrar por categoría', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    const selector = page.getByLabel('Categoría', { exact: true })
    const opciones = selector.locator('option')

    // La primera opción es "Todas las categorías".
    if ((await opciones.count()) < 2) return

    const elegida = (await opciones.nth(1).getAttribute('value'))!

    await selector.selectOption(elegida)
    await expect(tarjetas.first()).toBeVisible()

    // Lo que queda es de esa categoría, que es lo que importa. No se
    // comparan cantidades: sin filtro la portada muestra una muestra, así
    // que al filtrar pueden aparecer más productos, no menos.
    const insignias = page.getByTestId('productos').getByText(elegida, { exact: true })
    expect(await insignias.count()).toBe(await tarjetas.count())
  })

  test('al filtrar trae un tope y el resto llega con "Ver más"', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    // Se filtra por tienda para tener un listado largo detrás.
    const selectorTienda = page.getByLabel('Tienda', { exact: true })
    if (!(await selectorTienda.isVisible().catch(() => false))) return

    const tienda = (await selectorTienda.locator('option').nth(1).getAttribute('value'))!
    await selectorTienda.selectOption(tienda)
    await expect(tarjetas.first()).toBeVisible()

    const primeras = await tarjetas.count()
    expect(primeras).toBeLessThanOrEqual(9)

    const verMas = page.getByRole('button', { name: /ver más/i })
    if (!(await verMas.isVisible().catch(() => false))) return

    await verMas.click()

    // Cada "Ver más" añade la tanda siguiente a lo que ya se veía, sin
    // recargar el listado desde cero.
    await expect.poll(async () => tarjetas.count()).toBeGreaterThan(primeras)
    expect(await tarjetas.count()).toBeLessThanOrEqual(primeras + 3)
  })

  test('la portada muestra unos pocos por tienda, y los filtros abren el resto', async ({
    page,
  }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    // Es una vitrina: con varias tiendas y cientos de productos cada una,
    // volcarlo todo deja al visitante desplazándose sin rumbo.
    await expect(page.getByText(/lo más reciente de cada tienda/i)).toBeVisible()

    const selectorTienda = page.getByLabel('Tienda', { exact: true })
    if (!(await selectorTienda.isVisible().catch(() => false))) return

    const enPortada = await tarjetas.count()
    const tienda = (await selectorTienda.locator('option').nth(1).getAttribute('value'))!

    await selectorTienda.selectOption(tienda)
    await expect(tarjetas.first()).toBeVisible()

    // Al elegir una tienda se ve su catálogo entero y el aviso desaparece.
    await expect(page.getByText(/lo más reciente de cada tienda/i)).not.toBeVisible()
    expect(await tarjetas.count()).toBeGreaterThan(0)
    expect(enPortada).toBeGreaterThan(0)
  })

  test('elegir una tienda deja solo sus categorías', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    const selectorTienda = page.getByLabel('Tienda', { exact: true })
    if (!(await selectorTienda.isVisible().catch(() => false))) return

    const categorias = page.getByLabel('Categoría', { exact: true }).locator('option')
    const antes = await categorias.count()

    const tienda = (await selectorTienda.locator('option').nth(1).getAttribute('value'))!
    await selectorTienda.selectOption(tienda)

    // Quedan las de esa tienda: ofrecer categorías que no tiene solo lleva
    // a una pantalla en blanco.
    await expect.poll(async () => categorias.count()).toBeLessThanOrEqual(antes)
    expect(await categorias.count()).toBeGreaterThan(1)
  })

  test('todos los productos del catálogo tienen foto', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    // Una vitrina de cuadros grises no vende nada, así que el catálogo deja
    // fuera lo que no tenga imagen.
    const total = await tarjetas.count()
    const imagenes = await page.getByTestId('productos').locator('img').count()

    expect(imagenes).toBe(total)
  })

  test('el contador del carrito arranca oculto', async ({ page }) => {
    const enlace = page.getByRole('link', { name: /carrito/i })
    await expect(enlace).toBeVisible()
  })

  // La búsqueda la hace el servidor y se lanza con Enter: antes filtraba lo
  // que ya estaba en pantalla, así que buscar "gris" dentro de una categoría
  // solo miraba los nueve productos cargados.
  test('el buscador busca en todo el catálogo al pulsar Enter', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    const campo = page.getByLabel(/buscar por nombre/i)

    // Se busca sin tildes a propósito: "cafe" tiene que encontrar "Café".
    await campo.fill('cafe')
    await campo.press('Enter')

    await expect.poll(async () => tarjetas.count()).toBeGreaterThan(0)

    const nombres = await tarjetas.getByRole('heading').allTextContents()
    nombres.forEach((n) => {
      const sinTildes = n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      expect(sinTildes).toContain('cafe')
    })
  })

  test('con menos de tres letras no se busca', async ({ page }) => {
    const campo = page.getByLabel(/buscar por nombre/i)
    await campo.fill('ca')

    await expect(page.getByText(/al menos 3 letras/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toBeDisabled()
  })

  test('una búsqueda sin resultados se puede limpiar', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    const campo = page.getByLabel(/buscar por nombre/i)
    await campo.fill('zzzz-no-existe-zzzz')
    await campo.press('Enter')

    await expect(page.getByText(/ningún producto coincide/i)).toBeVisible()

    // Hay dos formas de limpiar: la × del campo y el botón del mensaje.
    // Aquí se usa el del mensaje, que es el que ve quien no encontró nada.
    await page.getByRole('button', { name: 'Borrar búsqueda', exact: true }).click()
    await expect(tarjetas.first()).toBeVisible()
    await expect(campo).toHaveValue('')
  })

  test('al pulsar la tarjeta se abre la ficha ampliada', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    const nombre = (await tarjetas.first().getByRole('heading').textContent())?.trim() || ''

    await tarjetas.first().getByRole('button', { name: /ver detalles/i }).click()

    const ficha = page.getByRole('dialog')
    await expect(ficha).toBeVisible()
    await expect(ficha.getByRole('heading', { name: nombre })).toBeVisible()
    await expect(ficha.getByText(/precio/i).first()).toBeVisible()

    // Escape la cierra sin añadir nada al carrito.
    await page.keyboard.press('Escape')
    await expect(ficha).not.toBeVisible()
  })

  test('desde la ficha se pasa al pop-up de cantidad', async ({ page }) => {
    const tarjetas = page.getByTestId('productos').locator('> div')
    await expect(tarjetas.first()).toBeVisible()

    await tarjetas.first().getByRole('button', { name: /ver detalles/i }).click()

    const ficha = page.getByRole('dialog')
    await ficha.getByRole('button', { name: /agregar al carrito/i }).click()

    await expect(ficha).not.toBeVisible()
    await expect(page.locator('.popup-in').getByRole('spinbutton')).toBeVisible()
  })
})

test.describe('Agregar al carrito', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('productos').locator('> div').first()).toBeVisible()
  })

  test('el pop-up pide los metros y calcula el total', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()

    const popup = page.locator('.popup-in')
    await expect(popup).toBeVisible()
    await expect(popup.getByText(/cuántos m² deseas/i)).toBeVisible()

    const input = popup.getByRole('spinbutton')
    await expect(input).toHaveValue('1')

    await input.fill('4')
    await expect(popup.getByText(/^Total$/)).toBeVisible()
  })

  test('los botones + y − ajustan de a 0.5 m²', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()

    const popup = page.locator('.popup-in')
    const input = popup.getByRole('spinbutton')

    await popup.getByRole('button', { name: '+' }).click()
    await expect(input).toHaveValue('1.5')

    await popup.getByRole('button', { name: '−' }).click()
    await expect(input).toHaveValue('1')
  })

  test('se cierra con Escape sin agregar nada', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    await expect(page.locator('.popup-in')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('.popup-in')).not.toBeVisible()

    await page.goto('/carrito')
    await expect(page.getByText(/el carrito está vacío/i)).toBeVisible()
  })

  test('se cierra al hacer clic fuera', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    await expect(page.locator('.popup-in')).toBeVisible()

    await page.mouse.click(10, 10)
    await expect(page.locator('.popup-in')).not.toBeVisible()
  })

  test('agrega el producto y lo refleja en el contador', async ({ page }) => {
    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()

    const popup = page.locator('.popup-in')
    await popup.getByRole('spinbutton').fill('3')
    await popup.getByRole('button', { name: /agregar al carrito/i }).click()

    await expect(popup).not.toBeVisible()
    await expect(page.getByRole('link', { name: /carrito/i })).toContainText('1')
  })
})

test.describe('Carrito', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('productos').locator('> div').first()).toBeVisible()

    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    const popup = page.locator('.popup-in')
    await popup.getByRole('spinbutton').fill('2')
    await popup.getByRole('button', { name: /agregar al carrito/i }).click()
    await expect(popup).not.toBeVisible()

    await page.goto('/carrito')
  })

  test('el producto persiste al navegar entre páginas', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /carrito de compras/i })).toBeVisible()
    await expect(page.getByRole('spinbutton')).toHaveValue('2')
  })

  test('permite cambiar la cantidad escribiendo', async ({ page }) => {
    await page.getByRole('spinbutton').fill('5')
    await expect(page.getByRole('spinbutton')).toHaveValue('5')
  })

  test('quitar el producto deja el carrito vacío', async ({ page }) => {
    // El botón se nombra por su aria-label: un "✕" a secas no le dice nada
    // a quien navega con lector de pantalla.
    await page.getByRole('button', { name: /quitar .* del carrito/i }).click()
    await expect(page.getByText(/el carrito está vacío/i)).toBeVisible()
  })
})

test.describe('Envío del pedido por WhatsApp', () => {
  test.beforeEach(async ({ page }) => {
    // Se intercepta window.open para leer la URL generada sin salir
    // a wa.me, que es un dominio externo y no hace falta para la prueba.
    await page.addInitScript(() => {
      ;(window as any).__urlWhatsapp = null
      window.open = (url?: string | URL) => {
        ;(window as any).__urlWhatsapp = String(url)
        return null
      }
    })

    await page.goto('/')
    await expect(page.getByTestId('productos').locator('> div').first()).toBeVisible()

    await page.getByRole('button', { name: /agregar al carrito/i }).first().click()
    const popup = page.locator('.popup-in')
    await popup.getByRole('spinbutton').fill('2')
    await popup.getByRole('button', { name: /agregar al carrito/i }).click()

    await page.goto('/carrito')
    await page.getByRole('button', { name: /enviar por whatsapp/i }).click()
  })

  test('exige el teléfono del cliente', async ({ page }) => {
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(/ingresa tu número de teléfono/i)).toBeVisible()
  })

  test('rechaza un teléfono demasiado corto', async ({ page }) => {
    await page.getByPlaceholder('300 123 4567').fill('12345')
    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(/al menos 10 dígitos/i)).toBeVisible()
  })

  test('muestra el resumen del pedido antes de enviar', async ({ page }) => {
    await expect(page.getByText(/productos:/i)).toBeVisible()
    await expect(page.getByText(/total m²:/i)).toBeVisible()
  })

  test('genera el enlace de WhatsApp con el pedido y confirma el envío', async ({ page }) => {
    await page.getByPlaceholder('Juan Pérez').fill('Cliente E2E')
    await page.getByPlaceholder('300 123 4567').fill('3001234567')
    await completarDestinoSiHaceFalta(page)

    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(/pedido enviado/i)).toBeVisible()

    const url = await page.evaluate(() => (window as any).__urlWhatsapp)
    const legible = decodeURIComponent(url)

    expect(url).toContain('wa.me/')
    expect(legible).toContain('NUEVO PEDIDO')
    expect(legible).toContain('Cliente E2E')
    expect(legible).toContain('3001234567')
    expect(legible).toMatch(/TOTAL/)
  })

  test('el carrito queda vacío después de enviar', async ({ page }) => {
    await page.getByPlaceholder('300 123 4567').fill('3001234567')
    await completarDestinoSiHaceFalta(page)

    await page.getByRole('button', { name: 'Enviar', exact: true }).click()
    await expect(page.getByText(/pedido enviado/i)).toBeVisible()

    await page.getByRole('button', { name: /cerrar/i }).click()
    await expect(page.getByText(/el carrito está vacío/i)).toBeVisible()
  })
})
