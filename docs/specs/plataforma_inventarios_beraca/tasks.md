# Tasks — Plataforma de Gestión de Inventarios Beraca

- **Fecha:** 2026-09-18
- **Estado:** Borrador
- **Design:** [design.md](./design.md)
- **Requirements:** [requirements.md](./requirements.md)

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
- **Estado:** pendiente

**Descripción:**
Crear proyecto Next.js 14 con TypeScript, configurar eslint, prettier, tsconfig, variables de entorno. Instalar dependencias base: tailwindcss, shadcn/ui, react-hook-form, zod. Configurar estructura de carpetas (src/, pages/, api/, components/, lib/, hooks/, types/, styles/).

**Criterio de done:**
- [ ] Proyecto Next.js 14 inicializado
- [ ] TypeScript configurado con tsconfig.json estricto
- [ ] TailwindCSS + Shadcn/ui instalado
- [ ] ESLint + Prettier configurado
- [ ] Carpetas de proyecto creadas
- [ ] .env.example con variables necesarias
- [ ] `npm run dev` inicia sin errores

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-2: Configurar Supabase (BD, Auth, Storage, RLS)

- **Cubre:** Infraestructura BD, autenticación
- **Componente:** Database, Auth
- **Tipo:** setup
- **Estado:** pendiente

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
- [ ] 🔐 Credenciales Supabase compartidas conmigo
- [ ] 8 tablas creadas con esquema completo
- [ ] Índices de performance aplicados
- [ ] RLS policies configuradas (usuarios, productos, facturas)
- [ ] Supabase Auth habilitado (email/password)
- [ ] Usuario admin inicial creado (especificar email)
- [ ] Storage bucket para imágenes creado
- [ ] .env.local con SUPABASE_URL y SUPABASE_ANON_KEY

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-3: Configurar Prisma y migraciones

- **Cubre:** ORM, migraciones automáticas
- **Componente:** Database, ORM
- **Tipo:** setup
- **Estado:** pendiente

**Descripción:**
Instalar Prisma, crear schema.prisma basado en tablas Supabase, generar types automáticos, configurar connection string. Crear primera migración para validar sincronización BD-Prisma.

**Criterio de done:**
- [ ] Prisma instalado y configurado
- [ ] schema.prisma sincronizado con tablas Supabase
- [ ] Tipos Prisma generados automáticamente
- [ ] Conexión BD funcional
- [ ] `prisma generate` sin errores
- [ ] Prima studio visualiza correctamente las tablas

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-4: Configurar Vercel y CI/CD

- **Cubre:** Hosting, deployment automático
- **Componente:** Infrastructure, DevOps
- **Tipo:** setup
- **Estado:** pendiente

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
- [ ] Repositorio GitHub creado y sincronizado
- [ ] Proyecto Vercel creado y conectado a Git
- [ ] Variables de entorno configuradas (SUPABASE_URL, SUPABASE_ANON_KEY, etc.)
- [ ] Primer deploy exitoso
- [ ] Sitio accesible en URL de Vercel
- [ ] Build sin warnings o errores
- [ ] Deploy automático en main funcional
- [ ] Preview en PRs generado automáticamente

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
- **Estado:** pendiente

**Descripción:**
Crear página de inicio (`/`) que muestra catálogo de todos los productos activos. Implementar grid responsive de ProductCard. Mostrar: SKU, imagen, nombre, dimensiones, color, acabado, m² por caja, precio, stock disponible. Stock debe reflejar datos actuales en realtime desde BD.

**Criterio de done:**
- [ ] Página `/` renderiza catálogo
- [ ] ProductCard muestra todos los campos requeridos
- [ ] Stock se actualiza en realtime (sin refresh)
- [ ] Responsive en móvil, tablet, desktop
- [ ] Imágenes se cargan desde Supabase Storage
- [ ] Rendimiento < 500ms en consulta de productos
- [ ] Tests unitarios para ProductCard

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-6: Implementar carrito de compras (localStorage)

- **Cubre:** RF-3, RF-4
- **Componente:** Cart, useCart hook
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear hook `useCart` que gestiona estado del carrito en localStorage. Implementar agregar/quitar items, calcular totales (cantidad, m², precio total). Crear componente Cart que muestra resumen. Carrito no persiste entre dispositivos.

**Criterio de done:**
- [ ] Hook `useCart` creado y funcional
- [ ] Agregar producto al carrito
- [ ] Quitar producto del carrito
- [ ] Actualizar cantidad en carrito
- [ ] Calcular totales correctamente
- [ ] localStorage guarda/recupera carrito
- [ ] Carrito vacío muestra mensaje
- [ ] Tests unitarios para useCart

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-7: Implementar envío de pedido por WhatsApp

- **Cubre:** RF-5, RF-6, RF-7
- **Componente:** WhatsAppButton, pedidos API
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear formulario que pide teléfono del cliente. Validar con Zod. Crear botón "Enviar por WhatsApp" que genera enlace wa.me con mensaje pre-formateado con detalles del carrito, total, teléfono cliente. Generar enlace a WhatsApp número del admin (configurable). Mostrar confirmación "Pedido enviado".

**Criterio de done:**
- [ ] Formulario pide teléfono del cliente
- [ ] Validación Zod en frontend
- [ ] Error si no hay teléfono
- [ ] Botón genera enlace WhatsApp correcto
- [ ] Enlace contiene: productos, cantidades, m², total, teléfono cliente
- [ ] Número admin se obtiene de configuracion (API)
- [ ] Al hacer clic, se abre WhatsApp
- [ ] Muestra confirmación "Pedido enviado"
- [ ] Tests E2E con Playwright

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
- **Estado:** pendiente

**Descripción:**
Crear página `/login` con formulario email/contraseña. Integrar con Supabase Auth. Validar credenciales, crear sesión, guardar JWT en cookie/localStorage. Crear hook `useAuth` para verificar autenticación. Redirigir usuarios no autenticados a `/login`. Proteger `/admin/*` con middleware.

**Criterio de done:**
- [ ] Página `/login` renderiza
- [ ] Formulario email/contraseña con validación Zod
- [ ] Autenticación funciona con Supabase
- [ ] JWT guardado en cookie secure
- [ ] Hook `useAuth` retorna usuario actual
- [ ] Usuarios no autenticados redirigidos a `/login`
- [ ] `/admin/*` protegido
- [ ] Logout funcional
- [ ] Tests de autenticación

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-9: Implementar sistema de roles y permisos

- **Cubre:** RF-11
- **Componente:** Auth, Roles middleware
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear tabla `usuarios_roles` en BD. Implementar función `getRoleForUser()`. Crear middleware que verifica rol en cada API route. Proteger funciones por rol: Admin (todos), Gerente (lectura + crear facturas), Vendedor (solo crear facturas + ver catálogo). Implementar componentes condicionales que ocultan funciones según rol.

**Criterio de done:**
- [ ] Tabla usuarios_roles en BD
- [ ] Función `getRoleForUser()` retorna rol del usuario
- [ ] Middleware verifica rol en API routes
- [ ] Admin tiene acceso a todo
- [ ] Gerente tiene acceso a lectura + facturas
- [ ] Vendedor tiene acceso limitado
- [ ] UI oculta opciones según rol
- [ ] Tests de autorización por rol

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-10: Crear dashboard admin

- **Cubre:** Componente principal admin
- **Componente:** Admin Dashboard, Layout
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear página `/admin/dashboard` que muestra: resumen de ventas hoy, productos con stock bajo, últimas facturas, accesos rápidos a módulos (productos, inventario, facturas, clientes, reportes). Implementar Layout con Sidebar navegable.

**Criterio de done:**
- [ ] Dashboard renderiza
- [ ] Muestra total ventas hoy
- [ ] Muestra productos con stock bajo (alertas)
- [ ] Muestra últimas 5 facturas
- [ ] Accesos rápidos a módulos principales
- [ ] Sidebar con navegación funcional
- [ ] Responsive
- [ ] Tests básicos de dashboard

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
- **Estado:** pendiente

**Descripción:**
Crear endpoint `GET /api/productos` que retorna array de productos activos con filtros opcionales (categoría, color, acabado). Optimizar con índices. Retornar stock actual en realtime desde BD.

**Criterio de done:**
- [ ] Endpoint `GET /api/productos` funcional
- [ ] Retorna productos activos
- [ ] Soporta filtros (categoría, color)
- [ ] Retorna stock actualizado
- [ ] Respuesta < 500ms
- [ ] Validación de inputs con Zod
- [ ] Tests unitarios

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-12: Implementar API para crear producto

- **Cubre:** RF-13, RF-14, RF-15, RF-16
- **Componente:** API /api/productos (POST), ProductForm
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear endpoint `POST /api/productos` que valida e inserta producto. Validar: SKU único, todos los campos requeridos, tipos de datos. Guardar imagen en Supabase Storage. Crear formulario ProductForm que consume el endpoint.

**Criterio de done:**
- [ ] Endpoint `POST /api/productos` funcional
- [ ] Validación de campos requeridos (Zod)
- [ ] Validación SKU único
- [ ] Validación tipos de datos (DECIMAL, VARCHAR, etc.)
- [ ] Guardar imagen en Storage
- [ ] Crear registro en BD
- [ ] Retornar error si SKU duplicado
- [ ] ProductForm renderiza
- [ ] Formulario valida campos
- [ ] Guardado exitoso muestra confirmación
- [ ] Tests de API y formulario

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-13: Implementar API para editar y eliminar productos

- **Cubre:** RF-17, RF-18, RF-19, RF-20
- **Componente:** API /api/productos/[id] (PUT, DELETE)
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear endpoints `PUT /api/productos/[id]` (actualizar) y `DELETE /api/productos/[id]` (eliminar). Validar permisos: solo Admin puede eliminar, Gerente solo editar sin eliminar. Validar integridad referencial: no eliminar si hay facturas.

**Criterio de done:**
- [ ] Endpoint `PUT /api/productos/[id]` funcional
- [ ] Endpoint `DELETE /api/productos/[id]` funcional
- [ ] Validación de permisos por rol
- [ ] Validación integridad: no eliminar si hay referencias
- [ ] Confirmación antes de eliminar
- [ ] Editar: cargar datos actuales en formulario
- [ ] Actualizar éxitosamente
- [ ] Tests de permisos y validaciones

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-14: Crear tabla de productos admin

- **Cubre:** RF-12
- **Componente:** ProductTable, Pagination
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear página `/admin/productos` con tabla interactiva de productos. Mostrar: SKU, nombre, categoría, dimensiones, color, stock, precio. Implementar paginación, búsqueda por SKU/nombre, botones Editar/Eliminar/Crear.

**Criterio de done:**
- [ ] Página `/admin/productos` renderiza
- [ ] Tabla muestra todos los campos
- [ ] Paginación funciona (10-20 items por página)
- [ ] Búsqueda por SKU/nombre
- [ ] Botón Crear abre formulario modal
- [ ] Botón Editar abre formulario modal con datos
- [ ] Botón Eliminar pide confirmación
- [ ] Integración con APIs (GET, POST, PUT, DELETE)
- [ ] Responsive
- [ ] Tests

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
- **Estado:** pendiente

**Descripción:**
Crear endpoint `POST /api/inventario/movimientos` que registra entrada/salida. Actualizar stock en tabla productos. Guardar registro en inventario_movimientos con: producto, tipo (entrada/salida), cantidad, antes, después, usuario, IP, fecha. Crear formulario para admin registrar movimientos manuales.

**Criterio de done:**
- [ ] Endpoint `POST /api/inventario/movimientos` funcional
- [ ] Actualiza stock en productos
- [ ] Crea registro en inventario_movimientos
- [ ] Guarda: usuario, IP, timestamp, antes, después
- [ ] Valida cantidad > 0
- [ ] InventoryForm renderiza
- [ ] Formulario con tipo (entrada/salida)
- [ ] Validación de datos
- [ ] Éxito muestra confirmación
- [ ] Tests de API y auditoría

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-16: Implementar configuración de stock mínimo y alertas

- **Cubre:** RF-25
- **Componente:** API /api/productos/[id]/stock-minimo, AlertSystem
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear endpoint para actualizar stock_minimo por producto. Implementar lógica que marca productos como "BAJO" cuando stock cae por debajo del mínimo. Mostrar alertas en dashboard admin.

**Criterio de done:**
- [ ] Endpoint para actualizar stock_minimo
- [ ] Campo stock_minimo en formulario producto
- [ ] Lógica: si stock < stock_minimo → marcar BAJO
- [ ] Dashboard muestra productos con stock BAJO
- [ ] Alertas visuales (badge rojo)
- [ ] Listado de productos con alerta
- [ ] Configuración por producto
- [ ] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-17: Crear página de historial de inventario

- **Cubre:** RF-24
- **Componente:** InventoryHistoryPage, InventoryTable
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear página `/admin/inventario` con tabla de movimientos. Filtros: por producto, por tipo (entrada/salida/factura/ajuste), por fecha. Mostrar: fecha, usuario, tipo, producto, cantidad, stock antes, stock después, motivo.

**Criterio de done:**
- [ ] Página `/admin/inventario` renderiza
- [ ] Tabla de movimientos
- [ ] Filtros funcionales (producto, tipo, fecha)
- [ ] Paginación
- [ ] Muestra: fecha, usuario, tipo, cantidad, antes, después
- [ ] Búsqueda
- [ ] Responsive
- [ ] Tests

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
- **Estado:** pendiente

**Descripción:**
Crear endpoints: `GET /api/clientes` (listar), `POST /api/clientes` (crear), `GET /api/clientes/[id]` (obtener), `PUT /api/clientes/[id]` (actualizar). Crear formulario ClientForm. Crear página `/admin/clientes` con tabla interactiva.

**Criterio de done:**
- [ ] Endpoints CRUD funcionales
- [ ] Validación de campos (Zod)
- [ ] Validación CC/Cédula única
- [ ] ClientForm renderiza (crear/editar)
- [ ] Página `/admin/clientes` con tabla
- [ ] Tabla muestra: nombre, email, tel, CC, dirección, última compra
- [ ] Paginación, búsqueda
- [ ] Botones Editar/Eliminar
- [ ] Historial de compras por cliente
- [ ] Tests

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
- **Estado:** pendiente

**Descripción:**
Crear endpoint `POST /api/facturas` que es el más crítico del sistema. Recibe: cliente_id, items[], descuento, términos_pago. Valida stock suficiente para todos los items. Genera número secuencial YYYYMMDD-SECUENCIAL. Ejecuta transacción atómica: crea factura → crea items → decrementa stock → crea registros auditoría. Si algo falla, rollback automático.

**Criterio de done:**
- [ ] Endpoint `POST /api/facturas` funcional
- [ ] Validar cliente existe
- [ ] Validar al menos 1 item
- [ ] Validar stock disponible (si no, error claro)
- [ ] Generar número YYYYMMDD-SECUENCIAL
- [ ] Transacción atómica (Prisma transaction)
- [ ] Crear factura
- [ ] Crear items en facturas_items
- [ ] Decrementar stock en productos
- [ ] Crear registros en inventario_movimientos (1 por item descuento)
- [ ] Crear registros en auditoria
- [ ] Si falla cualquier paso → rollback completo
- [ ] Retornar factura creada
- [ ] Validación Zod rigurosa
- [ ] Tests de happy path + edge cases + falla stock

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-20: Generar PDF descargable de factura

- **Cubre:** RF-34
- **Componente:** API /api/facturas/[id]/pdf, PDF generator
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear endpoint `GET /api/facturas/[id]/pdf` que genera PDF. Usar jsPDF + html2canvas. PDF debe contener: número factura, fecha, cliente (nombre, CC, tel, dirección), items (SKU, nombre, cantidad m², precio unitario, subtotal), subtotal, descuento, total, empresa Beraca, términos de pago.

**Criterio de done:**
- [ ] Endpoint `/api/facturas/[id]/pdf` funcional
- [ ] Valida que factura existe y usuario tiene permisos
- [ ] Genera PDF con jsPDF
- [ ] PDF contiene todos los campos requeridos
- [ ] Formato profesional y legible
- [ ] Logo/datos empresa (cuando sea disponible)
- [ ] Generación < 2 segundos
- [ ] Descarga automática al acceder a endpoint
- [ ] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-21: Crear formulario de factura (InvoiceForm)

- **Cubre:** RF-29
- **Componente:** InvoiceForm, Modal
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear componente InvoiceForm con: selector cliente, tabla de items agregables, campo cantidad m², precio calculado automáticamente, descuento manual (%), términos de pago, vista previa de total. Al hacer submit, consume endpoint POST /api/facturas.

**Criterio de done:**
- [ ] InvoiceForm renderiza
- [ ] Selector cliente (búsqueda)
- [ ] Tabla de items con agregar/quitar
- [ ] Campo cantidad m² con validación
- [ ] Precio unitario (lectura desde BD)
- [ ] Subtotal por item calculado
- [ ] Campo descuento (%)
- [ ] Recalcula total automáticamente
- [ ] Términos de pago (contado/mixto)
- [ ] Preview de total
- [ ] Submit valida campos
- [ ] Muestra error si stock insuficiente
- [ ] Integración con API POST
- [ ] Confirmación exitosa
- [ ] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-22: Crear página de facturas (listar, ver, descargar)

- **Cubre:** RF-12 (para facturas)
- **Componente:** InvoicesPage, InvoiceTable, InvoiceDetail
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear página `/admin/facturas` con: tabla de facturas (número, cliente, fecha, total, estado), filtros (cliente, fecha, estado), paginación. Botones: Ver detalle, Descargar PDF, Marcar como anulada. Crear vista de detalle que muestra factura completa.

**Criterio de done:**
- [ ] Página `/admin/facturas` renderiza
- [ ] Tabla muestra: número, cliente, fecha, total, estado
- [ ] Filtros (cliente, fecha, estado)
- [ ] Paginación
- [ ] Búsqueda por número factura
- [ ] Botón "Ver detalle" abre modal/página
- [ ] Detalle muestra factura completa + items
- [ ] Botón "Descargar PDF" funciona
- [ ] Botón "Anular" marca como "anulada"
- [ ] Anular revierte stock automáticamente
- [ ] Responsive
- [ ] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-23: Implementar términos de pago (contado/mixto)

- **Cubre:** RF-37, RF-38, RF-39
- **Componente:** PaymentTermsSelector
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
En InvoiceForm, agregar selector de término: "Contado" (100% ahora, seleccionar método tarjeta/efectivo) o "Mixto" (permitir ingresar % anticipado + % contra entrega). Guardar datos en factura.

**Criterio de done:**
- [ ] Radio selector: Contado / Mixto
- [ ] Si Contado: selector método (tarjeta, efectivo)
- [ ] Si Mixto: campos para % anticipado y % contra entrega
- [ ] Validación: anticipado + contra entrega = 100%
- [ ] Guardado en tabla facturas
- [ ] Visualización en detalle de factura
- [ ] Tests de validaciones

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
- **Estado:** pendiente

**Descripción:**
Crear endpoint `GET /api/reportes/facturacion` que retorna: total vendido (período configurable), número de facturas, promedio por factura, cliente con más ventas. Crear página `/admin/reportes` con gráficos usando librería de charts (recharts).

**Criterio de done:**
- [ ] Endpoint `/api/reportes/facturacion` funcional
- [ ] Retorna totales correctos
- [ ] Soporta filtro por fecha (hoy, semana, mes, personalizado)
- [ ] Página `/admin/reportes` renderiza
- [ ] Gráfico de ventas por período
- [ ] Tabla de productos más vendidos
- [ ] Tabla de clientes top
- [ ] Responsive
- [ ] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-25: Implementar reportes de inventario

- **Cubre:** RF-42
- **Componente:** API /api/reportes/inventario
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear endpoint `GET /api/reportes/inventario` que retorna: productos con stock bajo, movimientos por producto (rotación), productos sin movimiento. Agregar a página `/admin/reportes`.

**Criterio de done:**
- [ ] Endpoint `/api/reportes/inventario` funcional
- [ ] Productos con stock bajo (< stock_minimo)
- [ ] Rotación: productos más vendidos
- [ ] Productos sin movimiento (últimos 30 días)
- [ ] Página muestra todos los reportes
- [ ] Tabla interactiva
- [ ] Filtros
- [ ] Tests

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-26: Implementar auditoría y historial completo CON SEGUIMIENTO DE FECHAS

- **Cubre:** RF-40, Auditoría temporal
- **Componente:** API /api/auditoria, AuditLog, fecha_accion
- **Tipo:** feature
- **Estado:** pendiente

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
- [ ] Página `/admin/auditoria` renderiza
- [ ] Tabla muestra historial completo CON FECHA/HORA EXACTA
- [ ] Filtros: por usuario, tabla, fecha (rango de fechas), acción
- [ ] Búsqueda por fecha (hoy, semana, mes, personalizado)
- [ ] Paginación
- [ ] Visualizar datos antes/después (JSON expandible)
- [ ] Mostrar IP del usuario
- [ ] Solo Admin accede
- [ ] Reporte de cambios por período (ej: todas las acciones del último mes)
- [ ] Reporte de cambios por usuario (ej: qué hizo usuario X en fecha Y)
- [ ] Tests

**Campos de fecha en todas las tablas verificados:**
- [ ] usuarios: created_at, updated_at, last_login
- [ ] productos: created_at, updated_at, precio_unitario_updated_at, costo_updated_at, activo_desde
- [ ] clientes: created_at, updated_at, ultima_compra_fecha, activo_desde
- [ ] facturas: fecha, fecha_pago, fecha_vencimiento, fecha_anulacion, created_at, updated_at
- [ ] inventario_movimientos: fecha_movimiento, created_at
- [ ] auditoria: fecha_accion, created_at
- [ ] facturas_items: created_at
- [ ] configuracion: updated_at

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
- **Estado:** pendiente

**Descripción:**
Crear página `/admin/configuracion` donde admin puede cambiar: número de WhatsApp para recibir pedidos, nombre de empresa (Beraca), logo (upload a Storage), otros ajustes. Almacenar en tabla configuracion.

**Criterio de done:**
- [ ] Página `/admin/configuracion` renderiza
- [ ] Campo número WhatsApp (validación teléfono internacional)
- [ ] Campo nombre empresa
- [ ] Upload de logo (image to Storage)
- [ ] Save button
- [ ] Confirmación de cambios
- [ ] Datos se reflejan en Portal público (WhatsApp) y Facturas (logo)
- [ ] Solo Admin accede
- [ ] Tests

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
- **Estado:** pendiente

**Descripción:**
Escribir tests unitarios con Vitest para: componentes React (ProductCard, Cart, InvoiceForm), hooks (useCart, useAuth, useFetch), funciones utilitarias (cálculos, generación de números), validadores Zod.

**Criterio de done:**
- [ ] Tests para ProductCard
- [ ] Tests para Cart
- [ ] Tests para InvoiceForm
- [ ] Tests para useCart hook
- [ ] Tests para useAuth hook
- [ ] Tests para validadores Zod
- [ ] Tests para funciones utilitarias
- [ ] Cobertura >= 70%
- [ ] Todos los tests pasan
- [ ] CI/CD ejecuta tests en cada PR

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-29: Tests de integración (APIs + BD)

- **Cubre:** Validación de flujos
- **Componente:** Integration Tests
- **Tipo:** test
- **Estado:** pendiente

**Descripción:**
Tests que verifican APIs contra BD real: crear producto, listar con filtros, crear factura con transacción, validar stock, crear auditoría. Usar Vitest + bd de test Supabase.

**Criterio de done:**
- [ ] Test: GET /api/productos
- [ ] Test: POST /api/productos (crear)
- [ ] Test: PUT /api/productos/[id] (editar)
- [ ] Test: DELETE /api/productos/[id]
- [ ] Test: POST /api/facturas (transacción)
- [ ] Test: validación stock insuficiente
- [ ] Test: auditoría registra cambios
- [ ] Todos los tests pasan
- [ ] BD de test limpia después de cada test

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-30: Tests E2E (flujos completos con Playwright)

- **Cubre:** Validación user flows
- **Componente:** E2E Tests
- **Tipo:** test
- **Estado:** pendiente

**Descripción:**
Tests end-to-end con Playwright que validan flujos completos: (1) Cliente: ver catálogo → agregar carrito → enviar WhatsApp; (2) Admin: login → crear producto → crear factura → descargar PDF.

**Criterio de done:**
- [ ] Test: Cliente navega catálogo
- [ ] Test: Cliente agrega carrito
- [ ] Test: Cliente envía pedido por WhatsApp
- [ ] Test: Admin login
- [ ] Test: Admin crea producto
- [ ] Test: Admin crea factura
- [ ] Test: Admin descarga PDF
- [ ] Test: Validación stock insuficiente
- [ ] Todos los tests pasan
- [ ] CI/CD ejecuta tests antes de deploy

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
- **Estado:** pendiente

**Descripción:**
Optimizar: caché de consultas, compresión de imágenes, lazy loading, minificación, tree-shaking. Validar Lighthouse scores. Medir Core Web Vitals. Implementar keep-alive en API para mitigar cold starts.

**Criterio de done:**
- [ ] Lighthouse score >= 80 (Performance)
- [ ] Consultas BD < 200ms
- [ ] Generación PDF < 2 segundos
- [ ] Imágenes optimizadas/comprimidas
- [ ] Lazy loading en componentes
- [ ] Build size razonable
- [ ] Core Web Vitals verdes
- [ ] Keep-alive en APIs implementado

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-32: SEO básico y meta tags

- **Cubre:** Visibilidad web
- **Componente:** SEO
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Agregar meta tags (description, og:image, og:title), sitemap.xml, robots.txt. Configurar canonical URLs. Verificación en Google Search Console. Open Graph para compartir en redes.

**Criterio de done:**
- [ ] Meta tags en todas las páginas
- [ ] Open Graph configurado
- [ ] sitemap.xml generado
- [ ] robots.txt creado
- [ ] Canonical URLs
- [ ] Verificado en Google Search Console
- [ ] Estructura schema.org (si aplica)

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-33: Deploy a producción en Vercel

- **Cubre:** Puesta en vivo
- **Componente:** DevOps
- **Tipo:** setup
- **Estado:** pendiente

**Descripción:**
Hacer deploy a Vercel (debería estar automático con GitHub). Validar que sitio funciona en producción, testar flujos críticos en prod, setup Sentry para error tracking, validar certificado HTTPS, verificar backups BD.

**Criterio de done:**
- [ ] Deploy en Vercel producción
- [ ] Sitio accesible en dominio (o vercel.app)
- [ ] Tests E2E pasan en producción
- [ ] HTTPS funcional
- [ ] Sentry configurado para error tracking
- [ ] Backups Supabase automáticos verificados
- [ ] Performance aceptable en producción
- [ ] Usuarios admin pueden login y usar sistema

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| | | |

---

### TASK-34: Documentación de usuario

- **Cubre:** Usabilidad
- **Componente:** Docs
- **Tipo:** feature
- **Estado:** pendiente

**Descripción:**
Crear documentación básica: cómo agregar productos, cómo crear facturas, cómo usar reportes. Crear video tutorial de setup inicial. Crear guía de troubleshooting.

**Criterio de done:**
- [ ] Documentación de admin
- [ ] Guía de productos
- [ ] Guía de facturas
- [ ] FAQ
- [ ] Video tutorial (opcional)
- [ ] Contacto/soporte

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

**Estado:** Listo para Approval Gate 3 → Ejecución

