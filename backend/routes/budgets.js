const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole, requireActiveUser } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveUser);

// GET /api/budgets/project/:projectId - Obtener información de presupuesto de proyecto (RF02)
router.get('/project/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;

        // Verificar acceso al proyecto
        const projectQuery = `
            SELECT p.*, 
                   CASE 
                       WHEN ? = p.id_productor THEN 1
                       WHEN ? = p.id_asesor THEN 1
                       WHEN ? IN (SELECT id_usuario FROM usuarios WHERE rol = 'administrador') THEN 1
                       ELSE 0
                   END as tiene_acceso
            FROM proyectos p 
            WHERE p.id_proyecto = ?
        `;
        
        const projectAccess = await executeQuery(projectQuery, [req.user.id, req.user.id, req.user.id, projectId]);
        
        if (projectAccess.length === 0 || !projectAccess[0].tiene_acceso) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a este proyecto'
            });
        }

        const project = projectAccess[0];

        // Obtener límites financieros
        const limitsQuery = `
            SELECT * FROM limites_financieros_cliente 
            WHERE id_proyecto = ? AND activo = TRUE
            ORDER BY fecha_definicion DESC
            LIMIT 1
        `;
        const limits = await executeQuery(limitsQuery, [projectId]);

        // Obtener resumen de fases
        const phasesQuery = `
            SELECT id_fase, nombre, presupuesto_fase, estado_fase
            FROM fases_proyecto 
            WHERE id_proyecto = ?
            ORDER BY orden_fase
        `;
        const phases = await executeQuery(phasesQuery, [projectId]);

        // Obtener total gastado
        const expensesQuery = `
            SELECT COALESCE(SUM(monto), 0) as total_gastado
            FROM gastos_proyecto 
            WHERE id_proyecto = ?
        `;
        const expenses = await executeQuery(expensesQuery, [projectId]);

        // Obtener historial de cambios
        const historyQuery = `
            SELECT h.*, 
                   CONCAT(u.nombre, ' ', u.apellido) as usuario_nombre,
                   CASE 
                       WHEN h.tipo_entidad = 'proyecto' THEN p.nombre
                       WHEN h.tipo_entidad = 'fase' THEN f.nombre
                   END as entidad_nombre
            FROM historial_presupuesto h
            JOIN usuarios u ON h.usuario_modificacion = u.id_usuario
            LEFT JOIN proyectos p ON h.tipo_entidad = 'proyecto' AND h.id_entidad = p.id_proyecto
            LEFT JOIN fases_proyecto f ON h.tipo_entidad = 'fase' AND h.id_entidad = f.id_fase
            WHERE (h.tipo_entidad = 'proyecto' AND h.id_entidad = ?)
               OR (h.tipo_entidad = 'fase' AND h.id_entidad IN (
                   SELECT id_fase FROM fases_proyecto WHERE id_proyecto = ?
               ))
            ORDER BY h.fecha_cambio DESC
            LIMIT 20
        `;
        const history = await executeQuery(historyQuery, [projectId, projectId]);

        // Calcular métricas
        const totalGastado = expenses[0].total_gastado;
        const presupuestoTotal = project.presupuesto_total;
        const presupuestoRestante = presupuestoTotal - totalGastado;
        const porcentajeUsado = presupuestoTotal > 0 ? (totalGastado / presupuestoTotal) * 100 : 0;

        // Verificar alertas
        const alerts = [];
        if (limits.length > 0) {
            const limite = limits[0];
            if (presupuestoTotal > limite.presupuesto_maximo_total) {
                alerts.push({
                    tipo: 'limite_excedido',
                    mensaje: `Presupuesto total excede el límite máximo de $${limite.presupuesto_maximo_total.toLocaleString()}`,
                    severidad: 'alta'
                });
            } else if (porcentajeUsado >= (100 - limite.margen_variacion_porcentaje)) {
                alerts.push({
                    tipo: 'margen_alcanzado',
                    mensaje: `Se ha alcanzado el ${porcentajeUsado.toFixed(1)}% del presupuesto total`,
                    severidad: 'media'
                });
            }
        }

        res.json({
            success: true,
            data: {
                proyecto: {
                    id: project.id_proyecto,
                    nombre: project.nombre,
                    presupuesto_total: presupuestoTotal,
                    total_gastado: totalGastado,
                    presupuesto_restante: presupuestoRestante,
                    porcentaje_usado: porcentajeUsado
                },
                limites_financieros: limits.length > 0 ? limits[0] : null,
                fases: phases,
                historial_cambios: history,
                alertas: alerts
            }
        });

    } catch (error) {
        console.error('Error obteniendo presupuesto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/budgets/limits - Establecer límites financieros del cliente (RF02)
router.post('/limits', requireRole(['administrador', 'asesor']), [
    body('id_proyecto').isInt({ min: 1 }).withMessage('ID de proyecto inválido'),
    body('presupuesto_maximo_total').isFloat({ min: 0 }).withMessage('Presupuesto máximo debe ser mayor a 0'),
    body('presupuesto_maximo_fase').optional().isFloat({ min: 0 }).withMessage('Presupuesto máximo por fase debe ser mayor a 0'),
    body('margen_variacion_porcentaje').optional().isFloat({ min: 0, max: 100 }).withMessage('Margen de variación debe estar entre 0 y 100'),
    body('observaciones').optional().isLength({ max: 1000 }).withMessage('Observaciones muy largas')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errors: errors.array()
            });
        }

        const { 
            id_proyecto, 
            presupuesto_maximo_total, 
            presupuesto_maximo_fase, 
            margen_variacion_porcentaje,
            observaciones 
        } = req.body;

        // Verificar que el proyecto existe
        const projectQuery = 'SELECT id_proyecto FROM proyectos WHERE id_proyecto = ?';
        const projects = await executeQuery(projectQuery, [id_proyecto]);

        if (projects.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        // Desactivar límites anteriores
        await executeQuery(
            'UPDATE limites_financieros_cliente SET activo = FALSE WHERE id_proyecto = ?',
            [id_proyecto]
        );

        // Insertar nuevo límite
        const insertQuery = `
            INSERT INTO limites_financieros_cliente (
                id_proyecto, presupuesto_maximo_total, presupuesto_maximo_fase,
                margen_variacion_porcentaje, observaciones, definido_por
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        const result = await executeQuery(insertQuery, [
            id_proyecto, 
            presupuesto_maximo_total, 
            presupuesto_maximo_fase || null,
            margen_variacion_porcentaje || 10.00,
            observaciones || null,
            req.user.id
        ]);

        res.status(201).json({
            success: true,
            message: 'Límites financieros establecidos exitosamente',
            data: {
                id: result.insertId,
                presupuesto_maximo_total,
                margen_variacion_porcentaje: margen_variacion_porcentaje || 10.00
            }
        });

    } catch (error) {
        console.error('Error estableciendo límites:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PUT /api/budgets/project/:projectId - Actualizar presupuesto total del proyecto (RF02)
router.put('/project/:projectId', [
    body('presupuesto_total').isFloat({ min: 0 }).withMessage('Presupuesto debe ser mayor o igual a 0'),
    body('motivo_cambio').isLength({ min: 5 }).withMessage('Debe especificar el motivo del cambio (mínimo 5 caracteres)')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errors: errors.array()
            });
        }

        const projectId = req.params.projectId;
        const { presupuesto_total, motivo_cambio } = req.body;

        // Verificar acceso al proyecto
        const projectQuery = `
            SELECT p.*, 
                   CASE 
                       WHEN ? = p.id_productor THEN 1
                       WHEN ? = p.id_asesor THEN 1
                       WHEN ? IN (SELECT id_usuario FROM usuarios WHERE rol = 'administrador') THEN 1
                       ELSE 0
                   END as tiene_acceso
            FROM proyectos p 
            WHERE p.id_proyecto = ?
        `;
        
        const projectAccess = await executeQuery(projectQuery, [req.user.id, req.user.id, req.user.id, projectId]);
        
        if (projectAccess.length === 0 || !projectAccess[0].tiene_acceso) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a este proyecto'
            });
        }

        const project = projectAccess[0];

        // Verificar límites financieros
        const limitsQuery = `
            SELECT * FROM limites_financieros_cliente 
            WHERE id_proyecto = ? AND activo = TRUE
            LIMIT 1
        `;
        const limits = await executeQuery(limitsQuery, [projectId]);

        if (limits.length > 0) {
            const limite = limits[0];
            if (presupuesto_total > limite.presupuesto_maximo_total) {
                return res.status(400).json({
                    success: false,
                    message: `El presupuesto solicitado ($${presupuesto_total.toLocaleString()}) excede el límite máximo establecido ($${limite.presupuesto_maximo_total.toLocaleString()})`
                });
            }
        }

        // Establecer variable de usuario para el trigger
        await executeQuery('SET @current_user_id = ?', [req.user.id]);

        // Actualizar presupuesto
        await executeQuery(
            'UPDATE proyectos SET presupuesto_total = ? WHERE id_proyecto = ?',
            [presupuesto_total, projectId]
        );

        // Actualizar el motivo en el historial (el trigger ya creó el registro)
        await executeQuery(`
            UPDATE historial_presupuesto 
            SET motivo_cambio = ?, ip_origen = ?
            WHERE tipo_entidad = 'proyecto' 
              AND id_entidad = ? 
              AND usuario_modificacion = ?
            ORDER BY fecha_cambio DESC 
            LIMIT 1
        `, [motivo_cambio, req.ip || req.connection.remoteAddress, projectId, req.user.id]);

        res.json({
            success: true,
            message: 'Presupuesto actualizado exitosamente',
            data: {
                presupuesto_anterior: project.presupuesto_total,
                presupuesto_nuevo: presupuesto_total,
                diferencia: presupuesto_total - project.presupuesto_total
            }
        });

    } catch (error) {
        console.error('Error actualizando presupuesto:', error);
        if (error.sqlMessage && error.sqlMessage.includes('límite máximo')) {
            return res.status(400).json({
                success: false,
                message: error.sqlMessage
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PUT /api/budgets/phase/:phaseId - Actualizar presupuesto de fase (RF02)
router.put('/phase/:phaseId', [
    body('presupuesto_fase').isFloat({ min: 0 }).withMessage('Presupuesto debe ser mayor o igual a 0'),
    body('motivo_cambio').isLength({ min: 5 }).withMessage('Debe especificar el motivo del cambio (mínimo 5 caracteres)')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errors: errors.array()
            });
        }

        const phaseId = req.params.phaseId;
        const { presupuesto_fase, motivo_cambio } = req.body;

        // Verificar acceso a la fase
        const phaseQuery = `
            SELECT f.*, p.id_productor, p.id_asesor
            FROM fases_proyecto f
            JOIN proyectos p ON f.id_proyecto = p.id_proyecto
            WHERE f.id_fase = ?
        `;
        
        const phases = await executeQuery(phaseQuery, [phaseId]);
        
        if (phases.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Fase no encontrada'
            });
        }

        const phase = phases[0];

        // Verificar permisos
        const hasAccess = req.user.id === phase.id_productor || 
                         req.user.id === phase.id_asesor || 
                         req.user.rol === 'administrador';

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a esta fase'
            });
        }

        // Verificar límite por fase si existe
        const limitsQuery = `
            SELECT * FROM limites_financieros_cliente 
            WHERE id_proyecto = ? AND activo = TRUE AND presupuesto_maximo_fase IS NOT NULL
            LIMIT 1
        `;
        const limits = await executeQuery(limitsQuery, [phase.id_proyecto]);

        if (limits.length > 0) {
            const limite = limits[0];
            if (presupuesto_fase > limite.presupuesto_maximo_fase) {
                return res.status(400).json({
                    success: false,
                    message: `El presupuesto de fase solicitado ($${presupuesto_fase.toLocaleString()}) excede el límite máximo por fase ($${limite.presupuesto_maximo_fase.toLocaleString()})`
                });
            }
        }

        // Establecer variable de usuario para el trigger
        await executeQuery('SET @current_user_id = ?', [req.user.id]);

        // Actualizar presupuesto de fase
        await executeQuery(
            'UPDATE fases_proyecto SET presupuesto_fase = ? WHERE id_fase = ?',
            [presupuesto_fase, phaseId]
        );

        // Actualizar el motivo en el historial
        await executeQuery(`
            UPDATE historial_presupuesto 
            SET motivo_cambio = ?, ip_origen = ?
            WHERE tipo_entidad = 'fase' 
              AND id_entidad = ? 
              AND usuario_modificacion = ?
            ORDER BY fecha_cambio DESC 
            LIMIT 1
        `, [motivo_cambio, req.ip || req.connection.remoteAddress, phaseId, req.user.id]);

        res.json({
            success: true,
            message: 'Presupuesto de fase actualizado exitosamente',
            data: {
                presupuesto_anterior: phase.presupuesto_fase,
                presupuesto_nuevo: presupuesto_fase,
                diferencia: presupuesto_fase - phase.presupuesto_fase
            }
        });

    } catch (error) {
        console.error('Error actualizando presupuesto de fase:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/budgets/history/:projectId - Obtener historial de cambios de presupuesto (RF02)
router.get('/history/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const { page = 1, limit = 20 } = req.query;

        // Verificar acceso al proyecto
        const projectQuery = `
            SELECT p.*, 
                   CASE 
                       WHEN ? = p.id_productor THEN 1
                       WHEN ? = p.id_asesor THEN 1
                       WHEN ? IN (SELECT id_usuario FROM usuarios WHERE rol = 'administrador') THEN 1
                       ELSE 0
                   END as tiene_acceso
            FROM proyectos p 
            WHERE p.id_proyecto = ?
        `;
        
        const projectAccess = await executeQuery(projectQuery, [req.user.id, req.user.id, req.user.id, projectId]);
        
        if (projectAccess.length === 0 || !projectAccess[0].tiene_acceso) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a este proyecto'
            });
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const historyQuery = `
            SELECT h.*, 
                   CONCAT(u.nombre, ' ', u.apellido) as usuario_nombre,
                   u.rol as usuario_rol,
                   CASE 
                       WHEN h.tipo_entidad = 'proyecto' THEN p.nombre
                       WHEN h.tipo_entidad = 'fase' THEN f.nombre
                   END as entidad_nombre
            FROM historial_presupuesto h
            JOIN usuarios u ON h.usuario_modificacion = u.id_usuario
            LEFT JOIN proyectos p ON h.tipo_entidad = 'proyecto' AND h.id_entidad = p.id_proyecto
            LEFT JOIN fases_proyecto f ON h.tipo_entidad = 'fase' AND h.id_entidad = f.id_fase
            WHERE (h.tipo_entidad = 'proyecto' AND h.id_entidad = ?)
               OR (h.tipo_entidad = 'fase' AND h.id_entidad IN (
                   SELECT id_fase FROM fases_proyecto WHERE id_proyecto = ?
               ))
            ORDER BY h.fecha_cambio DESC
            LIMIT ? OFFSET ?
        `;

        const history = await executeQuery(historyQuery, [projectId, projectId, parseInt(limit), offset]);

        // Contar total de registros
        const countQuery = `
            SELECT COUNT(*) as total
            FROM historial_presupuesto h
            LEFT JOIN fases_proyecto f ON h.tipo_entidad = 'fase' AND h.id_entidad = f.id_fase
            WHERE (h.tipo_entidad = 'proyecto' AND h.id_entidad = ?)
               OR (h.tipo_entidad = 'fase' AND f.id_proyecto = ?)
        `;

        const countResult = await executeQuery(countQuery, [projectId, projectId]);
        const total = countResult[0].total;

        res.json({
            success: true,
            data: {
                historial: history,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    totalPages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;