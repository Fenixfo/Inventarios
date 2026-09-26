-- ============================================================================
-- Cerrar el acceso directo a las tablas con la clave pública (anon)
-- ============================================================================
-- Supabase publica cada tabla de `public` en su API REST. La clave "anon"
-- va dentro del JavaScript que descarga cualquier visitante, y con RLS
-- apagado esa clave podía leer, crear, modificar y borrar filas de todas
-- las tablas (facturas, clientes con cédula y teléfono, costos, usuarios...)
-- saltándose todos los permisos que comprueba la aplicación.
--
-- Con RLS encendido y sin políticas, anon y authenticated no ven ni tocan
-- nada. La aplicación no se ve afectada: entra por Prisma con el usuario
-- `postgres`, que es dueño de las tablas y no está sujeto a RLS. La clave
-- anon solo se usa para iniciar sesión, que no pasa por estas tablas.
-- ============================================================================

ALTER TABLE public.abonos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permisos_asignados     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitudes_acceso     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiendas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_tiendas       ENABLE ROW LEVEL SECURITY;

-- Por si cotizaciones.sql se ejecutó con "Run without RLS".
ALTER TABLE IF EXISTS public.cotizaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cotizaciones_items ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- Comprobación: todas deben salir con rls = true
-- ----------------------------------------------------------------------------
SELECT c.relname AS tabla, c.relrowsecurity AS rls
  FROM pg_class c
 WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
 ORDER BY c.relname;


-- ----------------------------------------------------------------------------
-- MARCHA ATRÁS (vuelve a abrir las tablas a la clave pública: no recomendado)
-- ----------------------------------------------------------------------------
-- ALTER TABLE public.<tabla> DISABLE ROW LEVEL SECURITY;
