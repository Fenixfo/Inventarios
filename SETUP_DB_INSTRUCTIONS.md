# 🔐 Instrucciones para Configurar la Base de Datos

## Paso 1: Obtener la contraseña de PostgreSQL de Supabase

1. Ve a tu proyecto en https://supabase.com/dashboard
2. Haz clic en **Settings** (engranaje abajo a la izquierda)
3. Ve a **Database** → **Connection string**
4. Busca la sección con las URLs y copia tu **contraseña**
   - Debería verse así: `postgresql://postgres.axehyjwscvjyyrhfllhc:[AQUI_VA_LA_CONTRASEÑA]@...`

---

## Paso 2: Actualizar `.env` con la contraseña

En tu archivo `.env`, reemplaza `[YOUR-PASSWORD]` con tu contraseña real:

```env
# Antes:
DIRECT_URL="postgresql://postgres.axehyjwscvjyyrhfllhc:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres"

# Después (ejemplo):
DIRECT_URL="postgresql://postgres.axehyjwscvjyyrhfllhc:abc123DefGhi456@aws-0-us-west-2.pooler.supabase.com:5432/postgres"
```

**⚠️ IMPORTANTE:**
- NO compartir este archivo (.env) en git (está protegido en .gitignore)
- NO poner la contraseña en chat o commits
- Mantén .env en tu máquina local solamente

---

## Paso 3: Ejecutar el setup

Una vez actualizado el `.env`, ejecuta:

```bash
node scripts/setup-db.js
```

Debería:
- ✓ Conectar a Supabase
- ✓ Crear 9 tablas
- ✓ Crear índices
- ✓ Configurar RLS policies
- ✓ Mostrar lista de tablas creadas

---

## Paso 4: Verificar en Supabase

1. Ve a tu dashboard de Supabase
2. **Table Editor** → Verifica que existan:
   - usuarios
   - usuarios_roles
   - productos
   - clientes
   - facturas
   - facturas_items
   - inventario_movimientos
   - auditoria
   - configuracion

---

## ¿Problemas?

Si ves errores:

- **ETIMEDOUT**: Verifica que la contraseña sea correcta
- **28P01 (bad password)**: Revisa que copiaste la contraseña correctamente
- **Connection refused**: Verifica que DIRECT_URL sea correcta

---

## Cuando esté listo

Avísame que las tablas se crearon exitosamente y pasamos a **TASK-3 (Setup Prisma)** ✓
