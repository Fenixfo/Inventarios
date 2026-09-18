-- ============================================================
-- SCHEMA: Plataforma de Gestión de Inventarios Beraca
-- ============================================================
-- Este script crea la estructura completa de la BD en Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query

-- Crear schema beraca
CREATE SCHEMA IF NOT EXISTS beraca;

-- ============================================================
-- 1. USUARIOS Y ROLES
-- ============================================================

CREATE TABLE beraca.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE beraca.usuarios_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES beraca.usuarios(id) ON DELETE CASCADE,
  rol VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, rol)
);

-- ============================================================
-- 2. PRODUCTOS
-- ============================================================

CREATE TABLE beraca.productos (
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
  created_by UUID REFERENCES beraca.usuarios(id)
);

CREATE INDEX idx_productos_sku ON beraca.productos(sku);
CREATE INDEX idx_productos_stock ON beraca.productos(stock_actual);
CREATE INDEX idx_productos_activo ON beraca.productos(activo);

-- ============================================================
-- 3. CLIENTES
-- ============================================================

CREATE TABLE beraca.clientes (
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
  created_by UUID REFERENCES beraca.usuarios(id)
);

CREATE INDEX idx_clientes_cedula ON beraca.clientes(cedula_cc);
CREATE INDEX idx_clientes_email ON beraca.clientes(email);

-- ============================================================
-- 4. FACTURAS
-- ============================================================

CREATE TABLE beraca.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_factura VARCHAR(50) UNIQUE NOT NULL,
  cliente_id UUID REFERENCES beraca.clientes(id),
  usuario_id UUID REFERENCES beraca.usuarios(id),
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

CREATE INDEX idx_facturas_numero ON beraca.facturas(numero_factura);
CREATE INDEX idx_facturas_cliente ON beraca.facturas(cliente_id);
CREATE INDEX idx_facturas_estado ON beraca.facturas(estado);
CREATE INDEX idx_facturas_fecha ON beraca.facturas(fecha);
CREATE INDEX idx_facturas_usuario ON beraca.facturas(usuario_id);

-- ============================================================
-- 5. FACTURAS ITEMS
-- ============================================================

CREATE TABLE beraca.facturas_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID REFERENCES beraca.facturas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES beraca.productos(id) ON DELETE RESTRICT,
  cantidad_m2 DECIMAL(12,2) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_facturas_items_factura ON beraca.facturas_items(factura_id);
CREATE INDEX idx_facturas_items_producto ON beraca.facturas_items(producto_id);

-- ============================================================
-- 6. INVENTARIO MOVIMIENTOS (AUDITORÍA)
-- ============================================================

CREATE TABLE beraca.inventario_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES beraca.productos(id) ON DELETE RESTRICT,
  tipo VARCHAR(50) NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL,
  stock_antes DECIMAL(12,2) NOT NULL,
  stock_despues DECIMAL(12,2) NOT NULL,
  referencia_tipo VARCHAR(50),
  referencia_id UUID,
  motivo TEXT,
  usuario_id UUID REFERENCES beraca.usuarios(id),
  ip_address INET,
  fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventario_producto ON beraca.inventario_movimientos(producto_id);
CREATE INDEX idx_inventario_tipo ON beraca.inventario_movimientos(tipo);
CREATE INDEX idx_inventario_fecha ON beraca.inventario_movimientos(fecha_movimiento);
CREATE INDEX idx_inventario_usuario ON beraca.inventario_movimientos(usuario_id);

-- ============================================================
-- 7. AUDITORÍA GENERAL
-- ============================================================

CREATE TABLE beraca.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES beraca.usuarios(id),
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

CREATE INDEX idx_auditoria_tabla ON beraca.auditoria(tabla_afectada);
CREATE INDEX idx_auditoria_usuario ON beraca.auditoria(usuario_id);
CREATE INDEX idx_auditoria_fecha ON beraca.auditoria(fecha_accion);
CREATE INDEX idx_auditoria_accion ON beraca.auditoria(accion);

-- ============================================================
-- 8. CONFIGURACIÓN
-- ============================================================

CREATE TABLE beraca.configuracion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave VARCHAR(100) UNIQUE NOT NULL,
  valor VARCHAR(500),
  tipo VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES beraca.usuarios(id)
);

-- Insertar configuración inicial
INSERT INTO beraca.configuracion (clave, valor, tipo) VALUES
  ('nombre_empresa', 'Beraca', 'string'),
  ('admin_whatsapp', '', 'string'),
  ('stock_minimo_default', '5', 'number');

-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE beraca.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE beraca.usuarios_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE beraca.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE beraca.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE beraca.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE beraca.facturas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE beraca.inventario_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE beraca.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE beraca.configuracion ENABLE ROW LEVEL SECURITY;

-- Productos: visibles para todos (lectura pública)
CREATE POLICY "Productos visibles para todos"
  ON beraca.productos FOR SELECT
  USING (activo = true);

-- Productos: Admin puede insertar
CREATE POLICY "Admin inserta productos"
  ON beraca.productos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT usuario_id FROM beraca.usuarios_roles WHERE rol = 'admin'
    )
  );

-- Productos: Admin puede actualizar
CREATE POLICY "Admin actualiza productos"
  ON beraca.productos FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM beraca.usuarios_roles WHERE rol = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT usuario_id FROM beraca.usuarios_roles WHERE rol = 'admin'
    )
  );

-- Productos: Admin puede eliminar
CREATE POLICY "Admin elimina productos"
  ON beraca.productos FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM beraca.usuarios_roles WHERE rol = 'admin'
    )
  );

-- Facturas: usuarios ven sus propias, Admin ve todas
CREATE POLICY "Usuarios ven sus facturas"
  ON beraca.facturas FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR auth.uid() IN (SELECT usuario_id FROM beraca.usuarios_roles WHERE rol = 'admin')
  );

-- Facturas: solo usuarios autenticados pueden crear
CREATE POLICY "Usuarios autenticados crean facturas"
  ON beraca.facturas FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Auditoría: solo Admin accede
CREATE POLICY "Solo Admin accede a auditoría"
  ON beraca.auditoria FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM beraca.usuarios_roles WHERE rol = 'admin'
    )
  );

-- Configuración: solo Admin modifica
CREATE POLICY "Solo Admin modifica configuración"
  ON beraca.configuracion FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM beraca.usuarios_roles WHERE rol = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT usuario_id FROM beraca.usuarios_roles WHERE rol = 'admin'
    )
  );

-- ============================================================
-- SCRIPT COMPLETADO
-- ============================================================
-- Próximos pasos:
-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. Crear usuario admin en Supabase Auth
-- 3. Insertar usuario en tabla usuarios
-- 4. Asignar rol 'admin' en usuarios_roles
-- ============================================================
