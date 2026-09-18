# 🚀 Configuración de Vercel

## Paso 1: Crear cuenta en Vercel

1. Ve a https://vercel.com/signup
2. Crea una cuenta (recomendado: GitHub)
3. Crea un nuevo proyecto

## Paso 2: Conectar con GitHub

1. En Vercel: "Import Git Repository"
2. Selecciona tu repositorio con este proyecto
3. Click "Import"

## Paso 3: Agregar Variables de Entorno

En el panel de Vercel, ve a **Settings → Environment Variables** y agrega desde tu archivo `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` → Tu URL de Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Tu Anon Key de Supabase
- `SUPABASE_SERVICE_ROLE_KEY` → Tu Service Role Key
- `DATABASE_URL` → Connection string (solo si necesitas migraciones)
- `DIRECT_URL` → Direct connection URL (solo si necesitas migraciones)

⚠️ **SEGURIDAD CRÍTICA**: 
- **NUNCA** expongas credenciales en archivos que subes a Git
- Usa `.env.local` localmente (está en `.gitignore`)
- Agrega las variables directamente en el dashboard de Vercel
- Las credenciales **NUNCA** deben ser visibles en código fuente

## Paso 4: Deploy

Vercel deployará automáticamente cada vez que hagas push a main.

## Verificar Deploy

Después del deploy:
1. Visita la URL del proyecto en Vercel
2. Prueba: /login y /admin

---

**¿Dudas? Contacta al equipo de Vercel** 📞
