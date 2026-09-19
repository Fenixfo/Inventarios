-- ============================================================
-- MIGRAR TODAS LAS TABLAS DE SCHEMA BERACA A PUBLIC
-- ============================================================

-- 1. Eliminar schema beraca (cascade elimina todas las tablas)
DROP SCHEMA IF EXISTS beraca CASCADE;

-- 2. Recrear todas las tablas en PUBLIC

-- USUARIOS Y ROLES
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE usuarios_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  rol VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, rol)
);

-- PRODUCTOS
CREATE TABLE productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  dimensiones VARCHAR(50),
  color VARCHAR(100),
  acabado VARCHAR(100),
  espesor_mm DECIMAL(4,2),
  m2_por_caja DECIMAL(6,2),
  precio_unitario DECIMAL(10,2) NOT NULL,
  precio_unitario_updated_at TIMESTAMPTZ,
  costo DECIMAL(10,2),
  costo_updated_at TIMESTAMPTZ,
  stock_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock_minimo DECIMAL(12,2) DEFAULT 0,
  proveedor VARCHAR(255),
  descripcion TEXT,
  imagen_url VARCHAR(500),
  activo BOOLEAN DEFAULT true,
  activo_desde TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES usuarios(id)
);

CREATE INDEX idx_productos_sku ON productos(sku);
CREATE INDEX idx_productos_stock ON productos(stock_actual);
CREATE INDEX idx_productos_activo ON productos(activo);

-- CLIENTES
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefono VARCHAR(20),
  cedula_cc VARCHAR(50) UNIQUE,
  direccion TEXT,
  termino_pago VARCHAR(50),
  limite_credito DECIMAL(12,2) DEFAULT 0,
  ultima_compra_fecha TIMESTAMPTZ,
  activo BOOLEAN DEFAULT true,
  activo_desde TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES usuarios(id)
);

CREATE INDEX idx_clientes_cedula ON clientes(cedula_cc);
CREATE INDEX idx_clientes_email ON clientes(email);

-- FACTURAS
CREATE TABLE facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  usuario_id UUID REFERENCES usuarios(id),
  fecha TIMESTAMPTZ DEFAULT now(),
  fecha_pago TIMESTAMPTZ,
  fecha_vencimiento TIMESTAMPTZ,
  fecha_anulacion TIMESTAMPTZ,
  termino_pago VARCHAR(50),
  metodo_pago VARCHAR(50),
  anticipo DECIMAL(12,2) DEFAULT 0,
  contra_entrega DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL,
  descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
  descuento_monto DECIMAL(12,2) DEFAULT 0,
  impuesto DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  estado VARCHAR(50) DEFAULT 'pendiente',
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_facturas_numero ON facturas(numero_factura);
CREATE INDEX idx_facturas_cliente ON facturas(cliente_id);
CREATE INDEX idx_facturas_estado ON facturas(estado);
CREATE INDEX idx_facturas_fecha ON facturas(fecha);
CREATE INDEX idx_facturas_usuario ON facturas(usuario_id);

-- FACTURAS ITEMS
CREATE TABLE facturas_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID REFERENCES facturas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad_m2 DECIMAL(12,2) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_facturas_items_factura ON facturas_items(factura_id);
CREATE INDEX idx_facturas_items_producto ON facturas_items(producto_id);

-- INVENTARIO MOVIMIENTOS (AUDITORÍA)
CREATE TABLE inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES productos(id) ON DELETE RESTRICT,
  tipo VARCHAR(50) NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL,
  stock_antes DECIMAL(12,2) NOT NULL,
  stock_despues DECIMAL(12,2) NOT NULL,
  referencia_tipo VARCHAR(50),
  referencia_id UUID,
  motivo TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  ip_address INET,
  fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventario_producto ON inventario_movimientos(producto_id);
CREATE INDEX idx_inventario_tipo ON inventario_movimientos(tipo);
CREATE INDEX idx_inventario_fecha ON inventario_movimientos(fecha_movimiento);
CREATE INDEX idx_inventario_usuario ON inventario_movimientos(usuario_id);

-- AUDITORÍA GENERAL
CREATE TABLE auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id),
  tabla_afectada VARCHAR(100) NOT NULL,
  registro_id UUID NOT NULL,
  accion VARCHAR(50) NOT NULL,
  datos_antes JSONB,
  datos_despues JSONB,
  ip_address INET,
  user_agent TEXT,
  fecha_accion TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auditoria_tabla ON auditoria(tabla_afectada);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha_accion);
CREATE INDEX idx_auditoria_accion ON auditoria(accion);

-- CONFIGURACIÓN
CREATE TABLE configuracion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave VARCHAR(100) UNIQUE NOT NULL,
  valor VARCHAR(500),
  tipo VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES usuarios(id)
);

-- Insertar configuración inicial
INSERT INTO configuracion (clave, valor, tipo) VALUES
  ('nombre_empresa', 'Beraca', 'string'),
  ('admin_whatsapp', '', 'string'),
  ('stock_minimo_default', '5', 'number');

-- 3. HABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

-- 4. CREAR POLÍTICAS RLS

-- Productos: visibles para todos (lectura pública)
CREATE POLICY "Productos visibles para todos"
  ON productos FOR SELECT
  USING (activo = true);

-- Productos: Admin puede insertar
CREATE POLICY "Admin inserta productos"
  ON productos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT usuario_id FROM usuarios_roles WHERE rol = 'admin'
    )
  );

-- Productos: Admin puede actualizar
CREATE POLICY "Admin actualiza productos"
  ON productos FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM usuarios_roles WHERE rol = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT usuario_id FROM usuarios_roles WHERE rol = 'admin'
    )
  );

-- Productos: Admin puede eliminar
CREATE POLICY "Admin elimina productos"
  ON productos FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM usuarios_roles WHERE rol = 'admin'
    )
  );

-- Facturas: usuarios ven sus propias, Admin ve todas
CREATE POLICY "Usuarios ven sus facturas"
  ON facturas FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR auth.uid() IN (SELECT usuario_id FROM usuarios_roles WHERE rol = 'admin')
  );

-- Facturas: solo usuarios autenticados pueden crear
CREATE POLICY "Usuarios autenticados crean facturas"
  ON facturas FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Auditoría: solo Admin accede
CREATE POLICY "Solo Admin accede a auditoría"
  ON auditoria FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM usuarios_roles WHERE rol = 'admin'
    )
  );

-- Configuración: solo Admin modifica
CREATE POLICY "Solo Admin modifica configuración"
  ON configuracion FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM usuarios_roles WHERE rol = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT usuario_id FROM usuarios_roles WHERE rol = 'admin'
    )
  );

-- ============================================================
-- MIGRATION COMPLETADA
-- ============================================================
