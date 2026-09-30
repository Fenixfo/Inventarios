-- A nombre de quién se vendió cada factura (a quien se le liquida).
ALTER TABLE facturas
ADD COLUMN IF NOT EXISTS vendedor_id UUID;

ALTER TABLE facturas
ADD CONSTRAINT facturas_vendedor_id_fkey
FOREIGN KEY (vendedor_id) REFERENCES usuarios(id);

CREATE INDEX IF NOT EXISTS facturas_vendedor_id_idx ON facturas(vendedor_id);

-- Las facturas que ya existen son de quien las registró.
UPDATE facturas SET vendedor_id = usuario_id WHERE vendedor_id IS NULL;

-- Permiso nuevo: facturar a nombre de otros usuarios de la tienda.
INSERT INTO public.permisos (modulo, accion, nombre, orden)
VALUES ('facturas', 'a_nombre_de_otros', 'Facturar a nombre de otros usuarios de la tienda', 48)
ON CONFLICT (modulo, accion) DO NOTHING;
