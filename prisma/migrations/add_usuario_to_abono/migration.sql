ALTER TABLE abonos
ADD COLUMN usuario_id UUID;

ALTER TABLE abonos
ADD CONSTRAINT abonos_usuario_id_fkey
FOREIGN KEY (usuario_id) REFERENCES usuarios(id);

CREATE INDEX abonos_usuario_id_idx ON abonos(usuario_id);
