-- RF07 - Sistema de Facturación y Generación de PDF
-- Esquema de base de datos para gestión de facturas

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
INSERT INTO configuracion_empresa (
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

-- Tabla principal de facturas
CREATE TABLE IF NOT EXISTS facturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    prefijo VARCHAR(10) NOT NULL,
    consecutivo INT NOT NULL,
    
    -- Datos del cliente/proveedor
    cliente_id INT NOT NULL,
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
    creado_por INT NOT NULL,
    proyecto_id INT NULL, -- Opcional: asociar con proyecto
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Índices y relaciones
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (creado_por) REFERENCES usuarios(id),
    FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
    
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
    producto_id INT NULL, -- Opcional: referencia a tabla productos
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
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    
    INDEX idx_factura (factura_id),
    INDEX idx_producto (producto_id)
);

-- Tabla de datos fiscales adicionales de usuarios
CREATE TABLE IF NOT EXISTS datos_fiscales_usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL UNIQUE,
    
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
    
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_documento (numero_documento),
    INDEX idx_usuario (usuario_id)
);

-- Insertar datos fiscales básicos para usuarios existentes
INSERT INTO datos_fiscales_usuarios (
    usuario_id, razon_social, numero_documento, direccion_fiscal, 
    ciudad, telefono_fiscal, email_facturacion
)
SELECT 
    id,
    CONCAT(nombre, ' ', apellido) as razon_social,
    COALESCE(documento, CONCAT('1000000', id)) as numero_documento,
    'Dirección por definir' as direccion_fiscal,
    'Bogotá' as ciudad,
    telefono,
    email as email_facturacion
FROM usuarios 
WHERE NOT EXISTS (
    SELECT 1 FROM datos_fiscales_usuarios WHERE usuario_id = usuarios.id
);

-- Tabla de historial de impresión/envío de facturas
CREATE TABLE IF NOT EXISTS historial_facturas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    factura_id INT NOT NULL,
    accion ENUM('creada', 'modificada', 'enviada', 'impresa', 'anulada') NOT NULL,
    usuario_id INT NOT NULL,
    detalles TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
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
    f.proyecto_id,
    p.nombre as proyecto_nombre,
    u.nombre as creado_por_nombre,
    CASE 
        WHEN f.estado = 'vencida' OR (f.estado = 'enviada' AND f.fecha_vencimiento < CURDATE()) THEN 'VENCIDA'
        WHEN f.estado = 'pagada' THEN 'PAGADA'
        WHEN f.estado = 'anulada' THEN 'ANULADA'
        WHEN f.estado = 'enviada' THEN 'PENDIENTE'
        ELSE 'BORRADOR'
    END as estado_visual,
    DATEDIFF(CURDATE(), f.fecha_vencimiento) as dias_vencimiento,
    (SELECT COUNT(*) FROM detalles_factura WHERE factura_id = f.id) as total_items
FROM facturas f
LEFT JOIN proyectos p ON f.proyecto_id = p.id
LEFT JOIN usuarios u ON f.creado_por = u.id
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

-- Funciones y procedimientos para numeración automática
DELIMITER $$

CREATE OR REPLACE FUNCTION obtener_siguiente_numero_factura()
RETURNS VARCHAR(50)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE siguiente_numero INT;
    DECLARE prefijo VARCHAR(10);
    DECLARE numero_completo VARCHAR(50);
    
    -- Obtener configuración actual
    SELECT prefijo_facturacion, numeracion_actual 
    INTO prefijo, siguiente_numero
    FROM configuracion_empresa 
    WHERE activa = TRUE 
    LIMIT 1;
    
    -- Si no hay configuración, usar valores por defecto
    IF prefijo IS NULL THEN
        SET prefijo = 'FAC';
        SET siguiente_numero = 1;
    END IF;
    
    -- Formar número completo
    SET numero_completo = CONCAT(prefijo, LPAD(siguiente_numero, 6, '0'));
    
    RETURN numero_completo;
END$$

CREATE OR REPLACE PROCEDURE actualizar_numeracion_factura()
MODIFIES SQL DATA
BEGIN
    UPDATE configuracion_empresa 
    SET numeracion_actual = numeracion_actual + 1
    WHERE activa = TRUE;
END$$

DELIMITER ;

-- Triggers para automatización
DELIMITER $$

-- Trigger para asignar número de factura automáticamente
CREATE OR REPLACE TRIGGER tr_facturas_before_insert
BEFORE INSERT ON facturas
FOR EACH ROW
BEGIN
    DECLARE siguiente_numero VARCHAR(50);
    DECLARE prefijo_config VARCHAR(10);
    DECLARE consecutivo_config INT;
    
    -- Si no se proporciona número de factura, generarlo automáticamente
    IF NEW.numero_factura IS NULL OR NEW.numero_factura = '' THEN
        -- Obtener configuración
        SELECT prefijo_facturacion, numeracion_actual 
        INTO prefijo_config, consecutivo_config
        FROM configuracion_empresa 
        WHERE activa = TRUE 
        LIMIT 1;
        
        -- Valores por defecto si no hay configuración
        IF prefijo_config IS NULL THEN
            SET prefijo_config = 'FAC';
            SET consecutivo_config = 1;
        END IF;
        
        -- Asignar valores
        SET NEW.prefijo = prefijo_config;
        SET NEW.consecutivo = consecutivo_config;
        SET NEW.numero_factura = CONCAT(prefijo_config, LPAD(consecutivo_config, 6, '0'));
        
        -- Actualizar numeración
        UPDATE configuracion_empresa 
        SET numeracion_actual = numeracion_actual + 1
        WHERE activa = TRUE;
    END IF;
    
    -- Asegurar que la fecha de factura no sea nula
    IF NEW.fecha_factura IS NULL THEN
        SET NEW.fecha_factura = CURDATE();
    END IF;
    
    -- Calcular fecha de vencimiento si no se proporciona
    IF NEW.fecha_vencimiento IS NULL THEN
        SET NEW.fecha_vencimiento = DATE_ADD(NEW.fecha_factura, INTERVAL NEW.dias_credito DAY);
    END IF;
END$$

-- Trigger para recalcular totales al insertar/actualizar detalles
CREATE OR REPLACE TRIGGER tr_detalles_factura_after_insert
AFTER INSERT ON detalles_factura
FOR EACH ROW
BEGIN
    CALL recalcular_totales_factura(NEW.factura_id);
END$$

CREATE OR REPLACE TRIGGER tr_detalles_factura_after_update
AFTER UPDATE ON detalles_factura
FOR EACH ROW
BEGIN
    CALL recalcular_totales_factura(NEW.factura_id);
END$$

CREATE OR REPLACE TRIGGER tr_detalles_factura_after_delete
AFTER DELETE ON detalles_factura
FOR EACH ROW
BEGIN
    CALL recalcular_totales_factura(OLD.factura_id);
END$$

-- Procedimiento para recalcular totales de factura
CREATE OR REPLACE PROCEDURE recalcular_totales_factura(IN p_factura_id INT)
MODIFIES SQL DATA
BEGIN
    DECLARE v_subtotal DECIMAL(15,2) DEFAULT 0.00;
    DECLARE v_valor_iva DECIMAL(15,2) DEFAULT 0.00;
    DECLARE v_total DECIMAL(15,2) DEFAULT 0.00;
    
    -- Calcular totales desde los detalles
    SELECT 
        COALESCE(SUM(subtotal_item - descuento_item), 0.00),
        COALESCE(SUM(valor_iva_item), 0.00),
        COALESCE(SUM(total_item), 0.00)
    INTO v_subtotal, v_valor_iva, v_total
    FROM detalles_factura
    WHERE factura_id = p_factura_id;
    
    -- Actualizar la factura
    UPDATE facturas 
    SET 
        subtotal = v_subtotal,
        base_gravable = v_subtotal,
        valor_iva = v_valor_iva,
        total = v_total
    WHERE id = p_factura_id;
END$$

DELIMITER ;

-- Datos de ejemplo para pruebas
INSERT INTO facturas (
    numero_factura, prefijo, consecutivo, cliente_id, tipo_cliente,
    cliente_nombre, cliente_documento, cliente_direccion, cliente_telefono, cliente_email,
    fecha_factura, subtotal, base_gravable, valor_iva, total, creado_por
) VALUES (
    'FAC000001', 'FAC', 1, 1, 'cliente',
    'Cliente de Prueba S.A.S.', '900123456-7', 'Calle 123 #45-67', '+57 300 123 4567', 'cliente@ejemplo.com',
    CURDATE(), 1000000.00, 1000000.00, 190000.00, 1190000.00, 1
);

-- Insertar algunos detalles de ejemplo
INSERT INTO detalles_factura (
    factura_id, codigo_producto, descripcion, cantidad, unidad_medida,
    precio_unitario, subtotal_item, valor_iva_item, total_item
) VALUES 
(1, 'FERT001', 'Fertilizante NPK 20-20-20 x 50kg', 10.000, 'saco', 50000.00, 500000.00, 95000.00, 595000.00),
(1, 'SEM001', 'Semilla de Maíz Híbrido x 20kg', 5.000, 'saco', 80000.00, 400000.00, 76000.00, 476000.00),
(1, 'HERB001', 'Herbicida Glifosato x 1L', 20.000, 'litro', 5000.00, 100000.00, 19000.00, 119000.00);

-- Actualizar numeración actual
UPDATE configuracion_empresa SET numeracion_actual = 2 WHERE activa = TRUE;