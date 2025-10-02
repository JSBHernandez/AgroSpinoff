const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole, requireActiveUser } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveUser);

// ================================================================
// RUTAS PARA TRACKING DE CONSUMO DE RECURSOS
// ================================================================

// GET /api/monitoring/project/:projectId/consumption - Obtener resumen de consumo del proyecto
router.get('/project/:projectId/consumption', async (req, res) => {
    try {
        const projectId = req.params.projectId;

        // Verificar acceso al proyecto
        const projectAccessQuery = `
            SELECT p.*, 
                   CASE 
                       WHEN ? = p.id_productor THEN 1
                       WHEN ? IN (SELECT id_usuario FROM usuarios WHERE rol IN ('administrador', 'asesor')) THEN 1
                       ELSE 0
                   END as tiene_acceso
            FROM proyectos p
            WHERE p.id_proyecto = ?
        `;
        
        const projectResult = await executeQuery(projectAccessQuery, [req.user.id_usuario, req.user.id_usuario, projectId]);
        
        if (projectResult.length === 0 || !projectResult[0].tiene_acceso) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado o sin permisos de acceso'
            });
        }

        // Obtener resumen de consumo usando la vista
        const consumptionQuery = `
            SELECT 
                vrc.*,
                CASE 
                    WHEN vrc.porcentaje_consumo >= 95 THEN 'critico'
                    WHEN vrc.porcentaje_consumo >= 85 THEN 'alto'
                    WHEN vrc.porcentaje_consumo >= 70 THEN 'medio'
                    ELSE 'normal'
                END as nivel_alerta,
                CASE 
                    WHEN vrc.dias_restantes <= 0 THEN 'vencido'
                    WHEN vrc.dias_restantes <= 3 THEN 'proximo_vencer'
                    WHEN vrc.dias_restantes <= 7 THEN 'atencion'
                    ELSE 'normal'
                END as estado_temporal
            FROM vista_resumen_consumo vrc
            WHERE vrc.id_proyecto = ?
            ORDER BY vrc.porcentaje_consumo DESC, vrc.dias_restantes ASC
        `;

        const consumption = await executeQuery(consumptionQuery, [projectId]);

        // Obtener estadísticas generales
        const statsQuery = `
            SELECT 
                COUNT(*) as total_recursos,
                SUM(cantidad_planificada) as total_planificado,
                SUM(cantidad_consumida) as total_consumido,
                AVG(porcentaje_consumo) as promedio_consumo,
                SUM(costo_total_planificado) as costo_total_planificado,
                SUM(costo_consumido) as costo_total_consumido
            FROM vista_resumen_consumo
            WHERE id_proyecto = ?
        `;

        const stats = await executeQuery(statsQuery, [projectId]);

        // Obtener alertas activas del proyecto
        const alertsQuery = `
            SELECT la.*, rpf.id_tipo_recurso, tr.nombre as tipo_recurso_nombre
            FROM log_alertas la
            LEFT JOIN recursos_planificados_fase rpf ON la.id_recurso_planificado = rpf.id_recurso_planificado
            LEFT JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
            WHERE la.id_proyecto = ? AND la.estado = 'activa'
            ORDER BY la.severidad DESC, la.fecha_generacion DESC
            LIMIT 10
        `;

        const activeAlerts = await executeQuery(alertsQuery, [projectId]);

        res.json({
            success: true,
            data: {
                project: projectResult[0],
                consumption: consumption,
                statistics: stats[0] || {},
                activeAlerts: activeAlerts
            }
        });

    } catch (error) {
        console.error('Error obteniendo consumo del proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/monitoring/consumption - Registrar consumo de recurso
router.post('/consumption', [
    body('id_recurso_planificado').isInt({ min: 1 }).withMessage('ID de recurso planificado requerido'),
    body('cantidad_consumida').isFloat({ min: 0 }).withMessage('Cantidad consumida debe ser un número positivo'),
    body('fecha_consumo').isISO8601().withMessage('Fecha de consumo requerida'),
    body('observaciones').optional().isLength({ max: 500 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { id_recurso_planificado, cantidad_consumida, fecha_consumo, observaciones } = req.body;

        // Verificar que el recurso existe y el usuario tiene permisos
        const resourceAccessQuery = `
            SELECT rpf.*, fp.id_proyecto, p.id_productor, tr.nombre as tipo_recurso
            FROM recursos_planificados_fase rpf
            INNER JOIN fases_proyecto fp ON rpf.id_fase = fp.id_fase
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            INNER JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
            WHERE rpf.id_recurso_planificado = ?
              AND (p.id_productor = ? OR ? IN (
                  SELECT id_usuario FROM usuarios WHERE rol IN ('administrador', 'asesor')
              ))
        `;
        
        const resourceResult = await executeQuery(resourceAccessQuery, [id_recurso_planificado, req.user.id_usuario, req.user.id_usuario]);
        
        if (resourceResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Recurso no encontrado o sin permisos de acceso'
            });
        }

        const resource = resourceResult[0];

        // Verificar que no se exceda la cantidad planificada
        const currentConsumptionQuery = `
            SELECT COALESCE(SUM(cantidad_consumida), 0) as total_consumido
            FROM consumo_recursos
            WHERE id_recurso_planificado = ?
        `;

        const currentResult = await executeQuery(currentConsumptionQuery, [id_recurso_planificado]);
        const currentConsumption = currentResult[0].total_consumido;
        const newTotal = parseFloat(currentConsumption) + parseFloat(cantidad_consumida);

        if (newTotal > resource.cantidad_planificada) {
            return res.status(400).json({
                success: false,
                message: `La cantidad total consumida (${newTotal}) excedería la cantidad planificada (${resource.cantidad_planificada})`
            });
        }

        // Registrar el consumo
        const insertQuery = `
            INSERT INTO consumo_recursos (
                id_recurso_planificado, cantidad_consumida, fecha_consumo, 
                observaciones, usuario_registro
            ) VALUES (?, ?, ?, ?, ?)
        `;

        const result = await executeQuery(insertQuery, [
            id_recurso_planificado, cantidad_consumida, fecha_consumo, 
            observaciones, req.user.id_usuario
        ]);

        // Obtener el registro creado con información completa
        const newConsumptionQuery = `
            SELECT 
                cr.*,
                rpf.cantidad_planificada,
                tr.nombre as tipo_recurso,
                fp.nombre as fase_nombre,
                p.nombre as proyecto_nombre
            FROM consumo_recursos cr
            INNER JOIN recursos_planificados_fase rpf ON cr.id_recurso_planificado = rpf.id_recurso_planificado
            INNER JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
            INNER JOIN fases_proyecto fp ON rpf.id_fase = fp.id_fase
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            WHERE cr.id_consumo = ?
        `;

        const newConsumption = await executeQuery(newConsumptionQuery, [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Consumo registrado exitosamente',
            data: {
                consumption: newConsumption[0]
            }
        });

    } catch (error) {
        console.error('Error registrando consumo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ================================================================
// RUTAS PARA GESTIÓN DE UMBRALES Y ALERTAS
// ================================================================

// GET /api/monitoring/thresholds - Obtener umbrales configurados
router.get('/thresholds', async (req, res) => {
    try {
        const { projectId, typeId } = req.query;

        let query = `
            SELECT 
                ua.*,
                tr.nombre as tipo_recurso_nombre,
                tr.categoria as categoria_recurso,
                p.nombre as proyecto_nombre,
                u.nombre as creador_nombre,
                u.apellido as creador_apellido
            FROM umbrales_alertas ua
            LEFT JOIN tipos_recurso tr ON ua.id_tipo_recurso = tr.id_tipo_recurso
            LEFT JOIN proyectos p ON ua.id_proyecto = p.id_proyecto
            LEFT JOIN usuarios u ON ua.usuario_creacion = u.id_usuario
            WHERE ua.activo = TRUE
        `;

        const params = [];

        if (projectId) {
            query += ' AND (ua.id_proyecto = ? OR ua.id_proyecto IS NULL)';
            params.push(projectId);
        }

        if (typeId) {
            query += ' AND (ua.id_tipo_recurso = ? OR ua.id_tipo_recurso IS NULL)';
            params.push(typeId);
        }

        // Verificar permisos para administradores
        if (!['administrador', 'asesor'].includes(req.user.rol)) {
            query += ` AND (ua.id_proyecto IN (
                SELECT id_proyecto FROM proyectos WHERE id_productor = ?
            ) OR ua.id_proyecto IS NULL)`;
            params.push(req.user.id_usuario);
        }

        query += ' ORDER BY ua.id_proyecto DESC, ua.id_tipo_recurso ASC, ua.tipo_umbral ASC';

        const thresholds = await executeQuery(query, params);

        res.json({
            success: true,
            data: { thresholds }
        });

    } catch (error) {
        console.error('Error obteniendo umbrales:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/monitoring/thresholds - Crear o actualizar umbral
router.post('/thresholds', requireRole(['administrador', 'asesor']), [
    body('tipo_umbral').isIn(['agotamiento', 'sobrecosto', 'retraso', 'reasignacion']),
    body('porcentaje_alerta').optional().isFloat({ min: 0, max: 100 }),
    body('cantidad_minima').optional().isFloat({ min: 0 }),
    body('dias_anticipacion').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { 
            id_tipo_recurso, id_proyecto, tipo_umbral, 
            porcentaje_alerta, cantidad_minima, dias_anticipacion 
        } = req.body;

        // Verificar si ya existe un umbral similar
        const existingQuery = `
            SELECT id_umbral 
            FROM umbrales_alertas 
            WHERE (id_tipo_recurso = ? OR (id_tipo_recurso IS NULL AND ? IS NULL))
              AND (id_proyecto = ? OR (id_proyecto IS NULL AND ? IS NULL))
              AND tipo_umbral = ?
              AND activo = TRUE
        `;

        const existing = await executeQuery(existingQuery, [
            id_tipo_recurso, id_tipo_recurso, 
            id_proyecto, id_proyecto, 
            tipo_umbral
        ]);

        if (existing.length > 0) {
            // Actualizar umbral existente
            const updateQuery = `
                UPDATE umbrales_alertas 
                SET porcentaje_alerta = ?, cantidad_minima = ?, 
                    dias_anticipacion = ?, fecha_modificacion = CURRENT_TIMESTAMP
                WHERE id_umbral = ?
            `;

            await executeQuery(updateQuery, [
                porcentaje_alerta, cantidad_minima, 
                dias_anticipacion, existing[0].id_umbral
            ]);

            res.json({
                success: true,
                message: 'Umbral actualizado exitosamente'
            });
        } else {
            // Crear nuevo umbral
            const insertQuery = `
                INSERT INTO umbrales_alertas (
                    id_tipo_recurso, id_proyecto, tipo_umbral, 
                    porcentaje_alerta, cantidad_minima, dias_anticipacion, 
                    usuario_creacion
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;

            await executeQuery(insertQuery, [
                id_tipo_recurso, id_proyecto, tipo_umbral, 
                porcentaje_alerta, cantidad_minima, dias_anticipacion, 
                req.user.id_usuario
            ]);

            res.status(201).json({
                success: true,
                message: 'Umbral creado exitosamente'
            });
        }

    } catch (error) {
        console.error('Error gestionando umbral:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/monitoring/alerts/recent - Obtener alertas recientes para dashboard
router.get('/alerts/recent', async (req, res) => {
    try {
        const query = `
            SELECT 
                la.id_log,
                la.id_proyecto,
                la.mensaje,
                la.nivel,
                la.fecha_creacion,
                la.estado,
                p.nombre as proyecto_nombre
            FROM log_alertas la
            LEFT JOIN proyectos p ON la.id_proyecto = p.id_proyecto
            WHERE la.estado = 'activa'
            ORDER BY la.fecha_creacion DESC
            LIMIT 10
        `;

        const [rows] = await pool.execute(query);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('Error obteniendo alertas recientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/monitoring/alerts - Obtener alertas
router.get('/alerts', async (req, res) => {
    try {
        const { projectId, status = 'activa', limit = 50 } = req.query;

        let query = `
            SELECT 
                la.*,
                rpf.id_tipo_recurso,
                tr.nombre as tipo_recurso_nombre,
                fp.nombre as fase_nombre,
                p.nombre as proyecto_nombre
            FROM log_alertas la
            LEFT JOIN recursos_planificados_fase rpf ON la.id_recurso_planificado = rpf.id_recurso_planificado
            LEFT JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
            LEFT JOIN fases_proyecto fp ON rpf.id_fase = fp.id_fase
            LEFT JOIN proyectos p ON la.id_proyecto = p.id_proyecto
            WHERE 1=1
        `;

        const params = [];

        if (status !== 'todas') {
            query += ' AND la.estado = ?';
            params.push(status);
        }

        if (projectId) {
            query += ' AND la.id_proyecto = ?';
            params.push(projectId);
        }

        // Verificar permisos
        if (!['administrador', 'asesor'].includes(req.user.rol)) {
            query += ' AND la.id_proyecto IN (SELECT id_proyecto FROM proyectos WHERE id_productor = ?)';
            params.push(req.user.id_usuario);
        }

        query += ' ORDER BY la.severidad DESC, la.fecha_generacion DESC LIMIT ?';
        params.push(parseInt(limit));

        const alerts = await executeQuery(query, params);

        // Parsear datos_contexto JSON
        const alertsWithData = alerts.map(alert => ({
            ...alert,
            datos_contexto: alert.datos_contexto ? JSON.parse(alert.datos_contexto) : null
        }));

        res.json({
            success: true,
            data: { alerts: alertsWithData }
        });

    } catch (error) {
        console.error('Error obteniendo alertas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT /api/monitoring/alerts/:alertId/status - Actualizar estado de alerta
router.put('/alerts/:alertId/status', [
    body('estado').isIn(['activa', 'leida', 'resuelta', 'ignorada']),
    body('observaciones').optional().isLength({ max: 500 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const alertId = req.params.alertId;
        const { estado, observaciones } = req.body;

        // Verificar que la alerta existe y el usuario tiene permisos
        const alertQuery = `
            SELECT la.*, p.id_productor
            FROM log_alertas la
            INNER JOIN proyectos p ON la.id_proyecto = p.id_proyecto
            WHERE la.id_alerta = ?
              AND (p.id_productor = ? OR ? IN (
                  SELECT id_usuario FROM usuarios WHERE rol IN ('administrador', 'asesor')
              ))
        `;

        const alertResult = await executeQuery(alertQuery, [alertId, req.user.id_usuario, req.user.id_usuario]);

        if (alertResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Alerta no encontrada o sin permisos de acceso'
            });
        }

        // Actualizar estado de la alerta
        const updateQuery = `
            UPDATE log_alertas 
            SET estado = ?, 
                fecha_resolucion = CASE WHEN ? IN ('resuelta', 'ignorada') THEN CURRENT_TIMESTAMP ELSE fecha_resolucion END,
                usuario_resolucion = CASE WHEN ? IN ('resuelta', 'ignorada') THEN ? ELSE usuario_resolucion END
            WHERE id_alerta = ?
        `;

        await executeQuery(updateQuery, [estado, estado, estado, req.user.id_usuario, alertId]);

        res.json({
            success: true,
            message: 'Estado de alerta actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error actualizando alerta:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ================================================================
// RUTAS PARA CONFIGURACIÓN DE NOTIFICACIONES
// ================================================================

// GET /api/monitoring/notifications/config - Obtener configuración de notificaciones del usuario
router.get('/notifications/config', async (req, res) => {
    try {
        const configQuery = `
            SELECT * FROM configuracion_notificaciones 
            WHERE id_usuario = ?
        `;

        const config = await executeQuery(configQuery, [req.user.id_usuario]);

        if (config.length === 0) {
            // Crear configuración por defecto
            const defaultConfig = {
                id_usuario: req.user.id_usuario,
                alertas_plataforma: true,
                alertas_email: false,
                frecuencia_resumen: 'semanal',
                tipos_alerta: ['agotamiento', 'sobrecosto', 'retraso'],
                horario_preferido: '09:00:00'
            };

            const insertQuery = `
                INSERT INTO configuracion_notificaciones (
                    id_usuario, alertas_plataforma, alertas_email, 
                    frecuencia_resumen, tipos_alerta, horario_preferido
                ) VALUES (?, ?, ?, ?, ?, ?)
            `;

            await executeQuery(insertQuery, [
                defaultConfig.id_usuario, defaultConfig.alertas_plataforma, defaultConfig.alertas_email,
                defaultConfig.frecuencia_resumen, JSON.stringify(defaultConfig.tipos_alerta), defaultConfig.horario_preferido
            ]);

            res.json({
                success: true,
                data: { config: defaultConfig }
            });
        } else {
            const userConfig = {
                ...config[0],
                tipos_alerta: JSON.parse(config[0].tipos_alerta || '[]')
            };

            res.json({
                success: true,
                data: { config: userConfig }
            });
        }

    } catch (error) {
        console.error('Error obteniendo configuración de notificaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT /api/monitoring/notifications/config - Actualizar configuración de notificaciones
router.put('/notifications/config', [
    body('alertas_plataforma').isBoolean(),
    body('alertas_email').isBoolean(),
    body('frecuencia_resumen').isIn(['nunca', 'diario', 'semanal']),
    body('tipos_alerta').isArray(),
    body('horario_preferido').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/)
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos',
                errors: errors.array()
            });
        }

        const { alertas_plataforma, alertas_email, frecuencia_resumen, tipos_alerta, horario_preferido } = req.body;

        const updateQuery = `
            UPDATE configuracion_notificaciones 
            SET alertas_plataforma = ?, alertas_email = ?, frecuencia_resumen = ?, 
                tipos_alerta = ?, horario_preferido = ?, fecha_modificacion = CURRENT_TIMESTAMP
            WHERE id_usuario = ?
        `;

        await executeQuery(updateQuery, [
            alertas_plataforma, alertas_email, frecuencia_resumen,
            JSON.stringify(tipos_alerta), horario_preferido, req.user.id_usuario
        ]);

        res.json({
            success: true,
            message: 'Configuración de notificaciones actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error actualizando configuración:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/monitoring/process-alerts - Procesar alertas pendientes (endpoint administrativo)
router.post('/process-alerts', requireRole(['administrador']), async (req, res) => {
    try {
        await executeQuery('CALL sp_procesar_alertas_pendientes()');

        res.json({
            success: true,
            message: 'Alertas procesadas exitosamente'
        });

    } catch (error) {
        console.error('Error procesando alertas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;