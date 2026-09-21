# Manual de uso — Inventarios Beraca

Guía para el día a día: cargar productos, atender pedidos, facturar y consultar cómo va el negocio.

---

## Índice

1. [Entrar al sistema](#entrar-al-sistema)
2. [Qué ve cada persona](#qué-ve-cada-persona)
3. [Productos](#productos)
4. [Inventario](#inventario)
5. [Clientes](#clientes)
6. [Facturas](#facturas)
7. [Abonos y pagos](#abonos-y-pagos)
8. [Reportes](#reportes)
9. [El catálogo para clientes](#el-catálogo-para-clientes)
10. [Configuración](#configuración)
11. [Preguntas frecuentes](#preguntas-frecuentes)
12. [Cuando algo sale mal](#cuando-algo-sale-mal)

---

## Entrar al sistema

El sistema tiene dos caras:

**El catálogo**, que es la página principal. Es público: cualquier persona puede verlo sin contraseña. Ahí tus clientes miran los productos y arman su pedido.

**El panel de administración**, en `/admin`. Requiere usuario y contraseña. Es donde trabaja el equipo.

Para entrar al panel, haz clic en **Ingresar** arriba a la derecha, escribe tu correo y contraseña. Si te equivocas, el sistema te avisa y puedes reintentar.

Si no tienes cuenta, un administrador debe crearla desde **Gestión de Usuarios**.

---

## Qué ve cada persona

No todos ven lo mismo. El menú de la izquierda muestra únicamente las secciones a las que tienes acceso, según tu rol:

| Rol | Qué puede usar |
|---|---|
| **Owner / Admin** | Todo el sistema, incluida la configuración y la gestión de usuarios |
| **Vendedor** | Clientes, facturas y reportes |
| **Bodega** | Productos e inventario |

Si necesitas algo que no aparece en tu menú, no es un error: pídele a un administrador que ajuste tu rol.

---

## Productos

El catálogo de lo que vendes: baldosas, cerámicas y porcelanatos.

### Crear un producto

En **Productos → + Nuevo Producto**. Los campos obligatorios son:

- **SKU** — el código único. No puede repetirse; si lo intentas, el sistema avisa
- **Nombre** — como lo reconoce el cliente
- **Categoría** — baldosa, cerámica o porcelanato
- **Precio unitario** — por metro cuadrado
- **Stock actual** — cuántos m² tienes hoy

Los demás campos son opcionales pero valen la pena, porque **es lo que ve tu cliente en el catálogo**: dimensiones, color, acabado, m² por caja y la imagen.

> Los campos numéricos no se modifican al pasar la rueda del ratón por encima. Puedes desplazarte por el formulario sin miedo a cambiar un precio sin darte cuenta.

### Stock mínimo

Es el punto en que consideras que hay que reponer. Cuando el stock baja de ese número, el producto aparece marcado como **STOCK BAJO** en la lista y sale un aviso en el tablero principal.

Si lo dejas en cero, nunca te avisará. Vale la pena ponerle un valor real a cada producto.

### Editar y desactivar

**Editar** en la lista abre el mismo formulario con los datos cargados.

Los productos no se borran: se **desactivan**. Así no se rompen las facturas viejas que los mencionan. Un producto desactivado desaparece del catálogo público pero sigue en el historial.

---

## Inventario

Aquí ves y registras cada movimiento de mercancía.

### El historial

**Inventario** muestra todo lo que ha entrado y salido, con fecha, producto, cantidad, el stock antes y después, el motivo y quién lo hizo. Puedes filtrar por producto, por tipo de movimiento o por rango de fechas.

Los movimientos marcados con la etiqueta **auto** los generó el sistema al facturar. Los demás los registró alguien a mano.

### Registrar un movimiento

Con **+ Registrar Movimiento** eliges entre tres tipos:

| Tipo | Qué hace | Cuándo usarlo |
|---|---|---|
| ⬆️ **Entrada** | Suma al stock | Llegó mercancía del proveedor |
| ⬇️ **Salida** | Resta del stock | Rotura, muestra, pérdida |
| ⚖️ **Ajuste** | Fija el stock en el valor que escribas | Después de un conteo físico |

La diferencia importante está en el **ajuste**: ahí no escribes cuánto entró o salió, sino **cuánto hay realmente**. Si contaste 48 m² y el sistema dice 52, escribes `48` y el sistema corrige la diferencia.

Antes de guardar, el sistema te muestra cómo quedaría el stock (`52 → 48`) para que confirmes.

El **motivo es obligatorio**. Dentro de seis meses, cuando revises por qué desaparecieron 4 m², el motivo es lo único que te lo va a explicar.

---

## Clientes

En **Clientes** llevas el registro de a quién le vendes.

El dato clave es la **cédula o NIT**: no puede repetirse, y es lo que usarás para encontrar al cliente al facturar. Lo demás —teléfono, correo, dirección, término de pago, cupo de crédito— es opcional.

No necesitas crear el cliente antes de facturar. Al hacer una factura puedes escribir una cédula nueva y el sistema te ofrece crearlo en ese momento.

---

## Facturas

El corazón del sistema.

### Crear una factura

En **Facturas → Nueva Factura**:

**1. El cliente.** Busca por cédula. Si ya existe, sus datos se completan solos. Si no, aparece la opción de crearlo sobre la marcha.

**2. Los productos.** Búscalos por SKU o por nombre. Al elegir uno, su precio se carga automáticamente; puedes cambiarlo si acordaste otro con el cliente. Indicas cuántos metros cuadrados lleva.

También puedes agregar un **producto que no está en el catálogo**: escribes el nombre y el precio a mano. Sirve para servicios como instalación o transporte. Estos **no afectan el inventario**, porque no son mercancía de bodega.

**3. Descuento e impuesto**, si aplican. El total se recalcula solo.

**4. Guardar.** El sistema asigna el número —con formato `20260921-001`: fecha y consecutivo del día— y descuenta el stock de cada producto del catálogo.

> **Si no hay stock suficiente, la factura se crea igual.** Es a propósito: a veces se vende mercancía que está por llegar. El inventario baja hasta cero pero nunca queda en negativo, y el movimiento queda anotado indicando cuántos metros se facturaron sin respaldo.

### Estados

Una factura pasa por estos estados:

| Estado | Significa |
|---|---|
| **Pendiente** | Recién creada, sin pagar |
| **Pagado** | El cliente ya canceló |
| **Entregado** | La mercancía salió |
| **Anulada** | Se dejó sin efecto |

Desde el detalle de la factura la marcas como pagada, entregada o anulada.

### Descargar el PDF

En el detalle, **Descargar PDF** abre la factura con formato en una pestaña nueva y aparece el diálogo de impresión. Ahí eliges **"Guardar como PDF"** y listo.

La factura sale con los datos de tu empresa —nombre, NIT, dirección, teléfono y logo— tomados de la **Configuración**. Si esos campos están vacíos, la factura sale incompleta.

---

## Abonos y pagos

Cuando un cliente paga por partes, registras cada abono desde el detalle de la factura.

Anotas el monto, el método de pago y la fecha. El sistema lleva la cuenta del saldo pendiente y guarda quién registró cada abono.

Los abonos aparecen también en el PDF, para que el cliente vea cuánto lleva pagado y cuánto debe.

---

## Reportes

Dos vistas, en **Reportes**:

**📊 Facturación** — cuánto vendiste, cuántas facturas, el promedio por factura y cuál es tu mejor cliente. Puedes ver por día, por semana, por mes o elegir un mes concreto. Incluye las ventas por día y los diez productos que más ingresos dejaron.

**📦 Inventario** — qué se está moviendo y qué no. Muestra los productos bajo mínimo, los diez de mayor rotación en 30 días y los que no se han vendido en ese periodo, con cuánto dinero tienes detenido en ellos.

### El filtro de estados

En ambos reportes hay casillas para **Pagado**, **Entregado** y **Pendiente**.

Por defecto cuentan las facturas pagadas y entregadas. Si marcas también **Pendiente**, verás las ventas incluyendo lo que aún no te han pagado: útil para saber cuánto vendiste, distinto de cuánto cobraste.

---

## El catálogo para clientes

La página principal es pública y funciona así para tu cliente:

1. Ve los productos disponibles, con filtro por categoría
2. Al tocar **Agregar al carrito** se abre una ventana donde escribe cuántos m² necesita, y ve el total al instante
3. En el carrito ajusta cantidades o quita productos
4. Con **Enviar por WhatsApp** escribe su nombre y teléfono, y se le abre WhatsApp con el pedido ya redactado, listo para enviártelo

El mensaje te llega con el detalle completo: cada producto, los metros, el precio unitario y el total.

**Solo se muestran productos activos y con stock disponible.** Si un producto no aparece en el catálogo, revisa que esté activo y que tenga stock mayor a cero.

> El carrito vive en el navegador de tu cliente. Si cambia de teléfono o borra sus datos de navegación, el carrito se pierde. Es normal: no es una cuenta, es una lista temporal.

---

## Configuración

Solo para administradores, en **⚙️ Configuración**.

**Número de WhatsApp para pedidos** — a dónde llegan los pedidos del catálogo. Va con indicativo de país y sin espacios: `573001234567`. **Mientras no lo configures, el sistema le pide el número al cliente en cada pedido**, lo cual no tiene sentido para él.

**Datos de la empresa** — nombre, eslogan, NIT, teléfono, dirección y correo. Es lo que aparece en el encabezado de tus facturas.

**Logo** — la dirección web de tu imagen. Se muestra una vista previa para que confirmes que carga bien antes de guardar.

---

## Preguntas frecuentes

**¿Por qué un producto no sale en el catálogo?**
Por una de dos razones: está desactivado, o su stock está en cero. El catálogo solo muestra lo que se puede vender hoy.

**¿Puedo vender algo que no tengo en stock?**
Sí. La factura se crea y el inventario baja hasta cero, sin pasar a negativo. El movimiento deja anotado cuántos metros se facturaron sin existencias.

**¿Por qué el stock no cuadra con lo que conté?**
Entra a **Inventario** y filtra por ese producto: ahí está cada movimiento con su fecha y motivo. Si aun así hay diferencia, regístrala como **ajuste** con el número real.

**¿Qué pasa si anulo una factura?**
Cambia de estado, pero **el stock no se devuelve solo**. Si la mercancía regresó a bodega, regístrala como entrada manual en Inventario.

**¿Puedo cambiar el precio en una factura?**
Sí. El precio del catálogo se carga como sugerencia y lo puedes editar en cada factura, sin que eso altere el precio del producto.

**¿Quién hizo este movimiento?**
Cada acción queda registrada con su autor y la hora. **Auditoría** guarda el historial completo de cambios del sistema.

---

## Cuando algo sale mal

**No puedo entrar.** Verifica el correo y la contraseña. Si es correcto y sigue sin funcionar, pide a un administrador que revise tu cuenta.

**No veo una sección del menú.** Tu rol no la incluye. No es una falla; solicita el acceso a un administrador.

**El PDF no se abre.** El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio y reintenta.

**El catálogo no carga productos.** Revisa tu conexión y recarga. Si persiste, entra al panel y confirma que haya productos activos con stock.

**El cliente dice que el enlace le pide iniciar sesión.** El catálogo debe ser público. Si aparece una pantalla de acceso de Vercel, hay que revisar la configuración de protección del despliegue.

**Guardé mal un movimiento de inventario.** Los movimientos no se borran, porque son el historial. Registra un movimiento nuevo que corrija la diferencia, explicando en el motivo qué pasó.

---

## Respaldos

Los datos viven en Supabase. **El plan gratuito no incluye respaldos automáticos**, así que conviene sacar una copia con cierta frecuencia y antes de cualquier cambio grande.

Quien administre el sistema técnicamente tiene un script para eso. La copia debe guardarse **fuera del equipo** —en la nube o en un disco externo—; si se queda en el mismo computador, un daño se lleva el original y la copia al tiempo.
