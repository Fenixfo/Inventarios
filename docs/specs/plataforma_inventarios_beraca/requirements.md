# Requirements — Plataforma de Gestión de Inventarios Beraca

- **Fecha:** 2026-09-18
- **Estado:** Borrador
- **Origen:** Brainstorming y especificación de usuario

---

## 1. Contexto

Beraca es una empresa distribuidora de baldosas, cerámicas y porcelanatos. Actualmente carece de un sistema informatizado para gestionar inventario, pedidos y facturación. Se requiere una plataforma web que permita: (1) a administradores gestionar productos, inventario y generar facturas; (2) a clientes consultar catálogo disponible y enviar pedidos a través de WhatsApp.

## 2. Actores

- **Administrador (Admin)**: Gestiona productos, inventario, facturas, clientes. Acceso privado con autenticación.
- **Gerente**: Acceso a reportes, gestión limitada de productos, generación de facturas.
- **Vendedor**: Visualiza catálogo, genera facturas, sin acceso a eliminar ni configurar.
- **Cliente (público)**: Consulta catálogo sin login, crea carrito, envía pedidos por WhatsApp.

## 3. Alcance

**Dentro de alcance:**
- Módulo admin privado con autenticación (3 roles)
- CRUD de productos (SKU, dimensiones, color, acabado, espesor, m² por caja, precio, stock, costo, proveedor, imagen)
- Gestión de inventario (entrada/salida, alertas de stock bajo, historial completo)
- Gestión de clientes (nombre, email, teléfono, dirección, CC/Cédula, historial de compras, términos de pago)
- Generación de facturas (numeración automática YYYYMMDD-SECUENCIAL, validación de stock, transacciones atómicas)
- Auditoría completa (usuario, timestamp, antes/después, reversible)
- Portal público: Catálogo sin login, carrito (localStorage), envío de pedidos por WhatsApp
- PDFs descargables de facturas (empresa Beraca)
- Reportes operacionales (facturación, inventario, productos más vendidos)
- Stock en realtime (cambios reflejados inmediatamente)

**Fuera de alcance (Fase 2+):**
- Autoregistro de clientes
- Pasarelas de pago (Stripe, Mercado Pago)
- Envío de facturas por email backend
- Integración con impresoras
- Multi-empresa
- Otras categorías de productos (baños, cemento, techos PVC)

---

## 4. Requisitos Funcionales (EARS)

### Módulo Público (Catálogo)

- **RF-1.** WHEN un usuario accede a la página web sin autenticación THE SYSTEM SHALL mostrar el catálogo completo de productos con stock disponible en tiempo real.

- **RF-2.** WHEN un usuario visualiza un producto en el catálogo THE SYSTEM SHALL mostrar: SKU, nombre, categoría, dimensiones, color, acabado, espesor, m² por caja, precio, stock disponible.

- **RF-3.** WHEN un usuario agrega un producto al carrito THE SYSTEM SHALL guardar el producto y cantidad en localStorage del navegador.

- **RF-4.** WHEN un usuario visualiza el carrito THE SYSTEM SHALL mostrar resumen: productos, cantidades, m² totales, precio unitario, precio total.

- **RF-5.** WHEN un usuario intenta enviar un pedido sin ingresar su teléfono THE SYSTEM SHALL mostrar error "Por favor ingresa tu número de teléfono" y no permitir continuar.

- **RF-6.** WHEN un usuario hace clic en "Enviar por WhatsApp" THE SYSTEM SHALL generar un enlace WhatsApp con mensaje pre-formateado conteniendo: detalles de los productos (SKU, cantidad, m², precio), total, nombre del cliente, teléfono, y abrir WhatsApp en el número configurado del administrador.

- **RF-7.** WHEN un usuario envía un pedido por WhatsApp THE SYSTEM SHALL mostrar confirmación "Pedido enviado - Esperando confirmación del administrador" en la pantalla.

- **RF-8.** WHEN un usuario cambia de dispositivo o navegador THE SYSTEM SHALL no recuperar el carrito anterior (localStorage no persiste entre dispositivos).

### Módulo Admin - Autenticación

- **RF-9.** WHEN un usuario ingresa email y contraseña correctos THE SYSTEM SHALL autenticar con Supabase y crear sesión con rol asignado.

- **RF-10.** WHEN un usuario sin autenticación intenta acceder a /admin THE SYSTEM SHALL redirigir a página de login.

- **RF-11.** WHEN un usuario intenta acceder a funciones restringidas por rol THE SYSTEM SHALL verificar permisos y denegar acceso si carece del rol requerido.

### Módulo Admin - Gestión de Productos

- **RF-12.** WHEN un Admin accede a gestión de productos THE SYSTEM SHALL mostrar tabla con todos los productos: SKU, nombre, categoría, dimensiones, color, stock, precio.

- **RF-13.** WHEN un Admin hace clic en "Crear Producto" THE SYSTEM SHALL abrir formulario con campos: SKU, nombre, categoría, dimensiones (ancho x largo), color, acabado, espesor, m² por caja, precio, stock inicial, costo, proveedor, descripción, imagen.

- **RF-14.** WHEN un Admin completa el formulario de creación y hace clic "Guardar" THE SYSTEM SHALL validar que todos los campos requeridos estén completos y guardar el producto en BD.

- **RF-15.** WHEN un Admin intenta guardar un producto sin SKU THE SYSTEM SHALL mostrar error "SKU es requerido" y no guardar.

- **RF-16.** WHEN un Admin intenta crear un producto con SKU duplicado THE SYSTEM SHALL mostrar error "El SKU ya existe" y no guardar.

- **RF-17.** WHEN un Admin hace clic en "Editar" en un producto THE SYSTEM SHALL cargar el formulario pre-completado con los datos actuales.

- **RF-18.** WHEN un Admin modifica un producto y hace clic "Guardar cambios" THE SYSTEM SHALL actualizar la BD y mostrar confirmación.

- **RF-19.** WHEN un Gerente intenta eliminar un producto THE SYSTEM SHALL denegar acceso (solo Admin puede eliminar).

- **RF-20.** WHEN un Admin hace clic en "Eliminar" en un producto THE SYSTEM SHALL mostrar confirmación "¿Estás seguro?" y eliminar de la BD si confirma.

### Módulo Admin - Gestión de Inventario

- **RF-21.** WHEN un Admin accede a gestión de inventario THE SYSTEM SHALL mostrar tabla: SKU, nombre, stock actual, stock mínimo configurado, estado (OK / BAJO).

- **RF-22.** WHEN el stock de un producto cae por debajo del mínimo configurado THE SYSTEM SHALL marcar como "BAJO" y mostrar alerta en el dashboard.

- **RF-23.** WHEN un Admin registra una entrada de inventario (compra a proveedor) THE SYSTEM SHALL: aumentar stock en BD, crear registro de auditoría (usuario, fecha, cantidad, tipo "entrada").

- **RF-24.** WHEN un Admin visualiza el historial de movimientos de un producto THE SYSTEM SHALL mostrar: fecha, usuario que registró, tipo (entrada/salida/factura/ajuste), cantidad, antes, después, motivo.

- **RF-25.** WHEN un Admin configura el stock mínimo para un producto THE SYSTEM SHALL guardar el umbral y disparar alertas automáticas cuando cae por debajo.

### Módulo Admin - Gestión de Clientes

- **RF-26.** WHEN un Admin accede a gestión de clientes THE SYSTEM SHALL mostrar tabla con: nombre, email, teléfono, dirección, CC/Cédula, total compras, última compra.

- **RF-27.** WHEN un Admin crea un cliente THE SYSTEM SHALL guardar: nombre, email, teléfono, dirección, CC/Cédula, términos de pago (contado/mixto), límite de crédito.

- **RF-28.** WHEN un Admin visualiza un cliente THE SYSTEM SHALL mostrar historial de compras con facturas, totales, fechas.

### Módulo Admin - Generación de Facturas

- **RF-29.** WHEN un Vendedor accede a crear factura THE SYSTEM SHALL mostrar formulario: seleccionar cliente, agregar items (producto + cantidad en m²), visualizar precio unitario, precio total.

- **RF-30.** WHEN un Vendedor agrega un producto al carrito de factura THE SYSTEM SHALL validar que hay stock disponible; si no hay THE SYSTEM SHALL mostrar error "Stock insuficiente: disponible X m²".

- **RF-31.** WHEN un Vendedor intenta crear factura sin items THE SYSTEM SHALL mostrar error "La factura debe tener al menos 1 item" y no permitir continuar.

- **RF-32.** WHEN un Vendedor hace clic "Generar Factura" THE SYSTEM SHALL: (a) validar stock de todos los items, (b) restar stock de BD ATÓMICAMENTE, (c) generar número secuencial YYYYMMDD-SECUENCIAL, (d) guardar factura en BD, (e) crear registros de auditoría para cada descuento de stock, (f) generar PDF.

- **RF-33.** WHEN un Admin aplica descuento manual en factura (%) THE SYSTEM SHALL recalcular total y mostrar el descuento aplicado.

- **RF-34.** WHEN un Vendedor descarga factura THE SYSTEM SHALL generar PDF con: número de factura, fecha, cliente (nombre, CC, teléfono, dirección), items (SKU, nombre, cantidad, precio unitario, subtotal), subtotal, descuento (si aplica), impuestos (si aplica), total, términos de pago, datos de la empresa Beraca, observaciones.

- **RF-35.** WHEN un Admin intenta eliminar una factura THE SYSTEM SHALL denegar (las facturas no se pueden eliminar, solo marcar como cancelada/anulada).

- **RF-36.** WHEN un Admin marca una factura como anulada THE SYSTEM SHALL revertir stock automáticamente y registrar en auditoría.

### Módulo Admin - Términos de Pago

- **RF-37.** WHEN se crea una factura THE SYSTEM SHALL permitir seleccionar término: "Contado" (100% ahora) o "Mixto" (anticipo + contra entrega).

- **RF-38.** WHEN el término es "Mixto" THE SYSTEM SHALL permitir ingresar: % o monto del anticipo, % o monto contra entrega.

- **RF-39.** WHEN el término es "Contado" THE SYSTEM SHALL permitir seleccionar método: Tarjeta, Efectivo.

### Módulo Admin - Auditoría y Reportes

- **RF-40.** WHEN un Admin accede a auditoría THE SYSTEM SHALL mostrar historial completo: fecha, usuario, acción, tabla afectada, registro antes, registro después, IP.

- **RF-41.** WHEN un Admin accede a reportes de facturación THE SYSTEM SHALL mostrar: total vendido (día/mes/período), número de facturas, promedio por factura, cliente con más ventas.

- **RF-42.** WHEN un Admin accede a reportes de inventario THE SYSTEM SHALL mostrar: productos con stock bajo, movimientos por producto, rotación (más vendidos), productos sin movimiento.

### Módulo Admin - Configuración

- **RF-43.** WHEN un Admin accede a configuración THE SYSTEM SHALL permitir: cambiar número de WhatsApp para recibir pedidos, editar nombre de empresa (Beraca), agregar logo (futuro).

---

## 5. Requisitos No Funcionales

- **RNF-1.** El sistema debe estar disponible 99.5% del tiempo.
- **RNF-2.** Las consultas de catálogo deben responder en menos de 500ms.
- **RNF-3.** Generación de PDF debe completarse en menos de 2 segundos.
- **RNF-4.** Las transacciones de facturación (validación + descuento de stock) deben ser atómicas (todo o nada).
- **RNF-5.** Los datos de clientes y facturas deben estar encriptados en tránsito (HTTPS).
- **RNF-6.** Las credenciales de acceso deben estar seguras con Supabase Auth (bcrypt).
- **RNF-7.** Row Level Security (RLS) debe garantizar que usuarios solo ven sus datos autorizados.
- **RNF-8.** La BD debe tener backup automático diario.
- **RNF-9.** El sitio debe ser responsive (móvil, tablet, desktop).
- **RNF-10.** Soportar hasta 10,000 productos y 100,000 facturas en fase 1.

---

## 6. Criterios de Aceptación

- [ ] Portal público accesible sin login mostrando catálogo en realtime
- [ ] Carrito funcional en localStorage con resumen correcto
- [ ] Envío de pedidos por WhatsApp generando enlace pre-formateado
- [ ] Módulo admin con autenticación (email/contraseña via Supabase)
- [ ] 3 roles (Admin, Gerente, Vendedor) con permisos granulares
- [ ] CRUD completo de productos con validaciones
- [ ] Gestión de inventario: entrada/salida/alertas/historial
- [ ] Generación de facturas con validación de stock y transacciones atómicas
- [ ] Descuento automático de stock en BD
- [ ] Numeración secuencial YYYYMMDD-SECUENCIAL
- [ ] PDFs descargables con formato profesional
- [ ] Auditoría completa (quién, cuándo, antes/después)
- [ ] Reportes operacionales (facturación e inventario)
- [ ] Términos de pago: Contado / Mixto (anticipo + contra entrega)
- [ ] Gestión de clientes con historial
- [ ] Configuración de número WhatsApp en settings
- [ ] All CRUD operations validated and error-handled
- [ ] Tests e2e cobriendo flujos críticos (crear factura, ver catálogo, enviar pedido)

---

## 7. Suposiciones y Dependencias

**Suposiciones:**
- Los clientes tienen acceso a WhatsApp en el navegador o app móvil
- El número de WhatsApp del admin se mantiene válido
- Las imágenes de productos se almacenan en Supabase Storage
- Las facturas se generan en PDF y se descargan localmente (no se envían por email automáticamente en MVP)

**Dependencias:**
- Supabase (BD PostgreSQL, Auth, Storage)
- Vercel para hosting/deploy
- Next.js 14+
- Navegador moderno con soporte ES2020+
- API de WhatsApp (enlace wa.me/)

---

## 8. Preguntas Abiertas

- ¿Se implementará validación de CC/Cédula (formato específico por país)?
- ¿Qué niveles de impuesto (IVA/ICAC) aplican en facturas?
- ¿Hay códigos promocionales o cupones de descuento en MVP?
- ¿Se requiere control de devoluciones de productos?

---

**Estado:** Listo para Approval Gate 1 → Design

