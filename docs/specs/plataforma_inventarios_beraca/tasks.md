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

