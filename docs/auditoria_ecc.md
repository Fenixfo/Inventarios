# Auditoría del código contra las reglas de ECC

**Fecha:** 2026-09-26 · **Alcance:** `app/`, `components/`, `lib/`, `middleware.ts` (104 archivos,
20.416 líneas, 39 rutas de API) · **Cambios al código:** ninguno.

**Reglas usadas** (de [everything-claude-code](https://github.com/affaan-m/everything-claude-code)):
`common/coding-style`, `common/testing`, `common/security`, `common/patterns`,
`typescript/coding-style`, `typescript/patterns`, `react/coding-style`, `react/patterns`,
`react/hooks`, `react/security`, `web/performance`.

**Cómo se midió:** un script de solo lectura que usa el analizador de TypeScript del proyecto
(largo de funciones y anidación) y búsquedas de patrones, más `eslint` con la configuración del
proyecto. Las cifras son de hoy y cambian con el código.

---

## Avance de la fase 2 (2026-09-26)

| Paso | Puntos | Estado |
|---|---|---|
| 1 | 1 — HTML de la factura | ✅ La factura abre su PDF (como la cotización); se retiró `generarHTML` (~410 líneas). El servidor solo descarga el logo desde el Storage de Supabase del proyecto. |
| 2 | 2, 3 — errores y validación | ✅ Ninguna ruta devuelve `error.message` (29 respuestas). Zod en facturas, abonos, cotizaciones y liquidaciones (`lib/esquemas.ts`). De paso: la auditoría de facturas y abonos tomaba el autor del cuerpo y no guardaba la tienda. |
| 3 | 5, 6 — proxy y cabeceras | ✅ `middleware.ts` → `proxy.ts`. Cabeceras en `next.config.ts` (anti-iframe, nosniff, referrer, permisos, HSTS, CSP corta). La CSP de scripts con nonce queda pendiente, aparte. |
| 4 | 9 — ESLint | ✅ 0 errores (eran 210) y `npm run lint` en la CI. El paso a "pagado" pasó al servidor: lo hacía un efecto de la pantalla al abrir la factura. No se admiten abonos en facturas anuladas. `set-state-in-effect` y `no-explicit-any` quedan como aviso documentado. |
| 5 | 8, 12 — duplicados y claves | ✅ `lib/formato.ts` (`pesos`, `esUuid`) reemplaza 13 definiciones y 11 `toFixed(2)`: todo el dinero sale sin decimales, igual que el PDF. `<VerMas>` en 7 pantallas. Claves estables en lugar del índice. |
| 6 | 4 — listas completas | ✅ `/api/productos/buscar` y `/api/clientes/buscar` (10 resultados, palabra por palabra, sin tildes). Factura, cotización, inventario y "nuevo producto" ya no bajan el catálogo ni los clientes. El costo visible a quien factura **se deja así por decisión del dueño**. |
| 7 | 7 — archivos grandes | ✅ En parte. `InvoiceForm` 1.045 → 293 líneas: `components/factura/` (SeccionCliente, SeccionProductos, SeccionResumen, DialogoBodega, tipos) y `lib/totales-factura.ts` con pruebas. Detalle de factura 939 → 408: `PanelPagos` (abonos y su confirmación), `Common/DialogoEnvioWhatsApp` y `lib/pdf-navegador.ts`, compartidos con el detalle de cotización (436 → 262). `generarHTML` ya se había eliminado. Catálogo (`app/page.tsx`) 909 → 279: `components/catalogo/` (useCatalogo, FiltrosCatalogo, TarjetaProducto, FichaProducto, DialogoCantidad, DialogoOtraTienda, useTeclasDialogo); `useEffectEvent` reemplaza los dos `eslint-disable` de `exhaustive-deps`. Usuarios 757 → 368: `components/usuarios/` (TablaUsuarios, SelectorPermisos, Confirmaciones con un marco común) y las tres acciones que guardan comparten un solo `enviar`; de 9 avisos de lint queda 1. Usuarios no tenía e2e: se agregaron 3 de solo lectura (abren y cancelan confirmaciones), en verde antes y después del cambio. |
| 8 | 13, 15–18 — limpieza | ✅ Completo: ✅ `?email=` retirado; ✅ `react-hook-form` y `@hookform/resolvers` desinstalados; ✅ aviso de variables faltantes al arrancar (`instrumentation.ts`); ✅ borrados `init-supabase.js`, `migrate-to-public.js`, `seed-data.js` y `setup-db.js` (confirmado por el dueño); ✅ cobertura medible con `npm run test:coverage`; ✅ `import 'server-only'` en `lib/prisma.ts` y `lib/permisos.ts` (Vitest lo resuelve a la versión vacía del paquete). De paso, `test-results/` salió de git y quedó en `.gitignore`. |

### Cobertura (2026-09-26, `npm run test:coverage`)

Solo se mide lo que corre dentro de Vitest. Las pruebas de integración llaman al servidor por HTTP
y las de navegador corren en Playwright: el código de `app/api` y de las pantallas se ejecuta fuera
y sale con 0%, aunque tenga 163 y 41 pruebas respectivamente.

| Grupo | Líneas | Nota |
|---|---|---|
| `lib/` | 793 / 1.326 (60%) | La lógica pura está al 100%: liquidación, fechas, montos en palabras, paginación, precios, WhatsApp, entorno. Lo bajo es lo que depende de red o navegador: `permisos` (33%), los hooks de listados y búsqueda, `imagen`, `storage`. |
| `components/`, `hooks/` | Carrito 100%, `useCart` 97%, el resto 0% | Solo el carrito tiene pruebas de componente. |
| `app/api`, `app/` | 0% medido | Cubiertos por integración y navegador, que no entran en la medición. |

**Sobre el 80% de ECC:** como umbral global no tiene sentido aquí, porque mezclaría código que se
prueba por HTTP y en el navegador. Si se quiere un umbral, conviene ponerlo solo sobre la lógica
pura de `lib/`, que hoy está al 100%, para que no baje.

---

## Resumen

| Prioridad | # | Hallazgo | Regla de ECC | Esfuerzo |
|---|---|---|---|---|
| 🔴 Crítico | 1 | HTML de impresión de facturas sin escapar: inyección de código | react/security (XSS) | S |
| 🟠 Alto | 2 | 22 rutas devuelven al cliente el mensaje interno del error | common/security | S |
| 🟠 Alto | 3 | 10 de 16 rutas que reciben datos no los validan con esquema | common/coding-style, typescript (Zod) | M |
| 🟠 Alto | 4 | Listas completas que aún se descargan; costo expuesto a quien solo factura | common/security, web/performance | M |
| 🟠 Alto | 5 | `middleware.ts` está obsoleto en Next.js 16 (ahora `proxy.ts`) | — (docs de Next 16) | S |
| 🟠 Alto | 6 | Sin cabeceras de seguridad (CSP, anti-iframe…) | react/security | S |
| 🟡 Medio | 7 | 3 archivos > 800 líneas y 14 > 400; 88 funciones > 50 líneas | common/coding-style | L |
| 🟡 Medio | 8 | Código repetido: formato de pesos (14), UUID (4), botón "Ver más" (7) | common/coding-style (DRY) | S |
| 🟡 Medio | 9 | ESLint: 210 errores y 36 advertencias; la CI no lo corre | react/hooks, typescript | M |
| 🟡 Medio | 10 | 172 usos de `any` | typescript/coding-style | M |
| 🟡 Medio | 11 | Dos generadores de factura (HTML para imprimir y PDF) | common/coding-style (DRY) | M |
| 🟡 Medio | 12 | `key={idx}` en listas de 4 pantallas | react/patterns | S |
| 🟢 Bajo | 13 | `?email=` que ya no se usa en 3 pantallas | — | S |
| 🟢 Bajo | 14 | Estilos: 1.169 en línea frente a 323 con Tailwind | web/coding-style | L |
| 🟢 Bajo | 15 | Dependencias y scripts sin uso | common/coding-style (YAGNI) | S |
| 🟢 Bajo | 16 | Sin `server-only` ni validación de variables de entorno al arrancar | react/patterns, common/security | S |
| 🟢 Bajo | 17 | La cobertura de pruebas no se mide | common/testing (80%) | S |
| 🟢 Bajo | 18 | 65 `console.*` en 42 archivos | typescript/coding-style | S |

Esfuerzo: **S** = menos de una hora · **M** = unas horas · **L** = uno o varios días.

---

## 🔴 1. HTML de impresión de facturas sin escapar

**Dónde:** `app/api/facturas/[id]/pdf/route.ts` (`generarHTML`) y `app/admin/facturas/[id]/page.tsx`
(`document.write`).

**Qué pasa:** "Descargar PDF" de una factura pide ese HTML al servidor y lo escribe con
`document.write` en una pestaña nueva. La pestaña se abre en blanco desde la aplicación, así que
tiene **el mismo origen** que el panel. El HTML se arma pegando datos tal cual, sin escapar:

- nombre, cédula, correo, teléfono y dirección del cliente (líneas 381–385);
- nombre de cada producto (146);
- observaciones de la factura (484);
- datos de la empresa: nombre, eslogan, dirección y el `src` del logo (360–366).

**Qué se puede hacer con eso:** cualquiera que pueda crear un cliente o una factura (un vendedor)
puede poner código en el nombre del cliente o en las observaciones, por ejemplo
`<img src=x onerror="…">`. Ese código se ejecuta cuando **otra persona**, por ejemplo el dueño, abre
el PDF de esa factura. Desde ahí puede leer la sesión guardada en el navegador y actuar con los
permisos del dueño.

**Arreglo:** escapar `& < > " '` en todo valor que se inserte en el HTML (una función
`escaparHtml`), y validar que `logo_url` empiece por `https://`. El PDF generado con pdf-lib no está
afectado, porque dibuja texto y no interpreta HTML. La cotización tampoco: su `document.write` solo
escribe un aviso fijo.

**Prueba que conviene agregar:** crear un cliente llamado `<script>x</script>` y comprobar que el HTML
de la factura lo trae escapado.

## 🟠 2. Mensajes internos del error al cliente

**Dónde:** 22 rutas de API responden `{ error: error.message || '…' }` en el `catch`. Por ejemplo:
`abonos`, `clientes`, `facturas`, `productos`, `cotizaciones`, `reportes/*`, `tiendas/*`,
`solicitudes-acceso/*`, `usuarios`.

**Qué pasa:** si falla la base, el mensaje de Prisma llega a la pantalla con nombres de tablas y
columnas, o con detalles de la conexión. ECC pide: *"Error messages don't leak sensitive data"*.

**Arreglo:** una función común que registre el error completo en el servidor y responda un texto
genérico. Los errores esperados (404, 409, validaciones) conservan su mensaje propio.

## 🟠 3. Datos de entrada sin esquema

**Dónde:** reciben un cuerpo y lo usan sin validarlo:
`abonos`, `auditoria`, `auth/register`, `clientes`, `cotizaciones`, `facturas`, `liquidaciones`,
`productos`, `solicitudes-acceso`, `solicitudes-acceso/[id]`. Las otras 6 ya usan Zod, por ejemplo
`inventario/movimientos`.

**Qué pasa:** hoy se hace `parseFloat(data.total || 0)` y similares. Un texto donde va un número
termina en `NaN` en la base o en un error 500. Además, la factura **confía en el total, el subtotal y
los precios que manda la pantalla**: el servidor no los recalcula a partir de los productos.

**Arreglo:** esquemas Zod por ruta (`z.infer` para los tipos), empezando por `facturas`, `abonos`,
`cotizaciones` y `liquidaciones`, que son las que mueven dinero. Por separado, decidir si el servidor
recalcula el total de la factura. Eso cambia el comportamiento, así que se decide aparte.

## 🟠 4. Listas completas que siguen descargándose

Detalle en `C:\Users\Jair\Documents\Data\pruebas\contexto_request.md` (puntos 15, 17, 23 y 24):

- el formulario de factura y de cotización nueva baja **todos** los productos y clientes;
- "Nuevo producto" y el selector de inventario bajan todos los productos;
- `/api/productos` sin página entrega `costo` y `proveedor` a quien solo tiene `facturas.crear`.

**Arreglo:** buscadores de productos y clientes contra el servidor (como ya se hizo en los listados).
Luego, limitar las columnas de la lista completa o retirarla.

## 🟠 5. `middleware.ts` obsoleto

La documentación de Next.js 16 que trae el proyecto
(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`) dice:
*"The `middleware.js` file convention has been **deprecated** in Next.js 16 and renamed to
`proxy.js`"*. Funciona igual, pero avisa en cada arranque y en algún momento dejará de funcionar.

**Arreglo:** `npx @next/codemod@canary middleware-to-proxy .` renombra el archivo y la función. El
límite de peticiones y la comprobación de sesión siguen igual.

## 🟠 6. Sin cabeceras de seguridad

`next.config.ts` no define cabeceras. Faltan, como mínimo:
- `X-Frame-Options: DENY` o `frame-ancestors`, para que el panel no se pueda meter en un iframe ajeno;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy`;
- una `Content-Security-Policy` básica.

La CSP ayudaría también contra el punto 1, pero no lo reemplaza.

## 🟡 7. Archivos y funciones demasiado grandes

ECC: archivos de 200–400 líneas con 800 como techo, y funciones de menos de 50 líneas.

| Archivo | Líneas | Función principal |
|---|---|---|
| `components/InvoiceForm.tsx` | 1.045 | `InvoiceForm`: 998 líneas |
| `app/admin/facturas/[id]/page.tsx` | 939 | `FacturaPage`: 889 |
| `app/page.tsx` | 909 | `Catalogo`: 842 |
| `app/admin/usuarios/page.tsx` | 757 | `UsuariosPage`: 712 |
| `app/api/facturas/[id]/pdf/route.ts` | 530 | `generarHTML`: 413 |
| `lib/factura-pdf.ts` | 445 | `generarPdfFactura`: 277 |

En total, 14 archivos pasan de 400 líneas y 88 funciones pasan de 50, de las cuales 39 son pantallas
completas. Solo una función pasa de 4 niveles de anidación (`SelectorCategoria.alTeclear`).

**Arreglo, empezando por lo que más se toca:**
- `InvoiceForm` → buscador de cliente, tabla de productos, totales y pago, y la lógica en un hook
  `useFactura`.
- Detalle de factura → abonos, acciones de estado, envío por WhatsApp.
- Catálogo → filtros, cuadrícula, ficha y carrito.

## 🟡 8. Código repetido

- **Formato de pesos** (`Intl.NumberFormat('es-CO', { currency: 'COP' … })`) definido en **14
  archivos**, con variantes de 0 y 2 decimales. Además, varias pantallas usan
  `$${Number(x).toFixed(2)}`, así que el mismo monto se ve distinto según la pantalla.
- **Expresión UUID** copiada en 4 rutas.
- **Botón "Ver más"** con los mismos estilos en 7 pantallas.
- **Buscar texto sin tildes:** la búsqueda de clientes y facturas no ignora tildes y la de productos
  sí.

**Arreglo:** `lib/formato.ts` (`pesos`, `pesosConDecimales`), `lib/validacion.ts` (`esUuid`) y un
componente `<VerMas>`.

## 🟡 9. ESLint con 210 errores, fuera de la CI

`npx eslint .`: 210 errores y 36 advertencias en 73 archivos. Los que pueden ser **fallos reales**:

- `react-hooks/set-state-in-effect` (9), `react-hooks/exhaustive-deps` (7) y
  `react-hooks/immutability` (7), en el tablero de reportes, auditoría, detalle de factura, catálogo,
  usuarios, configuración y otros. Pueden causar datos viejos en pantalla o renders de más.
- `@typescript-eslint/no-unused-vars` (19): código muerto.

El resto es de forma: `no-explicit-any` (172) y `no-require-imports` (17, en `scripts/`).

**Arreglo:** corregir los `react-hooks` uno por uno, porque cada uno se revisa. Luego agregar
`npm run lint` a la CI, primero como aviso y después como bloqueo.

## 🟡 10. `any`

172 usos según ESLint. Los más concentrados están en `facturas/[id]/page.tsx`, `usuarios/page.tsx`,
`api/facturas/route.ts` y `api/facturas/[id]/pdf/route.ts`. En las rutas desaparecen solos al hacer
el punto 3 (tipos inferidos de Zod). En las pantallas hacen falta interfaces de las respuestas.

## 🟡 11. Dos generadores de factura

La factura se dibuja dos veces: en HTML para imprimir (`generarHTML`, 413 líneas) y en PDF para
compartir (`lib/factura-pdf.ts`). Cualquier cambio de formato se hace dos veces, y ya difieren en
detalles. **Opción:** que "Descargar PDF" abra el mismo PDF que se comparte, como se hizo con la
cotización (TASK-68), y retirar el HTML. Eso además elimina el punto 1 de raíz.

## 🟡 12. `key={idx}` en listas

En `facturas/[id]` (abonos), `reportes/inventario` (rotación), `reportes` e `InvoiceForm` (líneas
de la factura). Donde se pueden quitar filas, como en `InvoiceForm`, el índice como clave puede
mezclar los valores de una fila con los de otra.

## 🟢 13–18. Menores

- **13.** `?email=` todavía se manda en `clientes/[id]`, `facturas/[id]` y `productos/[id]`. El
  servidor lo ignora.
- **14.** Estilos: 1.169 bloques `style={{…}}` frente a 323 `className`, con Tailwind instalado. No
  hay archivos que mezclen los dos a la vez, pero el panel es casi todo estilos en línea y la portada
  es Tailwind. Unificarlo es grande y de poco beneficio inmediato; mejor hacerlo al tocar cada
  pantalla.
- **15.** Sin uso: `react-hook-form` y `@hookform/resolvers` (dependencias), y los scripts
  `init-supabase.js`, `migrate-to-public.js` y `seed-data.js`, que no se referencian en ningún lado.
  `setup-db.js` solo aparece en documentación. Confirmar antes de borrarlos.
- **16.** `lib/prisma.ts` y `lib/permisos.ts` no llevan `import 'server-only'`. Si alguien los
  importara en una pantalla, el error saldría tarde y confuso. Tampoco se comprueba al arrancar que
  existan `DATABASE_URL` y las demás variables.
- **17.** Hay 412 pruebas (246 unitarias, 153 de integración y 41 de navegador) y cubren los tres
  tipos que pide ECC, pero la cobertura no se mide. Falta `@vitest/coverage-v8`.
- **18.** 65 `console.*` en 42 archivos, casi todos `console.error` en rutas del servidor. En Vercel
  llegan a los logs, así que funcionan. Un logger propio es opcional.

---

## Reglas de ECC que no recomiendo aplicar (o no ahora)

| Regla | Por qué no |
|---|---|
| Respuesta con sobre común (`{ success, data, error, meta }`) en toda la API | Cambia el formato de casi todas las rutas y obliga a tocar todas las pantallas a la vez. Estandarizar solo los errores (punto 2) da casi todo el beneficio. |
| Todo en Server Components o TanStack Query en vez de `useEffect` | Hay 43 pantallas de cliente, 23 de ellas cargan datos en `useEffect`. Es una reescritura. Tiene sentido pantalla por pantalla, al rehacer una. |
| Patrón Repository sobre Prisma | Prisma ya es esa capa. Agregar otra va contra el YAGNI que el mismo ECC pide. |
| TDD obligatorio y 80% de cobertura como bloqueo | Primero medir (punto 17). Con la cifra real se decide un umbral. |
| Inmutabilidad estricta | Los `where.campo = …` son objetos locales de una función, sin efectos fuera de ella. Cambiarlos no mejora nada. |
| Logger de producción | Ver punto 18: hoy los logs de Vercel alcanzan. |

---

## Plan propuesto para la fase 2

Cada paso termina con sus pruebas puntuales en verde y lo validas antes del siguiente.

1. **Punto 1:** escapar el HTML de la factura, o reemplazarlo por el PDF (punto 11). *Hoy.*
2. **Puntos 2 y 3:** errores genéricos al cliente y Zod en las rutas de dinero.
3. **Puntos 5 y 6:** `proxy.ts` y cabeceras de seguridad.
4. **Punto 9:** corregir los `react-hooks` y sumar `lint` a la CI.
5. **Puntos 8 y 12:** `lib/formato.ts`, `esUuid`, `<VerMas>` y claves estables.
6. **Punto 4:** buscadores contra el servidor en factura, cotización e inventario.
7. **Punto 7:** partir `InvoiceForm` y el detalle de factura.
8. **Puntos 13 y 15–17:** limpieza (`?email=`, dependencias, scripts, `server-only`) y medir cobertura.

Antes de empezar: **commit o rama del estado actual**, para poder deshacer cualquier paso.
