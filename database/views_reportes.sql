-- Vistas para sistema de reportes RF05
-- Generación de informes sobre utilización de recursos

-- Vista principal de utilización de recursos por proyecto y fase
CREATE OR REPLACE VIEW vista_utilizacion_recursos AS
SELECT 
    p.id_proyecto,
    p.nombre as proyecto_nombre,
    p.estado as proyecto_estado,
    fp.id_fase,
    fp.nombre as fase_nombre,
    fp.estado_fase as fase_estado,
    fp.fecha_inicio_planificada as fase_fecha_inicio,
    fp.fecha_fin_planificada as fase_fecha_fin_estimada,
    fp.fecha_fin_real as fase_fecha_fin_real,
    tr.id_tipo_recurso,
    tr.nombre as tipo_recurso_nombre,
    tr.unidad_medida,
    tr.categoria as recurso_categoria,
    rpf.id_recurso_planificado,
    rpf.cantidad_planificada,
    rpf.costo_unitario_estimado as costo_unitario_planificado,
    rpf.costo_total_estimado as costo_total_planificado,
    rpf.fecha_inicio_uso,
    rpf.fecha_fin_uso,
    
    -- Agregaciones de consumo real
    COALESCE(SUM(cr.cantidad_consumida), 0) as cantidad_real_utilizada,
    COALESCE(AVG(cr.cantidad_consumida), 0) as promedio_consumo,
    COUNT(cr.id_consumo) as numero_registros_consumo,
    MIN(cr.fecha_consumo) as primera_fecha_consumo,
    MAX(cr.fecha_consumo) as ultima_fecha_consumo,
    
    -- Cálculos de costo real (estimado)
    COALESCE(SUM(cr.cantidad_consumida), 0) * rpf.costo_unitario_estimado as costo_real_estimado,
    
    -- Variaciones y porcentajes
    CASE 
        WHEN rpf.cantidad_planificada > 0 THEN 
            ((COALESCE(SUM(cr.cantidad_consumida), 0) - rpf.cantidad_planificada) / rpf.cantidad_planificada) * 100
        ELSE 0 
    END as variacion_porcentual_cantidad,
    
    CASE 
        WHEN rpf.costo_total_estimado > 0 THEN 
            ((COALESCE(SUM(cr.cantidad_consumida), 0) * rpf.costo_unitario_estimado - rpf.costo_total_estimado) / rpf.costo_total_estimado) * 100
        ELSE 0 
    END as variacion_porcentual_costo,
    
    -- Estado del recurso
    CASE 
        WHEN COALESCE(SUM(cr.cantidad_consumida), 0) = 0 THEN 'Sin uso'
        WHEN COALESCE(SUM(cr.cantidad_consumida), 0) < rpf.cantidad_planificada * 0.5 THEN 'Bajo uso'
        WHEN COALESCE(SUM(cr.cantidad_consumida), 0) < rpf.cantidad_planificada * 0.8 THEN 'Uso normal'
        WHEN COALESCE(SUM(cr.cantidad_consumida), 0) < rpf.cantidad_planificada THEN 'Uso alto'
        ELSE 'Sobrepaso'
    END as estado_utilizacion

FROM proyectos p
LEFT JOIN fases_proyecto fp ON p.id_proyecto = fp.id_proyecto
LEFT JOIN recursos_planificados_fase rpf ON fp.id_fase = rpf.id_fase
LEFT JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
LEFT JOIN consumo_recursos cr ON rpf.id_recurso_planificado = cr.id_recurso_planificado
GROUP BY 
    p.id_proyecto, p.nombre, p.estado,
    fp.id_fase, fp.nombre, fp.estado_fase, fp.fecha_inicio_planificada, fp.fecha_fin_planificada, fp.fecha_fin_real,
    tr.id_tipo_recurso, tr.nombre, tr.unidad_medida, tr.categoria,
    rpf.id_recurso_planificado, rpf.cantidad_planificada, rpf.costo_unitario_estimado, 
    rpf.costo_total_estimado, rpf.fecha_inicio_uso, rpf.fecha_fin_uso;

-- Vista resumen por proyecto
CREATE OR REPLACE VIEW vista_resumen_recursos_proyecto AS
SELECT 
    p.id_proyecto,
    p.nombre as proyecto_nombre,
    p.estado as proyecto_estado,
    p.fecha_inicio as proyecto_fecha_inicio,
    p.fecha_fin as proyecto_fecha_fin_estimada,
    p.presupuesto_total as proyecto_presupuesto_total,
    
    -- Totales planificados
    COUNT(DISTINCT rpf.id_recurso_planificado) as total_recursos_planificados,
    COUNT(DISTINCT tr.id_tipo_recurso) as total_tipos_recursos,
    SUM(rpf.cantidad_planificada) as cantidad_total_planificada,
    SUM(rpf.costo_total_estimado) as costo_total_planificado,
    
    -- Totales reales
    SUM(COALESCE(sub.cantidad_real_utilizada, 0)) as cantidad_total_utilizada,
    SUM(COALESCE(sub.costo_real_estimado, 0)) as costo_total_real_estimado,
    COUNT(DISTINCT sub.numero_registros_consumo) as total_registros_consumo,
    
    -- Eficiencia general
    CASE 
        WHEN SUM(rpf.cantidad_planificada) > 0 THEN 
            (SUM(COALESCE(sub.cantidad_real_utilizada, 0)) / SUM(rpf.cantidad_planificada)) * 100
        ELSE 0 
    END as eficiencia_utilizacion_porcentaje,
    
    CASE 
        WHEN SUM(rpf.costo_total_estimado) > 0 THEN 
            (SUM(COALESCE(sub.costo_real_estimado, 0)) / SUM(rpf.costo_total_estimado)) * 100
        ELSE 0 
    END as eficiencia_costo_porcentaje,
    
    -- Estado general del proyecto
    CASE 
        WHEN AVG(COALESCE(sub.variacion_porcentual_cantidad, 0)) < -10 THEN 'Sub-utilizado'
        WHEN AVG(COALESCE(sub.variacion_porcentual_cantidad, 0)) <= 10 THEN 'Dentro del rango'
        WHEN AVG(COALESCE(sub.variacion_porcentual_cantidad, 0)) <= 25 THEN 'Sobre-utilizado'
        ELSE 'Crítico'
    END as estado_general_recursos

FROM proyectos p
LEFT JOIN fases_proyecto fp ON p.id_proyecto = fp.id_proyecto
LEFT JOIN recursos_planificados_fase rpf ON fp.id_fase = rpf.id_fase
LEFT JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
LEFT JOIN (
    SELECT 
        cr.id_recurso_planificado,
        SUM(cr.cantidad_consumida) as cantidad_real_utilizada,
        COUNT(cr.id_consumo) as numero_registros_consumo,
        SUM(cr.cantidad_consumida) * rpf.costo_unitario_estimado as costo_real_estimado,
        CASE 
            WHEN rpf.cantidad_planificada > 0 THEN 
                ((SUM(cr.cantidad_consumida) - rpf.cantidad_planificada) / rpf.cantidad_planificada) * 100
            ELSE 0 
        END as variacion_porcentual_cantidad
    FROM consumo_recursos cr
    JOIN recursos_planificados_fase rpf ON cr.id_recurso_planificado = rpf.id_recurso_planificado
    GROUP BY cr.id_recurso_planificado, rpf.costo_unitario_estimado, rpf.cantidad_planificada
) sub ON rpf.id_recurso_planificado = sub.id_recurso_planificado
GROUP BY 
    p.id_proyecto, p.nombre, p.estado, p.fecha_inicio, p.fecha_fin, p.presupuesto_total;

-- Vista de tendencias temporales
CREATE OR REPLACE VIEW vista_tendencias_consumo AS
SELECT 
    p.id_proyecto,
    p.nombre as proyecto_nombre,
    tr.id_tipo_recurso,
    tr.nombre as tipo_recurso_nombre,
    tr.categoria as recurso_categoria,
    DATE(cr.fecha_consumo) as fecha_consumo,
    YEAR(cr.fecha_consumo) as año_consumo,
    MONTH(cr.fecha_consumo) as mes_consumo,
    WEEK(cr.fecha_consumo) as semana_consumo,
    
    SUM(cr.cantidad_consumida) as cantidad_diaria,
    COUNT(cr.id_consumo) as registros_diarios,
    AVG(cr.cantidad_consumida) as promedio_diario,
    
    -- Acumulados
    SUM(SUM(cr.cantidad_consumida)) OVER (
        PARTITION BY p.id_proyecto, tr.id_tipo_recurso 
        ORDER BY DATE(cr.fecha_consumo)
        ROWS UNBOUNDED PRECEDING
    ) as cantidad_acumulada,
    
    -- Promedio móvil de 7 días
    AVG(SUM(cr.cantidad_consumida)) OVER (
        PARTITION BY p.id_proyecto, tr.id_tipo_recurso 
        ORDER BY DATE(cr.fecha_consumo)
        ROWS 6 PRECEDING
    ) as promedio_movil_7dias

FROM consumo_recursos cr
JOIN recursos_planificados_fase rpf ON cr.id_recurso_planificado = rpf.id_recurso_planificado
JOIN fases_proyecto fp ON rpf.id_fase = fp.id_fase
JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
GROUP BY 
    p.id_proyecto, p.nombre, tr.id_tipo_recurso, tr.nombre, tr.categoria,
    DATE(cr.fecha_consumo), YEAR(cr.fecha_consumo), MONTH(cr.fecha_consumo), WEEK(cr.fecha_consumo)
ORDER BY p.id_proyecto, tr.id_tipo_recurso, DATE(cr.fecha_consumo);

-- Vista para alertas y umbrales en reportes
CREATE OR REPLACE VIEW vista_reportes_alertas AS
SELECT 
    p.id_proyecto,
    p.nombre as proyecto_nombre,
    tr.id_tipo_recurso,
    tr.nombre as tipo_recurso_nombre,
    ua.tipo_umbral,
    ua.porcentaje_alerta,
    ua.cantidad_minima,
    ua.activo as umbral_activo,
    
    COUNT(la.id_alerta) as total_alertas_generadas,
    COUNT(CASE WHEN la.estado = 'activa' THEN 1 END) as alertas_activas,
    COUNT(CASE WHEN la.estado = 'resuelta' THEN 1 END) as alertas_resueltas,
    COUNT(CASE WHEN la.severidad = 'critica' THEN 1 END) as alertas_criticas,
    COUNT(CASE WHEN la.severidad = 'alta' THEN 1 END) as alertas_altas,
    COUNT(CASE WHEN la.severidad = 'media' THEN 1 END) as alertas_medias,
    COUNT(CASE WHEN la.severidad = 'baja' THEN 1 END) as alertas_bajas,
    
    MIN(la.fecha_generacion) as primera_alerta,
    MAX(la.fecha_generacion) as ultima_alerta

FROM proyectos p
LEFT JOIN umbrales_alertas ua ON p.id_proyecto = ua.id_proyecto
LEFT JOIN tipos_recurso tr ON ua.id_tipo_recurso = tr.id_tipo_recurso
LEFT JOIN log_alertas la ON p.id_proyecto = la.id_proyecto
GROUP BY 
    p.id_proyecto, p.nombre, tr.id_tipo_recurso, tr.nombre,
    ua.tipo_umbral, ua.porcentaje_alerta, ua.cantidad_minima, ua.activo;