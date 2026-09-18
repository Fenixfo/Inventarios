# TASK-2: Configuración de Supabase

## 📋 Paso a paso

### Paso 1: Ir al SQL Editor de Supabase

1. Abre https://supabase.com y accede a tu proyecto
2. En el sidebar izquierdo, ve a **SQL Editor**
3. Haz clic en **New Query**

### Paso 2: Ejecutar el schema SQL

1. Abre el archivo: `docs/specs/plataforma_inventarios_beraca/schema.sql`
2. Copia TODO el contenido
3. En Supabase SQL Editor, pega el código
4. Haz clic en **Run** (o presiona Ctrl+Enter)

**Espera a que se ejecute** (debería tomar 5-10 segundos)

Si ves un mensaje de éxito ✓, continúa. Si hay error, avísame.

### Paso 3: Verificar que las tablas se crearon

En Supabase, ve a **Table Editor** y verifica que existen:

```
✓ usuarios
✓ usuarios_roles
✓ productos
✓ clientes
✓ facturas
✓ facturas_items
✓ inventario_movimientos
✓ auditoria
✓ configuracion
```

### Paso 4: Crear usuario admin (en Supabase Auth)

1. Ve a **Authentication** → **Users**
2. Haz clic en **Add user**
3. Email: `admin@beraca.com` (o el que prefieras)
4. Password: una contraseña temporal (la cambiarás después)
5. Clic en **Create user**

**Copia el UUID del usuario** (aparece en la lista de usuarios)

### Paso 5: Asignar rol admin al usuario

Vuelve a **SQL Editor** y ejecuta este query:

```sql
-- Reemplaza UUID_DEL_USUARIO con el UUID que copiaste en Paso 4
INSERT INTO usuarios (id, email) 
VALUES ('UUID_DEL_USUARIO', 'admin@beraca.com');

INSERT INTO usuarios_roles (usuario_id, rol) 
VALUES ('UUID_DEL_USUARIO', 'admin');
```

Ejemplo (reemplaza con tu UUID real):
```sql
INSERT INTO usuarios (id, email) 
VALUES ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'admin@beraca.com');

INSERT INTO usuarios_roles (usuario_id, rol) 
VALUES ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'admin');
```

### Paso 6: Verificar que los Storage buckets existen

1. Ve a **Storage** en Supabase
2. Verifica que exista bucket `product-images` (debería crearse automáticamente)
3. Si NO existe, crea uno con nombre `product-images` y hazlo **Public**

### Paso 7: Configuración de Auth (CORS y Redirect URLs)

1. Ve a **Authentication** → **URL Configuration**
2. En **Redirect URLs**, agrega:
   ```
   http://localhost:3000/auth/callback
   ```
   (Vercel URL se agregará en TASK-4)

---

## ✅ Verificación Final

Una vez completados todos los pasos:

- [ ] Script SQL ejecutado sin errores
- [ ] 9 tablas creadas en Table Editor
- [ ] Usuario admin creado en Auth
- [ ] Usuario admin insertado en tabla usuarios
- [ ] Rol 'admin' asignado en usuarios_roles
- [ ] Storage bucket 'product-images' existe y es público
- [ ] Redirect URL configurada en Auth

---

## 🚀 Cuando todo esté listo

Avísame y haremos:
- Verificar conexión desde Next.js
- Pasar a TASK-3 (Setup Prisma)

**¿Ejecutaste los pasos? Avísame cuando esté completo.** ✓
