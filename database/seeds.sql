-- ================================================================
-- DATOS INICIALES PARA AGROTECH NOVA
-- Datos de prueba para desarrollo y testing
-- ================================================================

USE agrotech_nova;

-- ================================================================
-- USUARIOS DE PRUEBA
-- ================================================================

-- Insertar usuarios adicionales para pruebas
INSERT INTO usuarios (nombre, apellido, email, password_hash, rol, telefono) VALUES 
-- Productores
('Juan Carlos', 'Rodríguez', 'juan.rodriguez@agrotechnova.com', '$2a$12$LQv3c1yqBWVHxkd0LQ1Gau.4I3n9QRAr4X7mErhcPjnZT.8K5Tk8W', 'productor', '3001234567'),
('María Elena', 'García', 'maria.garcia@agrotechnova.com', '$2a$12$LQv3c1yqBWVHxkd0LQ1Gau.4I3n9QRAr4X7mErhcPjnZT.8K5Tk8W', 'productor', '3009876543'),
('Carlos Alberto', 'Mendoza', 'carlos.mendoza@agrotechnova.com', '$2a$12$LQv3c1yqBWVHxkd0LQ1Gau.4I3n9QRAr4X7mErhcPjnZT.8K5Tk8W', 'productor', '3005678901'),

-- Asesores
('Dr. Patricia', 'Vásquez', 'patricia.vasquez@agrotechnova.com', '$2a$12$LQv3c1yqBWVHxkd0LQ1Gau.4I3n9QRAr4X7mErhcPjnZT.8K5Tk8W', 'asesor', '3102345678'),
('Ing. Roberto', 'Silva', 'roberto.silva@agrotechnova.com', '$2a$12$LQv3c1yqBWVHxkd0LQ1Gau.4I3n9QRAr4X7mErhcPjnZT.8K5Tk8W', 'asesor', '3157890123'),

-- Administradores adicionales
('Ana Sofía', 'López', 'ana.lopez@agrotechnova.com', '$2a$12$LQv3c1yqBWVHxkd0LQ1Gau.4I3n9QRAr4X7mErhcPjnZT.8K5Tk8W', 'administrador', '3201234567');

-- ================================================================
-- PROVEEDORES DE PRUEBA
-- ================================================================

INSERT INTO proveedores (nombre_empresa, nit, contacto_nombre, telefono, email, direccion, ciudad, departamento) VALUES 
('Semillas del Valle S.A.S.', '900123456-7', 'Luis Fernando Pérez', '6012345678', 'ventas@semillasdelvalle.com', 'Cra 15 #45-67', 'Bucaramanga', 'Santander'),
('AgroInsumos Santander Ltda.', '800987654-3', 'Carmen Rosa Díaz', '6087654321', 'info@agroinsumos.com', 'Av. Quebrada Seca #23-45', 'Bucaramanga', 'Santander'),
('Fertilizantes El Campo S.A.', '900567890-1', 'Miguel Ángel Torres', '6034567890', 'comercial@fertilizantescampo.com', 'Zona Industrial #12-34', 'Floridablanca', 'Santander'),
('Maquinaria Agrícola UPB', '900111222-8', 'Sandra Milena Ruiz', '6012223334', 'maquinaria@upb.edu.co', 'Campus UPB Sede Central', 'Bucaramanga', 'Santander');

-- ================================================================
-- PRODUCTOS DE PROVEEDORES
-- ================================================================

INSERT INTO productos_proveedor (id_proveedor, id_tipo_insumo, nombre_producto, descripcion, precio_unitario, unidad_medida) VALUES 
-- Productos de Semillas del Valle
(1, 1, 'Semilla Maíz Híbrido Premium', 'Semilla certificada de alto rendimiento', 45000.00, 'kg'),
(1, 1, 'Semilla Sorgo Forrajero', 'Semilla para forraje animal', 32000.00, 'kg'),

-- Productos de AgroInsumos Santander
(2, 2, 'Fertilizante 10-30-10', 'NPK para etapa de crecimiento', 85000.00, 'bulto 50kg'),
(2, 3, 'Compost Orgánico Premium', 'Abono orgánico certificado', 25000.00, 'bulto 40kg'),
(2, 4, 'Bioinsecticida Natural', 'Control biológico de plagas', 35000.00, 'litro'),

-- Productos de Fertilizantes El Campo
(3, 2, 'Urea Granulada 46%', 'Fertilizante nitrogenado', 95000.00, 'bulto 50kg'),
(3, 5, 'Glifosato 48% SL', 'Herbicida sistémico', 28000.00, 'litro'),

-- Productos de Maquinaria Agrícola UPB
(4, 6, 'Azadón Profesional', 'Herramienta forjada premium', 45000.00, 'unidad'),
(4, 7, 'Tractor Kubota L3301', 'Tractor compacto 33HP', 65000000.00, 'unidad');

-- ================================================================
-- ENTIDADES COLABORADORAS
-- ================================================================

INSERT INTO entidades_colaboradoras (nombre, tipo_entidad, contacto_principal, telefono, email, direccion, funcion_sistema) VALUES 
('Universidad Pontificia Bolivariana', 'universidad', 'Decano Facultad Ingeniería', '6073155000', 'ingenieria@upb.edu.co', 'Autopista a Piedecuesta Km 7', 'Investigación y formación técnica'),
('SENA Regional Santander', 'gubernamental', 'Director Regional', '6076305555', 'regional@sena.edu.co', 'Calle 52 #46-28', 'Capacitación técnica y certificación'),
('ICA Santander', 'gubernamental', 'Coordinador Técnico', '6076201234', 'santander@ica.gov.co', 'Carrera 27 #54-35', 'Certificación fitosanitaria'),
('Federación Nacional de Cafeteros', 'asociacion', 'Comité Departamental', '6076789012', 'santander@federaciondecafeteros.org', 'Calle 35 #22-45', 'Asesoría técnica especializada'),
('Fundación ProBosques', 'ong', 'Director Ejecutivo', '6073456789', 'info@probosques.org', 'Cra 33 #42-18', 'Conservación y sostenibilidad ambiental');

-- ================================================================
-- PROYECTOS DE PRUEBA
-- ================================================================

INSERT INTO proyectos (nombre, descripcion, categoria, fecha_inicio, fecha_fin, presupuesto_total, id_productor, id_asesor, ubicacion_geografica) VALUES 
('Cultivo Orgánico de Maíz 2025', 'Implementación de técnicas orgánicas para cultivo de maíz en 5 hectáreas', 'agricola', '2025-03-01', '2025-12-15', 15000000.00, 2, 4, 'Vereda El Porvenir, Piedecuesta, Santander'),
('Producción Sostenible de Hortalizas', 'Sistema hidropónico para producción de hortalizas bajo invernadero', 'agricola', '2025-02-15', '2025-11-30', 25000000.00, 3, 5, 'Corregimiento La Esperanza, Floridablanca'),
('Ganadería Regenerativa Piloto', 'Implementación de pastoreo rotacional y silvopastoreo', 'pecuario', '2025-01-10', '2026-01-10', 45000000.00, 4, 4, 'Finca La Pradera, Girón, Santander');

-- ================================================================
-- FASES DE PROYECTOS
-- ================================================================

-- Fases para el proyecto de Cultivo Orgánico de Maíz
INSERT INTO fases_proyecto (id_proyecto, nombre, descripcion, fecha_inicio_planificada, fecha_fin_planificada, presupuesto_fase, orden_fase) VALUES 
(1, 'Preparación del Terreno', 'Análisis de suelo, arado y preparación orgánica', '2025-03-01', '2025-03-31', 3000000.00, 1),
(1, 'Siembra y Establecimiento', 'Siembra de semillas y establecimiento inicial del cultivo', '2025-04-01', '2025-05-15', 2500000.00, 2),
(1, 'Manejo del Cultivo', 'Fertilización orgánica, control biológico de plagas', '2025-05-16', '2025-10-30', 6000000.00, 3),
(1, 'Cosecha y Postcosecha', 'Recolección, secado y almacenamiento', '2025-11-01', '2025-12-15', 3500000.00, 4);

-- Fases para el proyecto de Hortalizas
INSERT INTO fases_proyecto (id_proyecto, nombre, descripcion, fecha_inicio_planificada, fecha_fin_planificada, presupuesto_fase, orden_fase) VALUES 
(2, 'Construcción de Infraestructura', 'Montaje de invernadero y sistema hidropónico', '2025-02-15', '2025-04-30', 15000000.00, 1),
(2, 'Instalación de Sistemas', 'Sistemas de riego, iluminación y control climático', '2025-05-01', '2025-06-15', 5000000.00, 2),
(2, 'Producción Inicial', 'Primeros ciclos de producción y ajustes', '2025-06-16', '2025-09-30', 3000000.00, 3),
(2, 'Optimización y Expansión', 'Mejoras en procesos y expansión de producción', '2025-10-01', '2025-11-30', 2000000.00, 4);

-- ================================================================
-- ASESORÍAS TÉCNICAS DE PRUEBA
-- ================================================================

INSERT INTO asesorias_tecnicas (id_proyecto, id_asesor, motivo, prioridad, estado) VALUES 
(1, 4, 'Análisis de pH del suelo y recomendaciones de enmiendas orgánicas', 'alta', 'completada'),
(1, 4, 'Control biológico de gusano cogollero', 'media', 'en_progreso'),
(2, 5, 'Optimización del sistema de fertirrigación', 'alta', 'solicitada'),
(3, 4, 'Diseño de rotación de potreros para pastoreo', 'media', 'asignada');

-- ================================================================
-- CONFIGURACIONES ADICIONALES DEL SISTEMA
-- ================================================================

INSERT INTO configuracion_sistema (clave, valor, descripcion, tipo_dato, categoria) VALUES
('empresa_nombre', 'AgroTechNova', 'Nombre de la empresa', 'string', 'general'),
('empresa_eslogan', 'Innovación que cuida, bienestar que produce', 'Eslogan de la empresa', 'string', 'general'),
('max_asesorias_activas', '3', 'Máximo de asesorías activas por proyecto', 'number', 'asesorias'),
('backup_retention_days', '30', 'Días de retención de copias de seguridad', 'number', 'backup'),
('notification_reminder_hours', '24', 'Horas antes de enviar recordatorios', 'number', 'notifications');

-- ================================================================
-- NOTIFICACIONES DE PRUEBA
-- ================================================================

INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, categoria) VALUES 
(2, 'Proyecto Creado Exitosamente', 'Tu proyecto "Cultivo Orgánico de Maíz 2025" ha sido creado y está en estado de planificación.', 'success', 'proyecto'),
(3, 'Asesoría Técnica Disponible', 'Se ha asignado un asesor técnico a tu proyecto de hortalizas.', 'info', 'asesoria'),
(4, 'Nueva Asesoría Solicitada', 'Se ha solicitado una nueva asesoría técnica para el proyecto de ganadería regenerativa.', 'warning', 'asesoria');

COMMIT;