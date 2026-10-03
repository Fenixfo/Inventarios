# Requirements — Módulo de compras

- **Fecha:** 2026-10-02
- **Estado:** Aprobado
- **Origen:** brainstorm (sesión del 2026-10-02) sobre la idea del usuario de registrar las facturas de compra a proveedores

## 1. Contexto

La empresa compra mercancía a proveedores, pero hoy esas compras no quedan registradas: el stock y el costo de los productos se ajustan a mano y el proveedor es solo un texto dentro de cada producto. El módulo de compras permite registrar la factura de compra de uno o varios productos a la vez, creando o actualizando los productos, sumando el stock, fijando el costo (incluyendo flete y descargue) y dejando la factura guardada y enlazada a los productos.

Decisiones heredadas del brainstorm:
- La compra suma stock, actualiza el costo y deja un movimiento `compra` en el historial.
- El producto existente se detecta por SKU, avisando si el nombre se parece al de otro.
- Con un producto existente solo se completan los campos vacíos; nunca se sobrescribe.
- El costo del producto es el último precio pagado, ajustable por línea, más costos adicionales de factura repartidos entre las líneas.
- El proveedor es una entidad propia.
- Una compra no se edita: se anula con motivo.

## 2. Actores

- **Comprador:** usuario con permiso para registrar compras (`compras.crear`).
- **Consultor de compras:** usuario que solo ve compras y proveedores (`compras.ver`).
- **Administrador de compras:** usuario que puede anular compras (`compras.anular`).
- **Sistema de inventario:** productos, stock y movimientos de inventario ya existentes, que la compra modifica.

## 3. Alcance

**Dentro de alcance:**
- Proveedores: crear, editar y listar.
- Factura de compra con varias líneas y costos adicionales (flete, descargue).
- Creación de productos nuevos y completado de productos existentes desde la compra, con imagen opcional.
- Efecto en stock, costo y movimientos de inventario.
- Anulación de compras.
- Lista y detalle de compras, historial de compras en la ficha del producto.
- Permisos del módulo y entrada en la barra lateral.

**Fuera de alcance:**
- Pagos, abonos y cuentas por pagar a proveedores (se puede añadir después sin rehacer lo anterior).
- Ingreso parcial o posterior de mercancía (borrador y "recibir mercancía").
- Devoluciones al proveedor.
- Importar facturas desde un archivo.
- Edición de una compra ya guardada (se anula y se registra de nuevo).
- Eliminar proveedores.
- Migrar el texto `proveedor` de los productos existentes a la nueva entidad.

## 4. Requisitos funcionales (EARS)

**Proveedores**

- **RF-1.** WHEN un usuario con `compras.crear` guarda un proveedor con nombre THE SYSTEM SHALL crearlo en su tienda con nombre, NIT, teléfono, correo y dirección, siendo opcionales todos menos el nombre.
- **RF-2.** WHEN se guarda un proveedor con un NIT que ya existe en la misma tienda THE SYSTEM SHALL rechazarlo indicando que el NIT ya está registrado.
- **RF-3.** WHEN un usuario con `compras.crear` edita un proveedor THE SYSTEM SHALL actualizar sus datos sin modificar las compras ya registradas con él.
- **RF-4.** WHEN un usuario con `compras.ver` abre la lista de proveedores THE SYSTEM SHALL mostrar solo los proveedores de su tienda.
- **RF-5.** WHEN el comprador está registrando una compra THE SYSTEM SHALL permitirle buscar un proveedor existente o crear uno nuevo sin salir de la pantalla.

**Registro de la compra**

- **RF-6.** WHEN el comprador guarda una compra THE SYSTEM SHALL exigir un proveedor, una fecha y al menos una línea.
- **RF-7.** WHEN se guarda una compra con un número de factura del proveedor que ya está registrado para ese mismo proveedor en la tienda, y esa compra no está anulada, THE SYSTEM SHALL rechazarla indicando la compra existente.
- **RF-8.** WHEN el comprador agrega una línea THE SYSTEM SHALL pedir los mismos datos de un producto nuevo (SKU, nombre, categoría, dimensiones, color, acabado, espesor, m² por caja, precio de venta y stock mínimo), más la cantidad comprada y el precio de factura.
- **RF-9.** WHEN el comprador escribe el SKU de una línea THE SYSTEM SHALL indicar si corresponde a un producto existente de la tienda o si se creará uno nuevo.
- **RF-10.** WHEN el SKU de una línea es nuevo y existe un producto de la tienda cuyo nombre se parece al escrito THE SYSTEM SHALL mostrar un aviso con ese producto y exigir elegir entre "es ese producto" y "crear uno nuevo" antes de guardar.
- **RF-11.** WHEN el comprador elige "es ese producto" THE SYSTEM SHALL tratar la línea como la de un producto existente.
- **RF-12.** WHEN dos líneas de la misma compra tienen el mismo SKU THE SYSTEM SHALL rechazar el guardado indicando el SKU repetido.
- **RF-13.** WHEN una línea de un producto nuevo no tiene precio de venta THE SYSTEM SHALL rechazar el guardado, porque todo producto exige precio de venta.
- **RF-14.** WHEN una línea tiene cantidad menor o igual a cero, o precio de factura negativo THE SYSTEM SHALL rechazar el guardado indicando la línea.

**Productos nuevos y existentes**

- **RF-15.** WHEN se guarda una compra con una línea de SKU nuevo THE SYSTEM SHALL crear el producto con los datos de la línea, con la imagen que se haya subido o sin imagen.
- **RF-16.** WHEN se guarda una compra con una línea de un producto existente THE SYSTEM SHALL completar solo los campos del producto que están vacíos con lo escrito en la línea.
- **RF-17.** WHEN una línea de un producto existente trae un valor distinto del que el producto ya tiene THE SYSTEM SHALL conservar el valor del producto y mostrar la diferencia entre el valor actual y el escrito.
- **RF-18.** WHEN una línea de un producto existente que ya tiene imagen trae otra imagen THE SYSTEM SHALL conservar la imagen del producto.
- **RF-19.** WHEN una línea de un producto existente sin imagen trae una imagen THE SYSTEM SHALL asignarla al producto.
- **RF-20.** IF falla el guardado de una compra después de subir imágenes THEN THE SYSTEM SHALL borrar las imágenes subidas durante ese intento.

**Costos**

- **RF-21.** WHEN el comprador agrega costos adicionales THE SYSTEM SHALL permitir varios, cada uno con un concepto y un valor mayor que cero.
- **RF-22.** WHEN hay costos adicionales THE SYSTEM SHALL repartirlos entre las líneas por valor de cada línea, o por cantidad si el comprador lo elige.
- **RF-23.** WHEN se reparten costos adicionales THE SYSTEM SHALL asegurar que la suma de las partes repartidas sea exactamente el total de los costos adicionales, asignando el centavo restante de redondeo a una línea.
- **RF-24.** WHEN se calcula el costo final de una línea THE SYSTEM SHALL tomar el precio de factura más la parte repartida de los costos adicionales dividida entre la cantidad.
- **RF-25.** WHEN el comprador edita a mano el costo final de una línea THE SYSTEM SHALL usar ese valor y no recalcularlo al cambiar los costos adicionales o el método de reparto.
- **RF-26.** WHEN se guarda una compra THE SYSTEM SHALL conservar en cada línea el precio de factura y el costo final por separado.
- **RF-27.** WHEN se guarda una compra THE SYSTEM SHALL fijar el costo del producto de cada línea con el costo final de esa línea.

**Efecto en el inventario**

- **RF-28.** WHEN se guarda una compra THE SYSTEM SHALL sumar la cantidad de cada línea al stock de su producto.
- **RF-29.** WHEN se guarda una compra THE SYSTEM SHALL registrar por cada línea un movimiento de inventario de tipo `entrada` con referencia `compra`, con el stock antes y después, enlazado a la compra.
- **RF-30.** WHEN se guarda una compra THE SYSTEM SHALL aplicar todos sus efectos (productos, stock, costos, movimientos y la compra misma) en una sola transacción, de modo que si algo falla no se guarda nada.
- **RF-31.** IF falla el guardado de una compra THEN THE SYSTEM SHALL indicar la línea que causó el fallo.
- **RF-32.** WHEN, entre la pantalla y el guardado, otro usuario crea un producto con el SKU de una línea marcada como nueva THE SYSTEM SHALL reclasificar la línea como producto existente y pedir confirmación antes de guardar.
- **RF-33.** WHEN el comprador pulsa guardar THE SYSTEM SHALL mostrar una confirmación con cuántos productos se crearán, cuántos se actualizarán y cuánto stock se sumará.

**Anulación**

- **RF-34.** WHEN un usuario con `compras.anular` anula una compra con un motivo THE SYSTEM SHALL marcarla como anulada, conservando la compra y el motivo.
- **RF-35.** WHEN se anula una compra sin motivo THE SYSTEM SHALL rechazar la anulación.
- **RF-36.** WHEN se anula una compra THE SYSTEM SHALL restar de cada producto el stock que sumó y registrar un movimiento de inventario de tipo `salida` con referencia `anulacion_compra`, enlazado a la compra.
- **RF-37.** IF anular una compra dejaría el stock de algún producto por debajo de cero THEN THE SYSTEM SHALL bloquear la anulación indicando el producto y la cantidad que falta.
- **RF-38.** WHEN se anula una compra THE SYSTEM SHALL conservar los productos creados por ella y el costo actual de todos los productos.
- **RF-39.** WHEN se anula una compra THE SYSTEM SHALL avisar en pantalla que el costo de los productos debe revisarse.
- **RF-40.** WHEN se intenta anular una compra ya anulada THE SYSTEM SHALL rechazar la operación.

**Consulta**

- **RF-41.** WHEN un usuario con `compras.ver` abre la lista de compras THE SYSTEM SHALL mostrar las compras de su tienda, incluidas las anuladas con su estado, y permitir filtrarlas por proveedor y por fecha.
- **RF-42.** WHEN un usuario con `compras.ver` abre el detalle de una compra THE SYSTEM SHALL mostrar el proveedor, las líneas con precio de factura y costo final, los costos adicionales, los totales, el motivo si está anulada y un enlace a cada producto.
- **RF-43.** WHEN un usuario con permiso abre la ficha de un producto THE SYSTEM SHALL mostrar el historial de compras en las que aparece.

**Permisos y tienda**

- **RF-44.** WHEN un usuario sin `compras.ver` intenta acceder a cualquier ruta o pantalla del módulo THE SYSTEM SHALL denegar el acceso.
- **RF-45.** WHEN un usuario sin `compras.crear` intenta registrar una compra o un proveedor THE SYSTEM SHALL denegar la operación.
- **RF-46.** WHEN un usuario sin `compras.anular` intenta anular una compra THE SYSTEM SHALL denegar la operación.
- **RF-47.** WHEN una compra incluye una línea que crearía un producto y el usuario no tiene `productos.crear` THE SYSTEM SHALL rechazar la compra.
- **RF-48.** WHEN un usuario consulta o modifica compras y proveedores THE SYSTEM SHALL limitarse a los de su tienda, y responder "no encontrado" para los de otra tienda.
- **RF-49.** WHEN un usuario tiene `compras.ver` THE SYSTEM SHALL mostrar el apartado Compras en la barra lateral, con la lista de compras y la de proveedores.
- **RF-50.** WHEN un usuario no tiene `compras.ver` THE SYSTEM SHALL ocultar el apartado Compras de la barra lateral.
- **RF-51.** WHEN un usuario no tiene `compras.crear` o `compras.anular` THE SYSTEM SHALL ocultar las acciones de nueva compra y de anular, respectivamente.
- **RF-52.** WHEN se crea o se anula una factura de compra THE SYSTEM SHALL registrar la acción en la tabla de auditoría con el usuario, la tienda y la compra afectada.

## 5. Requisitos no funcionales

- **RNF-1.** Toda validación (SKU repetido, cantidades, reparto de costos, permisos, tienda) se hace en el servidor, sin confiar en lo calculado por la pantalla.
- **RNF-2.** Los montos y cantidades usan la misma precisión decimal que los productos y facturas existentes (dos decimales), sin errores de redondeo acumulados.
- **RNF-3.** Una compra de hasta 100 líneas se guarda dentro del mismo límite de tiempo de transacción que ya usan facturas y liquidaciones.
- **RNF-4.** Los cambios de base de datos se entregan como scripts SQL en `docs/sql/`, con marcha atrás, y no se aplican con `prisma db push`.
- **RNF-5.** Las tablas nuevas llevan el mismo aislamiento por tienda que las demás.
- **RNF-6.** Las rutas nuevas quedan cubiertas por la prueba de endpoints protegidos.
- **RNF-7.** La pantalla de compra es usable en un teléfono, con las líneas legibles sin desplazamiento horizontal de la página.

## 6. Criterios de aceptación

- [ ] Registrar una compra con un producto existente y otro nuevo crea el nuevo (sin imagen si no se subió), suma stock a ambos y deja dos movimientos de entrada con referencia `compra`.
- [ ] El costo de cada producto de la compra queda igual al costo final de su línea.
- [ ] Con 100 de flete y dos líneas de 300 y 700 de valor, el reparto por valor es 30 y 70; la suma repartida siempre es exactamente el total de extras.
- [ ] Un costo final editado a mano en una línea no cambia al modificar los costos adicionales.
- [ ] Una línea cuyo producto ya tiene color no cambia ese color aunque la línea traiga otro; sí se completan los campos que estaban vacíos.
- [ ] Un SKU nuevo con nombre parecido a otro producto no permite guardar hasta elegir entre ese producto y crear uno nuevo.
- [ ] Dos líneas con el mismo SKU, una cantidad cero o un precio negativo impiden guardar y señalan la línea.
- [ ] Un fallo en cualquier línea no deja productos, stock ni movimientos creados.
- [ ] Anular una compra con motivo devuelve el stock, deja movimientos inversos, conserva productos y costos, y muestra el aviso de revisar costos.
- [ ] Anular una compra cuya mercancía ya se vendió (stock insuficiente) se bloquea y nombra el producto y la cantidad faltante.
- [ ] Una compra con el mismo número de factura del mismo proveedor se rechaza mientras la anterior no esté anulada.
- [ ] Un usuario sin `compras.ver` no ve Compras en la barra lateral y recibe denegación en las rutas; sin `compras.crear` no ve "nueva compra"; sin `compras.anular` no ve "anular".
- [ ] Un usuario sin `productos.crear` no puede registrar una compra que cree productos.
- [ ] Un usuario de otra tienda recibe "no encontrado" al pedir una compra o proveedor ajeno.
- [ ] La ficha de un producto lista las compras en las que aparece.

## 7. Suposiciones y dependencias

- Suposición: el SKU es único por tienda entre productos activos, tal como ya garantiza la base.
- Suposición: la unidad de cantidad es la misma que la de los productos existentes (`stockActual`), con dos decimales.
- Suposición: un producto nuevo creado desde una compra queda activo y sin imagen salvo que se suba una.
- Suposición: los campos del producto con valor por defecto (por ejemplo stock mínimo) se consideran "vacíos" solo cuando son nulos; el criterio exacto por campo se fija en el diseño.
- Suposición: el control de número de factura repetido (RF-7) es por proveedor dentro de la tienda y se ignora para compras anuladas.
- Dependencia: el `ImageUploader`, la ruta `/api/upload/imagen` y `lib/storage.ts` existentes.
- Dependencia: la tabla `inventario_movimientos`, con `referenciaTipo` y `referenciaId`.
- Dependencia: el sistema de permisos por módulo y acción (`exigirTienda`, `PermissionProtector`, tabla `permisos`) y la barra lateral de `app/admin/layout.tsx`.
- Dependencia: ejecutar en Supabase los scripts SQL nuevos antes de publicar el código.

## 8. Preguntas abiertas

Ninguna. La ubicación exacta del apartado Compras dentro de los grupos de la barra lateral (RF-49) se decide en `design.md`, tras leer la estructura actual del menú.
