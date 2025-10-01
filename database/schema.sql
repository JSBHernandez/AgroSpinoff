-- ================================================================
-- ESQUEMA DE BASE DE DATOS AGROTECH NOVA
-- Sistema Integrado de Gestión para Centro de Agroindustria
-- Basado en diagramas UML y requerimientos funcionales
-- ================================================================

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS agrotech_nova 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE agrotech_nova;

-- ================================================================
-- TABLA DE USUARIOS (RF39-RF51, RF58-RF59)
-- ================================================================
CREATE TABLE usuarios (
    id_usuario INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    rol ENUM('productor', 'asesor', 'administrador') NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_rol (rol),
    INDEX idx_activo (activo)
);

-- ================================================================
-- TABLA DE SESIONES DE USUARIO (RF42, RF47)
-- ================================================================
CREATE TABLE sesiones_usuario (
    id_sesion INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    fecha_login DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_logout DATETIME NULL,
    activa BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    INDEX idx_usuario (id_usuario),
    INDEX idx_fecha_login (fecha_login)
);

-- ================================================================
-- TABLA DE PROYECTOS (RF01-RF05, RF13-RF15, RF41)
-- ================================================================
CREATE TABLE proyectos (
    id_proyecto INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(200) NOT NULL UNIQUE,
    descripcion TEXT,
    categoria ENUM('agricola', 'pecuario', 'agroindustrial', 'mixto') NOT NULL,
    estado ENUM('planificacion', 'ejecucion', 'finalizado', 'cancelado', 'suspendido') DEFAULT 'planificacion',
    fecha_inicio DATE,
    fecha_fin DATE,
    presupuesto_total DECIMAL(15,2) DEFAULT 0.00,
    id_productor INT NOT NULL,
    id_asesor INT NULL,
    ubicacion_geografica VARCHAR(255),
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_productor) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_asesor) REFERENCES usuarios(id_usuario),
    INDEX idx_categoria (categoria),
    INDEX idx_estado (estado),
    INDEX idx_productor (id_productor),
    INDEX idx_asesor (id_asesor),
    INDEX idx_fechas (fecha_inicio, fecha_fin)
);

-- ================================================================
-- TABLA DE FASES DE PROYECTO (RF13, RF17, RF25)
-- ================================================================
CREATE TABLE fases_proyecto (
    id_fase INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    fecha_inicio_planificada DATE NOT NULL,
    fecha_fin_planificada DATE NOT NULL,
    fecha_inicio_real DATE NULL,
    fecha_fin_real DATE NULL,
    presupuesto_fase DECIMAL(12,2) DEFAULT 0.00,
    porcentaje_avance DECIMAL(5,2) DEFAULT 0.00,
    orden_fase INT NOT NULL,
    estado_fase ENUM('pendiente', 'en_progreso', 'completada', 'suspendida') DEFAULT 'pendiente',
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_orden (orden_fase),
    INDEX idx_estado_fase (estado_fase)
);

-- ================================================================
-- TABLA DE HITOS DEL PROYECTO (RF25)
-- ================================================================
CREATE TABLE hitos_proyecto (
    id_hito INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_fase INT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    fecha_objetivo DATE NOT NULL,
    fecha_completado DATE NULL,
    estado_hito ENUM('pendiente', 'en_progreso', 'completado', 'vencido') DEFAULT 'pendiente',
    responsable_id INT NULL,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_fase) REFERENCES fases_proyecto(id_fase) ON DELETE SET NULL,
    FOREIGN KEY (responsable_id) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_fase (id_fase),
    INDEX idx_fecha_objetivo (fecha_objetivo),
    INDEX idx_estado_hito (estado_hito)
);

-- ================================================================
-- TABLA DE TIPOS DE INSUMO (RF12, RF45)
-- ================================================================
CREATE TABLE tipos_insumo (
    id_tipo_insumo INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    categoria ENUM('organico', 'quimico', 'herramienta', 'maquinaria', 'semilla', 'fertilizante', 'pesticida', 'otro') NOT NULL,
    descripcion TEXT,
    unidad_medida_default VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    INDEX idx_categoria (categoria),
    INDEX idx_activo (activo)
);

-- ================================================================
-- TABLA DE PROVEEDORES (RF16, RF18)
-- ================================================================
CREATE TABLE proveedores (
    id_proveedor INT PRIMARY KEY AUTO_INCREMENT,
    nombre_empresa VARCHAR(200) NOT NULL,
    nit VARCHAR(20) UNIQUE NOT NULL,
    contacto_nombre VARCHAR(150),
    telefono VARCHAR(20),
    email VARCHAR(150),
    direccion TEXT,
    ciudad VARCHAR(100),
    departamento VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nit (nit),
    INDEX idx_activo (activo)
);

-- ================================================================
-- TABLA DE PRODUCTOS/INSUMOS DE PROVEEDORES (RF06)
-- ================================================================
CREATE TABLE productos_proveedor (
    id_producto INT PRIMARY KEY AUTO_INCREMENT,
    id_proveedor INT NOT NULL,
    id_tipo_insumo INT NOT NULL,
    nombre_producto VARCHAR(200) NOT NULL,
    descripcion TEXT,
    precio_unitario DECIMAL(10,2),
    unidad_medida VARCHAR(20),
    disponible BOOLEAN DEFAULT TRUE,
    fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
    FOREIGN KEY (id_tipo_insumo) REFERENCES tipos_insumo(id_tipo_insumo),
    INDEX idx_proveedor (id_proveedor),
    INDEX idx_tipo_insumo (id_tipo_insumo),
    INDEX idx_disponible (disponible)
);

-- ================================================================
-- TABLA DE INSUMOS UTILIZADOS EN PROYECTO (RF12, RF38, RF45)
-- ================================================================
CREATE TABLE insumos_proyecto (
    id_insumo INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_tipo_insumo INT NOT NULL,
    id_proveedor INT NULL,
    nombre_insumo VARCHAR(200) NOT NULL,
    cantidad_utilizada DECIMAL(10,3) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    costo_unitario DECIMAL(10,2),
    costo_total DECIMAL(12,2) GENERATED ALWAYS AS (cantidad_utilizada * costo_unitario) STORED,
    fecha_uso DATE NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_tipo_insumo) REFERENCES tipos_insumo(id_tipo_insumo),
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_tipo_insumo (id_tipo_insumo),
    INDEX idx_fecha_uso (fecha_uso)
);

-- ================================================================
-- TABLA DE GASTOS DEL PROYECTO (RF19, RF32)
-- ================================================================
CREATE TABLE gastos_proyecto (
    id_gasto INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_fase INT NULL,
    concepto VARCHAR(200) NOT NULL,
    descripcion TEXT,
    monto DECIMAL(12,2) NOT NULL,
    fecha_gasto DATE NOT NULL,
    tipo_gasto ENUM('insumo', 'mano_obra', 'maquinaria', 'servicios', 'transporte', 'otro') NOT NULL,
    comprobante_numero VARCHAR(100),
    comprobante_archivo VARCHAR(255),
    registrado_por INT NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_fase) REFERENCES fases_proyecto(id_fase) ON DELETE SET NULL,
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_fase (id_fase),
    INDEX idx_fecha_gasto (fecha_gasto),
    INDEX idx_tipo_gasto (tipo_gasto)
);

-- ================================================================
-- TABLA DE MANO DE OBRA (RF29)
-- ================================================================
CREATE TABLE mano_obra_proyecto (
    id_mano_obra INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_fase INT NULL,
    nombre_trabajador VARCHAR(150),
    tipo_trabajo VARCHAR(100),
    horas_trabajadas DECIMAL(6,2) NOT NULL,
    costo_por_hora DECIMAL(8,2) NOT NULL,
    costo_total DECIMAL(10,2) GENERATED ALWAYS AS (horas_trabajadas * costo_por_hora) STORED,
    fecha_trabajo DATE NOT NULL,
    observaciones TEXT,
    documento_soporte VARCHAR(255),
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_fase) REFERENCES fases_proyecto(id_fase) ON DELETE SET NULL,
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_fase (id_fase),
    INDEX idx_fecha_trabajo (fecha_trabajo)
);

-- ================================================================
-- TABLA DE MAQUINARIA Y HERRAMIENTAS (RF31)
-- ================================================================
CREATE TABLE maquinaria_herramientas (
    id_maquinaria INT PRIMARY KEY AUTO_INCREMENT,
    codigo_identificacion VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    tipo ENUM('maquinaria', 'herramienta') NOT NULL,
    descripcion TEXT,
    estado ENUM('disponible', 'en_uso', 'mantenimiento', 'fuera_servicio') DEFAULT 'disponible',
    fecha_adquisicion DATE,
    costo_adquisicion DECIMAL(12,2),
    vida_util_años INT,
    observaciones TEXT,
    activo BOOLEAN DEFAULT TRUE,
    INDEX idx_codigo (codigo_identificacion),
    INDEX idx_tipo (tipo),
    INDEX idx_estado (estado)
);

-- ================================================================
-- TABLA DE USO DE MAQUINARIA EN PROYECTOS
-- ================================================================
CREATE TABLE uso_maquinaria_proyecto (
    id_uso INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_maquinaria INT NOT NULL,
    fecha_inicio_uso DATE NOT NULL,
    fecha_fin_uso DATE,
    horas_uso DECIMAL(8,2),
    costo_uso DECIMAL(10,2),
    operador VARCHAR(150),
    observaciones TEXT,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_maquinaria) REFERENCES maquinaria_herramientas(id_maquinaria),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_maquinaria (id_maquinaria),
    INDEX idx_fechas_uso (fecha_inicio_uso, fecha_fin_uso)
);

-- ================================================================
-- TABLA DE ENTIDADES COLABORADORAS (RF21-RF22)
-- ================================================================
CREATE TABLE entidades_colaboradoras (
    id_entidad INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(200) NOT NULL UNIQUE,
    tipo_entidad ENUM('universidad', 'ong', 'gubernamental', 'empresa_privada', 'asociacion', 'otro') NOT NULL,
    contacto_principal VARCHAR(150),
    telefono VARCHAR(20),
    email VARCHAR(150),
    direccion TEXT,
    funcion_sistema TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tipo_entidad (tipo_entidad),
    INDEX idx_activo (activo)
);

-- ================================================================
-- TABLA DE COLABORACIONES EN PROYECTOS
-- ================================================================
CREATE TABLE colaboraciones_proyecto (
    id_colaboracion INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_entidad INT NOT NULL,
    tipo_colaboracion VARCHAR(100),
    descripcion_colaboracion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado_colaboracion ENUM('solicitada', 'aprobada', 'activa', 'finalizada', 'cancelada') DEFAULT 'solicitada',
    solicitado_por INT NOT NULL,
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_entidad) REFERENCES entidades_colaboradoras(id_entidad),
    FOREIGN KEY (solicitado_por) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_entidad (id_entidad),
    INDEX idx_estado (estado_colaboracion)
);

-- ================================================================
-- TABLA DE ASESORÍAS TÉCNICAS (RF11)
-- ================================================================
CREATE TABLE asesorias_tecnicas (
    id_asesoria INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_asesor INT NULL,
    motivo TEXT NOT NULL,
    prioridad ENUM('baja', 'media', 'alta', 'urgente') DEFAULT 'media',
    estado ENUM('solicitada', 'asignada', 'en_progreso', 'completada', 'cancelada') DEFAULT 'solicitada',
    fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_asignacion DATETIME NULL,
    fecha_completado DATETIME NULL,
    solucion_propuesta TEXT,
    observaciones_asesor TEXT,
    calificacion_servicio TINYINT CHECK (calificacion_servicio BETWEEN 1 AND 5),
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_asesor) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_asesor (id_asesor),
    INDEX idx_estado (estado),
    INDEX idx_prioridad (prioridad)
);

-- ================================================================
-- TABLA DE DOCUMENTOS DEL PROYECTO (RF10, RF26, RF60)
-- ================================================================
CREATE TABLE documentos_proyecto (
    id_documento INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_fase INT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    tipo_documento ENUM('acta', 'informe', 'contrato', 'factura', 'foto', 'video', 'certificado', 'otro') NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    tamaño_archivo INT,
    mime_type VARCHAR(100),
    descripcion TEXT,
    subido_por INT NOT NULL,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_fase) REFERENCES fases_proyecto(id_fase) ON DELETE SET NULL,
    FOREIGN KEY (subido_por) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_fase (id_fase),
    INDEX idx_tipo_documento (tipo_documento),
    INDEX idx_fecha_subida (fecha_subida)
);

-- ================================================================
-- TABLA DE FOTOS GEORREFERENCIADAS (RF24)
-- ================================================================
CREATE TABLE fotos_proyecto (
    id_foto INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    id_documento INT NOT NULL,
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    altitud DECIMAL(8, 2),
    fecha_captura DATETIME,
    etapa_proyecto VARCHAR(100),
    descripcion_foto TEXT,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_documento) REFERENCES documentos_proyecto(id_documento) ON DELETE CASCADE,
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_coordenadas (latitud, longitud)
);

-- ================================================================
-- TABLA DE NORMATIVAS Y CERTIFICACIONES (RF30)
-- ================================================================
CREATE TABLE normativas_proyecto (
    id_normativa INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    nombre_normativa VARCHAR(200) NOT NULL,
    tipo_normativa ENUM('bpa', 'organico', 'iso', 'ica', 'invima', 'otra') NOT NULL,
    estado_cumplimiento ENUM('no_aplicable', 'pendiente', 'en_proceso', 'cumplida', 'vencida') DEFAULT 'pendiente',
    fecha_verificacion DATE,
    fecha_vencimiento DATE,
    documento_soporte VARCHAR(255),
    observaciones TEXT,
    verificado_por INT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (verificado_por) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_tipo_normativa (tipo_normativa),
    INDEX idx_estado_cumplimiento (estado_cumplimiento)
);

-- ================================================================
-- TABLA DE REUNIONES Y ASESORÍAS VIRTUALES (RF34)
-- ================================================================
CREATE TABLE reuniones_virtuales (
    id_reunion INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_programada DATETIME NOT NULL,
    duracion_minutos INT DEFAULT 60,
    enlace_reunion VARCHAR(500),
    plataforma ENUM('zoom', 'meet', 'teams', 'otra') DEFAULT 'meet',
    estado_reunion ENUM('programada', 'en_curso', 'completada', 'cancelada') DEFAULT 'programada',
    organizador_id INT NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (organizador_id) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_fecha_programada (fecha_programada),
    INDEX idx_estado_reunion (estado_reunion)
);

-- ================================================================
-- TABLA DE PARTICIPANTES EN REUNIONES
-- ================================================================
CREATE TABLE participantes_reunion (
    id_participante INT PRIMARY KEY AUTO_INCREMENT,
    id_reunion INT NOT NULL,
    id_usuario INT NOT NULL,
    rol_reunion ENUM('organizador', 'participante', 'observador') DEFAULT 'participante',
    confirmacion ENUM('pendiente', 'confirmado', 'rechazado') DEFAULT 'pendiente',
    asistio BOOLEAN DEFAULT FALSE,
    fecha_respuesta DATETIME,
    FOREIGN KEY (id_reunion) REFERENCES reuniones_virtuales(id_reunion) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    INDEX idx_reunion (id_reunion),
    INDEX idx_usuario (id_usuario),
    UNIQUE KEY unique_participante_reunion (id_reunion, id_usuario)
);

-- ================================================================
-- TABLA DE NOTIFICACIONES (RF63, RF66)
-- ================================================================
CREATE TABLE notificaciones (
    id_notificacion INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    tipo ENUM('info', 'warning', 'error', 'success') DEFAULT 'info',
    categoria ENUM('proyecto', 'asesoria', 'reunion', 'sistema', 'otro') DEFAULT 'proyecto',
    leida BOOLEAN DEFAULT FALSE,
    enviada_email BOOLEAN DEFAULT FALSE,
    enviada_sms BOOLEAN DEFAULT FALSE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_lectura DATETIME NULL,
    datos_adicionales JSON,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    INDEX idx_usuario (id_usuario),
    INDEX idx_leida (leida),
    INDEX idx_fecha_creacion (fecha_creacion),
    INDEX idx_categoria (categoria)
);

-- ================================================================
-- TABLA DE CONFIGURACIÓN DEL SISTEMA (RF35-RF37)
-- ================================================================
CREATE TABLE configuracion_sistema (
    id_config INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    tipo_dato ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    categoria VARCHAR(50),
    modificado_por INT,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (modificado_por) REFERENCES usuarios(id_usuario),
    INDEX idx_clave (clave),
    INDEX idx_categoria (categoria)
);

-- ================================================================
-- TABLA DE COPIAS DE SEGURIDAD (RF35-RF36)
-- ================================================================
CREATE TABLE copias_seguridad (
    id_copia INT PRIMARY KEY AUTO_INCREMENT,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    tamaño_mb DECIMAL(10,2),
    tipo_copia ENUM('manual', 'automatica') NOT NULL,
    estado ENUM('en_progreso', 'completada', 'fallida') DEFAULT 'en_progreso',
    iniciado_por INT NULL,
    fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_completado DATETIME NULL,
    observaciones TEXT,
    FOREIGN KEY (iniciado_por) REFERENCES usuarios(id_usuario),
    INDEX idx_fecha_inicio (fecha_inicio),
    INDEX idx_estado (estado),
    INDEX idx_tipo_copia (tipo_copia)
);

-- ================================================================
-- TABLA DE MONITOREO DEL SISTEMA (RF37)
-- ================================================================
CREATE TABLE monitoreo_sistema (
    id_monitoreo INT PRIMARY KEY AUTO_INCREMENT,
    componente VARCHAR(100) NOT NULL,
    metrica VARCHAR(100) NOT NULL,
    valor DECIMAL(15,4),
    unidad VARCHAR(20),
    estado ENUM('normal', 'advertencia', 'critico') DEFAULT 'normal',
    timestamp_medicion DATETIME DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    INDEX idx_componente (componente),
    INDEX idx_metrica (metrica),
    INDEX idx_timestamp (timestamp_medicion),
    INDEX idx_estado (estado)
);

-- ================================================================
-- INSERTAR DATOS INICIALES
-- ================================================================

-- Insertar usuario administrador por defecto (RF48)
INSERT INTO usuarios (nombre, apellido, email, password_hash, rol) VALUES 
('Admin', 'Sistema', 'admin@agrotechnova.com', '$2a$12$LQv3c1yqBWVHxkd0LQ1Gau.4I3n9QRAr4X7mErhcPjnZT.8K5Tk8W', 'administrador');

-- Insertar tipos de insumo básicos
INSERT INTO tipos_insumo (nombre, categoria, descripcion, unidad_medida_default) VALUES
('Semilla de Maíz', 'semilla', 'Semillas para cultivo de maíz', 'kg'),
('Fertilizante NPK', 'fertilizante', 'Fertilizante nitrógeno, fósforo, potasio', 'kg'),
('Abono Orgánico', 'organico', 'Compost y abonos orgánicos', 'kg'),
('Pesticida Orgánico', 'organico', 'Control de plagas orgánico', 'litros'),
('Herbicida', 'quimico', 'Control de malezas', 'litros'),
('Azadón', 'herramienta', 'Herramienta manual para labranza', 'unidad'),
('Tractor', 'maquinaria', 'Maquinaria agrícola pesada', 'unidad');

-- Insertar configuraciones básicas del sistema
INSERT INTO configuracion_sistema (clave, valor, descripcion, tipo_dato, categoria) VALUES
('backup_frequency_hours', '24', 'Frecuencia de copias automáticas en horas', 'number', 'backup'),
('max_file_size_mb', '5', 'Tamaño máximo de archivo en MB', 'number', 'uploads'),
('notification_email_enabled', 'true', 'Activar notificaciones por email', 'boolean', 'notifications'),
('session_timeout_minutes', '480', 'Tiempo de sesión en minutos', 'number', 'security');

-- ================================================================
-- PROCEDIMIENTOS ALMACENADOS Y TRIGGERS
-- ================================================================

-- Trigger para actualizar fecha de modificación en proyectos
DELIMITER //
CREATE TRIGGER update_project_modified 
    BEFORE UPDATE ON proyectos
    FOR EACH ROW 
BEGIN 
    SET NEW.fecha_modificacion = NOW();
END//
DELIMITER ;

-- Trigger para calcular presupuesto total del proyecto
DELIMITER //
CREATE TRIGGER update_project_budget
    AFTER INSERT ON fases_proyecto
    FOR EACH ROW
BEGIN
    UPDATE proyectos 
    SET presupuesto_total = (
        SELECT COALESCE(SUM(presupuesto_fase), 0) 
        FROM fases_proyecto 
        WHERE id_proyecto = NEW.id_proyecto
    )
    WHERE id_proyecto = NEW.id_proyecto;
END//
DELIMITER ;

-- ================================================================
-- VISTAS ÚTILES
-- ================================================================

-- Vista de resumen de proyectos
CREATE VIEW vista_resumen_proyectos AS
SELECT 
    p.id_proyecto,
    p.nombre,
    p.categoria,
    p.estado,
    p.fecha_inicio,
    p.fecha_fin,
    p.presupuesto_total,
    CONCAT(prod.nombre, ' ', prod.apellido) as productor,
    CONCAT(ases.nombre, ' ', ases.apellido) as asesor,
    COUNT(f.id_fase) as total_fases,
    COALESCE(SUM(g.monto), 0) as total_gastado,
    (p.presupuesto_total - COALESCE(SUM(g.monto), 0)) as presupuesto_restante
FROM proyectos p
LEFT JOIN usuarios prod ON p.id_productor = prod.id_usuario
LEFT JOIN usuarios ases ON p.id_asesor = ases.id_usuario
LEFT JOIN fases_proyecto f ON p.id_proyecto = f.id_proyecto
LEFT JOIN gastos_proyecto g ON p.id_proyecto = g.id_proyecto
GROUP BY p.id_proyecto;

-- Vista de asesorías pendientes
CREATE VIEW vista_asesorias_pendientes AS
SELECT 
    a.id_asesoria,
    a.motivo,
    a.prioridad,
    a.fecha_solicitud,
    p.nombre as proyecto,
    CONCAT(prod.nombre, ' ', prod.apellido) as productor,
    CONCAT(ases.nombre, ' ', ases.apellido) as asesor_asignado
FROM asesorias_tecnicas a
JOIN proyectos p ON a.id_proyecto = p.id_proyecto
JOIN usuarios prod ON p.id_productor = prod.id_usuario
LEFT JOIN usuarios ases ON a.id_asesor = ases.id_usuario
WHERE a.estado IN ('solicitada', 'asignada', 'en_progreso')
ORDER BY 
    CASE a.prioridad 
        WHEN 'urgente' THEN 1 
        WHEN 'alta' THEN 2 
        WHEN 'media' THEN 3 
        WHEN 'baja' THEN 4 
    END,
    a.fecha_solicitud;

-- ================================================================
-- ÍNDICES ADICIONALES PARA OPTIMIZACIÓN
-- ================================================================

-- Índices compuestos para consultas frecuentes
CREATE INDEX idx_proyecto_estado_categoria ON proyectos(estado, categoria);
CREATE INDEX idx_gastos_proyecto_fecha ON gastos_proyecto(id_proyecto, fecha_gasto);
CREATE INDEX idx_insumos_proyecto_fecha ON insumos_proyecto(id_proyecto, fecha_uso);
CREATE INDEX idx_notificaciones_usuario_leida ON notificaciones(id_usuario, leida, fecha_creacion);

COMMIT;