# Pruebas

El proyecto tiene tres niveles de pruebas. Solo el primero corre automáticamente.

| Nivel | Cantidad | Necesita | Comando |
|---|---:|---|---|
| Unitarias | 62 | nada | `npm test` |
| Integración | 27 | servidor + base de datos | `npm run test:integration` |
| End-to-end | 29 | servidor + navegador | `npm run test:e2e` |

`npm run test:all` corre los tres contra tu entorno local.

---

## Qué cubre cada nivel

**Unitarias** (`tests/unit/`) — lógica del carrito, render del componente `Cart`, validaciones de teléfono y movimientos, y las fórmulas de stock y de totales de factura. No tocan red ni base de datos: tardan segundos.

**Integración** (`tests/integration/`) — llama a los endpoints reales y comprueba el efecto en la base de datos: que una factura descuente stock, que un ajuste fije el inventario, que el catálogo público no exponga costos, que los permisos devuelvan 403.

**End-to-end** (`e2e/`) — maneja un navegador de verdad. Cubre el flujo del cliente (catálogo → pop-up de metros → carrito → WhatsApp) y el del administrador (login → producto → inventario → factura → PDF).

---

## Integración y E2E escriben en la base de datos

Ambos niveles crean registros reales: productos con prefijo `TEST-` o `E2E-`, facturas, movimientos de inventario. **No se limpian**, quedan como constancia de lo que se probó.

Mientras la base no sea productiva esto es cómodo. Cuando lo sea, hay que apuntarlos a una base aparte antes de automatizarlos.

---

## Integración continua

`.github/workflows/ci.yml` corre en cada pull request y en cada push a `main`:

1. `npm ci`
2. `npx prisma generate`
3. `npm run test:unit`
4. `npm run build` — el mismo comando que ejecuta Vercel

El paso 4 es el que más atrapa: el type-check completo. Ya evitó un deploy roto por un error de tipos en la configuración de Vitest.

**El CI no corre integración ni E2E**, porque escribirían en la base real en cada push.

Las variables del build son de relleno a propósito: las `NEXT_PUBLIC_*` se inyectan en el bundle y ninguna página consulta la base al compilar, así que el build no necesita credenciales verdaderas. Si algún día sí las necesitara, van como *secrets* del repositorio.

---

## Probar contra un despliegue de Vercel

Cada pull request genera un *Preview Deployment* con URL propia. Los tests aceptan esa URL por variable de entorno:

```bash
# End-to-end contra el preview
E2E_BASE_URL=https://inventarios-abc123.vercel.app npx playwright test

# Integración contra el preview
TEST_BASE_URL=https://inventarios-abc123.vercel.app npm run test:integration
```

Esto prueba el build de producción, no el servidor de desarrollo, así que detecta cosas que en local no aparecen: variables mal configuradas en Vercel, diferencias del runtime o rutas que solo fallan compiladas.

### Dos cosas a tener en cuenta

**Playwright levanta su propio servidor.** En `playwright.config.ts`, `webServer` ejecuta `npm run dev` y `reuseExistingServer` está activo. Al apuntar a Vercel hay que desactivarlo, o intentará levantar un servidor local que nadie usa:

```ts
webServer: process.env.E2E_BASE_URL ? undefined : { /* config actual */ }
```

**Los previews suelen estar protegidos.** Vercel los cubre con una pantalla de autenticación; el navegador de Playwright recibiría esa pantalla en vez de la aplicación. Se resuelve con un *Protection Bypass Token* (Vercel → Settings → Deployment Protection), que se envía como cabecera:

```ts
use: {
  extraHTTPHeaders: process.env.VERCEL_BYPASS
    ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS }
    : {},
}
```

**Recuerda que el preview usa la misma base de datos que producción.** Vercel inyecta las mismas variables en ambos, así que estos tests escriben en datos reales.

---

## Credenciales

Los E2E de administrador necesitan un usuario de prueba. Van en `.env`, que está en `.gitignore`:

```
E2E_USER=...
E2E_PASSWORD=...
```

Sin esas dos variables, los tests de administrador se saltan en vez de fallar. Playwright las carga con `dotenv` desde `playwright.config.ts`, porque no lee el `.env` por su cuenta.

---

## Rendimiento: por qué las pruebas tardan

La ida y vuelta mínima a Supabase (`SELECT 1`) es de unos **820 ms** desde Colombia, porque la base está en Oregón. Ese es el piso de cualquier consulta en local.

Por eso los tests de integración y E2E tienen tiempos de espera amplios (60 s en Vitest, 90 s en Playwright). No es que sean lentos por estar mal escritos: es latencia de red. En Vercel, con las funciones en la misma región que la base, esos tiempos bajan a milisegundos.
