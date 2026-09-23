-- ============================================================================
-- Retirar las tablas del modelo de roles anterior
-- ============================================================================
-- El sistema pasó a permisos por tienda (`usuarios_tiendas` + `permisos` +
-- `permisos_asignados`). Estas cinco tablas son del modelo previo y ya no
-- las consulta ningún endpoint: los que lo hacían se eliminaron.
--
-- Borrar una tabla no tiene vuelta atrás, así que el paso 1 muestra qué hay
-- dentro. Si alguna guarda algo que quieras conservar, para ahí y avísame.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — Qué hay en cada una (no modifica nada)
-- ----------------------------------------------------------------------------
SELECT 'usuarios_roles'              AS tabla, count(*) AS filas FROM public.usuarios_roles
UNION ALL
SELECT 'roles_personalizados',       count(*) FROM public.roles_personalizados
UNION ALL
SELECT 'permisos_modulos',           count(*) FROM public.permisos_modulos
UNION ALL
SELECT 'usuarios_roles_personalizados', count(*) FROM public.usuarios_roles_personalizados
UNION ALL
SELECT 'permisos_roles_personalizados', count(*) FROM public.permisos_roles_personalizados;

-- Por si quieres ver a quién afectaba lo que queda guardado:
-- SELECT u.email, r.rol FROM public.usuarios_roles r
--   JOIN public.usuarios u ON u.id = r.usuario_id;


-- ----------------------------------------------------------------------------
-- PASO 2 — Copia de seguridad dentro de la misma base
-- ----------------------------------------------------------------------------
-- Cuestan casi nada y permiten volver atrás sin restaurar un respaldo entero.
-- Se pueden borrar cuando haya pasado un tiempo prudencial.
CREATE TABLE IF NOT EXISTS public.respaldo_usuarios_roles AS
  SELECT * FROM public.usuarios_roles;

CREATE TABLE IF NOT EXISTS public.respaldo_roles_personalizados AS
  SELECT * FROM public.roles_personalizados;

CREATE TABLE IF NOT EXISTS public.respaldo_permisos_modulos AS
  SELECT * FROM public.permisos_modulos;

CREATE TABLE IF NOT EXISTS public.respaldo_usuarios_roles_pers AS
  SELECT * FROM public.usuarios_roles_personalizados;

CREATE TABLE IF NOT EXISTS public.respaldo_permisos_roles_pers AS
  SELECT * FROM public.permisos_roles_personalizados;


-- ----------------------------------------------------------------------------
-- PASO 3 — Eliminar
-- ----------------------------------------------------------------------------
-- Primero los puentes, que dependen de las otras dos.
BEGIN;

DROP TABLE IF EXISTS public.permisos_roles_personalizados;
DROP TABLE IF EXISTS public.usuarios_roles_personalizados;
DROP TABLE IF EXISTS public.roles_personalizados;
DROP TABLE IF EXISTS public.permisos_modulos;
DROP TABLE IF EXISTS public.usuarios_roles;

COMMIT;


-- ----------------------------------------------------------------------------
-- PASO 4 — Comprobación
-- ----------------------------------------------------------------------------
-- No debería devolver ninguna fila.
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'usuarios_roles',
     'roles_personalizados',
     'permisos_modulos',
     'usuarios_roles_personalizados',
     'permisos_roles_personalizados'
   );


-- ----------------------------------------------------------------------------
-- DESPUÉS DE EJECUTARLO
-- ----------------------------------------------------------------------------
-- Hay que quitar los modelos correspondientes de prisma/schema.prisma
-- (Usuario.roles, Usuario.rolesPersonalizados, UsuarioRol, RolPersonalizado,
-- PermisoModulo, UsuarioRolPersonalizado, PermisoRolPersonalizado) y volver
-- a generar el cliente. Avísame y lo hago.
