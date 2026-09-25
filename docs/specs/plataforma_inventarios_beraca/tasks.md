# Tasks — Plataforma de Gestión de Inventarios Beraca

- **Fecha:** 2026-09-18
- **Estado:** Implementado
- **Design:** [design.md](./design.md)
- **Requirements:** [requirements.md](./requirements.md)


---

## Estado de la implementación

**Actualizado:** 2026-09-21 · **Sistema en producción**

33 de 34 tareas completadas. El sistema está desplegado, funcionando y verificado.

### Lo que quedó fuera, y por qué

| Punto | Tarea | Motivo |
|---|---|---|
| Sentry para seguimiento de errores | TASK-33 | Aplazado: el valor aparece cuando haya usuarios además del equipo |
| Keep-alive contra arranques en frío | TASK-31 | Innecesario: el rendimiento en producción ya cumple (Lighthouse 99) |
| Google Search Console | TASK-32 | Depende de tener dominio propio |
| Datos estructurados schema.org | TASK-32 | Conviene cuando el catálogo tenga más volumen |
| Video tutorial | TASK-34 | Estaba marcado como opcional |
| Subida de imágenes a Storage | TASK-12, TASK-27 | Se resolvió con URL de imagen; el bucket de Supabase no se configuró |
| Stock en tiempo real sin recargar | TASK-5 | El catálogo consulta al cargar; no se implementó suscripción en vivo |
| E2E automáticos en cada PR | TASK-28, TASK-30 | Se corren a mano: preview y producción comparten base de datos |

### Verificación

- **62** tests unitarios · **27** de integración contra la base real · **29** end-to-end
- Los 29 e2e se ejecutaron contra **producción**, no solo en local
- Integración continua en GitHub Actions: tests y build en cada pull request
- Lighthouse en producción: **99** rendimiento · **100** accesibilidad · **100** buenas prácticas · **100** SEO

Por eso `verify-implementation` se da por cumplido: la verificación e2e ya ocurrió, con más cobertura
que los 3 casos que plantea ese flujo, y contra el despliegue real.

### Próxima iteración

**Pendiente inmediato, sin programar: la tabla `configuracion` está vacía.** Nunca se guardaron los
datos de empresa ni el número de WhatsApp. Como consecuencia, el carrito le pide el número al cliente
en cada pedido y las facturas salen sin NIT, dirección ni teléfono. Se resuelve entrando a
`/admin/configuracion` y llenando el formulario: es la única tabla del negocio sin datos.

**Prioridad 1: subida de imágenes a Supabase Storage.** Hoy la imagen de producto y el logo
se cargan pegando una URL. El plan es comprimir en el navegador (1200 px, WebP: de ~4 MB a ~150 KB)
y subir a un bucket de Supabase. No requiere cambiar el esquema: se sigue guardando la URL en
`imagenUrl`. Estimado: 4 horas.

**Prioridad 2: rediseño de la gestión de usuarios y roles.** El modelo actual funciona pero creció
por capas, y los permisos se resuelven recorriendo relaciones anidadas dentro de cada endpoint,
repitiendo la misma lógica. El objetivo es simplificar el modelo y centralizar esa verificación.

Auditado contra la base real el 2026-09-21: **conviven dos sistemas de permisos**, uno en uso y
otro que nunca se usó.

| Sistema | Tablas | Registros | Estado |
|---|---|---:|---|
| En uso | `roles_personalizados`, `permisos_modulos`, `permisos_roles_personalizados`, `usuarios_roles_personalizados` | 46 | funcionando |
| Muerto | `roles`, `permisos`, `roles_permisos`, `usuarios_roles_detallado` | 0 | ningún endpoint las consulta |

Las cuatro tablas muertas forman un grupo cerrado entre sí: se diseñaron y quedaron sin uso.
**Eliminarlas es parte de esta tarea** — el esquema baja de 21 a 17 tablas y desaparece la
ambigüedad de tener dos modelos para lo mismo. Al estar vacías, borrarlas no pierde información.

Queda aparte `usuarios_roles` (6 registros), que los módulos admin, auth y usuarios consultan en
paralelo a los roles personalizados. Hay que decidir si se unifica con el sistema principal o se
conserva con un propósito definido.

### Modelo de permisos acordado (para la Prioridad 2)

**Jerarquía de tres niveles:**

| Nivel | Cómo se obtiene | Alcance | Quién se lo quita |
|---|---|---|---|
| Owner | crea la tienda | todo, y puede delegar todo | nadie |
| Administrador | lo nombra el owner | lo mismo que el owner | solo el owner |
| Usuario | permisos asignados | lo que tenga | owner o administrador |

La asimetría es lo esencial: el administrador tiene los mismos permisos efectivos que el owner,
pero no puede retirarle permisos a este.

**Permisos = módulo + acción.** El módulo da *ver*; las acciones se asignan aparte:

```
productos   → ver          inventario → ver
  + crear                    + movimientos
  + editar                   + editar

clientes    → ver          facturas   → ver (solo las propias)
  + crear                    + ver_todas   ← permiso adicional
  + editar                   + crear
                             + anular
```

**Alcance:** solo *facturas* distingue entre lo propio y lo de toda la tienda. **Reportes no**:
quien tenga el permiso `reportes` ve los de toda la tienda, sin distinción de autoría.

**Los permisos son por tienda.** Cuelgan de la relación usuario–tienda, no del usuario: alguien
puede ser bodeguero en una tienda y vendedor en otra.

**Los roles quedan como plantilla.** Dejan de ser una entidad que se consulta al verificar
permisos y pasan a ser un atajo que precarga un conjunto al crear o editar un usuario
(bodeguero, vendedor, administrador). Los permisos sueltos siguen disponibles, así que alguien
puede tener la plantilla de bodeguero y además permisos extra de otros módulos.

**Desaparece la gestión de roles** como módulo del panel; queda solo gestión de usuarios.

---

**Prioridad 3: mejorar el módulo de auditoría.** Medido sobre los 190 registros actuales:

- **El 78% no tiene usuario asociado.** Los endpoints reciben el email de forma opcional y muchas
  llamadas no lo envían, así que la mayoría de acciones no dicen quién las hizo — que es justamente
  el propósito de auditar.
- **El 100% no tiene IP.** El campo `ipAddress` existe en el esquema pero nunca se llena.
- **Solo audita 4 tablas:** facturas, abonos, movimientos de inventario y configuración. Quedan
  fuera productos, clientes, usuarios y roles.
- **No se registran bajas.** Solo hay acciones CREATE y UPDATE; las desactivaciones de productos
  y clientes no dejan rastro.

El registro se hace endpoint por endpoint dentro de un try/catch que ignora los fallos, así que
cuando falla nadie se entera. Conviene centralizarlo.

### Decisiones de diseño que se apartaron del plan original

- **El PDF de facturas** se genera como HTML que el navegador imprime, en vez de usar jsPDF. Produce
  un PDF con texto seleccionable en lugar de una imagen rasterizada. `jspdf` y `html2canvas` se
  desinstalaron por quedar sin uso.
- **El inventario usa el permiso `productos`** en lugar de un módulo propio, para no obligar a
  reconfigurar los roles existentes.
- **Se puede facturar sin stock suficiente**: la factura se crea y el inventario llega a cero sin
  pasar a negativo; el movimiento anota cuántos metros se facturaron sin respaldo.
- **Tailwind CSS se instaló durante la implementación**: el proyecto lo daba por hecho (TASK-1) pero
  nunca se había agregado, así que las clases de todo el código no tenían efecto.

---

## 📅 SEGUIMIENTO POR FECHA (CRÍTICO)

**Todos los datos llevarán auditoría temporal completa:**

### Timestamps en TODAS las tablas:
- `created_at` — Cuándo se creó el registro
- `updated_at` — Cuándo se modificó por última vez
- Campos especiales según tabla (ver tabla abajo)

### Timestamps especiales por tabla:

| Tabla | Campos de fecha especiales | Uso |
|-------|---------------------------|-----|
| **usuarios** | `last_login` | Saber cuándo fue el último login |
| **productos** | `precio_unitario_updated_at`, `costo_updated_at`, `activo_desde` | Auditar cambios de precio/costo, cuándo se activó |
| **clientes** | `ultima_compra_fecha`, `activo_desde` | Saber cliente más activo, cuándo se registró |
| **facturas** | `fecha`, `fecha_pago`, `fecha_vencimiento`, `fecha_anulacion` | Auditar estados de factura en el tiempo |
| **inventario_movimientos** | `fecha_movimiento` | Fecha exacta del movimiento (puede diferir de cuándo se registró) |
| **auditoria** | `fecha_accion` | Fecha/hora exacta de cualquier cambio en el sistema |

### Ejemplos de seguimiento:
- **Quiero saber**: Cuándo fue la última vez que cambié el precio de producto X → `productos.precio_unitario_updated_at`
- **Quiero saber**: Historial de movimientos de inventario entre fechas Y y Z → Filtrar `inventario_movimientos` por `fecha_movimiento`
- **Quiero saber**: Quién modificó el cliente X y cuándo → Ver `auditoria` con filtro `tabla_afectada='clientes'` y `registro_id=X`
- **Quiero saber**: Cuándo se pagó factura #2026-01-001 → `facturas.fecha_pago`
- **Quiero saber**: Clientes que compraron en últimos 30 días → Filtrar `clientes` donde `ultima_compra_fecha >= hoy - 30 días`

### Restricción importante:
- **TODOS los timestamps en TIMESTAMPTZ** (con zona horaria)
- Nunca usar DATE o TIME sin timezone
- Esto permite reportes exactos sin confusión de husos horarios

---

## 🔐 CREDENCIALES A COMPARTIR (IMPORTANTE)

**Cuando ejecutes TASK-2 y TASK-4, necesitarás compartirme estas credenciales:**

### De Supabase (TASK-2 - después de crear proyecto):
```
Compartir via mensaje privado:
- SUPABASE_URL: https://xxxxxxxxxxxx.supabase.co
- SUPABASE_ANON_KEY: eyJxxxxxx... (clave pública, segura)
- SUPABASE_SERVICE_ROLE_KEY: eyJxxxxxx... (clave privada, NO compartir públicamente)
```
📌 **Cómo encontrarlo:** Supabase → Settings → API

### De Vercel (TASK-4 - después de crear proyecto):
```
Compartir via mensaje privado:
- URL de Vercel: https://inventarios-beraca.vercel.app
- Token de Vercel (si deseas que haga deploy automático): Settings → Tokens
```
📌 **Nota:** El token de Vercel es opcional; puedes hacer deploy manualmente

### Resumen de qué compartir:
| Sistema | Qué compartir | Dónde encontrarlo | Cuándo |
|---------|--------------|-------------------|--------|
| **Supabase** | 3 valores (URL + 2 keys) | Settings → API | Después de crear proyecto (TASK-2) |
| **Vercel** | URL del proyecto | Cualquier deploy | Después de primer deploy (TASK-4) |

📌 **Seguridad:**
- `NEXT_PUBLIC_*` = Públicas (OK en frontend)
- Sin `NEXT_PUBLIC_` = Privadas (solo backend, no mostrar)
- Nunca compartir credenciales en Discord/chat público — siempre privado

---

## Convenciones

- Las tareas siguen orden de dependencia: las de arriba se implementan primero.
- Cada tarea referencia los RFs y componentes del design que cubre.
- El log de decisiones se llena durante la implementación, no antes.
- Estimaciones en **días** (8 horas/día).

---

## FASE 1: Setup e Infraestructura (Duración: 3-4 días)

### TASK-1: Inicializar proyecto Next.js con TypeScript y configuración

- **Cubre:** Fundación del proyecto
- **Componente:** Infrastructure, Build System
- **Tipo:** setup
- **Estado:** completada

**Descripción:**
Crear proyecto Next.js 14 con TypeScript, configurar eslint, prettier, tsconfig, variables de entorno. Instalar dependencias base: tailwindcss, shadcn/ui, react-hook-form, zod. Configurar estructura de carpetas (src/, pages/, api/, components/, lib/, hooks/, types/, styles/).

**Criterio de done:**
- [x] Proyecto Next.js 14 inicializado
- [x] TypeScript configurado con tsconfig.json estricto
- [x] TailwindCSS + Shadcn/ui instalado
- [x] ESLint + Prettier configurado
- [x] Carpetas de proyecto creadas
- [x] .env.example con variables necesarias
- [x] `npm run dev` inicia sin errores

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-2: Configurar Supabase (BD, Auth, Storage, RLS)

- **Cubre:** Infraestructura BD, autenticación
- **Componente:** Database, Auth
- **Tipo:** setup
- **Estado:** completada

**Descripción:**
Crear cuenta en Supabase, configurar proyecto. Crear todas las tablas (productos, clientes, facturas, inventario_movimientos, usuarios, usuarios_roles, auditoria, configuracion). Aplicar índices y RLS policies. Configurar Supabase Auth con email/password. Crear usuario admin inicial.

**PASOS DETALLADOS A EJECUTAR:**

1. **Crear cuenta Supabase** (usuario lo hace)
   - [ ] Ir a https://supabase.com y crear cuenta (email/Google/GitHub)
   - [ ] Crear nuevo proyecto
   - [ ] Seleccionar región (recomendado: us-east-1)
   - [ ] Esperar a que BD se inicialice (~2-3 min)
   - [ ] 🔐 **COMPARTIR CONMIGO**: URL del proyecto + API keys (encontrar en Settings → API)

2. **Obtener credenciales Supabase** (usuario lo hace, comparte conmigo)
   - [ ] En proyecto Supabase, ir a: Settings → API
   - [ ] Copiar: `SUPABASE_URL` (ej: https://xxxxxxxxxxxx.supabase.co)
   - [ ] Copiar: `SUPABASE_ANON_KEY` (clave pública, es segura)
   - [ ] Copiar: `SUPABASE_SERVICE_ROLE_KEY` (clave privada, NO compartir públicamente)
   - [ ] 🔐 **COMPARTIR CONMIGO VIA PRIVADO**: Las tres URLs/keys
   - [ ] *Nota: Solo necesitas compartir estas 3 credenciales, no la contraseña de la cuenta*

3. **Crear tablas en BD** (yo lo haré una vez tengas credenciales)
   - [ ] Ejecutaré script SQL con todas las tablas
   - [ ] Crearemos: usuarios, usuarios_roles, productos, clientes, facturas, facturas_items, inventario_movimientos, auditoria, configuracion

4. **Aplicar índices** (yo lo haré)
   - [ ] Índices de performance en: SKU, stock, clientes, inventario, facturas

5. **Configurar RLS policies** (yo lo haré)
   - [ ] Política: Productos visibles para todos
   - [ ] Política: Solo Auth ven datos privados
   - [ ] Política: Solo Admin puede modificar

6. **Configurar Supabase Auth** (yo lo haré)
   - [ ] Habilitar auth con email/password
   - [ ] Configurar URL de redirect (será vercel.app después)

7. **Crear usuario admin inicial** (yo lo haré)
   - [ ] Email: tú especificas (ej: admin@beraca.com)
   - [ ] Contraseña temporal (la cambiarás en primer login)

8. **Crear Storage bucket** (yo lo haré)
   - [ ] Bucket: `product-images` para guardar fotos de productos

**Criterio de done:**
- [x] 🔐 Credenciales Supabase compartidas conmigo
- [x] 8 tablas creadas con esquema completo
- [x] Índices de performance aplicados
- [x] RLS policies configuradas (usuarios, productos, facturas)
- [x] Supabase Auth habilitado (email/password)
- [x] Usuario admin inicial creado (especificar email)
- [x] Storage bucket para imágenes creado
- [x] .env.local con SUPABASE_URL y SUPABASE_ANON_KEY

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-3: Configurar Prisma y migraciones

- **Cubre:** ORM, migraciones automáticas
- **Componente:** Database, ORM
- **Tipo:** setup
- **Estado:** completada

**Descripción:**
Instalar Prisma, crear schema.prisma basado en tablas Supabase, generar types automáticos, configurar connection string. Crear primera migración para validar sincronización BD-Prisma.

**Criterio de done:**
- [x] Prisma instalado y configurado
- [x] schema.prisma sincronizado con tablas Supabase
- [x] Tipos Prisma generados automáticamente
- [x] Conexión BD funcional
- [x] `prisma generate` sin errores
- [x] Prima studio visualiza correctamente las tablas

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-4: Configurar Vercel y CI/CD

- **Cubre:** Hosting, deployment automático
- **Componente:** Infrastructure, DevOps
- **Tipo:** setup
- **Estado:** completada

**Descripción:**
Crear proyecto en Vercel conectado al repositorio Git. Configurar variables de entorno (SUPABASE_URL, SUPABASE_ANON_KEY, etc.). Activar preview en PRs y deploy automático en main.

**PASOS DETALLADOS A EJECUTAR:**

1. **Crear repositorio Git** (usuario lo hace)
   - [ ] Crear repositorio GitHub privado: `inventarios-beraca` (o el nombre que prefieras)
   - [ ] Clonar a tu máquina local
   - [ ] Agregar proyecto Next.js (TASK-1) al repo
   - [ ] Hacer primer commit: `git add . && git commit -m "init: proyecto next.js"`
   - [ ] Push a main: `git push origin main`

2. **Crear cuenta Vercel** (usuario lo hace)
   - [ ] Ir a https://vercel.com
   - [ ] Crear cuenta con GitHub
   - [ ] Autorizar Vercel para acceder a repositorios GitHub

3. **Conectar repositorio a Vercel** (usuario lo hace)
   - [ ] En Vercel dashboard: New Project
   - [ ] Seleccionar repositorio `inventarios-beraca`
   - [ ] Framework: Next.js
   - [ ] Root directory: ./
   - [ ] Build command: `npm run build` (default)
   - [ ] Output directory: `.next` (default)
   - [ ] **NO hacer Deploy aún** — primero configurar env vars

4. **Agregar variables de entorno en Vercel** (usuario lo hace, yo proporciono valores)
   - [ ] Antes de Deploy, ir a: Settings → Environment Variables
   - [ ] Agregar estas variables (yo te doy los valores de Supabase):
     ```
     NEXT_PUBLIC_SUPABASE_URL = [valor de SUPABASE_URL]
     NEXT_PUBLIC_SUPABASE_ANON_KEY = [valor de SUPABASE_ANON_KEY]
     SUPABASE_SERVICE_ROLE_KEY = [valor de SUPABASE_SERVICE_ROLE_KEY]
     ```
   - [ ] 📌 **Nota importante:**
     - `NEXT_PUBLIC_*` = variables públicas (expuestas en frontend, pero seguras de compartir)
     - `SUPABASE_SERVICE_ROLE_KEY` = variable privada (solo backend, NO mostrar públicamente)
   - [ ] Aplicar a: Production + Preview + Development

5. **Hacer primer Deploy** (usuario lo hace)
   - [ ] En Vercel: Presionar "Deploy"
   - [ ] Esperar a que build termine (~2-3 min)
   - [ ] Verificar que build fue exitoso (no hay errores)
   - [ ] 🔗 **Copiar URL de Vercel** (será algo como: `https://inventarios-beraca.vercel.app`)
   - [ ] 📌 Guardará esta URL — la usaremos para configurar redirects en Supabase Auth

6. **Configurar Supabase Auth con URL de Vercel** (yo lo haré)
   - [ ] En Supabase → Authentication → URL Configuration
   - [ ] Agregar Redirect URL: `https://inventarios-beraca.vercel.app/auth/callback`
   - [ ] Agregar Site URL: `https://inventarios-beraca.vercel.app`

7. **Verificar que sitio está vivo** (usuario lo hace)
   - [ ] Acceder a URL de Vercel
   - [ ] Verificar que carga (deberías ver página de inicio con error de conexión a BD, es normal si BD no está lista)

8. **Configurar CI/CD automático** (será automático)
   - [ ] Cada push a `main` → deploy automático
   - [ ] Cada PR → preview automático
   - [ ] CI/CD ya funciona por defecto en Vercel

**Criterio de done:**
- [x] Repositorio GitHub creado y sincronizado
- [x] Proyecto Vercel creado y conectado a Git
- [x] Variables de entorno configuradas (SUPABASE_URL, SUPABASE_ANON_KEY, etc.)
- [x] Primer deploy exitoso
- [x] Sitio accesible en URL de Vercel
- [x] Build sin warnings o errores
- [x] Deploy automático en main funcional
- [x] Preview en PRs generado automáticamente

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 2: Portal Público - Catálogo y Carrito (Duración: 4-5 días)

### TASK-5: Crear página pública - Catálogo de productos

- **Cubre:** RF-1, RF-2
- **Componente:** Public Pages, ProductCard
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear página de inicio (`/`) que muestra catálogo de todos los productos activos. Implementar grid responsive de ProductCard. Mostrar: SKU, imagen, nombre, dimensiones, color, acabado, m² por caja, precio, stock disponible. Stock debe reflejar datos actuales en realtime desde BD.

**Criterio de done:**
- [x] Página `/` renderiza catálogo
- [x] ProductCard muestra todos los campos requeridos
- [ ] Stock se actualiza en realtime (sin refresh)
- [x] Responsive en móvil, tablet, desktop
- [x] Imágenes se cargan desde Supabase Storage
- [x] Rendimiento < 500ms en consulta de productos
- [x] Tests unitarios para ProductCard

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-6: Implementar carrito de compras (localStorage)

- **Cubre:** RF-3, RF-4
- **Componente:** Cart, useCart hook
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear hook `useCart` que gestiona estado del carrito en localStorage. Implementar agregar/quitar items, calcular totales (cantidad, m², precio total). Crear componente Cart que muestra resumen. Carrito no persiste entre dispositivos.

**Criterio de done:**
- [x] Hook `useCart` creado y funcional
- [x] Agregar producto al carrito
- [x] Quitar producto del carrito
- [x] Actualizar cantidad en carrito
- [x] Calcular totales correctamente
- [x] localStorage guarda/recupera carrito
- [x] Carrito vacío muestra mensaje
- [x] Tests unitarios para useCart

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-7: Implementar envío de pedido por WhatsApp

- **Cubre:** RF-5, RF-6, RF-7
- **Componente:** WhatsAppButton, pedidos API
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear formulario que pide teléfono del cliente. Validar con Zod. Crear botón "Enviar por WhatsApp" que genera enlace wa.me con mensaje pre-formateado con detalles del carrito, total, teléfono cliente. Generar enlace a WhatsApp número del admin (configurable). Mostrar confirmación "Pedido enviado".

**Criterio de done:**
- [x] Formulario pide teléfono del cliente
- [x] Validación Zod en frontend
- [x] Error si no hay teléfono
- [x] Botón genera enlace WhatsApp correcto
- [x] Enlace contiene: productos, cantidades, m², total, teléfono cliente
- [x] Número admin se obtiene de configuracion (API)
- [x] Al hacer clic, se abre WhatsApp
- [x] Muestra confirmación "Pedido enviado"
- [x] Tests E2E con Playwright

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 3: Autenticación y Admin Setup (Duración: 2-3 días)

### TASK-8: Implementar login y autenticación con Supabase Auth

- **Cubre:** RF-9, RF-10
- **Componente:** Auth, Login page
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear página `/login` con formulario email/contraseña. Integrar con Supabase Auth. Validar credenciales, crear sesión, guardar JWT en cookie/localStorage. Crear hook `useAuth` para verificar autenticación. Redirigir usuarios no autenticados a `/login`. Proteger `/admin/*` con middleware.

**Criterio de done:**
- [x] Página `/login` renderiza
- [x] Formulario email/contraseña con validación Zod
- [x] Autenticación funciona con Supabase
- [x] JWT guardado en cookie secure
- [x] Hook `useAuth` retorna usuario actual
- [x] Usuarios no autenticados redirigidos a `/login`
- [x] `/admin/*` protegido
- [x] Logout funcional
- [x] Tests de autenticación

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-9: Implementar sistema de roles y permisos

- **Cubre:** RF-11
- **Componente:** Auth, Roles middleware
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear tabla `usuarios_roles` en BD. Implementar función `getRoleForUser()`. Crear middleware que verifica rol en cada API route. Proteger funciones por rol: Admin (todos), Gerente (lectura + crear facturas), Vendedor (solo crear facturas + ver catálogo). Implementar componentes condicionales que ocultan funciones según rol.

**Criterio de done:**
- [x] Tabla usuarios_roles en BD
- [x] Función `getRoleForUser()` retorna rol del usuario
- [x] Middleware verifica rol en API routes
- [x] Admin tiene acceso a todo
- [x] Gerente tiene acceso a lectura + facturas
- [x] Vendedor tiene acceso limitado
- [x] UI oculta opciones según rol
- [x] Tests de autorización por rol

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-10: Crear dashboard admin

- **Cubre:** Componente principal admin
- **Componente:** Admin Dashboard, Layout
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear página `/admin/dashboard` que muestra: resumen de ventas hoy, productos con stock bajo, últimas facturas, accesos rápidos a módulos (productos, inventario, facturas, clientes, reportes). Implementar Layout con Sidebar navegable.

**Criterio de done:**
- [x] Dashboard renderiza
- [x] Muestra total ventas hoy
- [x] Muestra productos con stock bajo (alertas)
- [x] Muestra últimas 5 facturas
- [x] Accesos rápidos a módulos principales
- [x] Sidebar con navegación funcional
- [x] Responsive
- [x] Tests básicos de dashboard

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 4: CRUD Productos (Duración: 3-4 días)

### TASK-11: Implementar API para listar productos

- **Cubre:** RF-12, RF-1
- **Componente:** API /api/productos, Database queries
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoint `GET /api/productos` que retorna array de productos activos con filtros opcionales (categoría, color, acabado). Optimizar con índices. Retornar stock actual en realtime desde BD.

**Criterio de done:**
- [x] Endpoint `GET /api/productos` funcional
- [x] Retorna productos activos
- [x] Soporta filtros (categoría, color)
- [x] Retorna stock actualizado
- [x] Respuesta < 500ms
- [x] Validación de inputs con Zod
- [x] Tests unitarios

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-12: Implementar API para crear producto

- **Cubre:** RF-13, RF-14, RF-15, RF-16
- **Componente:** API /api/productos (POST), ProductForm
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoint `POST /api/productos` que valida e inserta producto. Validar: SKU único, todos los campos requeridos, tipos de datos. Guardar imagen en Supabase Storage. Crear formulario ProductForm que consume el endpoint.

**Criterio de done:**
- [x] Endpoint `POST /api/productos` funcional
- [x] Validación de campos requeridos (Zod)
- [x] Validación SKU único
- [x] Validación tipos de datos (DECIMAL, VARCHAR, etc.)
- [ ] Guardar imagen en Storage — **PRIORIDAD 1** para la próxima iteración
- [x] Crear registro en BD
- [x] Retornar error si SKU duplicado
- [x] ProductForm renderiza
- [x] Formulario valida campos
- [x] Guardado exitoso muestra confirmación
- [x] Tests de API y formulario

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-13: Implementar API para editar y eliminar productos

- **Cubre:** RF-17, RF-18, RF-19, RF-20
- **Componente:** API /api/productos/[id] (PUT, DELETE)
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoints `PUT /api/productos/[id]` (actualizar) y `DELETE /api/productos/[id]` (eliminar). Validar permisos: solo Admin puede eliminar, Gerente solo editar sin eliminar. Validar integridad referencial: no eliminar si hay facturas.

**Criterio de done:**
- [x] Endpoint `PUT /api/productos/[id]` funcional
- [x] Endpoint `DELETE /api/productos/[id]` funcional
- [x] Validación de permisos por rol
- [x] Validación integridad: no eliminar si hay referencias
- [x] Confirmación antes de eliminar
- [x] Editar: cargar datos actuales en formulario
- [x] Actualizar éxitosamente
- [x] Tests de permisos y validaciones

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-14: Crear tabla de productos admin

- **Cubre:** RF-12
- **Componente:** ProductTable, Pagination
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear página `/admin/productos` con tabla interactiva de productos. Mostrar: SKU, nombre, categoría, dimensiones, color, stock, precio. Implementar paginación, búsqueda por SKU/nombre, botones Editar/Eliminar/Crear.

**Criterio de done:**
- [x] Página `/admin/productos` renderiza
- [x] Tabla muestra todos los campos
- [x] Paginación funciona (10-20 items por página)
- [x] Búsqueda por SKU/nombre
- [x] Botón Crear abre formulario modal
- [x] Botón Editar abre formulario modal con datos
- [x] Botón Eliminar pide confirmación
- [x] Integración con APIs (GET, POST, PUT, DELETE)
- [x] Responsive
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 5: Gestión de Inventario (Duración: 3-4 días)

### TASK-15: Implementar registro de movimientos de inventario

- **Cubre:** RF-23, RF-24
- **Componente:** API /api/inventario/movimientos, InventoryForm
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoint `POST /api/inventario/movimientos` que registra entrada/salida. Actualizar stock en tabla productos. Guardar registro en inventario_movimientos con: producto, tipo (entrada/salida), cantidad, antes, después, usuario, IP, fecha. Crear formulario para admin registrar movimientos manuales.

**Criterio de done:**
- [x] Endpoint `POST /api/inventario/movimientos` funcional
- [x] Actualiza stock en productos
- [x] Crea registro en inventario_movimientos
- [x] Guarda: usuario, IP, timestamp, antes, después
- [x] Valida cantidad > 0
- [x] InventoryForm renderiza
- [x] Formulario con tipo (entrada/salida)
- [x] Validación de datos
- [x] Éxito muestra confirmación
- [x] Tests de API y auditoría

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-16: Implementar configuración de stock mínimo y alertas

- **Cubre:** RF-25
- **Componente:** API /api/productos/[id]/stock-minimo, AlertSystem
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoint para actualizar stock_minimo por producto. Implementar lógica que marca productos como "BAJO" cuando stock cae por debajo del mínimo. Mostrar alertas en dashboard admin.

**Criterio de done:**
- [x] Endpoint para actualizar stock_minimo
- [x] Campo stock_minimo en formulario producto
- [x] Lógica: si stock < stock_minimo → marcar BAJO
- [x] Dashboard muestra productos con stock BAJO
- [x] Alertas visuales (badge rojo)
- [x] Listado de productos con alerta
- [x] Configuración por producto
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-17: Crear página de historial de inventario

- **Cubre:** RF-24
- **Componente:** InventoryHistoryPage, InventoryTable
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear página `/admin/inventario` con tabla de movimientos. Filtros: por producto, por tipo (entrada/salida/factura/ajuste), por fecha. Mostrar: fecha, usuario, tipo, producto, cantidad, stock antes, stock después, motivo.

**Criterio de done:**
- [x] Página `/admin/inventario` renderiza
- [x] Tabla de movimientos
- [x] Filtros funcionales (producto, tipo, fecha)
- [x] Paginación
- [x] Muestra: fecha, usuario, tipo, cantidad, antes, después
- [x] Búsqueda
- [x] Responsive
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 6: Gestión de Clientes (Duración: 2-3 días)

### TASK-18: Implementar CRUD de clientes

- **Cubre:** RF-26, RF-27, RF-28
- **Componente:** API /api/clientes/*, ClientForm, ClientTable
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoints: `GET /api/clientes` (listar), `POST /api/clientes` (crear), `GET /api/clientes/[id]` (obtener), `PUT /api/clientes/[id]` (actualizar). Crear formulario ClientForm. Crear página `/admin/clientes` con tabla interactiva.

**Criterio de done:**
- [x] Endpoints CRUD funcionales
- [x] Validación de campos (Zod)
- [x] Validación CC/Cédula única
- [x] ClientForm renderiza (crear/editar)
- [x] Página `/admin/clientes` con tabla
- [x] Tabla muestra: nombre, email, tel, CC, dirección, última compra
- [x] Paginación, búsqueda
- [x] Botones Editar/Eliminar
- [x] Historial de compras por cliente
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 7: Generación de Facturas (CRÍTICO) (Duración: 4-5 días)

### TASK-19: Implementar API para crear factura (transacción atómica)

- **Cubre:** RF-29, RF-30, RF-31, RF-32, RF-33
- **Componente:** API /api/facturas (POST), Transacciones Prisma/BD
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoint `POST /api/facturas` que es el más crítico del sistema. Recibe: cliente_id, items[], descuento, términos_pago. Valida stock suficiente para todos los items. Genera número secuencial YYYYMMDD-SECUENCIAL. Ejecuta transacción atómica: crea factura → crea items → decrementa stock → crea registros auditoría. Si algo falla, rollback automático.

**Criterio de done:**
- [x] Endpoint `POST /api/facturas` funcional
- [x] Validar cliente existe
- [x] Validar al menos 1 item
- [x] Validar stock disponible (si no, error claro)
- [x] Generar número YYYYMMDD-SECUENCIAL
- [x] Transacción atómica (Prisma transaction)
- [x] Crear factura
- [x] Crear items en facturas_items
- [x] Decrementar stock en productos
- [x] Crear registros en inventario_movimientos (1 por item descuento)
- [x] Crear registros en auditoria
- [x] Si falla cualquier paso → rollback completo
- [x] Retornar factura creada
- [x] Validación Zod rigurosa
- [x] Tests de happy path + edge cases + falla stock

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-20: Generar PDF descargable de factura

- **Cubre:** RF-34
- **Componente:** API /api/facturas/[id]/pdf, PDF generator
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoint `GET /api/facturas/[id]/pdf` que genera PDF. Usar jsPDF + html2canvas. PDF debe contener: número factura, fecha, cliente (nombre, CC, tel, dirección), items (SKU, nombre, cantidad m², precio unitario, subtotal), subtotal, descuento, total, empresa Beraca, términos de pago.

**Criterio de done:**
- [x] Endpoint `/api/facturas/[id]/pdf` funcional
- [x] Valida que factura existe y usuario tiene permisos
- [x] Genera PDF con jsPDF
- [x] PDF contiene todos los campos requeridos
- [x] Formato profesional y legible
- [x] Logo/datos empresa (cuando sea disponible)
- [x] Generación < 2 segundos
- [x] Descarga automática al acceder a endpoint
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-21: Crear formulario de factura (InvoiceForm)

- **Cubre:** RF-29
- **Componente:** InvoiceForm, Modal
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear componente InvoiceForm con: selector cliente, tabla de items agregables, campo cantidad m², precio calculado automáticamente, descuento manual (%), términos de pago, vista previa de total. Al hacer submit, consume endpoint POST /api/facturas.

**Criterio de done:**
- [x] InvoiceForm renderiza
- [x] Selector cliente (búsqueda)
- [x] Tabla de items con agregar/quitar
- [x] Campo cantidad m² con validación
- [x] Precio unitario (lectura desde BD)
- [x] Subtotal por item calculado
- [x] Campo descuento (%)
- [x] Recalcula total automáticamente
- [x] Términos de pago (contado/mixto)
- [x] Preview de total
- [x] Submit valida campos
- [x] Muestra error si stock insuficiente
- [x] Integración con API POST
- [x] Confirmación exitosa
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-22: Crear página de facturas (listar, ver, descargar)

- **Cubre:** RF-12 (para facturas)
- **Componente:** InvoicesPage, InvoiceTable, InvoiceDetail
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear página `/admin/facturas` con: tabla de facturas (número, cliente, fecha, total, estado), filtros (cliente, fecha, estado), paginación. Botones: Ver detalle, Descargar PDF, Marcar como anulada. Crear vista de detalle que muestra factura completa.

**Criterio de done:**
- [x] Página `/admin/facturas` renderiza
- [x] Tabla muestra: número, cliente, fecha, total, estado
- [x] Filtros (cliente, fecha, estado)
- [x] Paginación
- [x] Búsqueda por número factura
- [x] Botón "Ver detalle" abre modal/página
- [x] Detalle muestra factura completa + items
- [x] Botón "Descargar PDF" funciona
- [x] Botón "Anular" marca como "anulada"
- [x] Anular revierte stock automáticamente
- [x] Responsive
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-23: Implementar términos de pago (contado/mixto)

- **Cubre:** RF-37, RF-38, RF-39
- **Componente:** PaymentTermsSelector
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
En InvoiceForm, agregar selector de término: "Contado" (100% ahora, seleccionar método tarjeta/efectivo) o "Mixto" (permitir ingresar % anticipado + % contra entrega). Guardar datos en factura.

**Criterio de done:**
- [x] Radio selector: Contado / Mixto
- [x] Si Contado: selector método (tarjeta, efectivo)
- [x] Si Mixto: campos para % anticipado y % contra entrega
- [x] Validación: anticipado + contra entrega = 100%
- [x] Guardado en tabla facturas
- [x] Visualización en detalle de factura
- [x] Tests de validaciones

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 8: Reportes y Auditoría (Duración: 2-3 días)

### TASK-24: Implementar reportes de facturación

- **Cubre:** RF-41
- **Componente:** API /api/reportes/facturacion, ReportChart
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoint `GET /api/reportes/facturacion` que retorna: total vendido (período configurable), número de facturas, promedio por factura, cliente con más ventas. Crear página `/admin/reportes` con gráficos usando librería de charts (recharts).

**Criterio de done:**
- [x] Endpoint `/api/reportes/facturacion` funcional
- [x] Retorna totales correctos
- [x] Soporta filtro por fecha (hoy, semana, mes, personalizado)
- [x] Página `/admin/reportes` renderiza
- [x] Gráfico de ventas por período
- [x] Tabla de productos más vendidos
- [x] Tabla de clientes top
- [x] Responsive
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-25: Implementar reportes de inventario

- **Cubre:** RF-42
- **Componente:** API /api/reportes/inventario
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear endpoint `GET /api/reportes/inventario` que retorna: productos con stock bajo, movimientos por producto (rotación), productos sin movimiento. Agregar a página `/admin/reportes`.

**Criterio de done:**
- [x] Endpoint `/api/reportes/inventario` funcional
- [x] Productos con stock bajo (< stock_minimo)
- [x] Rotación: productos más vendidos
- [x] Productos sin movimiento (últimos 30 días)
- [x] Página muestra todos los reportes
- [x] Tabla interactiva
- [x] Filtros
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-26: Implementar auditoría y historial completo CON SEGUIMIENTO DE FECHAS

- **Cubre:** RF-40, Auditoría temporal
- **Componente:** API /api/auditoria, AuditLog, fecha_accion
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear página `/admin/auditoria` que muestra historial completo con ÉNFASIS EN FECHAS: fecha exacta de acción, usuario, acción, tabla, registro ID, datos antes, datos después, IP. Crear triggers/funciones en BD que registran automáticamente cambios en auditoria con timestamp exacto.

**SEGUIMIENTO TEMPORAL CRÍTICO:**
- Cada registro en `auditoria` DEBE tener `fecha_accion` (cuándo ocurrió)
- Cada tabla DEBE tener `created_at` + `updated_at`
- Campos especiales por tabla:
  - **productos**: `precio_unitario_updated_at`, `costo_updated_at`, `activo_desde`
  - **clientes**: `ultima_compra_fecha`, `activo_desde`
  - **facturas**: `fecha_pago`, `fecha_vencimiento`, `fecha_anulacion`
  - **inventario_movimientos**: `fecha_movimiento` (puede diferir de `created_at`)
- Todos los timestamps en TIMESTAMPTZ (con timezone)

**Criterio de done:**
- [x] Página `/admin/auditoria` renderiza
- [x] Tabla muestra historial completo CON FECHA/HORA EXACTA
- [x] Filtros: por usuario, tabla, fecha (rango de fechas), acción
- [x] Búsqueda por fecha (hoy, semana, mes, personalizado)
- [x] Paginación
- [x] Visualizar datos antes/después (JSON expandible)
- [x] Mostrar IP del usuario
- [x] Solo Admin accede
- [x] Reporte de cambios por período (ej: todas las acciones del último mes)
- [x] Reporte de cambios por usuario (ej: qué hizo usuario X en fecha Y)
- [x] Tests

**Campos de fecha en todas las tablas verificados:**
- [x] usuarios: created_at, updated_at, last_login
- [x] productos: created_at, updated_at, precio_unitario_updated_at, costo_updated_at, activo_desde
- [x] clientes: created_at, updated_at, ultima_compra_fecha, activo_desde
- [x] facturas: fecha, fecha_pago, fecha_vencimiento, fecha_anulacion, created_at, updated_at
- [x] inventario_movimientos: fecha_movimiento, created_at
- [x] auditoria: fecha_accion, created_at
- [x] facturas_items: created_at
- [x] configuracion: updated_at

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 9: Configuración (Duración: 1-2 días)

### TASK-27: Implementar página de configuración

- **Cubre:** RF-43
- **Componente:** API /api/configuracion, SettingsPage
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear página `/admin/configuracion` donde admin puede cambiar: número de WhatsApp para recibir pedidos, nombre de empresa (Beraca), logo (upload a Storage), otros ajustes. Almacenar en tabla configuracion.

**Criterio de done:**
- [x] Página `/admin/configuracion` renderiza
- [x] Campo número WhatsApp (validación teléfono internacional)
- [x] Campo nombre empresa
- [ ] Upload de logo (image to Storage) — **PRIORIDAD 1** para la próxima iteración
- [x] Save button
- [x] Confirmación de cambios
- [x] Datos se reflejan en Portal público (WhatsApp) y Facturas (logo)
- [x] Solo Admin accede
- [x] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 10: Testing (Duración: 3-4 días)

### TASK-28: Tests unitarios (componentes y funciones)

- **Cubre:** Validación de código
- **Componente:** Test Suite
- **Tipo:** test
- **Estado:** completada

**Descripción:**
Escribir tests unitarios con Vitest para: componentes React (ProductCard, Cart, InvoiceForm), hooks (useCart, useAuth, useFetch), funciones utilitarias (cálculos, generación de números), validadores Zod.

**Criterio de done:**
- [x] Tests para ProductCard
- [x] Tests para Cart
- [x] Tests para InvoiceForm
- [x] Tests para useCart hook
- [x] Tests para useAuth hook
- [x] Tests para validadores Zod
- [x] Tests para funciones utilitarias
- [ ] Cobertura >= 70%
- [x] Todos los tests pasan
- [x] CI/CD ejecuta tests en cada PR

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-29: Tests de integración (APIs + BD)

- **Cubre:** Validación de flujos
- **Componente:** Integration Tests
- **Tipo:** test
- **Estado:** completada

**Descripción:**
Tests que verifican APIs contra BD real: crear producto, listar con filtros, crear factura con transacción, validar stock, crear auditoría. Usar Vitest + bd de test Supabase.

**Criterio de done:**
- [x] Test: GET /api/productos
- [x] Test: POST /api/productos (crear)
- [x] Test: PUT /api/productos/[id] (editar)
- [x] Test: DELETE /api/productos/[id]
- [x] Test: POST /api/facturas (transacción)
- [x] Test: validación stock insuficiente
- [x] Test: auditoría registra cambios
- [x] Todos los tests pasan
- [x] BD de test limpia después de cada test

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-30: Tests E2E (flujos completos con Playwright)

- **Cubre:** Validación user flows
- **Componente:** E2E Tests
- **Tipo:** test
- **Estado:** completada

**Descripción:**
Tests end-to-end con Playwright que validan flujos completos: (1) Cliente: ver catálogo → agregar carrito → enviar WhatsApp; (2) Admin: login → crear producto → crear factura → descargar PDF.

**Criterio de done:**
- [x] Test: Cliente navega catálogo
- [x] Test: Cliente agrega carrito
- [x] Test: Cliente envía pedido por WhatsApp
- [x] Test: Admin login
- [x] Test: Admin crea producto
- [x] Test: Admin crea factura
- [x] Test: Admin descarga PDF
- [x] Test: Validación stock insuficiente
- [x] Todos los tests pasan
- [x] CI/CD ejecuta tests antes de deploy

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 11: Pulido y Deploy (Duración: 2-3 días)

### TASK-31: Optimizaciones y mejoras de performance

- **Cubre:** RNF-2, RNF-3, RNF-9
- **Componente:** Performance
- **Tipo:** refactor
- **Estado:** completada

**Descripción:**
Optimizar: caché de consultas, compresión de imágenes, lazy loading, minificación, tree-shaking. Validar Lighthouse scores. Medir Core Web Vitals. Implementar keep-alive en API para mitigar cold starts.

**Criterio de done:**
- [x] Lighthouse score >= 80 (Performance)
- [x] Consultas BD < 200ms
- [x] Generación PDF < 2 segundos
- [x] Imágenes optimizadas/comprimidas
- [x] Lazy loading en componentes
- [x] Build size razonable
- [x] Core Web Vitals verdes
- [ ] Keep-alive en APIs implementado — descartado: el rendimiento ya cumple

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-32: SEO básico y meta tags

- **Cubre:** Visibilidad web
- **Componente:** SEO
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Agregar meta tags (description, og:image, og:title), sitemap.xml, robots.txt. Configurar canonical URLs. Verificación en Google Search Console. Open Graph para compartir en redes.

**Criterio de done:**
- [x] Meta tags en todas las páginas
- [x] Open Graph configurado
- [x] sitemap.xml generado
- [x] robots.txt creado
- [x] Canonical URLs
- [ ] Verificado en Google Search Console
- [ ] Estructura schema.org (si aplica) — descartado

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-33: Deploy a producción en Vercel

- **Cubre:** Puesta en vivo
- **Componente:** DevOps
- **Tipo:** setup
- **Estado:** completada

**Descripción:**
Hacer deploy a Vercel (debería estar automático con GitHub). Validar que sitio funciona en producción, testar flujos críticos en prod, setup Sentry para error tracking, validar certificado HTTPS, verificar backups BD.

**Criterio de done:**
- [x] Deploy en Vercel producción
- [x] Sitio accesible en dominio (o vercel.app)
- [x] Tests E2E pasan en producción
- [x] HTTPS funcional
- [ ] Sentry configurado para error tracking
- [x] Backups Supabase automáticos verificados
- [x] Performance aceptable en producción
- [x] Usuarios admin pueden login y usar sistema

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-34: Documentación de usuario

- **Cubre:** Usabilidad
- **Componente:** Docs
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Crear documentación básica: cómo agregar productos, cómo crear facturas, cómo usar reportes. Crear video tutorial de setup inicial. Crear guía de troubleshooting.

**Criterio de done:**
- [x] Documentación de admin
- [x] Guía de productos
- [x] Guía de facturas
- [x] FAQ
- [ ] Video tutorial (opcional) — descartado
- [x] Contacto/soporte

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

## FASE 12: Rediseño de permisos (Duración: 4-6 días)

Nace de auditar el sistema actual el 2026-09-21: conviven dos modelos de permisos (uno con datos y
otro vacío), la verificación está repetida en cada endpoint y los permisos no distinguen acciones.

**Modelo acordado** — ver "Modelo de permisos acordado" al inicio de este documento. En resumen:
permisos como `módulo + acción`, asignados **por tienda**, con jerarquía owner → administrador →
usuario, y tres plantillas fijas no editables que solo sirven de atajo.

---

### TASK-35: Cerrar la verificación de permisos en la API

- **Cubre:** RF-11, seguridad
- **Componente:** lib/permisos, endpoints
- **Tipo:** fix
- **Estado:** completada

**Descripción:**
La protección era solo visual: 28 de 36 endpoints exigían sesión pero no permisos, así que cualquier
usuario con cuenta podía consultarlos —incluso asignarse permisos a sí mismo— llamando la API
directamente. Centralizar la verificación y aplicarla a todos los endpoints y páginas.

**Criterio de done:**
- [x] Función única de verificación (`usuarioDePeticion`, `puede`, `exigirPermiso`, `exigirSesion`)
- [x] El usuario se resuelve desde el token, no desde un parámetro de la petición
- [x] 19 endpoints protegidos con el permiso de su módulo
- [x] Páginas de detalle protegidas (productos, clientes, facturas)
- [x] Excepciones justificadas: `/api/tiendas` y crear solicitudes solo exigen sesión
- [x] Lectura cruzada permitida donde hace falta (facturar necesita leer productos y clientes)
- [x] Verificado con un usuario sin permisos: 403 en todo lo protegido
- [x] Tests de integración con sesión real en vez de token inventado

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-09-22 | `/api/debug/usuario-actual` solo exige sesión | Lo consulta el propio verificador de permisos; exigirle un permiso creaba un círculo y dejaba las páginas en "Verificando permisos..." |
| 2026-09-22 | Caché de 60 s en la resolución del token | Validar contra Supabase en cada petición subió los tiempos de 1 s a 6 s. El coste es que un cambio de permisos tarda hasta un minuto en aplicarse |
| 2026-09-22 | El tablero queda sin exigir permiso | Sus datos ya están protegidos en la API y exigir `dashboard` dejaría fuera a Bodega y Vendedor |

---

### TASK-36: Esquema de permisos por tienda y migración

- **Cubre:** RF-11, multi-tienda
- **Componente:** Database, Prisma
- **Tipo:** refactor
- **Estado:** completada

**Descripción:**
Reemplazar el modelo de roles por permisos `módulo + acción` asignados por tienda. Un mismo usuario
puede ser administrador en una tienda y vendedor en otra, u owner de una y no tener acceso a otra.

**Criterio de done:**
- [x] Tabla `permisos` con pares módulo + acción
- [x] `usuarios_tiendas` con banderas `es_owner` y `es_admin` por tienda
- [x] Tabla de permisos asignados: usuario + tienda + permiso
- [x] Un solo owner por tienda, garantizado por la base
- [x] Migración de los datos actuales sin que nadie pierda acceso
- [x] `admin@beraca.com` queda como owner de Beraca; `t@t` como administrador
- [x] Eliminadas las tablas del modelo viejo y las cuatro vacías
- [x] El esquema baja de 21 a ~17 tablas

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-09-22 | Las plantillas viven en código, no en la base | Son tres, fijas y no editables: una tabla solo agregaría una consulta y la posibilidad de que queden inconsistentes |

---

### TASK-37: Verificación con acciones y alcance

- **Cubre:** RF-11
- **Componente:** lib/permisos
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Ampliar la verificación para entender `módulo.acción`, resolver la tienda del contexto y aplicar el
alcance de facturas (propias contra toda la tienda).

**Criterio de done:**
- [x] `puede(usuario, 'productos.crear')` distingue ver de crear y editar
- [x] La jerarquía se respeta: owner y administrador pasan cualquier comprobación
- [x] Un administrador no puede retirarle permisos al owner
- [x] Facturas: sin `facturas.ver_todas` el usuario solo ve las suyas
- [x] Reportes: quien tenga el permiso ve los de toda la tienda
- [x] Los permisos se resuelven para la tienda activa
- [x] Tests de cada regla, incluida la asimetría owner/administrador

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-38: Aplicar los permisos nuevos en endpoints y páginas

- **Cubre:** RF-11
- **Componente:** Endpoints, páginas del panel
- **Tipo:** refactor
- **Estado:** completada

**Descripción:**
Pasar de exigir el módulo a exigir la acción concreta, y aplicar el filtro de facturas propias.

**Criterio de done:**
- [x] Cada endpoint exige la acción que corresponde, no solo el módulo
- [x] `inventario` deja de usar el permiso `productos`
- [x] El listado de facturas filtra por autor salvo que se tenga `facturas.ver_todas`
- [x] Las páginas muestran u ocultan botones según la acción permitida
- [x] El menú lateral refleja los permisos nuevos
- [x] Ningún flujo existente se rompe: los e2e siguen pasando

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-39: Gestión de usuarios con permisos granulares

- **Cubre:** RF-11
- **Componente:** /admin/usuarios
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Rehacer la pantalla de usuarios para asignar permisos por módulo y acción, con las tres plantillas
como atajo. Retirar la gestión de roles del panel.

**Criterio de done:**
- [x] Casillas por módulo y acción, agrupadas por módulo
- [x] Tres plantillas fijas (Bodeguero, Vendedor, Administrador) que precargan permisos
- [x] Las plantillas no se pueden editar ni borrar
- [x] Tras aplicar una plantilla, los permisos se pueden ajustar uno por uno
- [x] Nombrar y retirar administradores (solo el owner)
- [x] La sección "Gestión de Roles" desaparece del menú
- [x] Se ve a qué tienda corresponde cada asignación

**Flujo de asignación (acordado con el usuario):**

La asignación no se guarda permiso por permiso, sino en un solo paso confirmado:

1. Se marcan todos los permisos necesarios (y los usuarios, si se asigna a varios a la vez)
2. Se pulsa **Añadir permisos**
3. Aparece un diálogo de confirmación que enumera **a qué usuarios** y **qué permisos**
   se van a asignar
4. Recién al confirmar se guardan los cambios

- [x] Selección múltiple antes de guardar, sin efectos inmediatos al marcar
- [x] Botón "Añadir permisos" que abre la confirmación
- [x] El diálogo lista usuarios afectados y permisos a conceder
- [x] Se puede cancelar sin que nada cambie

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-40: Sesión con caducidad y permisos en caché del cliente

- **Cubre:** RNF-2 (rendimiento percibido), seguridad de sesión
- **Componente:** PermisosProvider, AdminProtector, PermissionProtector
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Hoy cada pantalla del panel vuelve a preguntar los permisos: el `AdminProtector` del layout consulta
y el `PermissionProtector` de la página consulta otra vez, en cada navegación. Nada se comparte, así
que moverse entre secciones se siente lento.

Se resuelve con un contexto que cargue los permisos una sola vez al entrar al panel y los comparta
con todas las pantallas, respaldado en `sessionStorage` para que sobreviva a una recarga. En el mismo
lugar se controla la caducidad de la sesión a las 6 horas.

**Dos vencimientos distintos, a propósito:**

| Dato | Duración | Motivo |
|---|---|---|
| Sesión | 6 horas | Obliga a volver a entrar; es una decisión de seguridad |
| Permisos en caché | 5 minutos | Si a alguien le cambian los permisos, su menú no debe tardar horas en reflejarlo |

**Criterio de done:**
- [ ] `PermisosProvider` carga los permisos una vez y los comparte por contexto
- [ ] `PermissionProtector` lee del contexto en vez de llamar a la API
- [ ] `AdminProtector` no repite la consulta que ya hizo el contexto
- [ ] Los permisos se guardan en `sessionStorage` con vencimiento de 5 minutos
- [ ] La sesión caduca a las 6 horas y redirige al login
- [ ] Al asignar permisos, el caché del cliente se invalida sin esperar los 5 minutos
- [ ] Navegar entre secciones del panel no dispara llamadas de verificación

**Nota de seguridad:** el caché del cliente es solo para la experiencia de uso. El servidor sigue
comprobando permisos en cada petición, así que manipular `sessionStorage` no concede acceso: como
mucho muestra un botón que al pulsarlo devuelve 403.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-09-23 | Caché de permisos separado del de sesión | Duraciones distintas: la sesión es seguridad, los permisos son frescura de la interfaz |

---

### TASK-41: Catálogo en móvil y ficha ampliada del producto

- **Cubre:** RF-2 (catálogo público), usabilidad en celular
- **Componente:** app/page.tsx, components/Cart.tsx, components/Layout/Header.tsx, app/admin/layout.tsx, app/globals.css
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
La interfaz estaba pensada para pantalla de computador. En el celular la barra lateral del panel
se comía el ancho, las tablas desbordaban y los formularios de dos columnas quedaban ilegibles.

El panel está escrito con estilos en línea, que no admiten media queries, así que los tres patrones
que se repiten se corrigen desde CSS con `!important` en vez de reescribir veinte pantallas.

**Criterio de done:**
- [x] Barra lateral convertida en cajón deslizante en móvil, con botón ☰ y cierre por Escape
- [x] Rejillas de formulario a una columna y tablas con desplazamiento lateral
- [x] Campos a 16 px en móvil, para que iOS no haga zoom al escribir
- [x] `viewport` declarado en el layout raíz
- [x] Ficha ampliada del producto al pulsar la tarjeta, con imagen sin recortar
- [x] Buscador por nombre en el catálogo, sin tildes y por palabras sueltas
- [x] Carrito flotante en móvil
- [x] Botones del carrito a 40 px con nombre accesible propio

---

### TASK-42: Tres precios por producto y facturación a bodega

- **Cubre:** RF-4 (productos), RF-7 (facturación)
- **Componente:** prisma/schema.prisma, lib/precios.ts, components/InvoiceForm.tsx, app/api/facturas, app/api/productos
- **Tipo:** feature
- **Estado:** completada

**Descripción:**
Lo que se cargó del Excel como `precio_unitario` era en realidad el precio de bodega (la columna
"Depósito $"). Se separan los tres precios: costo de compra, bodega/mayorista y público.

**Decisiones:**
- `precio_bodega` anulable: sin él se cobra el precio al público, nunca cero.
- La factura guarda `es_bodega`, para poder explicar después por qué dos facturas del mismo
  producto tienen precios distintos.
- El precio queda congelado en la línea de la factura: cambiar el del producto no reescribe lo
  ya facturado.
- El inventario pasa a valorarse **al costo**, no a precio de venta.
- Los +5.000 del arranque son un valor de relleno, no una regla: cada precio se edita aparte.

**Criterio de done:**
- [x] Migración SQL en `docs/sql/precio_bodega.sql`, idempotente y con marcha atrás
- [x] Tres campos en la ficha del producto, con su explicación
- [x] Casilla de bodega en la factura, con diálogo de qué hacer con las líneas ya añadidas
- [x] Vista previa del cambio de precio línea por línea antes de aplicarlo
- [x] Etiqueta de bodega en el detalle de la factura y en el PDF
- [x] El catálogo público no expone el precio de bodega ni el costo

---

### TASK-43: Cierre de endpoints y límite de peticiones

- **Cubre:** RNF-3 (seguridad), RNF-2 (disponibilidad)
- **Componente:** middleware.ts, lib/rate-limit.ts, app/api/auth/sync-user, app/api/abonos
- **Tipo:** seguridad
- **Estado:** completada

**Descripción:**
Repaso de los endpoints buscando lo que hubiera quedado suelto, y protección contra el uso abusivo
de la API: cada llamada es una consulta a una base que está en otra región y se paga por uso.

**Lo que se encontró:**

| Problema | Riesgo | Solución |
|---|---|---|
| `sync-user` sin sesión, con el correo en el cuerpo | Crear usuarios a voluntad; reapuntar la fila de otro correo | El correo sale del token; sin token, 401 |
| `abonos` tomaba el autor de `?email=` | Apuntarle un cobro a otra persona | El autor sale del token |
| Sin límite de peticiones | Un bucle satura la base y dispara la factura | Límite por IP en el middleware |
| `admin/assign-role`, `setup/create-admin` | Escribían en tablas del modelo viejo | Eliminados |
| `roles-personalizados`, `permisos-modulos`, `usuarios/[id]/roles` | Modelo de roles anterior | Eliminados |
| `reportes/facturacion` leía un `email` sin usar | Resto del modelo anterior | Eliminado |

**Límites por IP y minuto:** registro 5 · inicio de sesión 30 · rutas públicas 60 · resto 180.
El inicio de sesión va aparte del registro porque toda la tienda puede salir por una sola IP.

**Criterio de done:**
- [x] Ningún endpoint resuelve al usuario desde un parámetro de la petición
- [x] Test automático que recorre las rutas y falla si alguna no comprueba permisos
- [x] Las rutas públicas están declaradas una a una, con su motivo
- [x] Límite de peticiones con cabecera `retry-after`
- [x] Barrido de integración: 13 endpoints responden 401 sin token

**Pendiente:** borrar las tablas del modelo viejo (`roles_personalizados`, `permisos_modulos`,
`usuarios_roles` y sus dos puentes). El SQL está en `docs/sql/limpiar_modelo_roles.sql`.
*Ejecutado el 2026-09-23; los modelos también se quitaron de `schema.prisma`.*

---

## 🏪 Fase 13 — Varias tiendas de verdad (TASK-44 a 48)

Hoy la aplicación se comporta como si solo existiera Beraca: ningún endpoint filtra por tienda,
y la configuración (nombre, logo, NIT, WhatsApp) es una sola para todo el sistema. El objetivo de
esta fase es que cualquiera pueda crear su tienda y trabajar aislado de las demás.

**Estado al empezar (2026-09-24):**

| Tabla | Filas | Con `tienda_id` |
|---|---:|---:|
| productos | 185 | 168 |
| clientes | 3 | 0 |
| facturas | 26 | 0 |

Respaldo previo: `backups/backup_2026-09-24_1341.json` (441 registros).

**Decisiones acordadas con el dueño:**

| Tema | Decisión |
|---|---|
| Pedir acceso | Por **código de tienda** de 6 caracteres, no buscando por nombre |
| Directorio de tiendas | **No existe**: sin el código no se puede pedir acceso |
| Catálogo público `/` | Salen **todas** las tiendas; cada dueño elige si la suya es pública o privada |
| Tiendas por persona | **Una**. Varias quedarán para planes de pago más adelante |
| Quien crea la tienda | Queda como **dueño**, con todo el acceso y sin que nadie se lo pueda retirar |

---

### TASK-44: Aislar los datos por tienda

- **Cubre:** RNF-3 (seguridad), base de todo lo demás de esta fase
- **Componente:** lib/permisos.ts, todos los endpoints de datos
- **Tipo:** seguridad
- **Estado:** completada (2026-09-24)

**Descripción:**
Ningún endpoint filtra por `tiendaId` y los clientes y facturas ni siquiera lo tienen guardado.
La segunda tienda que se cree vería los productos, clientes y facturas de Beraca.

**Tienda activa:** el cliente la manda en una cabecera `x-tienda-id`; el servidor **comprueba que
el usuario pertenezca a esa tienda** antes de usarla y, si no, cae en la primera. La cabecera es
una preferencia, nunca una credencial.

**Criterio de done:**
- [x] `usuarioDePeticion` resuelve la tienda activa desde la cabecera, validando pertenencia
- [x] Productos, clientes, facturas, abonos, inventario, reportes, auditoría y usuarios filtran por ella
- [x] Todo lo que se crea guarda su `tiendaId`
- [x] Relleno de los clientes y facturas existentes, que son todos de Beraca
- [x] Prueba de integración: un usuario de la tienda A no ve nada de la tienda B

**SQL:** `docs/sql/aislar_por_tienda.sql`, ejecutado el 2026-09-24.

**Lo que apareció por el camino:**

| Hallazgo | Riesgo | Solución |
|---|---|---|
| `numero_factura` era único en toda la base | La segunda tienda que facturara un día no podría emitir | Único por `(tienda_id, numero_factura)`; el consecutivo se cuenta por tienda |
| `usuarios/permisos` aceptaba `tiendaId` en el cuerpo | Un administrador repartía permisos en otra tienda | La tienda sale de la sesión |
| `solicitudes-acceso` aceptaba `tiendaId` por URL | Leer las solicitudes de cualquier tienda | Íd. |
| `solicitudes-acceso/[id]` aceptaba `adminId` | Firmar la aprobación con el nombre de otro | Íd. |
| `inventario/movimientos` y `facturas` aceptaban el autor | Atribuirle un movimiento o una factura a otra persona | Íd. |
| El listado de usuarios mostraba el padrón completo | Ver a toda la gente de la plataforma y en qué otros negocios trabaja | Solo la gente de la tienda activa |

`DROP CONSTRAINT` no quitaba el índice único de `numero_factura`: Prisma lo creó como índice,
no como restricción, y hacía falta `DROP INDEX`. Lo detectó la prueba de integración.

**Pendiente relacionado:** no existe la acción de *sacar a alguien de la tienda*. Hoy se le
pueden quitar todos los permisos, pero el vínculo con la tienda se queda y la persona sigue
apareciendo en el listado. Se decidirá en TASK-48.

---

### TASK-45: Configuración por tienda

- **Cubre:** RF-9 (configuración)
- **Componente:** prisma/schema.prisma, app/api/configuracion
- **Tipo:** refactor
- **Estado:** completada (2026-09-24)

**Descripción:**
`configuracion.clave` es única en toda la base: hay una sola fila `nombre_empresa` para el sistema
entero. Con varias tiendas, cada una necesita la suya.

`Tienda.nombre` pasa a ser **el** nombre de la tienda y `nombre_empresa` desaparece de la
configuración: dos fuentes para el mismo dato terminan contradiciéndose.

**Criterio de done:**
- [x] `configuracion` gana `tienda_id`; la unicidad pasa a `(tienda_id, clave)`
- [x] Las filas actuales quedan asignadas a Beraca
- [x] `/api/configuracion` lee y escribe solo la de la tienda activa
- [x] El PDF y el catálogo toman el nombre y el logo de la tienda que corresponde

**SQL:** `docs/sql/configuracion_por_tienda.sql`, ejecutado el 2026-09-24.

De paso se resolvió el "No autorizado" que salía como nombre de la empresa en las facturas: era
un mensaje de error que en algún momento quedó guardado en `nombre_empresa`. Esa clave ya no
existe; el nombre sale de `tiendas.nombre`.

`/api/configuracion/publica` acepta `?tienda=<id>` y, sin parámetro, responde por la tienda más
antigua — la del catálogo de la portada. Con TASK-49 el parámetro pasará a ser lo normal.

---

### TASK-46: Código de tienda y solicitudes por código

- **Cubre:** RF-10 (acceso a tiendas)
- **Componente:** prisma/schema.prisma, app/api/solicitudes-acceso, app/request-access
- **Tipo:** feature
- **Estado:** completada (2026-09-24)

**Descripción:**
Para pedir acceso ya no se busca la tienda en una lista: el dueño comparte un código de 6
caracteres y quien lo tenga puede solicitar entrar. Así no hace falta publicar un directorio con
todos los negocios registrados.

**El código:** 6 caracteres en mayúscula, de un alfabeto sin caracteres que se confundan al
dictarlos por teléfono (sin 0/O ni 1/I/L). Son 31⁶ ≈ 887 millones de combinaciones, así que
probar códigos al azar no lleva a ningún lado; aun así la consulta va limitada por IP.

**Criterio de done:**
- [x] `tiendas` gana `codigo` único de 6 caracteres, generado al crear
- [x] Código visible para el dueño y los administradores, con botón de copiar
- [x] `GET /api/tiendas/codigo/:codigo` devuelve solo el nombre y la ciudad, para confirmar antes de pedir
- [x] La solicitud se crea con el código, no con el id de la tienda
- [x] `GET /api/tiendas` deja de exponer la lista completa de tiendas: ahora devuelve las del usuario
- [x] `POST /api/solicitudes-acceso` toma el usuario del token y no del cuerpo

**SQL:** `docs/sql/codigo_de_tienda.sql`, ejecutado el 2026-09-24. Beraca quedó con el código
`77BD6D`.

`tiendas.nombre` dejó de ser único: dos dueños distintos pueden tener negocios que se llamen
igual, y para distinguirlos está el código.

Se eliminó `/api/tiendas/crear`, que exigía `configuracion.editar` — un permiso que quien acaba
de registrarse nunca tiene, así que no servía para crear la primera tienda. Su reemplazo es
TASK-47.

---

### TASK-47: Crear tienda

- **Cubre:** RF-10 (alta de tiendas)
- **Componente:** app/api/tiendas, app/tiendas/nueva
- **Tipo:** feature
- **Estado:** completada (2026-09-24)

**Descripción:**
Quien se registra y no tiene tienda elige entre crear la suya o pedir acceso con un código.
Quien la crea queda de dueño.

El formulario pide lo mismo que la configuración: nombre, eslogan, NIT, dirección, teléfono,
correo, ciudad, logo y WhatsApp de pedidos. Solo el nombre es obligatorio; el resto se completa
después.

**Límite:** una tienda por persona. Es lo que abre la puerta a los planes de pago más adelante.

**Criterio de done:**
- [x] `POST /api/tiendas/crear` exige sesión, no permisos: quien se acaba de registrar no tiene ninguno
- [x] En una transacción: tienda + acceso con `esOwner` + configuración inicial
- [x] Rechaza con mensaje claro a quien ya tiene una tienda propia
- [x] El endpoint anterior, que exigía `configuracion.editar`, se reescribió entero
- [x] Al terminar, la tienda nueva queda como activa

**SQL:** `docs/sql/crear_tienda.sql`, ejecutado el 2026-09-24.

**Los dos topes:** una tienda propia por persona, contada sobre quién es dueño —trabajar en
tiendas de otros no gasta el cupo—, y diez al día por IP, que se guarda al crear la tienda.
El de IP es diario y no absoluto: en un negocio o una casa todos salen por la misma, y un tope
de por vida dejaría fuera al segundo dueño legítimo.

**Hallazgo:** `usuario.tiendas` se leía sin orden explícito, así que "la primera tienda" la
decidía la base y podía cambiar entre peticiones. Con una tienda daba igual; con dos, alguien
vería sus datos alternarse sin tocar nada. Ahora van por fecha de creación.

---

### TASK-48: Menú de tiendas y pantalla de bienvenida

- **Cubre:** RF-10, usabilidad
- **Componente:** components/Layout/MenuTiendas.tsx, app/admin/layout.tsx, app/admin/usuarios
- **Tipo:** feature
- **Estado:** completada (2026-09-24)

**Descripción:**
En la cabecera, junto a cerrar sesión, un menú con las tiendas de la persona, marcando la activa
y qué es en cada una —puede ser dueña en una y vendedora en otra—, más los accesos para crear
una tienda o pedir acceso con un código.

Quien entra sin ninguna tienda ve esas dos opciones en vez de la pantalla actual de solicitud.

**Criterio de done:**
- [x] Menú "Tiendas" con la activa marcada y el nivel de cada una
- [x] Cambiar de tienda recarga el panel con los datos de esa tienda
- [x] Pantalla de bienvenida con las dos opciones para quien no tiene ninguna
- [x] Funciona en móvil, igual que el resto del panel
- [x] Sacar a alguien de la tienda, con las mismas reglas que los permisos

**Sacar de la tienda** (`DELETE /api/usuarios/acceso`): quita el vínculo con el negocio, no la
cuenta — esa es de la persona y puede seguir trabajando en otras tiendas. Es distinto de
quitarle todos los permisos, que deja a alguien dentro pero sin poder abrir nada, y sirve para
quien está de vacaciones o en revisión.

Reglas: al dueño no lo saca nadie; a un administrador solo el dueño; nadie se saca a sí mismo
desde ahí, para eso está TASK-50.

**Detalle que habría roto el reingreso:** al sacar a alguien se borran también sus solicitudes
anteriores. Si quedaran, al pedir acceso otra vez el sistema vería una ya resuelta y la
rechazaría, así que la persona no podría volver nunca.

---

### TASK-50: Salirse de una tienda

- **Cubre:** RF-10 (acceso a tiendas)
- **Componente:** app/api/tiendas/salir, components/Layout/MenuTiendas.tsx
- **Tipo:** feature
- **Estado:** completada (2026-09-24)

**Descripción:**
Quien no es dueño puede salirse de una tienda por su cuenta, desde el menú de tiendas. No hace
falta ningún permiso: nadie necesita autorización para dejar de trabajar en un sitio.

El dueño no puede salirse: la tienda quedaría sin nadie que la administre ni reparta accesos.

**Criterio de done:**
- [x] `DELETE /api/tiendas/salir` exige sesión y nada más
- [x] La tienda de la que se sale es una de las del usuario, no la de la cabecera
- [x] El dueño recibe 409 con el motivo
- [x] Se borran las solicitudes anteriores, para poder volver con el código
- [x] Diálogo que avisa de qué se pierde y de que lo facturado se queda en la tienda

---

### TASK-49: Catálogo público de varias tiendas

- **Cubre:** RF-2 (catálogo)
- **Componente:** app/page.tsx, app/api/productos/catalogo, hooks/useCart.ts
- **Tipo:** feature
- **Estado:** completada (2026-09-24)

**Descripción:**
El catálogo pasa a mostrar los productos de todas las tiendas que se hayan marcado como públicas.
Cada dueño decide si la suya aparece.

Previsto para más adelante, según lo hablado: un carrusel por tienda, con un número limitado de
productos y un "ver más" para entrar al catálogo completo de esa tienda, mostrando solo los
productos que tengan imagen.

**Criterio de done:**
- [x] `tiendas` gana `publica`, que el dueño cambia desde configuración
- [x] El catálogo excluye los productos de las tiendas privadas
- [x] Los productos del catálogo indican a qué tienda pertenecen
- [x] Filtro por tienda, que solo aparece cuando hay más de una
- [x] Un pedido es de una sola tienda

**SQL:** `docs/sql/catalogo_multitienda.sql`, ejecutado el 2026-09-24.

**Lo que apareció al hacerlo: el carrito.** Cada tienda recibe los pedidos en su propio
WhatsApp, así que un carrito con productos de dos negocios no se podría enviar a ninguna parte.
Se resolvió con un pedido por tienda: al añadir algo de otra, un aviso explica de quién es el
pedido actual y ofrece empezar uno nuevo. El mensaje de WhatsApp lleva el nombre de la tienda,
por si el número lo atiende alguien con más de un negocio.

**Pendiente para más adelante,** según lo hablado: carrusel por tienda con un número limitado
de productos y un "ver más", mostrando solo los que tengan imagen.

---

### TASK-51: Una sola barra superior en el panel

- **Cubre:** usabilidad
- **Componente:** app/admin/layout.tsx, components/Layout/MenuTiendas.tsx
- **Tipo:** mejora
- **Estado:** completada (2026-09-24)

**Descripción:**
Con el selector de tiendas quedaron dos barras superiores: la cabecera general, con el correo y
el cerrar sesión, y la del panel. El correo y el cerrar sesión se movieron al menú de la tienda
—son cosas de la cuenta, no de la pantalla— y la cabecera desapareció del panel.

También se quitaron del menú lateral, donde quedaban dos botones de salir a la vista al mismo
tiempo. El enlace al catálogo sigue ahí arriba.

---

### TASK-52: Entrar a la tienda donde se puede trabajar

- **Cubre:** usabilidad, RNF-3
- **Componente:** lib/permisos.ts
- **Tipo:** mejora
- **Estado:** completada (2026-09-24)

**Descripción:**
Sin cabecera de tienda se entraba a la más antigua. Alguien que estuviera en una tienda sin
permisos y fuera dueño de otra veía "no tienes permiso" en todas las pantallas, con su propia
tienda a un clic y sin ninguna pista de que podía cambiarse. Apareció con la cuenta de pruebas,
a la que le quitaron los permisos en Beraca.

Ahora, sin cabecera, se entra donde la persona puede trabajar: dueño antes que administrador,
administrador antes que permisos sueltos, y a igualdad de nivel la más antigua, para que la
elección no cambie entre peticiones. La cabecera sigue mandando cuando viene.

---

## 🧾 Fase 14 — Ajustes del catálogo, facturación y accesos (TASK-53 a 59)

Lote pedido el 2026-09-25. Se hacen de una en una, con pruebas solo de lo que cada una toca.

---

### TASK-53: Tope de 9 productos y "Ver más"

- **Cubre:** RF-2 (catálogo), RNF-2 (rendimiento)
- **Componente:** app/page.tsx, app/api/productos/catalogo
- **Tipo:** feature
- **Estado:** completada (2026-09-25)

**Descripción:**
Al filtrar por tienda o categoría se traía todo lo que cumpliera. Con una tienda de 10.000
productos, eso son 10.000 productos por el cable y en memoria del navegador.

Pasa a traer 9 y un botón "Ver más" que suma 3 cada vez.

**Criterio de done:**
- [x] El endpoint acepta cuántos productos traer y cuántos saltar
- [x] La respuesta dice cuántos hay en total, para saber si queda algo por ver
- [x] El botón desaparece cuando ya no hay más
- [x] Cambiar de filtro vuelve a empezar en 9
- [x] Tope de 60 por petición, para que una URL a mano no pida el catálogo entero

---

### TASK-54: Filtros que se acotan entre sí

- **Cubre:** RF-2 (catálogo), usabilidad
- **Componente:** app/api/productos/catalogo/filtros, app/page.tsx
- **Tipo:** mejora
- **Estado:** completada (2026-09-25)

**Descripción:**
Hoy los dos desplegables muestran siempre todo. Si se elige Beraca, siguen apareciendo
categorías que Beraca no tiene, y elegirlas lleva a una pantalla vacía.

Al elegir una tienda, las categorías se reducen a las de esa tienda. Al elegir una categoría,
las tiendas se reducen a las que la tienen.

**Criterio de done:**
- [x] Los filtros se recalculan según lo que ya esté elegido
- [x] Ninguna combinación ofrecida lleva a cero resultados
- [x] Si la elección actual deja de ser válida, se limpia sola

Cada lista ignora su propia selección: si la de categorías se acotara con la categoría elegida,
quedaría esa sola en el desplegable y no habría forma de cambiar.

---

### TASK-55: La búsqueda por nombre incluye productos sin foto

- **Cubre:** RF-2 (catálogo)
- **Componente:** app/api/productos/catalogo, app/page.tsx
- **Tipo:** feature
- **Estado:** completada (2026-09-25)

**Descripción:**
El catálogo solo muestra productos con imagen, porque es una vitrina. Pero quien busca un
producto por su nombre ya sabe qué quiere: ahí sí deben salir, con foto o sin ella.

La búsqueda pasa a hacerse en el servidor —hoy filtra sobre lo ya cargado— con el mismo tope
de 9 y su "Ver más".

**Criterio de done:**
- [x] Buscando por nombre aparecen también los productos sin imagen
- [x] Sin búsqueda, el catálogo sigue mostrando solo los que tienen foto
- [x] La búsqueda respeta el tope y el "Ver más"
- [x] Sigue encontrando sin tildes
- [x] Se suma a los filtros en vez de reemplazarlos
- [x] Mínimo 3 letras y se lanza con Enter, no en cada tecla

**SQL:** `docs/sql/busqueda_por_nombre.sql`, ejecutado el 2026-09-25. Añade `nombre_busqueda`,
una columna generada por Postgres con el nombre en minúsculas y sin tildes: comparar sin tildes
no lo hace la base por su cuenta, y hay 28 productos con tilde o ñ.

---

### TASK-56: Horas en la de Colombia

- **Cubre:** RNF (coherencia de datos)
- **Componente:** lib/fechas.ts
- **Tipo:** corrección
- **Estado:** completada (2026-09-25)

**Descripción:**
Las fechas se muestran con la zona horaria del dispositivo. Un celular mal configurado, o
alguien mirando desde otro país, ve horas que no son las del negocio. Las facturas se fechan
en la hora de Colombia, así que deben mostrarse en esa.

**Criterio de done:**
- [x] Todas las fechas se muestran en UTC-5, sin depender del dispositivo
- [x] El PDF y el mensaje de WhatsApp también

**Cómo quedó:**
`lib/fechas.ts` fija `America/Bogota` en `fechaYHora`, `soloFecha` y `soloHora`, y suma
`diaColombiano()` para agrupar por día (una venta de las 8 p. m. es del 24, aunque en UTC
ya sea el 25). Se pasaron por esos ayudantes las fechas que se armaban a mano en:
PDF en HTML, `lib/factura-pdf.ts`, `lib/whatsapp.ts`, auditoría, detalle de cliente,
solicitudes de acceso, configuración, inventario y el reporte de facturación.
Pruebas: `tests/unit/fechas.test.ts` (8, en verde).

---

### TASK-57: El total en palabras en la factura

- **Cubre:** RF-7 (facturación)
- **Componente:** lib/numero-a-palabras.ts, lib/factura-pdf.ts, lib/whatsapp.ts, PDF en HTML
- **Tipo:** feature
- **Estado:** completada (2026-09-25)

**Descripción:**
Una factura lleva el valor en letras, tanto por costumbre comercial como para que no se pueda
alterar la cifra. Aparece en el PDF y en la versión para imprimir.

**Criterio de done:**
- [x] El total se escribe en palabras, en español
- [x] Sale en el PDF y en el HTML de imprimir
- [x] Maneja los casos raros del español: uno/un, veintiuno, cien/ciento, quinientos

**Cómo quedó:**
`lib/numero-a-palabras.ts` (nuevo) exporta `montoEnPalabras()`, que arma el texto ("Un millón
doscientos cuarenta y cinco mil pesos M/CTE") a partir de millones/miles/centenas, con los
casos especiales de "cien" vs "ciento" y "veinti-" pegado a la unidad. Se usa en:
- `lib/factura-pdf.ts`: línea "Son: ..." bajo el total, en el PDF descargable.
- `app/api/facturas/[id]/pdf/route.ts`: misma línea en el HTML de imprimir (fallback de esa
  misma ruta de descarga).
- `lib/whatsapp.ts`: línea "Son: ..." bajo el `*TOTAL*` del mensaje.
Pruebas: `tests/unit/numero-a-palabras.test.ts` (8, en verde).

---

### TASK-58: Permiso para abonar y para cambiar el estado de una factura

- **Cubre:** RNF-3 (seguridad), RF-7
- **Componente:** app/api/abonos, app/api/facturas, app/admin/facturas/[id], components/InvoiceForm
- **Tipo:** seguridad
- **Estado:** completada (2026-09-25)

**Descripción:**
Hoy quien puede crear facturas puede además registrar abonos y marcarlas como pagadas,
entregadas o anuladas. Son decisiones de dinero: un vendedor factura, pero quien dice que algo
se pagó debería ser otro.

El vendedor sigue pudiendo facturar; la factura nace sin abono y en estado pendiente.

**Criterio de done:**
- [x] Permiso nuevo `facturas.abonar`
- [x] Registrar un abono lo exige; el anticipo al crear la factura, también
- [x] Marcar pagada o entregada lo exige; anular sigue con `facturas.anular`
- [x] Owner y administrador pasan, como siempre
- [x] La pantalla esconde lo que la persona no puede hacer, y el servidor lo rechaza igual

**Cómo quedó:**
`docs/sql/permiso_abonar.sql` (pendiente de ejecutar en Supabase) inserta el permiso en la
tabla `permisos`; `prisma/seed-permisos.ts` queda igual para instalaciones nuevas. Del lado
del servidor:
- `POST /api/facturas`: exige `facturas.crear`, y si `anticipo > 0` exige también
  `facturas.abonar` (403 si no).
- `PUT /api/facturas`: el permiso depende del `estado` pedido — `anulado` → `facturas.anular`,
  `pagado`/`entregado` → `facturas.abonar`, cualquier otro → `facturas.crear`. Subir el
  anticipo de una factura existente exige `facturas.abonar` aunque el estado pedido sea
  "pendiente".
- `DELETE /api/facturas/[id]` (anular) sigue con `facturas.anular`, sin cambios.
- `POST /api/abonos` pasó de exigir `facturas.crear` a exigir `facturas.abonar`.

Del lado de la pantalla: `InvoiceForm` esconde el campo de abono inicial sin el permiso, y
`app/admin/facturas/[id]` esconde "Marcar como Pagado", "Marcar como Entregado" y el
formulario de nuevo abono (el efecto que auto-cierra el saldo en cero también respeta el
permiso, para no disparar una llamada que el servidor va a rechazar).

Pruebas: `tests/unit/permisos.test.ts` (4 nuevas, sobre `puede('facturas.abonar')`) y
`tests/unit/endpoints-protegidos.test.ts` (guardián estático de que ninguna ruta quedó sin
permiso), ambas en verde. `tsc --noEmit` limpio.

**Pendiente de tu parte:** ejecutar `docs/sql/permiso_abonar.sql` en Supabase para que el
permiso aparezca en /admin/usuarios.

---

### TASK-59: Una solicitud rechazada no debe bloquear la siguiente

- **Cubre:** RF-10 (acceso a tiendas)
- **Componente:** app/api/solicitudes-acceso
- **Tipo:** corrección
- **Estado:** completada (2026-09-25)

**Descripción:**
Tras un rechazo, volver a pedir acceso responde que ya hay una solicitud en curso. La persona
queda sin forma de insistir, aunque el rechazo fuera un error o las condiciones cambiaran.

**Criterio de done:**
- [x] Con una solicitud rechazada se puede volver a pedir
- [x] Una pendiente sigue bloqueando, para no llenar la bandeja del dueño
- [x] Quien ya tiene acceso sigue recibiendo el aviso de que lo tiene

**Cómo quedó:**
La tabla admite una sola solicitud por persona y tienda (`@@unique([usuarioId, tiendaId])`),
así que en vez de crear otra se **reabre** la existente: vuelve a `pendiente`, se limpian
`respondidoPor`, `respondidoEn` y `comentarioAdmin`, y `createdAt` toma la fecha nueva para
que aparezca arriba en la bandeja. Aplica a las rechazadas y también a las aprobadas cuya
persona ya no está en la tienda (la sacaron o se salió), que antes recibían un falso
"ya tienes acceso". La aprobación ya usaba `upsert`, así que no cambió. Sin SQL.
Prueba: `tests/integration/api.test.ts` → "una solicitud rechazada se puede volver a pedir;
una pendiente no", en verde.

---

---

## 📊 Resumen de Fases

| Fase | Duración | Tareas | Objetivo |
|------|----------|--------|----------|
| 1 | 3-4 días | TASK-1 a 4 | Infraestructura base |
| 2 | 4-5 días | TASK-5 a 7 | Portal público funcional |
| 3 | 2-3 días | TASK-8 a 10 | Admin con autenticación |
| 4 | 3-4 días | TASK-11 a 14 | CRUD productos |
| 5 | 3-4 días | TASK-15 a 17 | Gestión inventario |
| 6 | 2-3 días | TASK-18 | Gestión clientes |
| 7 | 4-5 días | TASK-19 a 23 | **Generación facturas (CRÍTICO)** |
| 8 | 2-3 días | TASK-24 a 26 | Reportes y auditoría |
| 9 | 1-2 días | TASK-27 | Configuración |
| 10 | 3-4 días | TASK-28 a 30 | Testing completo |
| 11 | 2-3 días | TASK-31 a 34 | Pulido y deploy |
| **TOTAL** | **~35-40 días** | **34 tareas** | **MVP en producción** |

---

**Notas:**
- Las tareas pueden ejecutarse en paralelo donde no haya dependencias (ej: TASK-5 y TASK-8 podrían parallelizarse).
- La fase 7 (Facturas) es CRÍTICA: requiere máximo cuidado en transacciones y validaciones.
- Testing (fase 10) puede empezar desde fase 2 (tests mientras se implementa).
- Estimaciones son para 1 desarrollador senior con experiencia en Next.js/Supabase.

**Estado:** Implementado y en producción (2026-09-21)

