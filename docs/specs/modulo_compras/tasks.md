# Tasks — Módulo de compras

- **Fecha:** 2026-10-02 (implementado el 2026-10-03)
- **Estado:** Aprobado e implementado (iterado con planning-tasks: 13 tareas iniciales → 20)
- **Design:** [design.md](./design.md)
- **Requirements:** [requirements.md](./requirements.md)

## Convenciones

- Las tareas siguen orden de dependencia: las de arriba se implementan primero.
- Cada tarea referencia los RFs y componentes del design que cubre.
- Todo es por tienda: la tienda sale siempre de la sesión (`exigirTienda`), nunca del cuerpo de la petición.
- No se aplica `prisma db push` (borraría índices parciales). El SQL de `docs/sql/compras.sql` lo ejecuta **el usuario** en Supabase antes de publicar el código y antes de correr las pruebas de integración.
- **Nada se borra de la base:** el módulo solo agrega tablas, filas y columnas, y las pruebas solo crean datos.
- **Pruebas de integración (autorizadas solo para este módulo, hasta nuevo aviso del usuario):** se ejecutan únicamente con la cuenta y la tienda de prueba, con el servidor local levantado. Las credenciales se pasan como variables de entorno y nunca se escriben en archivos del repositorio ni en respuestas. Los datos que crean llevan el prefijo `TEST-` y no se borran.
- Los criterios marcados con [x] se verificaron (con prueba automática o comprobación directa); los que quedan sin marcar se explican en su nota.

## Tareas

### TASK-1: Crear el SQL, el schema de Prisma y los permisos del módulo

- **Cubre:** RF-7, RNF-4, RNF-5 (habilita RF-44, RF-45, RF-46 y RF-48, que se cumplen en las rutas)
- **Componente:** `docs/sql/compras.sql`, `prisma/schema.prisma`, `prisma/seed-permisos.ts`
- **Tipo:** setup
- **Estado:** completada (`compras.sql` ejecutado en Supabase el 2026-10-03: las 4 tablas existen y hay 31 permisos)

**Criterio de done:**
- [x] El SQL no tiene ningún `DROP` ni `DELETE` activo: solo aparecen dentro de la marcha atrás comentada.
- [ ] El SQL se puede ejecutar dos veces sin error. (Idempotente por construcción con `IF NOT EXISTS` y `ON CONFLICT`; se ejecutó una sola vez, no se repitió.)
- [x] La comprobación final lista RLS, índices y permisos de las tablas nuevas.
- [x] Los tres permisos están en el SQL y en `seed-permisos.ts` con el mismo `orden`.
- [x] `prisma generate` y `tsc --noEmit` salen limpios.
- [x] El schema avisa en un comentario que el índice parcial vive en el SQL.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | El único de NIT es un índice único normal `(tienda_id, nit)`, no parcial. | Postgres no compara los NULL entre sí, así que no choca entre proveedores sin NIT. Al ser normal, Prisma lo declara con `@@unique`, como `clientes`. Solo el de factura de proveedor es parcial (`estado <> 'anulada'`) y vive en el SQL. |
| 2026-10-03 | Las llaves foráneas de `compras` hacia `proveedores` y de `compras_items` hacia `productos` no llevan `ON DELETE CASCADE`. | Un proveedor o producto con compras no debe poder borrarse en silencio; solo las líneas y extras caen con su compra. Coincide con "nada se borra". |
| 2026-10-03 | Se agregaron restricciones `CHECK` en la base (cantidad > 0, precio ≥ 0, valor de extra > 0, método y estado con valores fijos). | Una segunda barrera por si algo llegara a la base sin pasar por la validación de la API. |

---

### TASK-2: Implementar la lógica pura de compras con sus pruebas

- **Cubre:** RF-10, RF-16, RF-17, RF-22, RF-23, RF-24, RF-25, RNF-2
- **Componente:** `lib/compras.ts`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Con 100 de extras y líneas de 300 y 700, el reparto por valor es 30 y 70; por cantidad respeta las cantidades.
- [x] La suma repartida es exactamente el total, también cuando todas las líneas valen cero.
- [x] El centavo sobrante va a la línea de mayor valor.
- [x] El costo final es `precio + extra repartido / cantidad`, redondeado a dos decimales.
- [x] Un costo final manual no cambia al variar los extras ni el método.
- [x] `camposACompletar` llena solo campos nulos, devuelve las diferencias entre el valor actual y el escrito, y nunca toca nombre, categoría, precio de venta ni stock mínimo.
- [x] `nombresParecidos` ignora tildes y mayúsculas y devuelve como máximo el límite pedido.
- [x] `npm test` pasa.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | Dos nombres se consideran parecidos desde 0,6 de parecido (palabras en común / palabras en total), o 0,9 si uno contiene al otro. | Con 0,5 "Porcelanato Marfil 60x60" y "…80x80" saltaban como parecidos; con 0,6 no, y "Baldosa 1", "Baldosa 2"… de una misma serie tampoco se avisan entre sí. |
| 2026-10-03 | Todo el sobrante del redondeo (puede ser más de un centavo si hay muchas líneas) va a la línea de mayor peso. | Mantiene la suma exacta sin repartir centavo a centavo. |
| 2026-10-03 | Si todas las líneas valen cero, el reparto por valor cae al de cantidad; si tampoco hay cantidades, se reparte por igual. | Evita dividir entre cero y siempre suma el total. |
| 2026-10-03 | En los campos numéricos (espesor, m² por caja, precio de bodega) un 0 no cuenta como dato; el texto `proveedor` del producto sí se puede completar. | Un 0 en esos campos es "no sé", no un valor real. |
| 2026-10-03 | Se reutiliza `normalizarBusqueda` de `lib/paginacion.ts` en vez de duplicar la normalización. | Es la misma que usa la columna `nombre_busqueda`. |

---

### TASK-3: Agregar los esquemas de validación de compras y proveedores

- **Cubre:** RF-1, RF-6, RF-12, RF-13, RF-14, RF-21, RF-35, RNF-1 (RF-12 y RF-14 se revalidan en TASK-6)
- **Componente:** esquemas `compraNueva`, `proveedorNuevo`, `compraAnulacion` y `compraVerificar` en `lib/esquemas.ts`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Se rechaza compra sin proveedor, sin fecha o sin líneas.
- [x] Se rechaza SKU repetido (ignorando mayúsculas y espacios), cantidad cero, precio negativo, más de 100 líneas y extra sin valor.
- [x] Una línea sin `productoId` y sin `precioUnitario` se rechaza; con `productoId` se acepta.
- [x] `proveedorNuevo` acepta solo el nombre y rechaza nombre vacío o correo inválido.
- [x] `compraAnulacion` rechaza un motivo vacío.
- [ ] Una `imagenUrl` de otro servidor se rechaza. (Cambiado: se acepta cualquier dirección **https**; ver el log.)

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | La imagen acepta cualquier dirección `https`, no solo las del Storage del proyecto. Rechaza `http`, `javascript:` y lo que no sea una URL. | El selector de imagen deja pegar una dirección web, igual que el formulario de productos; limitarlo solo en compras habría sido inconsistente. |
| 2026-10-03 | `nombre`, `categoria` y `precioUnitario` son opcionales en el esquema y se exigen con `superRefine` solo en las líneas sin `productoId`. | Una línea de producto existente no necesita esos datos. El precio de venta de un producto nuevo debe ser mayor que cero. |
| 2026-10-03 | Una fecha sin hora (`2026-10-03`) se guarda a mediodía UTC. | A medianoche UTC caería en el día anterior para quien está en Colombia (UTC-5). |
| 2026-10-03 | Máximo 20 costos adicionales por compra, y `compraAnulacion` admite hasta 1000 caracteres de motivo. | Topes razonables que el diseño no fijaba. |

---

### TASK-4: Crear las rutas de proveedores

- **Cubre:** RF-1, RF-2, RF-3, RF-4, RF-45, RF-48
- **Componente:** `/api/proveedores` y `/api/proveedores/[id]`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Crear y editar funcionan con solo el nombre; el resto es opcional.
- [x] Un NIT repetido en la misma tienda devuelve 409 en crear y en editar; un NIT vacío no choca.
- [x] Un `PATCH` de un proveedor inexistente responde 404, y también el de un proveedor **de otra tienda** (probado con la cuenta B en su propia tienda; ver `e2e/compras-permisos.spec.ts`).
- [x] Editar un proveedor no altera las compras que ya lo usan (las compras lo enlazan por id).
- [x] Sin sesión responde 401; los permisos se comprueban con `exigirTienda`. (No se probó con una cuenta sin el permiso: solo hay la cuenta de la tienda de prueba.)
- [x] Las pruebas de integración de proveedores pasan contra la tienda de prueba y no borran nada.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | `GET` devuelve `{ proveedores, total }` paginado (10 por página, búsqueda por nombre o NIT desde 3 letras). | Igual que clientes; la pantalla y el selector usan la misma ruta. |
| 2026-10-03 | `PATCH` reemplaza todos los campos (el nombre sigue siendo obligatorio), no es una actualización parcial. | El formulario siempre manda el proveedor completo. |
| 2026-10-03 | Un id que no es uuid responde 404, y un error inesperado responde 500 (clientes usa 400). | Un id inventado no debe dar error de base. |
| 2026-10-03 | Para correr las pruebas de integración se levantó el servidor de desarrollo en segundo plano y las credenciales de la cuenta de prueba se pasaron por un archivo de variables en la carpeta temporal, fuera del proyecto. | El usuario autorizó pruebas solo con esa cuenta y tienda. |

---

### TASK-5: Crear la ruta que clasifica las líneas de la compra

- **Cubre:** RF-9, RF-10, RF-45, RF-48
- **Componente:** `/api/compras/verificar` y `lib/compras-clasificar.ts`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Un SKU existente en la tienda devuelve el producto completo; uno inactivo se trata como nuevo, y uno de **otra tienda** también (visto desde la tienda B, el SKU de A sale como `nuevo`).
- [x] Un SKU nuevo con nombre parecido devuelve hasta tres candidatos.
- [x] Un SKU nuevo sin parecidos devuelve `nuevo`.
- [x] Sin sesión responde 401 y más de 100 líneas se rechaza.
- [x] Hace una consulta de SKU y otra de candidatos por petición, sin importar el número de líneas.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | Un producto inactivo no cuenta como existente. | El índice único del SKU solo mira los activos, así que su SKU está libre. |
| 2026-10-03 | Los candidatos de nombres parecidos se preseleccionan con las palabras del nombre (hasta 6 por línea, de 3 letras o más) sobre `nombre_busqueda`, con un tope de 1.000, y se afinan en memoria. | No baja el catálogo entero de la tienda, y sigue siendo una sola consulta. |
| 2026-10-03 | Los `Decimal` del producto se convierten a números en la respuesta. | Así llegan como números al navegador, no como texto. |

---

### TASK-6: Registrar la compra, parte 1: validar y clasificar sin escribir

- **Cubre:** RF-6, RF-7, RF-10, RF-12, RF-13, RF-14, RF-45, RF-47, RF-48, RNF-1
- **Componente:** `POST /api/compras` (validación y clasificación)
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Un proveedor que no existe en la tienda responde 404.
- [x] Una factura de proveedor repetida responde 409 con la compra existente, salvo que esa esté anulada.
- [x] Un SKU nuevo con parecidos sin `confirmadoNuevo` responde 409 con la línea y los candidatos.
- [x] Sin `productos.crear`, una compra que crea productos responde 403 y no deja nada creado (probado con la cuenta B con solo `compras.ver` y `compras.crear`).
- [x] Los cuerpos inválidos responden 400.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | El permiso `productos.crear` se exige al principio si alguna línea no trae `productoId`, aunque luego esa línea resultara ser un SKU ya existente. | Más simple y más seguro que decidirlo tras clasificar. |
| 2026-10-03 | Un mismo producto en dos líneas (con SKU distinto escrito) se rechaza con 400. | Sumaría stock dos veces al mismo producto en una sola operación. |
| 2026-10-03 | Los 409 incluyen `linea` (empezando en 1) y `tipo` (`sku_existe`, `parecidos`, `producto_inexistente`). | La pantalla reclasifica la línea concreta. |

---

### TASK-7: Registrar la compra, parte 2: persistir la compra y sus efectos

- **Cubre:** RF-15, RF-16, RF-17, RF-18, RF-19, RF-22, RF-23, RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31, RF-32, RNF-2, RNF-3
- **Componente:** `POST /api/compras` (transacción)
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Una compra con un producto nuevo y uno existente deja: producto creado (sin imagen si no se envió), stock sumado, costo igual al costo final de la línea y un movimiento por línea enlazado a la compra.
- [x] Un producto existente con color no lo cambia; sí se llenan los campos nulos y la imagen si faltaba; un producto con imagen conserva la suya.
- [x] Un fallo en cualquier punto de la transacción deja la base sin cambios (probado forzando un desbordamiento numérico a mitad de la compra).
- [x] Un SKU creado por otro usuario mientras tanto responde 409 con la línea.
- [x] La respuesta informa las diferencias no aplicadas.
- [x] La suma repartida de extras coincide con el total guardado.
- [x] Una compra de 100 líneas se guarda dentro del límite de la transacción (5,9 s).
- [ ] Un fallo de base de datos a mitad de la compra indica **la línea** que lo causó (RF-31). Solo se indica la línea en los errores de datos y de SKU repetido; un fallo interno de la base responde un 500 genérico. Ver el log.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | Las escrituras van por lotes: `createMany` para productos, ítems y movimientos, y **una sola sentencia SQL** que suma el stock y fija el costo de todos los productos. | Con una consulta por línea, 100 líneas contra la base remota no cabían en los 20 s. Además la suma sobre el valor actual de la base es atómica (no lee y reescribe). |
| 2026-10-03 | Los productos nuevos reciben su id generado en el servidor antes de crearse. | `createMany` no devuelve los ids y hacen falta para enlazar ítems y movimientos. |
| 2026-10-03 | Un fallo interno de la base a mitad de la transacción responde un 500 genérico, sin la línea. | Con escrituras por lotes la base no dice qué fila falló. Los errores atribuibles a una línea (validación, SKU que apareció, producto que ya no existe) sí la indican. |
| 2026-10-03 | Los productos nuevos guardan el nombre del proveedor en su campo de texto `proveedor`, y esa diferencia nunca se avisa en `diferencias`. | Mantiene el campo existente al día sin generar ruido. |
| 2026-10-03 | Ante un choque de índice único (carrera), se vuelve a clasificar fuera de la transacción para decir en qué línea. | Lo pide RF-32. |

---

### TASK-8: Registrar la compra, parte 3: auditoría y pruebas de la ruta

- **Cubre:** RF-52 (creación), verifica RF-30
- **Componente:** auditoría de `POST /api/compras` y `tests/integration`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Queda una fila de auditoría por cada compra creada.
- [x] Si falla la auditoría, la compra sigue siendo válida y el error queda en el log (try/catch fuera de la transacción).
- [x] Las pruebas de integración de la ruta pasan contra la tienda de prueba, con datos `TEST-` y sin borrar nada.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | En las pruebas, las líneas nuevas llevan un nombre con una palabra aleatoria y no el prefijo de fecha de los productos de prueba. | Todos los productos de prueba compartían ese prefijo y por eso "se parecían" entre sí y la compra pedía confirmar. El SKU sí lleva `TEST-`. |

---

### TASK-9: Crear las rutas de consulta de compras y de historial

- **Cubre:** RF-41, RF-42, RF-43, RF-44, RF-48
- **Componente:** `GET /api/compras`, `GET /api/compras/[id]`, `GET /api/productos/[id]/compras`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] La lista filtra por proveedor y por fecha, y muestra las anuladas con su estado.
- [x] El detalle devuelve proveedor, líneas con precio de factura y costo final, extras, totales y motivo.
- [x] Una compra inexistente o con un id mal formado responde 404; sin sesión responde 401.
- [x] El historial de un producto trae solo compras de su tienda. (Con otra tienda no se probó: ver TASK-19.)

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | Los filtros de fecha se llaman `fechaDesde` y `fechaHasta` (el diseño decía `desde` y `hasta`). | En este proyecto `desde` ya es el desplazamiento de la paginación: `desde=2026-02-01` se leía como "saltar 2026 filas". |
| 2026-10-03 | Un filtro de proveedor mal formado devuelve una lista vacía, no un error. | Un id inventado no debe dar un error de base. |
| 2026-10-03 | El historial de un producto trae como máximo 50 compras. | Evita respuestas enormes. |

---

### TASK-10: Crear la ruta de anulación

- **Cubre:** RF-34, RF-35, RF-36, RF-37, RF-38, RF-40, RF-46, RF-48, RF-52 (anulación)
- **Componente:** `POST /api/compras/[id]/anular`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Anular con stock suficiente devuelve el stock, deja los movimientos de salida y conserva productos (también el creado en la compra) y costos.
- [x] Anular con stock insuficiente se deshace por completo (incluido lo que sí alcanzaba) y responde 409 con el producto y la cantidad faltante.
- [x] Anular sin motivo responde 400 y anular una ya anulada responde 409 sin restar otra vez.
- [x] Una compra inexistente o con un id mal formado responde 404; sin sesión responde 401. (Ajena de otra tienda: ver TASK-19.)
- [x] La anulación queda auditada.
- [x] Tras anular, la misma factura del proveedor se puede volver a registrar.
- [x] Las pruebas de integración pasan contra la tienda de prueba y no borran nada.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | El stock se resta con una sola sentencia condicionada (`stock_actual >= cantidad`); si alguna fila no alcanza, se lanza un error y se deshace todo. | Es atómica y no deja anulaciones a medias. |
| 2026-10-03 | La anulación queda en la auditoría con la acción `UPDATE`. | Es la que usan las facturas para los cambios de estado. |
| 2026-10-03 | La respuesta incluye `revisarCostos: true`. | La anulación no restaura el costo (RF-39) y la pantalla lo avisa. |

---

### TASK-11: Ampliar el permiso de subida de imágenes a quien compra

- **Cubre:** RF-18, RF-19, RF-20 (habilita), RF-45
- **Componente:** `lib/imagen-permisos.ts` y `/api/upload/imagen` (POST y DELETE)
- **Tipo:** setup
- **Estado:** completada

**Criterio de done:**
- [x] Un usuario con `compras.crear` puede subir imágenes a la carpeta `productos`, y borrar las recién subidas.
- [x] Un usuario sin ninguno de esos permisos sigue recibiendo 403.
- [x] La carpeta `logos` y sus permisos no cambian.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | Quien solo tiene `compras.crear` puede **borrar** únicamente imágenes subidas en la última hora; quien tiene permisos de productos o logos conserva lo de antes. | La ruta de borrado no dice de qué tienda es cada imagen: ampliarla sin límite le habría dado a un comprador poder para borrar cualquier imagen de producto. |
| 2026-10-03 | Para ese caso solo se aceptan rutas con la forma exacta que genera la subida. | Cierra intentos de salirse de la carpeta con `..`. |
| 2026-10-03 | No se tocó el borrado de quien ya tenía permisos de productos. | Fuera de alcance. Observación: hoy esa ruta no valida la forma de `ruta`, así que quien edita productos podría apuntar a otra carpeta del mismo almacenamiento. Conviene revisarlo aparte. |
| 2026-10-03 | La lógica de permisos de imágenes se sacó a `lib/imagen-permisos.ts`. | Para poder probarla sin servidor (15 pruebas). |

---

### TASK-12: Crear la pantalla de proveedores

- **Cubre:** RF-1, RF-2, RF-3, RF-4, RF-44, RF-51 (crear y editar)
- **Componente:** `app/admin/proveedores` y `components/compras/FormularioProveedor.tsx`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Un usuario con solo `compras.ver` ve la lista pero no los botones de crear ni editar.
- [x] Se puede crear un proveedor con solo el nombre.
- [x] Crear y editar refleja el cambio en la lista (recarga la lista).
- [x] Un NIT repetido muestra el mensaje del servidor.
- [x] Un usuario sin ningún permiso de compras no ve el menú ni accede a la pantalla (probado en un navegador con la cuenta B sin permisos).

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | El formulario no usa su propio `<form>`; Enter en un campo guarda. | La pantalla de compra lo muestra dentro de otro formulario y los formularios no se pueden anidar. |
| 2026-10-03 | La lista usa la misma paginación de 10 en 10 con "Ver más" y búsqueda por Enter que clientes. | Coherencia con el resto del panel. |

---

### TASK-13: Crear la pantalla de nueva compra, parte 1: encabezado

- **Cubre:** RF-5, RF-6
- **Componente:** `app/admin/compras/nueva` y `components/compras/SelectorProveedor.tsx`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Se puede buscar un proveedor existente y elegirlo.
- [x] Se puede crear un proveedor al vuelo y queda seleccionado.
- [x] No deja guardar sin proveedor. (La fecha arranca con el día de hoy; no se probó vaciarla.)

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | El selector busca con una pausa de 300 ms, trae 8 resultados y sin texto muestra los primeros por orden alfabético. | No consulta en cada letra. |
| 2026-10-03 | El selector admite `etiqueta` y `permitirCrear` opcionales. | Se reutiliza como filtro en la lista de compras, sin ofrecer crear. |

---

### TASK-14: Crear la pantalla de nueva compra, parte 2: líneas

- **Cubre:** RF-8, RF-9, RF-10, RF-11, RF-17, RF-18, RF-19, RF-32, RNF-7
- **Componente:** `components/compras/LineaCompraEditor.tsx`, `lib/compras-cliente.ts`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Una línea con SKU existente muestra el producto, lo que ya tiene y las diferencias sin sobrescribir.
- [x] Un SKU nuevo con parecidos no deja guardar hasta elegir una opción.
- [x] Elegir "es ese producto" convierte la línea en existente.
- [x] Un 409 de SKU creado mientras tanto reclasifica la línea.
- [x] En un teléfono no hay desplazamiento horizontal de la página (probado en un navegador con una pantalla de 390 px, con dos líneas y costos adicionales; ver `e2e/compras.spec.ts`). La página queda larga, porque cada línea muestra todos sus campos opcionales.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | En un producto existente los campos (color, acabado…) quedan editables y vacíos, con "Tiene: X" de placeholder, y avisan en vivo cuando lo escrito difiere de lo que el producto ya tiene. | Cumple RF-16 y RF-17: se puede completar lo vacío y se ve la diferencia sin sobrescribir. |
| 2026-10-03 | La imagen solo se pide en productos nuevos o existentes que no tienen; si ya tienen, se avisa que no se cambia desde una compra. | Mismo criterio de "completar lo vacío". |
| 2026-10-03 | Se verifica al salir del campo SKU y del nombre, y se reinicia la verificación si se edita alguno. | Que lo mostrado corresponda siempre a lo escrito. |
| 2026-10-03 | Se agregó `onSubida` opcional a `ImageUploader`, que se llama solo al subir un archivo (no al pegar una dirección). | Para saber qué imágenes son nuestras y borrar las huérfanas. No cambia a quienes no la usan. |
| 2026-10-03 | La lógica de la pantalla (conversión de textos, costos, validación, cuerpo a enviar) está en `lib/compras-cliente.ts` y se prueba aparte (21 pruebas). | Usa las mismas funciones que el servidor. |
| 2026-10-03 | Lo opcional de cada línea (dimensiones, color, acabado, espesor, m² por caja, precio de bodega, stock mínimo, descripción e imagen) va en una sección plegada "Más datos del producto (opcional)". Cerrada, su encabezado resume cuántos datos hay escritos y avisa si alguno difiere de lo que ya tiene el producto. Se oculta con `hidden` y no se desmonta. El resumen de totales pasa a dos columnas en el celular. | En el celular la pantalla con dos líneas medía unos 4.600 px y ahora 2.822 px. Siempre a la vista quedan SKU, cantidad, precio de factura y, en un producto nuevo, nombre, categoría y precio al público. Se oculta y no se desmonta para no perder el estado de una imagen que se esté subiendo. |
| 2026-10-03 | **Corrección tras probar en un navegador:** si el nombre del producto nuevo se escribe mientras todavía se verifica el SKU, esa verificación se repite con el nombre actual (hasta tres veces). | Antes la respuesta "nuevo" se pedía con el nombre viejo y el aviso de nombres parecidos no salía nunca. Lo encontró la prueba de Playwright; ahora también lo cubre una prueba de componente. |

---

### TASK-15: Crear la pantalla de nueva compra, parte 3: costos, resumen y guardado

- **Cubre:** RF-20, RF-21, RF-22, RF-24, RF-25, RF-33
- **Componente:** `app/admin/compras/nueva`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Cambiar los extras o el método recalcula los costos finales, salvo los editados a mano.
- [x] La confirmación muestra cuántos productos se crean, cuántos se actualizan y cuánto stock se suma.
- [x] Si el guardado falla por un error del servidor, las imágenes subidas en ese intento se borran.
- [x] Tras guardar, lleva al detalle de la compra.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | Las imágenes subidas se borran si falla el guardado por un error del servidor (500) o de red, y si se sale de la pantalla sin guardar; **se conservan** ante errores de datos (400, 409). | RF-20 pide borrarlas ante cualquier fallo, pero un 409 (por ejemplo, nombres parecidos) se corrige y se reintenta: borrar la imagen obligaría a subirla otra vez. |
| 2026-10-03 | Ante un error de red se avisa que no se sabe si se guardó y que se revise la lista antes de repetir. | Evita registrar la misma compra dos veces. |
| 2026-10-03 | La lista de líneas vive en una referencia que se actualiza de forma síncrona y el estado solo la refleja. | Al guardar siempre se lee lo último, aunque una verificación acabe de terminar. |
| 2026-10-03 | La confirmación usa `window.confirm`, como las liquidaciones. | Coherencia con el resto del panel. |
| 2026-10-03 | **Corrección tras probar en un navegador:** "Registrar compra" espera a que terminen las verificaciones de SKU en curso, y las repite si quedaron desactualizadas, antes de validar. | Pulsarlo mientras una línea seguía en "Verificando…" se detenía con "Revisa las líneas marcadas" aunque estaba a punto de resolverse. Lo encontró Playwright; lo cubre una prueba de componente. |

---

### TASK-16: Crear las pantallas de lista y detalle de compras, con anulación

- **Cubre:** RF-39, RF-41, RF-42, RF-44, RF-46, RF-51
- **Componente:** `app/admin/compras`, `app/admin/compras/[id]`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] La lista muestra las anuladas con su estado y filtra por proveedor y fecha.
- [x] "Nueva compra" solo aparece con `compras.crear`.
- [x] El botón de anular solo aparece con `compras.anular` y exige motivo.
- [x] Tras anular se muestra el aviso de revisar los costos.
- [x] Si la anulación se bloquea por stock, se muestra el mensaje del servidor con el producto y la cantidad faltante.
- [x] Una compra inexistente muestra "Compra no encontrada".

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | El detalle enlaza cada producto a su ficha y marca los que se crearon en esa compra y los costos ajustados a mano. | Más contexto para revisar la compra. |
| 2026-10-03 | Anular pide confirmación además del motivo. | Es una acción que mueve inventario. |

---

### TASK-17: Mostrar el historial de compras en la ficha del producto

- **Cubre:** RF-43
- **Componente:** `components/compras/HistorialDeCompras.tsx` y `app/admin/productos/[id]`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Lista las compras con enlace a cada una y marca las anuladas.
- [x] Muestra un estado vacío si no hay compras.
- [x] Sin permiso o con un error (403 o de red) no muestra nada y no rompe la edición del producto.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | La sección va fuera del `<form>`, después de él. | No afecta ni se envía con el formulario de edición. |
| 2026-10-03 | Sin `compras.ver` ni siquiera se hace la consulta. | Evita un 403 innecesario. |

---

### TASK-18: Agregar Compras a la barra lateral

- **Cubre:** RF-49, RF-50
- **Componente:** grupo "Compras" en `app/admin/layout.tsx`
- **Tipo:** feature
- **Estado:** completada

**Criterio de done:**
- [x] Un usuario con `compras.ver` ve el grupo con sus dos ítems.
- [x] Un usuario sin `compras.ver` no ve el grupo ni los ítems.
- [x] Un administrador de la tienda lo ve.
- [x] `/admin/compras/nueva` y `/admin/compras/[id]` resaltan Compras y no Proveedores; `/admin/proveedores` resalta Proveedores.

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | El grupo "Compras" va debajo de Ventas y encima de Administración (donde está Configuración). Orden final: Catálogo, Ventas, Compras, Administración. | Primero se puso entre Catálogo y Ventas; el usuario pidió moverlo. Una prueba fija el orden. |
| 2026-10-03 | Quien solo tiene `compras.crear` o `compras.anular`, sin `compras.ver`, no ve el grupo. | Lo pide RF-49 y lo prueba un caso. Conviene dar `compras.ver` junto con los otros dos. |

---

### TASK-19: Cubrir seguridad y aislamiento entre tiendas

- **Cubre:** RF-45, RF-46, RF-48, RNF-6
- **Componente:** `tests/unit/endpoints-protegidos.test.ts`
- **Tipo:** test
- **Estado:** completada

**Criterio de done:**
- [x] Las 7 rutas nuevas están en `DE_DATOS` y la prueba estática pasa.
- [x] Cada ruta de compras pide el permiso de su acción (anular solo `compras.anular`, el listado `compras.ver`, registrar `compras.crear`).
- [x] Con una segunda cuenta (B) que está en dos tiendas, estando en la suya no lee ni modifica compras, proveedores, historial ni productos de la tienda de pruebas, ni registra compras con el proveedor o el producto de esa tienda (`e2e/compras-permisos.spec.ts`).

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | Se agregó un caso que comprueba, leyendo el código, que anular no mezcla permisos con registrar ni ver. | `exigirTienda` solo prueba que haya alguno de la lista; esto asegura que cada ruta pide el suyo. |
| 2026-10-03 | El aislamiento entre tiendas se apoya en que toda consulta filtra por `{ id, tiendaId }` y la prueba estática exige `exigirTienda`. | Se comprobó además de extremo a extremo con la cuenta B (ver abajo). |
| 2026-10-03 | Se creó una segunda cuenta de prueba (B) **desde la pantalla de registro**, con su propia tienda, y se unió a la tienda de pruebas A pidiendo acceso con el código y aprobándolo la administradora, todo por pantalla. Sus permisos en A los fija la administradora con la propia API de la aplicación. | Lo autorizó el usuario para poder probar permisos y aislamiento. La contraseña de B vive solo en un archivo de variables fuera del repositorio. Al terminar, B queda sin permisos de compras en A (mínimo privilegio). |

---

### TASK-20: Verificación final del módulo

- **Cubre:** RNF-2, RNF-3, RNF-4, RNF-7, criterios de aceptación completos
- **Componente:** módulo completo
- **Tipo:** test
- **Estado:** completada (con lo que no se pudo comprobar anotado abajo)

**Criterio de done:**
- [x] Tipos (`tsc --noEmit`), lint (0 errores) y pruebas pasan; el build de producción pasa.
- [x] Los criterios de aceptación de `requirements.md` se cubren con pruebas automáticas: unitarias, de componente, de integración contra la tienda de prueba y **de navegador con Playwright** (25 pruebas en `e2e/compras*.spec.ts`: menú, proveedores, nueva compra completa, parecidos, anulación, historial, celular, permisos y aislamiento entre tiendas).
- [x] Una compra de 100 líneas se guarda sin agotar el tiempo (5,9 s).
- [x] En un teléfono, las pantallas de compras no tienen desplazamiento horizontal (RNF-7): nueva compra, lista, detalle y proveedores, con una pantalla de 390 px.
- [x] Los montos de la compra de prueba usan dos decimales y la suma repartida coincide con el total (RNF-2).
- [x] `npm run backup` termina sin errores y el JSON trae los 4 modelos nuevos (`proveedor`, `compra`, `compraItem`, `compraCostoExtra`).

**Log de decisiones:**
| Fecha | Decisión | Contexto |
|---|---|---|
| 2026-10-03 | Para correr el build hubo que cerrar el servidor de desarrollo que se había levantado en esta sesión. | Ambos usan la carpeta `.next` y el motor de Prisma; con el servidor abierto el build fallaba con `EPERM`. |
| 2026-10-03 | Las pruebas de integración dejaron datos `TEST-` en la tienda de prueba (productos, proveedores y compras). | Es la política del proyecto: no se limpian. |
