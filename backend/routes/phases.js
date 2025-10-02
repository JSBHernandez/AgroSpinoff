const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole, requireActiveUser } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveUser);

// GET /api/phases/project/:projectId - Listar fases de un proyecto (RF01)
router.get('/project/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;

        // Verificar que el usuario tenga acceso al proyecto
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

        const query = `
            SELECT 
                f.*,
                COUNT(rp.id_recurso_planificado) as total_recursos_planificados,
                COALESCE(SUM(rp.costo_total_estimado), 0) as costo_total_recursos
            FROM fases_proyecto f
            LEFT JOIN recursos_planificados_fase rp ON f.id_fase = rp.id_fase
            WHERE f.id_proyecto = ?
            GROUP BY f.id_fase
            ORDER BY f.orden_fase ASC
        `;

        const phases = await executeQuery(query, [projectId]);

        res.json({
            success: true,
            data: phases
        });

    } catch (error) {
        console.error('Error listando fases:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/phases/project/:projectId - Crear nueva fase (RF01)
router.post('/project/:projectId', [
    body('nombre').isLength({ min: 3 }).withMessage('Nombre debe tener al menos 3 caracteres'),
    body('descripcion').optional().isLength({ min: 10 }).withMessage('Descripción debe tener al menos 10 caracteres'),
    body('fecha_inicio_planificada').isISO8601().withMessage('Fecha de inicio inválida'),
    body('fecha_fin_planificada').isISO8601().withMessage('Fecha de fin inválida'),
    body('presupuesto_fase').isFloat({ min: 0 }).withMessage('Presupuesto debe ser mayor o igual a 0'),
    body('orden_fase').isInt({ min: 1 }).withMessage('Orden de fase debe ser un número entero positivo')
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
        const { nombre, descripcion, fecha_inicio_planificada, fecha_fin_planificada, presupuesto_fase, orden_fase } = req.body;

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

        // Validar fechas
        if (new Date(fecha_inicio_planificada) >= new Date(fecha_fin_planificada)) {
            return res.status(400).json({
                success: false,
                message: 'La fecha de inicio debe ser anterior a la fecha de fin'
            });
        }

        // Verificar que el orden de fase no esté duplicado
        const existingPhase = await executeQuery(
            'SELECT id_fase FROM fases_proyecto WHERE id_proyecto = ? AND orden_fase = ?',
            [projectId, orden_fase]
        );

        if (existingPhase.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una fase con ese orden en el proyecto'
            });
        }

        const insertQuery = `
            INSERT INTO fases_proyecto (
                id_proyecto, nombre, descripcion, fecha_inicio_planificada, 
                fecha_fin_planificada, presupuesto_fase, orden_fase, estado_fase
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')
        `;

        const result = await executeQuery(insertQuery, [
            projectId, nombre, descripcion, fecha_inicio_planificada, 
            fecha_fin_planificada, presupuesto_fase, orden_fase
        ]);

        res.status(201).json({
            success: true,
            message: 'Fase creada exitosamente',
            data: {
                id: result.insertId,
                nombre,
                descripcion,
                estado_fase: 'pendiente'
            }
        });

    } catch (error) {
        console.error('Error creando fase:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PUT /api/phases/:id - Actualizar fase (RF01)
router.put('/:id', [
    body('nombre').optional().isLength({ min: 3 }).withMessage('Nombre debe tener al menos 3 caracteres'),
    body('descripcion').optional().isLength({ min: 10 }).withMessage('Descripción debe tener al menos 10 caracteres'),
    body('fecha_inicio_planificada').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    body('fecha_fin_planificada').optional().isISO8601().withMessage('Fecha de fin inválida'),
    body('presupuesto_fase').optional().isFloat({ min: 0 }).withMessage('Presupuesto debe ser mayor o igual a 0'),
    body('estado_fase').optional().isIn(['pendiente', 'en_progreso', 'completada', 'suspendida']).withMessage('Estado de fase inválido')
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

        const phaseId = req.params.id;

        // Verificar que la fase existe y el usuario tiene acceso
        const phaseQuery = `
            SELECT f.*, p.id_productor, p.id_asesor, p.estado as estado_proyecto
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

        // Validar que no se pueda editar si el proyecto está finalizado o cancelado
        if (['finalizado', 'cancelado'].includes(phase.estado_proyecto)) {
            return res.status(400).json({
                success: false,
                message: 'No se puede editar fases de proyectos finalizados o cancelados'
            });
        }

        const { nombre, descripcion, fecha_inicio_planificada, fecha_fin_planificada, presupuesto_fase, estado_fase } = req.body;
        
        const updateFields = [];
        const values = [];

        if (nombre) {
            updateFields.push('nombre = ?');
            values.push(nombre);
        }
        if (descripcion !== undefined) {
            updateFields.push('descripcion = ?');
            values.push(descripcion);
        }
        if (fecha_inicio_planificada) {
            updateFields.push('fecha_inicio_planificada = ?');
            values.push(fecha_inicio_planificada);
        }
        if (fecha_fin_planificada) {
            updateFields.push('fecha_fin_planificada = ?');
            values.push(fecha_fin_planificada);
        }
        if (presupuesto_fase !== undefined) {
            updateFields.push('presupuesto_fase = ?');
            values.push(presupuesto_fase);
        }
        if (estado_fase) {
            updateFields.push('estado_fase = ?');
            values.push(estado_fase);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        values.push(phaseId);

        const updateQuery = `
            UPDATE fases_proyecto 
            SET ${updateFields.join(', ')}
            WHERE id_fase = ?
        `;

        await executeQuery(updateQuery, values);

        res.json({
            success: true,
            message: 'Fase actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error actualizando fase:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// DELETE /api/phases/:id - Eliminar fase (RF01)
router.delete('/:id', async (req, res) => {
    try {
        const phaseId = req.params.id;

        // Verificar que la fase existe y el usuario tiene acceso
        const phaseQuery = `
            SELECT f.*, p.id_productor, p.id_asesor, p.estado as estado_proyecto
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

        // Validar que no se pueda eliminar si está en progreso o completada
        if (['en_progreso', 'completada'].includes(phase.estado_fase)) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar una fase en progreso o completada'
            });
        }

        // Verificar si tiene recursos planificados
        const resourcesQuery = 'SELECT COUNT(*) as total FROM recursos_planificados_fase WHERE id_fase = ?';
        const resourcesCount = await executeQuery(resourcesQuery, [phaseId]);

        if (resourcesCount[0].total > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar una fase que tiene recursos planificados. Elimine primero los recursos.'
            });
        }

        await executeQuery('DELETE FROM fases_proyecto WHERE id_fase = ?', [phaseId]);

        res.json({
            success: true,
            message: 'Fase eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error eliminando fase:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;