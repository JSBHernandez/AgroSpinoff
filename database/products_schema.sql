-- Extensión de base de datos para RF06 - Lista de productos

-- Tabla de categorías de productos
CREATE TABLE IF NOT EXISTS categorias_productos (
    id_categoria INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    icono VARCHAR(50),
    activa BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla principal de productos
CREATE TABLE IF NOT EXISTS productos (
    id_producto INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    codigo_producto VARCHAR(50) UNIQUE,
    id_categoria INT,
    unidad_medida VARCHAR(50) NOT NULL,
    peso_unitario DECIMAL(10,3),
    dimensiones VARCHAR(100),
    origen VARCHAR(100),
    marca VARCHAR(100),
    
    -- Información de inventario
    stock_actual INT DEFAULT 0,
    stock_minimo INT DEFAULT 0,
    stock_maximo INT DEFAULT 1000,
    
    -- Estados y metadatos
    estado ENUM('activo', 'inactivo', 'descontinuado') DEFAULT 'activo',
    es_perecedero BOOLEAN DEFAULT FALSE,
    dias_caducidad INT,
    requiere_refrigeracion BOOLEAN DEFAULT FALSE,
    
    -- Información de trazabilidad
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    usuario_creacion INT,
    usuario_modificacion INT,
    
    FOREIGN KEY (id_categoria) REFERENCES categorias_productos(id_categoria),
    FOREIGN KEY (usuario_creacion) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (usuario_modificacion) REFERENCES usuarios(id_usuario),
    
    INDEX idx_producto_codigo (codigo_producto),
    INDEX idx_producto_categoria (id_categoria),
    INDEX idx_producto_estado (estado),
    INDEX idx_producto_nombre (nombre)
);

-- Tabla de precios por rol de usuario
CREATE TABLE IF NOT EXISTS precios_productos (
    id_precio INT PRIMARY KEY AUTO_INCREMENT,
    id_producto INT NOT NULL,
    tipo_usuario ENUM('cliente', 'proveedor', 'interno') NOT NULL,
    precio_unitario DECIMAL(12,2) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'COP',
    
    -- Información de vigencia
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    activo BOOLEAN DEFAULT TRUE,
    
    -- Información de descuentos/promociones
    precio_promocional DECIMAL(12,2),
    porcentaje_descuento DECIMAL(5,2),
    cantidad_minima INT DEFAULT 1,
    cantidad_maxima INT,
    
    -- Metadatos
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    usuario_creacion INT,
    
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
    FOREIGN KEY (usuario_creacion) REFERENCES usuarios(id_usuario),
    
    INDEX idx_precio_producto (id_producto),
    INDEX idx_precio_tipo_usuario (tipo_usuario),
    INDEX idx_precio_vigencia (fecha_inicio, fecha_fin),
    INDEX idx_precio_activo (activo),
    
    -- Constraint para evitar precios duplicados
    UNIQUE KEY unique_precio_producto_tipo (id_producto, tipo_usuario, fecha_inicio)
);

-- Tabla de imágenes de productos
CREATE TABLE IF NOT EXISTS imagenes_productos (
    id_imagen INT PRIMARY KEY AUTO_INCREMENT,
    id_producto INT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    es_principal BOOLEAN DEFAULT FALSE,
    alt_text VARCHAR(255),
    orden_visualizacion INT DEFAULT 0,
    
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_subida INT,
    
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
    FOREIGN KEY (usuario_subida) REFERENCES usuarios(id_usuario),
    
    INDEX idx_imagen_producto (id_producto),
    INDEX idx_imagen_principal (es_principal)
);

-- Tabla de especificaciones técnicas de productos
CREATE TABLE IF NOT EXISTS especificaciones_productos (
    id_especificacion INT PRIMARY KEY AUTO_INCREMENT,
    id_producto INT NOT NULL,
    nombre_especificacion VARCHAR(100) NOT NULL,
    valor_especificacion TEXT NOT NULL,
    unidad_medida VARCHAR(50),
    es_critica BOOLEAN DEFAULT FALSE,
    orden_visualizacion INT DEFAULT 0,
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON DELETE CASCADE,
    
    INDEX idx_especificacion_producto (id_producto),
    INDEX idx_especificacion_critica (es_critica)
);

-- Tabla de relaciones entre productos (productos relacionados, accesorios, etc.)
CREATE TABLE IF NOT EXISTS relaciones_productos (
    id_relacion INT PRIMARY KEY AUTO_INCREMENT,
    id_producto_origen INT NOT NULL,
    id_producto_destino INT NOT NULL,
    tipo_relacion ENUM('complementario', 'alternativo', 'accesorio', 'repuesto', 'conjunto') NOT NULL,
    descripcion_relacion VARCHAR(255),
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_producto_origen) REFERENCES productos(id_producto) ON DELETE CASCADE,
    FOREIGN KEY (id_producto_destino) REFERENCES productos(id_producto) ON DELETE CASCADE,
    
    INDEX idx_relacion_origen (id_producto_origen),
    INDEX idx_relacion_destino (id_producto_destino),
    INDEX idx_relacion_tipo (tipo_relacion),
    
    -- Evitar relaciones duplicadas
    UNIQUE KEY unique_relacion (id_producto_origen, id_producto_destino, tipo_relacion)
);

-- Vista principal para lista de productos con precios por rol
CREATE OR REPLACE VIEW vista_productos_lista AS
SELECT 
    p.id_producto,
    p.nombre,
    p.descripcion,
    p.codigo_producto,
    p.unidad_medida,
    p.stock_actual,
    p.estado,
    p.es_perecedero,
    p.peso_unitario,
    p.origen,
    p.marca,
    
    -- Información de categoría
    cp.nombre as categoria_nombre,
    cp.icono as categoria_icono,
    
    -- Precios por tipo de usuario
    pp_cliente.precio_unitario as precio_cliente,
    pp_cliente.precio_promocional as precio_promocional_cliente,
    pp_cliente.porcentaje_descuento as descuento_cliente,
    
    pp_proveedor.precio_unitario as precio_proveedor,
    pp_proveedor.precio_promocional as precio_promocional_proveedor,
    pp_proveedor.porcentaje_descuento as descuento_proveedor,
    
    pp_interno.precio_unitario as precio_interno,
    
    -- Imagen principal
    ip.ruta_archivo as imagen_principal,
    ip.alt_text as imagen_alt,
    
    -- Información de disponibilidad
    CASE 
        WHEN p.stock_actual <= 0 THEN 'agotado'
        WHEN p.stock_actual <= p.stock_minimo THEN 'stock_bajo'
        WHEN p.stock_actual >= p.stock_maximo THEN 'stock_alto'
        ELSE 'disponible'
    END as estado_stock,
    
    -- Calcular precio efectivo (con descuentos)
    CASE 
        WHEN pp_cliente.precio_promocional IS NOT NULL THEN pp_cliente.precio_promocional
        WHEN pp_cliente.porcentaje_descuento > 0 THEN 
            pp_cliente.precio_unitario * (1 - pp_cliente.porcentaje_descuento / 100)
        ELSE pp_cliente.precio_unitario
    END as precio_efectivo_cliente,
    
    CASE 
        WHEN pp_proveedor.precio_promocional IS NOT NULL THEN pp_proveedor.precio_promocional
        WHEN pp_proveedor.porcentaje_descuento > 0 THEN 
            pp_proveedor.precio_unitario * (1 - pp_proveedor.porcentaje_descuento / 100)
        ELSE pp_proveedor.precio_unitario
    END as precio_efectivo_proveedor

FROM productos p
LEFT JOIN categorias_productos cp ON p.id_categoria = cp.id_categoria
LEFT JOIN precios_productos pp_cliente ON p.id_producto = pp_cliente.id_producto 
    AND pp_cliente.tipo_usuario = 'cliente' 
    AND pp_cliente.activo = TRUE
    AND CURDATE() BETWEEN pp_cliente.fecha_inicio AND COALESCE(pp_cliente.fecha_fin, '9999-12-31')
LEFT JOIN precios_productos pp_proveedor ON p.id_producto = pp_proveedor.id_producto 
    AND pp_proveedor.tipo_usuario = 'proveedor' 
    AND pp_proveedor.activo = TRUE
    AND CURDATE() BETWEEN pp_proveedor.fecha_inicio AND COALESCE(pp_proveedor.fecha_fin, '9999-12-31')
LEFT JOIN precios_productos pp_interno ON p.id_producto = pp_interno.id_producto 
    AND pp_interno.tipo_usuario = 'interno' 
    AND pp_interno.activo = TRUE
    AND CURDATE() BETWEEN pp_interno.fecha_inicio AND COALESCE(pp_interno.fecha_fin, '9999-12-31')
LEFT JOIN imagenes_productos ip ON p.id_producto = ip.id_producto AND ip.es_principal = TRUE
WHERE p.estado = 'activo';

-- Insertar categorías de ejemplo
INSERT IGNORE INTO categorias_productos (nombre, descripcion, icono) VALUES
('Fertilizantes', 'Productos para nutrición del suelo y plantas', '🌱'),
('Semillas', 'Semillas certificadas para cultivo', '🌾'),
('Pesticidas', 'Productos para control de plagas', '🛡️'),
('Herramientas', 'Herramientas agrícolas y de jardinería', '🔧'),
('Equipos', 'Maquinaria y equipos especializados', '🚜'),
('Insumos', 'Insumos generales para agricultura', '📦'),
('Tecnología', 'Sistemas de riego y tecnología agrícola', '💧'),
('Servicios', 'Servicios especializados y consultoría', '🤝');

-- Insertar productos de ejemplo
INSERT IGNORE INTO productos (nombre, descripcion, codigo_producto, id_categoria, unidad_medida, peso_unitario, stock_actual, stock_minimo, usuario_creacion) VALUES
('Fertilizante NPK 15-15-15', 'Fertilizante completo balanceado para cultivos generales. Rico en nitrógeno, fósforo y potasio.', 'FERT-NPK-001', 1, 'kg', 1.000, 500, 50, 1),
('Semilla Maíz Híbrido DK7088', 'Semilla de maíz híbrido de alto rendimiento, resistente a sequía y enfermedades.', 'SEM-MAIZ-001', 2, 'kg', 0.500, 200, 20, 1),
('Glifosato 48% SL', 'Herbicida sistémico no selectivo para control de malezas anuales y perennes.', 'PEST-GLI-001', 3, 'litro', 1.200, 100, 10, 1),
('Azada de Acero Inoxidable', 'Herramienta para laboreo del suelo, mango de madera certificada.', 'HERR-AZA-001', 4, 'unidad', 2.500, 50, 5, 1),
('Sistema de Riego por Goteo 1Ha', 'Kit completo de riego por goteo para 1 hectárea, incluye controlador automático.', 'EQUIP-RIE-001', 7, 'kit', 25.000, 10, 2, 1),
('Semilla Frijol Cargamanto', 'Semilla criolla de frijol cargamanto, adaptada al clima colombiano.', 'SEM-FRIJ-001', 2, 'kg', 0.800, 150, 15, 1),
('Fungicida Mancozeb 80%', 'Fungicida preventivo para control de enfermedades foliares en cultivos.', 'PEST-FUN-001', 3, 'kg', 1.000, 80, 8, 1),
('Tractor Compacto 25HP', 'Tractor compacto ideal para pequeñas fincas, motor diésel eficiente.', 'EQUIP-TRA-001', 5, 'unidad', 1500.000, 2, 1, 1);

-- Insertar precios por rol para los productos
INSERT IGNORE INTO precios_productos (id_producto, tipo_usuario, precio_unitario, fecha_inicio, usuario_creacion) VALUES
-- Fertilizante NPK
(1, 'cliente', 3500.00, '2025-01-01', 1),
(1, 'proveedor', 2800.00, '2025-01-01', 1),
(1, 'interno', 3000.00, '2025-01-01', 1),

-- Semilla Maíz
(2, 'cliente', 45000.00, '2025-01-01', 1),
(2, 'proveedor', 38000.00, '2025-01-01', 1),
(2, 'interno', 40000.00, '2025-01-01', 1),

-- Glifosato
(3, 'cliente', 28000.00, '2025-01-01', 1),
(3, 'proveedor', 22000.00, '2025-01-01', 1),
(3, 'interno', 24000.00, '2025-01-01', 1),

-- Azada
(4, 'cliente', 85000.00, '2025-01-01', 1),
(4, 'proveedor', 65000.00, '2025-01-01', 1),
(4, 'interno', 70000.00, '2025-01-01', 1),

-- Sistema de Riego
(5, 'cliente', 2500000.00, '2025-01-01', 1),
(5, 'proveedor', 2000000.00, '2025-01-01', 1),
(5, 'interno', 2200000.00, '2025-01-01', 1),

-- Semilla Frijol
(6, 'cliente', 18000.00, '2025-01-01', 1),
(6, 'proveedor', 15000.00, '2025-01-01', 1),
(6, 'interno', 16000.00, '2025-01-01', 1),

-- Fungicida
(7, 'cliente', 35000.00, '2025-01-01', 1),
(7, 'proveedor', 28000.00, '2025-01-01', 1),
(7, 'interno', 30000.00, '2025-01-01', 1),

-- Tractor
(8, 'cliente', 45000000.00, '2025-01-01', 1),
(8, 'proveedor', 38000000.00, '2025-01-01', 1),
(8, 'interno', 40000000.00, '2025-01-01', 1);

-- Insertar especificaciones técnicas de ejemplo
INSERT IGNORE INTO especificaciones_productos (id_producto, nombre_especificacion, valor_especificacion, unidad_medida, es_critica) VALUES
(1, 'Nitrógeno (N)', '15', '%', TRUE),
(1, 'Fósforo (P2O5)', '15', '%', TRUE),
(1, 'Potasio (K2O)', '15', '%', TRUE),
(1, 'pH recomendado aplicación', '5.5 - 7.0', '', FALSE),

(2, 'Días a cosecha', '120-130', 'días', TRUE),
(2, 'Rendimiento promedio', '8-12', 'ton/ha', TRUE),
(2, 'Resistencia a sequía', 'Alta', '', TRUE),
(2, 'Altura de planta', '2.2-2.5', 'metros', FALSE),

(5, 'Cobertura', '1', 'hectárea', TRUE),
(5, 'Caudal máximo', '5000', 'L/h', TRUE),
(5, 'Presión de trabajo', '1.5-3.0', 'bar', TRUE),
(5, 'Material tuberías', 'PE (Polietileno)', '', FALSE);

-- Crear índices adicionales para optimización
CREATE INDEX idx_productos_busqueda ON productos(nombre, codigo_producto, descripcion(100));
CREATE INDEX idx_precios_vigentes ON precios_productos(activo, fecha_inicio, fecha_fin);
CREATE INDEX idx_stock_estado ON productos(stock_actual, estado);