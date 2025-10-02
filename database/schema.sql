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
-- TABLA DE TIPOS DE RECURSO (RF01)
-- ================================================================
CREATE TABLE tipos_recurso (
    id_tipo_recurso INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    categoria ENUM('material', 'humano', 'financiero', 'maquinaria', 'servicio') NOT NULL,
    descripcion TEXT,
    unidad_medida VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_categoria (categoria),
    INDEX idx_activo (activo)
);

-- ================================================================
-- TABLA DE RECURSOS PLANIFICADOS POR FASE (RF01)
-- ================================================================
CREATE TABLE recursos_planificados_fase (
    id_recurso_planificado INT PRIMARY KEY AUTO_INCREMENT,
    id_fase INT NOT NULL,
    id_tipo_recurso INT NOT NULL,
    nombre_recurso VARCHAR(200) NOT NULL,
    cantidad_planificada DECIMAL(10,3) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL,
    costo_unitario_estimado DECIMAL(10,2),
    costo_total_estimado DECIMAL(12,2) GENERATED ALWAYS AS (cantidad_planificada * costo_unitario_estimado) STORED,
    fecha_inicio_uso DATE,
    fecha_fin_uso DATE,
    descripcion TEXT,
    estado_asignacion ENUM('planificado', 'asignado', 'en_uso', 'completado', 'cancelado') DEFAULT 'planificado',
    responsable_asignacion INT NULL,
    fecha_planificacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    observaciones TEXT,
    FOREIGN KEY (id_fase) REFERENCES fases_proyecto(id_fase) ON DELETE CASCADE,
    FOREIGN KEY (id_tipo_recurso) REFERENCES tipos_recurso(id_tipo_recurso),
    FOREIGN KEY (responsable_asignacion) REFERENCES usuarios(id_usuario),
    INDEX idx_fase (id_fase),
    INDEX idx_tipo_recurso (id_tipo_recurso),
    INDEX idx_estado_asignacion (estado_asignacion),
    INDEX idx_fechas_uso (fecha_inicio_uso, fecha_fin_uso)
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
-- TABLA DE LÍMITES FINANCIEROS DEL CLIENTE (RF02)
-- ================================================================
CREATE TABLE limites_financieros_cliente (
    id_limite INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    presupuesto_maximo_total DECIMAL(15,2) NOT NULL,
    presupuesto_maximo_fase DECIMAL(12,2),
    margen_variacion_porcentaje DECIMAL(5,2) DEFAULT 10.00,
    observaciones TEXT,
    definido_por INT NOT NULL,
    fecha_definicion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (definido_por) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_activo (activo)
);

-- ================================================================
-- TABLA DE HISTORIAL DE CAMBIOS DE PRESUPUESTO (RF02)
-- ================================================================
CREATE TABLE historial_presupuesto (
    id_historial INT PRIMARY KEY AUTO_INCREMENT,
    tipo_entidad ENUM('proyecto', 'fase') NOT NULL,
    id_entidad INT NOT NULL,
    campo_modificado ENUM('presupuesto_total', 'presupuesto_fase') NOT NULL,
    valor_anterior DECIMAL(15,2),
    valor_nuevo DECIMAL(15,2) NOT NULL,
    diferencia DECIMAL(15,2) GENERATED ALWAYS AS (valor_nuevo - valor_anterior) STORED,
    motivo_cambio TEXT,
    usuario_modificacion INT NOT NULL,
    fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_origen VARCHAR(45),
    validado_por_limite BOOLEAN DEFAULT TRUE,
    excede_limite BOOLEAN DEFAULT FALSE,
    observaciones_validacion TEXT,
    FOREIGN KEY (usuario_modificacion) REFERENCES usuarios(id_usuario),
    INDEX idx_tipo_entidad (tipo_entidad, id_entidad),
    INDEX idx_fecha_cambio (fecha_cambio),
    INDEX idx_usuario (usuario_modificacion),
    INDEX idx_excede_limite (excede_limite)
);

-- ================================================================
-- TABLA DE ALERTAS DE PRESUPUESTO (RF02)
-- ================================================================
CREATE TABLE alertas_presupuesto (
    id_alerta INT PRIMARY KEY AUTO_INCREMENT,
    id_proyecto INT NOT NULL,
    tipo_alerta ENUM('limite_excedido', 'margen_alcanzado', 'revision_requerida') NOT NULL,
    mensaje TEXT NOT NULL,
    porcentaje_uso DECIMAL(5,2),
    monto_excedido DECIMAL(12,2),
    estado_alerta ENUM('activa', 'revisada', 'resuelta') DEFAULT 'activa',
    fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    revisada_por INT NULL,
    fecha_revision DATETIME NULL,
    accion_tomada TEXT,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (revisada_por) REFERENCES usuarios(id_usuario),
    INDEX idx_proyecto (id_proyecto),
    INDEX idx_tipo_alerta (tipo_alerta),
    INDEX idx_estado_alerta (estado_alerta),
    INDEX idx_fecha_generacion (fecha_generacion)
);

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

-- ================================================================
-- TRIGGERS PARA HISTORIAL DE PRESUPUESTO (RF02)
-- ================================================================

DELIMITER //

-- Trigger para registrar cambios de presupuesto en proyectos
CREATE TRIGGER trigger_historial_presupuesto_proyecto
    AFTER UPDATE ON proyectos
    FOR EACH ROW
BEGIN
    IF OLD.presupuesto_total != NEW.presupuesto_total THEN
        INSERT INTO historial_presupuesto (
            tipo_entidad, 
            id_entidad, 
            campo_modificado, 
            valor_anterior, 
            valor_nuevo,
            usuario_modificacion
        ) VALUES (
            'proyecto', 
            NEW.id_proyecto, 
            'presupuesto_total', 
            OLD.presupuesto_total, 
            NEW.presupuesto_total,
            @current_user_id
        );
    END IF;
END//

-- Trigger para registrar cambios de presupuesto en fases
CREATE TRIGGER trigger_historial_presupuesto_fase
    AFTER UPDATE ON fases_proyecto
    FOR EACH ROW
BEGIN
    IF OLD.presupuesto_fase != NEW.presupuesto_fase THEN
        INSERT INTO historial_presupuesto (
            tipo_entidad, 
            id_entidad, 
            campo_modificado, 
            valor_anterior, 
            valor_nuevo,
            usuario_modificacion
        ) VALUES (
            'fase', 
            NEW.id_fase, 
            'presupuesto_fase', 
            OLD.presupuesto_fase, 
            NEW.presupuesto_fase,
            @current_user_id
        );
    END IF;
END//

-- Trigger para validar límites financieros al actualizar proyecto
CREATE TRIGGER trigger_validar_limite_proyecto
    BEFORE UPDATE ON proyectos
    FOR EACH ROW
BEGIN
    DECLARE limite_maximo DECIMAL(15,2);
    DECLARE margen_variacion DECIMAL(5,2);
    
    -- Obtener límite financiero del proyecto
    SELECT lfc.presupuesto_maximo_total, lfc.margen_variacion_porcentaje
    INTO limite_maximo, margen_variacion
    FROM limites_financieros_cliente lfc
    WHERE lfc.id_proyecto = NEW.id_proyecto AND lfc.activo = TRUE
    LIMIT 1;
    
    -- Si existe límite, validar
    IF limite_maximo IS NOT NULL THEN
        IF NEW.presupuesto_total > limite_maximo THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'El presupuesto total excede el límite máximo establecido por el cliente';
        END IF;
    END IF;
END//

DELIMITER ;

-- ================================================================
-- ESTRUCTURAS PARA RF03: ASIGNACIÓN DE PERSONAL A TAREAS
-- ================================================================

-- Tabla para definir tareas dentro de las fases del proyecto
CREATE TABLE tareas_proyecto (
    id_tarea INT PRIMARY KEY AUTO_INCREMENT,
    id_fase INT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    fecha_inicio_real DATE,
    fecha_fin_real DATE,
    estado ENUM('pendiente', 'en_progreso', 'completada', 'suspendida', 'cancelada') DEFAULT 'pendiente',
    prioridad ENUM('baja', 'media', 'alta', 'critica') DEFAULT 'media',
    progreso_porcentaje DECIMAL(5,2) DEFAULT 0.00,
    horas_estimadas DECIMAL(6,2),
    horas_reales DECIMAL(6,2) DEFAULT 0.00,
    dependencias JSON, -- IDs de tareas de las que depende
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    usuario_creacion INT,
    
    FOREIGN KEY (id_fase) REFERENCES fases_proyecto(id_fase) ON DELETE CASCADE,
    FOREIGN KEY (usuario_creacion) REFERENCES usuarios(id_usuario),
    
    INDEX idx_tarea_fase (id_fase),
    INDEX idx_tarea_estado (estado),
    INDEX idx_tarea_fechas (fecha_inicio, fecha_fin),
    INDEX idx_tarea_prioridad (prioridad)
);

-- Tabla para definir roles que pueden tener los miembros en las tareas
CREATE TABLE roles_tarea (
    id_rol_tarea INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    permisos JSON, -- Permisos específicos del rol
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rol_activo (activo)
);

-- Tabla para gestionar la disponibilidad de los miembros del equipo
CREATE TABLE disponibilidad_miembros (
    id_disponibilidad INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    horas_disponibles_dia DECIMAL(4,2) DEFAULT 8.00,
    dias_semana JSON, -- [1,2,3,4,5] para lun-vie
    observaciones TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    
    INDEX idx_disponibilidad_usuario (id_usuario),
    INDEX idx_disponibilidad_fechas (fecha_inicio, fecha_fin),
    INDEX idx_disponibilidad_activo (activo)
);

-- Tabla para las asignaciones de personal a tareas
CREATE TABLE asignaciones_personal (
    id_asignacion INT PRIMARY KEY AUTO_INCREMENT,
    id_tarea INT NOT NULL,
    id_usuario INT NOT NULL,
    id_rol_tarea INT NOT NULL,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio_asignacion DATE,
    fecha_fin_asignacion DATE,
    horas_asignadas DECIMAL(6,2),
    horas_trabajadas DECIMAL(6,2) DEFAULT 0.00,
    porcentaje_dedicacion DECIMAL(5,2) DEFAULT 100.00, -- % de tiempo dedicado a esta tarea
    estado_asignacion ENUM('asignada', 'activa', 'completada', 'suspendida', 'cancelada') DEFAULT 'asignada',
    observaciones TEXT,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    usuario_asignador INT,
    
    FOREIGN KEY (id_tarea) REFERENCES tareas_proyecto(id_tarea) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_rol_tarea) REFERENCES roles_tarea(id_rol_tarea),
    FOREIGN KEY (usuario_asignador) REFERENCES usuarios(id_usuario),
    
    -- Un usuario no puede tener el mismo rol en la misma tarea múltiples veces
    UNIQUE KEY unique_user_role_task (id_tarea, id_usuario, id_rol_tarea),
    
    INDEX idx_asignacion_tarea (id_tarea),
    INDEX idx_asignacion_usuario (id_usuario),
    INDEX idx_asignacion_fechas (fecha_inicio_asignacion, fecha_fin_asignacion),
    INDEX idx_asignacion_estado (estado_asignacion)
);

-- Tabla para registro de conflictos de disponibilidad
CREATE TABLE conflictos_asignacion (
    id_conflicto INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    id_tarea_1 INT NOT NULL,
    id_tarea_2 INT NOT NULL,
    tipo_conflicto ENUM('temporal', 'sobrecarga', 'disponibilidad') NOT NULL,
    fecha_inicio_conflicto DATE,
    fecha_fin_conflicto DATE,
    descripcion TEXT,
    estado_resolucion ENUM('pendiente', 'resuelto', 'ignorado') DEFAULT 'pendiente',
    resolucion TEXT,
    fecha_deteccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMP NULL,
    usuario_resolucion INT,
    
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_tarea_1) REFERENCES tareas_proyecto(id_tarea) ON DELETE CASCADE,
    FOREIGN KEY (id_tarea_2) REFERENCES tareas_proyecto(id_tarea) ON DELETE CASCADE,
    FOREIGN KEY (usuario_resolucion) REFERENCES usuarios(id_usuario),
    
    INDEX idx_conflicto_usuario (id_usuario),
    INDEX idx_conflicto_estado (estado_resolucion),
    INDEX idx_conflicto_fechas (fecha_inicio_conflicto, fecha_fin_conflicto)
);

-- ================================================================
-- DATOS INICIALES PARA RF03
-- ================================================================

-- Insertar roles de tarea básicos
INSERT INTO roles_tarea (nombre, descripcion, permisos) VALUES
('Responsable', 'Responsable principal de la tarea', '["editar_tarea", "asignar_personal", "marcar_completada"]'),
('Colaborador', 'Miembro colaborador en la tarea', '["ver_tarea", "actualizar_progreso", "registrar_horas"]'),
('Supervisor', 'Supervisor de la tarea', '["ver_tarea", "aprobar_avance", "generar_reportes"]'),
('Especialista', 'Especialista técnico en área específica', '["ver_tarea", "asesorar", "validar_calidad"]');

-- ================================================================
-- TRIGGERS Y PROCEDIMIENTOS PARA RF03
-- ================================================================

DELIMITER //

-- Trigger para detectar conflictos de asignación antes de insertar
CREATE TRIGGER trigger_detectar_conflictos_asignacion
    BEFORE INSERT ON asignaciones_personal
    FOR EACH ROW
BEGIN
    DECLARE conflicto_count INT DEFAULT 0;
    DECLARE mensaje_error VARCHAR(500);
    
    -- Verificar que el usuario esté activo
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = NEW.id_usuario AND activo = TRUE) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'No se puede asignar un usuario inactivo a la tarea';
    END IF;
    
    -- Verificar conflictos temporales solo si hay fechas definidas
    IF NEW.fecha_inicio_asignacion IS NOT NULL AND NEW.fecha_fin_asignacion IS NOT NULL THEN
        SELECT COUNT(*) INTO conflicto_count
        FROM asignaciones_personal ap
        INNER JOIN tareas_proyecto tp ON ap.id_tarea = tp.id_tarea
        WHERE ap.id_usuario = NEW.id_usuario
          AND ap.estado_asignacion IN ('asignada', 'activa')
          AND ap.fecha_inicio_asignacion IS NOT NULL 
          AND ap.fecha_fin_asignacion IS NOT NULL
          AND (
              (NEW.fecha_inicio_asignacion BETWEEN ap.fecha_inicio_asignacion AND ap.fecha_fin_asignacion)
              OR (NEW.fecha_fin_asignacion BETWEEN ap.fecha_inicio_asignacion AND ap.fecha_fin_asignacion)
              OR (ap.fecha_inicio_asignacion BETWEEN NEW.fecha_inicio_asignacion AND NEW.fecha_fin_asignacion)
          );
          
        IF conflicto_count > 0 THEN
            SET mensaje_error = CONCAT('El usuario ya tiene asignaciones en el período ', 
                                     NEW.fecha_inicio_asignacion, ' - ', NEW.fecha_fin_asignacion);
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = mensaje_error;
        END IF;
    END IF;
END//

-- Trigger para actualizar progreso de la tarea basado en horas trabajadas
CREATE TRIGGER trigger_actualizar_progreso_tarea
    AFTER UPDATE ON asignaciones_personal
    FOR EACH ROW
BEGIN
    DECLARE total_horas_estimadas DECIMAL(6,2);
    DECLARE total_horas_trabajadas DECIMAL(6,2);
    DECLARE nuevo_progreso DECIMAL(5,2);
    
    -- Obtener horas estimadas de la tarea
    SELECT horas_estimadas INTO total_horas_estimadas
    FROM tareas_proyecto 
    WHERE id_tarea = NEW.id_tarea;
    
    -- Calcular total de horas trabajadas por todos los asignados
    SELECT COALESCE(SUM(horas_trabajadas), 0) INTO total_horas_trabajadas
    FROM asignaciones_personal 
    WHERE id_tarea = NEW.id_tarea 
      AND estado_asignacion IN ('activa', 'completada');
    
    -- Calcular nuevo progreso
    IF total_horas_estimadas > 0 THEN
        SET nuevo_progreso = LEAST(100.00, (total_horas_trabajadas / total_horas_estimadas) * 100);
        
        UPDATE tareas_proyecto 
        SET progreso_porcentaje = nuevo_progreso,
            horas_reales = total_horas_trabajadas
        WHERE id_tarea = NEW.id_tarea;
    END IF;
END//

-- Procedimiento para detectar y registrar conflictos existentes
CREATE PROCEDURE sp_detectar_conflictos_disponibilidad(IN p_usuario_id INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_tarea1, v_tarea2 INT;
    DECLARE v_fecha_inicio1, v_fecha_fin1, v_fecha_inicio2, v_fecha_fin2 DATE;
    
    DECLARE conflictos_cursor CURSOR FOR
        SELECT a1.id_tarea, a1.fecha_inicio_asignacion, a1.fecha_fin_asignacion,
               a2.id_tarea, a2.fecha_inicio_asignacion, a2.fecha_fin_asignacion
        FROM asignaciones_personal a1
        INNER JOIN asignaciones_personal a2 ON a1.id_usuario = a2.id_usuario 
        WHERE a1.id_usuario = p_usuario_id
          AND a1.id_tarea < a2.id_tarea
          AND a1.estado_asignacion IN ('asignada', 'activa')
          AND a2.estado_asignacion IN ('asignada', 'activa')
          AND a1.fecha_inicio_asignacion IS NOT NULL
          AND a1.fecha_fin_asignacion IS NOT NULL
          AND a2.fecha_inicio_asignacion IS NOT NULL
          AND a2.fecha_fin_asignacion IS NOT NULL
          AND (
              (a1.fecha_inicio_asignacion BETWEEN a2.fecha_inicio_asignacion AND a2.fecha_fin_asignacion)
              OR (a1.fecha_fin_asignacion BETWEEN a2.fecha_inicio_asignacion AND a2.fecha_fin_asignacion)
              OR (a2.fecha_inicio_asignacion BETWEEN a1.fecha_inicio_asignacion AND a1.fecha_fin_asignacion)
          );
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN conflictos_cursor;
    
    read_loop: LOOP
        FETCH conflictos_cursor INTO v_tarea1, v_fecha_inicio1, v_fecha_fin1, v_tarea2, v_fecha_inicio2, v_fecha_fin2;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Insertar conflicto si no existe
        INSERT IGNORE INTO conflictos_asignacion (
            id_usuario, id_tarea_1, id_tarea_2, tipo_conflicto,
            fecha_inicio_conflicto, fecha_fin_conflicto, descripcion
        ) VALUES (
            p_usuario_id, v_tarea1, v_tarea2, 'temporal',
            GREATEST(v_fecha_inicio1, v_fecha_inicio2),
            LEAST(v_fecha_fin1, v_fecha_fin2),
            CONCAT('Conflicto temporal entre tareas ', v_tarea1, ' y ', v_tarea2)
        );
    END LOOP;
    
    CLOSE conflictos_cursor;
END//

DELIMITER ;

-- ================================================================
-- ESTRUCTURAS PARA RF04: SEGUIMIENTO Y ALERTAS DE USO DE RECURSOS
-- ================================================================

-- Tabla para registrar el consumo real de recursos
CREATE TABLE consumo_recursos (
    id_consumo INT PRIMARY KEY AUTO_INCREMENT,
    id_recurso_planificado INT NOT NULL,
    cantidad_consumida DECIMAL(10,2) NOT NULL,
    fecha_consumo DATE NOT NULL,
    hora_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    usuario_registro INT,
    
    FOREIGN KEY (id_recurso_planificado) REFERENCES recursos_planificados_fase(id_recurso_planificado) ON DELETE CASCADE,
    FOREIGN KEY (usuario_registro) REFERENCES usuarios(id_usuario),
    
    INDEX idx_consumo_recurso (id_recurso_planificado),
    INDEX idx_consumo_fecha (fecha_consumo),
    INDEX idx_consumo_registro (hora_registro)
);

-- Tabla para configurar umbrales de alerta por tipo de recurso
CREATE TABLE umbrales_alertas (
    id_umbral INT PRIMARY KEY AUTO_INCREMENT,
    id_tipo_recurso INT,
    id_proyecto INT,
    tipo_umbral ENUM('agotamiento', 'sobrecosto', 'retraso', 'reasignacion') NOT NULL,
    porcentaje_alerta DECIMAL(5,2), -- % de consumo para activar alerta
    cantidad_minima DECIMAL(10,2), -- cantidad mínima antes de alerta
    dias_anticipacion INT, -- días antes de fecha límite para alertar
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    usuario_creacion INT,
    
    FOREIGN KEY (id_tipo_recurso) REFERENCES tipos_recurso(id_tipo_recurso),
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (usuario_creacion) REFERENCES usuarios(id_usuario),
    
    INDEX idx_umbral_tipo (id_tipo_recurso),
    INDEX idx_umbral_proyecto (id_proyecto),
    INDEX idx_umbral_activo (activo)
);

-- Tabla para configuración de notificaciones por usuario
CREATE TABLE configuracion_notificaciones (
    id_configuracion INT PRIMARY KEY AUTO_INCREMENT,
    id_usuario INT NOT NULL,
    alertas_plataforma BOOLEAN DEFAULT TRUE,
    alertas_email BOOLEAN DEFAULT FALSE,
    frecuencia_resumen ENUM('nunca', 'diario', 'semanal') DEFAULT 'semanal',
    tipos_alerta JSON, -- ["agotamiento", "sobrecosto", "retraso", "reasignacion"]
    horario_preferido TIME DEFAULT '09:00:00',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_config (id_usuario)
);

-- Tabla para registrar alertas generadas
CREATE TABLE log_alertas (
    id_alerta INT PRIMARY KEY AUTO_INCREMENT,
    id_recurso_planificado INT,
    id_proyecto INT NOT NULL,
    tipo_alerta ENUM('agotamiento', 'sobrecosto', 'retraso', 'reasignacion') NOT NULL,
    severidad ENUM('baja', 'media', 'alta', 'critica') DEFAULT 'media',
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    datos_contexto JSON, -- información adicional sobre la alerta
    estado ENUM('activa', 'leida', 'resuelta', 'ignorada') DEFAULT 'activa',
    fecha_generacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion TIMESTAMP NULL,
    usuario_resolucion INT,
    
    FOREIGN KEY (id_recurso_planificado) REFERENCES recursos_planificados_fase(id_recurso_planificado) ON DELETE CASCADE,
    FOREIGN KEY (id_proyecto) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (usuario_resolucion) REFERENCES usuarios(id_usuario),
    
    INDEX idx_alerta_recurso (id_recurso_planificado),
    INDEX idx_alerta_proyecto (id_proyecto),
    INDEX idx_alerta_tipo (tipo_alerta),
    INDEX idx_alerta_estado (estado),
    INDEX idx_alerta_fecha (fecha_generacion)
);

-- Tabla para notificaciones enviadas a usuarios
CREATE TABLE notificaciones_enviadas (
    id_notificacion_enviada INT PRIMARY KEY AUTO_INCREMENT,
    id_alerta INT NOT NULL,
    id_usuario INT NOT NULL,
    metodo_envio ENUM('plataforma', 'email') NOT NULL,
    estado_envio ENUM('pendiente', 'enviado', 'fallido', 'leido') DEFAULT 'pendiente',
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_lectura TIMESTAMP NULL,
    detalles_envio JSON, -- información sobre el envío (email, etc.)
    
    FOREIGN KEY (id_alerta) REFERENCES log_alertas(id_alerta) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    
    INDEX idx_notif_alerta (id_alerta),
    INDEX idx_notif_usuario (id_usuario),
    INDEX idx_notif_estado (estado_envio),
    INDEX idx_notif_metodo (metodo_envio)
);

-- Vista para resumen de consumo por recurso
CREATE VIEW vista_resumen_consumo AS
SELECT 
    rpf.id_recurso_planificado,
    rpf.id_fase,
    fp.nombre as fase_nombre,
    fp.id_proyecto,
    p.nombre as proyecto_nombre,
    tr.nombre as tipo_recurso,
    tr.categoria as categoria_recurso,
    rpf.cantidad_planificada,
    rpf.costo_unitario,
    (rpf.cantidad_planificada * rpf.costo_unitario) as costo_total_planificado,
    COALESCE(SUM(cr.cantidad_consumida), 0) as cantidad_consumida,
    COALESCE(SUM(cr.cantidad_consumida * rpf.costo_unitario), 0) as costo_consumido,
    CASE 
        WHEN rpf.cantidad_planificada > 0 THEN 
            (COALESCE(SUM(cr.cantidad_consumida), 0) / rpf.cantidad_planificada * 100)
        ELSE 0 
    END as porcentaje_consumo,
    (rpf.cantidad_planificada - COALESCE(SUM(cr.cantidad_consumida), 0)) as cantidad_restante,
    rpf.fecha_inicio_uso,
    rpf.fecha_fin_uso,
    DATEDIFF(rpf.fecha_fin_uso, CURDATE()) as dias_restantes
FROM recursos_planificados_fase rpf
INNER JOIN fases_proyecto fp ON rpf.id_fase = fp.id_fase
INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
INNER JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
LEFT JOIN consumo_recursos cr ON rpf.id_recurso_planificado = cr.id_recurso_planificado
GROUP BY rpf.id_recurso_planificado;

-- ================================================================
-- DATOS INICIALES PARA RF04
-- ================================================================

-- Insertar umbrales de alerta por defecto
INSERT INTO umbrales_alertas (id_tipo_recurso, tipo_umbral, porcentaje_alerta, dias_anticipacion, usuario_creacion) 
SELECT 
    id_tipo_recurso,
    'agotamiento',
    85.0,
    7,
    1
FROM tipos_recurso;

INSERT INTO umbrales_alertas (id_tipo_recurso, tipo_umbral, porcentaje_alerta, dias_anticipacion, usuario_creacion) 
SELECT 
    id_tipo_recurso,
    'retraso',
    NULL,
    3,
    1
FROM tipos_recurso;

-- Configuración de notificaciones por defecto para usuarios existentes
INSERT INTO configuracion_notificaciones (id_usuario, alertas_plataforma, alertas_email, tipos_alerta)
SELECT 
    id_usuario,
    TRUE,
    FALSE,
    '["agotamiento", "sobrecosto", "retraso"]'
FROM usuarios
WHERE activo = TRUE;

-- ================================================================
-- TRIGGERS Y PROCEDIMIENTOS PARA RF04
-- ================================================================

DELIMITER //

-- Trigger para generar alertas automáticamente al registrar consumo
CREATE TRIGGER trigger_evaluar_alertas_consumo
    AFTER INSERT ON consumo_recursos
    FOR EACH ROW
BEGIN
    DECLARE v_cantidad_planificada DECIMAL(10,2);
    DECLARE v_cantidad_total_consumida DECIMAL(10,2);
    DECLARE v_porcentaje_consumo DECIMAL(5,2);
    DECLARE v_id_tipo_recurso INT;
    DECLARE v_id_proyecto INT;
    DECLARE v_umbral_agotamiento DECIMAL(5,2);
    DECLARE v_fase_nombre VARCHAR(200);
    DECLARE v_recurso_nombre VARCHAR(200);
    
    -- Obtener información del recurso
    SELECT 
        rpf.cantidad_planificada,
        rpf.id_tipo_recurso,
        fp.id_proyecto,
        fp.nombre,
        tr.nombre
    INTO v_cantidad_planificada, v_id_tipo_recurso, v_id_proyecto, v_fase_nombre, v_recurso_nombre
    FROM recursos_planificados_fase rpf
    INNER JOIN fases_proyecto fp ON rpf.id_fase = fp.id_fase
    INNER JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
    WHERE rpf.id_recurso_planificado = NEW.id_recurso_planificado;
    
    -- Calcular consumo total actual
    SELECT COALESCE(SUM(cantidad_consumida), 0)
    INTO v_cantidad_total_consumida
    FROM consumo_recursos
    WHERE id_recurso_planificado = NEW.id_recurso_planificado;
    
    -- Calcular porcentaje de consumo
    IF v_cantidad_planificada > 0 THEN
        SET v_porcentaje_consumo = (v_cantidad_total_consumida / v_cantidad_planificada) * 100;
        
        -- Obtener umbral de agotamiento
        SELECT porcentaje_alerta
        INTO v_umbral_agotamiento
        FROM umbrales_alertas
        WHERE (id_tipo_recurso = v_id_tipo_recurso OR id_tipo_recurso IS NULL)
          AND (id_proyecto = v_id_proyecto OR id_proyecto IS NULL)
          AND tipo_umbral = 'agotamiento'
          AND activo = TRUE
        ORDER BY id_proyecto DESC, id_tipo_recurso DESC
        LIMIT 1;
        
        -- Generar alerta si se supera el umbral
        IF v_porcentaje_consumo >= COALESCE(v_umbral_agotamiento, 85) THEN
            INSERT INTO log_alertas (
                id_recurso_planificado,
                id_proyecto,
                tipo_alerta,
                severidad,
                titulo,
                mensaje,
                datos_contexto
            ) VALUES (
                NEW.id_recurso_planificado,
                v_id_proyecto,
                'agotamiento',
                CASE 
                    WHEN v_porcentaje_consumo >= 95 THEN 'critica'
                    WHEN v_porcentaje_consumo >= 90 THEN 'alta'
                    ELSE 'media'
                END,
                CONCAT('Recurso ', v_recurso_nombre, ' agotándose'),
                CONCAT('El recurso ', v_recurso_nombre, ' en la fase ', v_fase_nombre, 
                       ' ha alcanzado el ', ROUND(v_porcentaje_consumo, 1), '% de consumo. ',
                       'Cantidad restante: ', (v_cantidad_planificada - v_cantidad_total_consumida)),
                JSON_OBJECT(
                    'porcentaje_consumo', v_porcentaje_consumo,
                    'cantidad_planificada', v_cantidad_planificada,
                    'cantidad_consumida', v_cantidad_total_consumida,
                    'cantidad_restante', (v_cantidad_planificada - v_cantidad_total_consumida)
                )
            );
        END IF;
    END IF;
END//

-- Trigger para evaluar alertas de retraso en fechas
CREATE TRIGGER trigger_evaluar_alertas_fecha
    AFTER UPDATE ON recursos_planificados_fase
    FOR EACH ROW
BEGIN
    DECLARE v_dias_anticipacion INT;
    DECLARE v_id_proyecto INT;
    DECLARE v_fase_nombre VARCHAR(200);
    DECLARE v_recurso_nombre VARCHAR(200);
    
    -- Solo evaluar si cambió la fecha de fin de uso
    IF OLD.fecha_fin_uso != NEW.fecha_fin_uso AND NEW.fecha_fin_uso IS NOT NULL THEN
        
        -- Obtener información del recurso
        SELECT fp.id_proyecto, fp.nombre, tr.nombre
        INTO v_id_proyecto, v_fase_nombre, v_recurso_nombre
        FROM fases_proyecto fp
        INNER JOIN tipos_recurso tr ON NEW.id_tipo_recurso = tr.id_tipo_recurso
        WHERE fp.id_fase = NEW.id_fase;
        
        -- Obtener días de anticipación para alerta
        SELECT dias_anticipacion
        INTO v_dias_anticipacion
        FROM umbrales_alertas
        WHERE (id_tipo_recurso = NEW.id_tipo_recurso OR id_tipo_recurso IS NULL)
          AND (id_proyecto = v_id_proyecto OR id_proyecto IS NULL)
          AND tipo_umbral = 'retraso'
          AND activo = TRUE
        ORDER BY id_proyecto DESC, id_tipo_recurso DESC
        LIMIT 1;
        
        -- Generar alerta si la fecha se acerca
        IF DATEDIFF(NEW.fecha_fin_uso, CURDATE()) <= COALESCE(v_dias_anticipacion, 3) 
           AND NEW.fecha_fin_uso >= CURDATE() THEN
            
            INSERT INTO log_alertas (
                id_recurso_planificado,
                id_proyecto,
                tipo_alerta,
                severidad,
                titulo,
                mensaje,
                datos_contexto
            ) VALUES (
                NEW.id_recurso_planificado,
                v_id_proyecto,
                'retraso',
                CASE 
                    WHEN DATEDIFF(NEW.fecha_fin_uso, CURDATE()) <= 1 THEN 'critica'
                    WHEN DATEDIFF(NEW.fecha_fin_uso, CURDATE()) <= 2 THEN 'alta'
                    ELSE 'media'
                END,
                CONCAT('Recurso ', v_recurso_nombre, ' próximo a vencer'),
                CONCAT('El recurso ', v_recurso_nombre, ' en la fase ', v_fase_nombre, 
                       ' vence el ', DATE_FORMAT(NEW.fecha_fin_uso, '%d/%m/%Y'), '. ',
                       'Días restantes: ', DATEDIFF(NEW.fecha_fin_uso, CURDATE())),
                JSON_OBJECT(
                    'fecha_fin_uso', NEW.fecha_fin_uso,
                    'dias_restantes', DATEDIFF(NEW.fecha_fin_uso, CURDATE()),
                    'fecha_alerta', CURDATE()
                )
            );
        END IF;
    END IF;
END//

-- Procedimiento para procesar alertas pendientes y enviar notificaciones
CREATE PROCEDURE sp_procesar_alertas_pendientes()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_id_alerta INT;
    DECLARE v_id_proyecto INT;
    DECLARE v_tipo_alerta VARCHAR(50);
    DECLARE v_severidad VARCHAR(20);
    
    DECLARE alertas_cursor CURSOR FOR
        SELECT id_alerta, id_proyecto, tipo_alerta, severidad
        FROM log_alertas
        WHERE estado = 'activa'
          AND fecha_generacion >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        ORDER BY severidad DESC, fecha_generacion DESC;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN alertas_cursor;
    
    read_loop: LOOP
        FETCH alertas_cursor INTO v_id_alerta, v_id_proyecto, v_tipo_alerta, v_severidad;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Enviar notificaciones a usuarios del proyecto con configuración habilitada
        INSERT INTO notificaciones_enviadas (id_alerta, id_usuario, metodo_envio, estado_envio)
        SELECT 
            v_id_alerta,
            u.id_usuario,
            'plataforma',
            'enviado'
        FROM usuarios u
        INNER JOIN configuracion_notificaciones cn ON u.id_usuario = cn.id_usuario
        WHERE u.activo = TRUE
          AND cn.alertas_plataforma = TRUE
          AND JSON_CONTAINS(cn.tipos_alerta, CONCAT('"', v_tipo_alerta, '"'))
          AND (u.id_usuario = (SELECT id_productor FROM proyectos WHERE id_proyecto = v_id_proyecto)
               OR u.rol IN ('administrador', 'asesor'));
    END LOOP;
    
    CLOSE alertas_cursor;
END//

DELIMITER ;

COMMIT;