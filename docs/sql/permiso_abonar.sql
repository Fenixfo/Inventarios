-- ============================================================================
-- TASK-58: Nuevo permiso "facturas.abonar"
-- ============================================================================
-- Hoy quien puede crear facturas (facturas.crear) puede además registrar
-- abonos y marcarlas como pagadas o entregadas. Se separa en un permiso
-- aparte: el vendedor sigue facturando, pero la factura nace sin abono y en
-- estado pendiente a menos que además tenga este permiso (o sea owner/admin).
-- ============================================================================

INSERT INTO public.permisos (modulo, accion, nombre, descripcion, orden)
VALUES (
  'facturas',
  'abonar',
  'Abonar y cambiar estado',
  'Registrar abonos, marcar como pagada o entregada. Anular sigue con el permiso de anular.',
  44
)
ON CONFLICT (modulo, accion) DO NOTHING;
