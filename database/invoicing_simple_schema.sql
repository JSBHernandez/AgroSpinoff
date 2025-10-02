-- RF07 - Sistema de Facturación Simplificado
-- Esquema básico sin dependencias externas

-- Tabla de configuración de empresa para datos fiscales
CREATE TABLE IF NOT EXISTS configuracion_empresa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_empresa VARCHAR(255) NOT NULL,
    nit VARCHAR(50) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(50),
    email VARCHAR(100),
    sitio_web VARCHAR(100),
    logo_url VARCHAR(255),
    regimen_fiscal VARCHAR(100),
    actividad_economica TEXT,
    resolucion_dian VARCHAR(255),
    prefijo_facturacion VARCHAR(10) DEFAULT 'FAC',
    numeracion_desde INT DEFAULT 1,
    numeracion_hasta INT DEFAULT 99999,
    numeracion_actual INT DEFAULT 1,
    iva_porcentaje DECIMAL(5,2) DEFAULT 19.00,
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar configuración básica de empresa
INSERT IGNORE INTO configuracion_empresa (
    nombre_empresa, nit, direccion, telefono, email,
    regimen_fiscal, actividad_economica, resolucion_dian
) VALUES (
    'AgroTechNova S.A.S.',
    '900123456-7',
    'Calle 123 #45-67, Bogotá, Colombia',
    '+57 1 234 5678',
    'facturacion@agrotechnova.com',
    'Régimen Ordinario',
    'Desarrollo de software agroindustrial y consultoría técnica',
    'Resolución DIAN No. 18764003123456 del 2024'
);

-- Tabla principal de facturas (sin foreign keys por ahora)
CREATE TABLE IF NOT EXISTS facturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    prefijo VARCHAR(10) NOT NULL,
    consecutivo INT NOT NULL,
    
    -- Datos del cliente/proveedor (almacenados directamente)
    cliente_id INT NULL, -- Referencia opcional
    tipo_cliente ENUM('cliente', 'proveedor') NOT NULL,
    
    -- Información fiscal del cliente en la factura
    cliente_nombre VARCHAR(255) NOT NULL,
    cliente_documento VARCHAR(50),
    cliente_tipo_documento ENUM('CC', 'NIT', 'CE', 'PP') DEFAULT 'CC',
    cliente_direccion TEXT,
    cliente_telefono VARCHAR(50),
    cliente_email VARCHAR(100),
    cliente_ciudad VARCHAR(100),
    
    -- Fechas
    fecha_factura DATE NOT NULL,
    fecha_vencimiento DATE,
    
    -- Valores
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    descuento DECIMAL(15,2) DEFAULT 0.00,
    base_gravable DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    valor_iva DECIMAL(15,2) DEFAULT 0.00,
    total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    
    -- Estado y metadatos
    estado ENUM('borrador', 'enviada', 'pagada', 'vencida', 'anulada') DEFAULT 'borrador',
    observaciones TEXT,
    terminos_condiciones TEXT,
    metodo_pago ENUM('efectivo', 'transferencia', 'cheque', 'tarjeta', 'credito') DEFAULT 'efectivo',
    dias_credito INT DEFAULT 0,
    
    -- Control
    creado_por_id INT NULL, -- Referencia opcional
    creado_por_nombre VARCHAR(255),
    proyecto_id INT NULL,
    proyecto_nombre VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices para optimización
    INDEX idx_numero_factura (numero_factura),
    INDEX idx_cliente (cliente_id),
    INDEX idx_fecha (fecha_factura),
    INDEX idx_estado (estado)
);

-- Tabla de detalles de factura (items/productos)
CREATE TABLE IF NOT EXISTS detalles_factura (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT NOT NULL,
    
    -- Información del producto/servicio
    producto_id INT NULL, -- Referencia opcional
    codigo_producto VARCHAR(100),
    descripcion TEXT NOT NULL,
    categoria VARCHAR(100),
    
    -- Cantidades y precios
    cantidad DECIMAL(10,3) NOT NULL,
    unidad_medida VARCHAR(50) DEFAULT 'unidad',
    precio_unitario DECIMAL(15,2) NOT NULL,
    descuento_item DECIMAL(15,2) DEFAULT 0.00,
    subtotal_item DECIMAL(15,2) NOT NULL,
    
    -- Impuestos
    aplica_iva BOOLEAN DEFAULT TRUE,
    porcentaje_iva DECIMAL(5,2) DEFAULT 19.00,
    valor_iva_item DECIMAL(15,2) DEFAULT 0.00,
    total_item DECIMAL(15,2) NOT NULL,
    
    -- Metadatos
    orden_item INT DEFAULT 1,
    notas_item TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    
    INDEX idx_factura (factura_id),
    INDEX idx_producto (producto_id)
);

-- Tabla de datos fiscales de usuarios/clientes
CREATE TABLE IF NOT EXISTS datos_fiscales_usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NULL, -- Referencia opcional por ahora
    
    -- Información fiscal
    razon_social VARCHAR(255),
    nombre_comercial VARCHAR(255),
    tipo_documento ENUM('CC', 'NIT', 'CE', 'PP') DEFAULT 'CC',
    numero_documento VARCHAR(50) NOT NULL,
    digito_verificacion CHAR(1),
    
    -- Ubicación
    direccion_fiscal TEXT,
    ciudad VARCHAR(100),
    departamento VARCHAR(100),
    codigo_postal VARCHAR(10),
    pais VARCHAR(100) DEFAULT 'Colombia',
    
    -- Contacto fiscal
    telefono_fiscal VARCHAR(50),
    email_facturacion VARCHAR(100),
    
    -- Clasificación fiscal
    regimen_fiscal ENUM('simplificado', 'ordinario', 'gran_contribuyente') DEFAULT 'simplificado',
    responsabilidad_fiscal SET('iva', 'ica', 'renta', 'no_responsable') DEFAULT 'no_responsable',
    actividad_economica VARCHAR(255),
    codigo_ciiu VARCHAR(10),
    
    -- Control
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY idx_documento (numero_documento),
    INDEX idx_usuario (usuario_id)
);

-- Insertar algunos datos fiscales de ejemplo
INSERT IGNORE INTO datos_fiscales_usuarios (
    razon_social, numero_documento, tipo_documento, direccion_fiscal, 
    ciudad, telefono_fiscal, email_facturacion, regimen_fiscal
) VALUES 
('Cliente de Prueba S.A.S.', '900123456-7', 'NIT', 'Calle 123 #45-67', 'Bogotá', '+57 300 123 4567', 'cliente@ejemplo.com', 'ordinario'),
('Proveedor Agrícola Ltda.', '890987654-3', 'NIT', 'Carrera 45 #78-90', 'Medellín', '+57 301 987 6543', 'proveedor@agricola.com', 'ordinario'),
('Juan Pérez', '12345678', 'CC', 'Calle 56 #34-12', 'Cali', '+57 302 456 7890', 'juan.perez@email.com', 'simplificado');

-- Tabla de historial de acciones en facturas
CREATE TABLE IF NOT EXISTS historial_facturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT NOT NULL,
    accion ENUM('creada', 'modificada', 'enviada', 'impresa', 'anulada', 'pagada') NOT NULL,
    usuario_id INT NULL,
    usuario_nombre VARCHAR(255),
    detalles TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    INDEX idx_factura_historial (factura_id),
    INDEX idx_fecha_historial (fecha_accion)
);

-- Vista para listado de facturas con información resumida
CREATE OR REPLACE VIEW vista_facturas_lista AS
SELECT 
    f.id,
    f.numero_factura,
    f.fecha_factura,
    f.fecha_vencimiento,
    f.cliente_nombre,
    f.cliente_documento,
    f.tipo_cliente,
    f.subtotal,
    f.valor_iva,
    f.total,
    f.estado,
    f.metodo_pago,
    f.proyecto_nombre,
    f.creado_por_nombre,
    CASE 
        WHEN f.estado = 'vencida' OR (f.estado = 'enviada' AND f.fecha_vencimiento < CURDATE()) THEN 'VENCIDA'
        WHEN f.estado = 'pagada' THEN 'PAGADA'
        WHEN f.estado = 'anulada' THEN 'ANULADA'
        WHEN f.estado = 'enviada' THEN 'PENDIENTE'
        ELSE 'BORRADOR'
    END as estado_visual,
    CASE 
        WHEN f.fecha_vencimiento IS NOT NULL THEN DATEDIFF(CURDATE(), f.fecha_vencimiento)
        ELSE NULL
    END as dias_vencimiento,
    (SELECT COUNT(*) FROM detalles_factura WHERE factura_id = f.id) as total_items
FROM facturas f
ORDER BY f.fecha_factura DESC, f.numero_factura DESC;

-- Vista para resumen financiero de facturación
CREATE OR REPLACE VIEW vista_resumen_facturacion AS
SELECT 
    DATE_FORMAT(fecha_factura, '%Y-%m') as periodo,
    COUNT(*) as total_facturas,
    SUM(CASE WHEN estado = 'pagada' THEN 1 ELSE 0 END) as facturas_pagadas,
    SUM(CASE WHEN estado = 'enviada' THEN 1 ELSE 0 END) as facturas_pendientes,
    SUM(CASE WHEN estado = 'vencida' OR (estado = 'enviada' AND fecha_vencimiento < CURDATE()) THEN 1 ELSE 0 END) as facturas_vencidas,
    SUM(total) as total_facturado,
    SUM(CASE WHEN estado = 'pagada' THEN total ELSE 0 END) as total_recaudado,
    SUM(CASE WHEN estado = 'enviada' OR estado = 'vencida' THEN total ELSE 0 END) as total_por_cobrar,
    AVG(total) as promedio_factura
FROM facturas
WHERE estado != 'anulada'
GROUP BY DATE_FORMAT(fecha_factura, '%Y-%m')
ORDER BY periodo DESC;

-- Datos de ejemplo para pruebas
INSERT IGNORE INTO facturas (
    numero_factura, prefijo, consecutivo, cliente_id, tipo_cliente,
    cliente_nombre, cliente_documento, cliente_direccion, cliente_telefono, cliente_email,
    fecha_factura, subtotal, base_gravable, valor_iva, total, 
    creado_por_nombre, estado
) VALUES (
    'FAC000001', 'FAC', 1, 1, 'cliente',
    'Cliente de Prueba S.A.S.', '900123456-7', 'Calle 123 #45-67', '+57 300 123 4567', 'cliente@ejemplo.com',
    CURDATE(), 1000000.00, 1000000.00, 190000.00, 1190000.00, 
    'Administrador', 'borrador'
);

-- Insertar algunos detalles de ejemplo
INSERT IGNORE INTO detalles_factura (
    factura_id, codigo_producto, descripcion, cantidad, unidad_medida,
    precio_unitario, subtotal_item, valor_iva_item, total_item
) VALUES 
(1, 'FERT001', 'Fertilizante NPK 20-20-20 x 50kg', 10.000, 'saco', 50000.00, 500000.00, 95000.00, 595000.00),
(1, 'SEM001', 'Semilla de Maíz Híbrido x 20kg', 5.000, 'saco', 80000.00, 400000.00, 76000.00, 476000.00),
(1, 'HERB001', 'Herbicida Glifosato x 1L', 20.000, 'litro', 5000.00, 100000.00, 19000.00, 119000.00);

-- Actualizar numeración actual
UPDATE configuracion_empresa SET numeracion_actual = 2 WHERE activa = TRUE;