const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole, requireActiveUser } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveUser);

// GET /api/resources/types - Listar tipos de recurso (RF01)
router.get('/types', async (req, res) => {
    try {
        const query = `
            SELECT * FROM tipos_recurso 
            WHERE activo = TRUE 
            ORDER BY categoria, nombre
        `;

        const resourceTypes = await executeQuery(query);

        res.json({
            success: true,
            data: resourceTypes
        });

    } catch (error) {
        console.error('Error listando tipos de recurso:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/resources/types - Crear tipo de recurso (RF01) - Solo administradores
router.post('/types', requireRole(['administrador']), [
    body('nombre').isLength({ min: 2 }).withMessage('Nombre debe tener al menos 2 caracteres'),
    body('categoria').isIn(['material', 'humano', 'financiero', 'maquinaria', 'servicio']).withMessage('Categoría inválida'),
    body('descripcion').optional().isLength({ min: 5 }).withMessage('Descripción debe tener al menos 5 caracteres'),
    body('unidad_medida').isLength({ min: 1 }).withMessage('Unidad de medida es requerida')
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

        const { nombre, categoria, descripcion, unidad_medida } = req.body;

        // Verificar que no exista un tipo con el mismo nombre y categoría
        const existingType = await executeQuery(
            'SELECT id_tipo_recurso FROM tipos_recurso WHERE nombre = ? AND categoria = ?',
            [nombre, categoria]
        );

        if (existingType.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un tipo de recurso con ese nombre en esa categoría'
            });
        }

        const insertQuery = `
            INSERT INTO tipos_recurso (nombre, categoria, descripcion, unidad_medida)
            VALUES (?, ?, ?, ?)
        `;

        const result = await executeQuery(insertQuery, [nombre, categoria, descripcion, unidad_medida]);

        res.status(201).json({
            success: true,
            message: 'Tipo de recurso creado exitosamente',
            data: {
                id: result.insertId,
                nombre,
                categoria,
                descripcion,
                unidad_medida
            }
        });

    } catch (error) {
        console.error('Error creando tipo de recurso:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/resources/phase/:phaseId - Listar recursos planificados de una fase (RF01)
router.get('/phase/:phaseId', async (req, res) => {
    try {
        const phaseId = req.params.phaseId;

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

        const query = `
            SELECT 
                rp.*,
                tr.nombre as tipo_recurso_nombre,
                tr.categoria as tipo_recurso_categoria,
                CONCAT(u.nombre, ' ', u.apellido) as responsable_nombre
            FROM recursos_planificados_fase rp
            JOIN tipos_recurso tr ON rp.id_tipo_recurso = tr.id_tipo_recurso
            LEFT JOIN usuarios u ON rp.responsable_asignacion = u.id_usuario
            WHERE rp.id_fase = ?
            ORDER BY tr.categoria, rp.nombre_recurso
        `;

        const resources = await executeQuery(query, [phaseId]);

        res.json({
            success: true,
            data: {
                phase: phase,
                resources: resources
            }
        });

    } catch (error) {
        console.error('Error listando recursos de fase:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/resources/phase/:phaseId - Planificar recurso para una fase (RF01)
router.post('/phase/:phaseId', [
    body('id_tipo_recurso').isInt({ min: 1 }).withMessage('Tipo de recurso inválido'),
    body('nombre_recurso').isLength({ min: 3 }).withMessage('Nombre del recurso debe tener al menos 3 caracteres'),
    body('cantidad_planificada').isFloat({ min: 0.001 }).withMessage('Cantidad debe ser mayor a 0'),
    body('unidad_medida').isLength({ min: 1 }).withMessage('Unidad de medida es requerida'),
    body('costo_unitario_estimado').optional().isFloat({ min: 0 }).withMessage('Costo unitario debe ser mayor o igual a 0'),
    body('fecha_inicio_uso').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    body('fecha_fin_uso').optional().isISO8601().withMessage('Fecha de fin inválida'),
    body('responsable_asignacion').optional().isInt({ min: 1 }).withMessage('Responsable inválido')
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

        // Validar restricción: No se podrán asignar recursos a fases cerradas o no iniciadas
        if (phase.estado_fase === 'completada') {
            return res.status(400).json({
                success: false,
                message: 'No se pueden asignar recursos a fases completadas'
            });
        }

        const { 
            id_tipo_recurso, 
            nombre_recurso, 
            cantidad_planificada, 
            unidad_medida, 
            costo_unitario_estimado,
            fecha_inicio_uso,
            fecha_fin_uso,
            descripcion,
            responsable_asignacion
        } = req.body;

        // Verificar que el tipo de recurso existe
        const typeQuery = 'SELECT * FROM tipos_recurso WHERE id_tipo_recurso = ? AND activo = TRUE';
        const resourceTypes = await executeQuery(typeQuery, [id_tipo_recurso]);

        if (resourceTypes.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tipo de recurso no encontrado'
            });
        }

        // Validar fechas si se proporcionan
        if (fecha_inicio_uso && fecha_fin_uso && new Date(fecha_inicio_uso) >= new Date(fecha_fin_uso)) {
            return res.status(400).json({
                success: false,
                message: 'La fecha de inicio de uso debe ser anterior a la fecha de fin'
            });
        }

        // Verificar que el responsable existe (si se proporciona)
        if (responsable_asignacion) {
            const userQuery = 'SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND activo = TRUE';
            const users = await executeQuery(userQuery, [responsable_asignacion]);

            if (users.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario responsable no encontrado'
                });
            }
        }

        const insertQuery = `
            INSERT INTO recursos_planificados_fase (
                id_fase, id_tipo_recurso, nombre_recurso, cantidad_planificada, 
                unidad_medida, costo_unitario_estimado, fecha_inicio_uso, 
                fecha_fin_uso, descripcion, responsable_asignacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await executeQuery(insertQuery, [
            phaseId, id_tipo_recurso, nombre_recurso, cantidad_planificada,
            unidad_medida, costo_unitario_estimado || null, fecha_inicio_uso || null,
            fecha_fin_uso || null, descripcion || null, responsable_asignacion || null
        ]);

        res.status(201).json({
            success: true,
            message: 'Recurso planificado exitosamente',
            data: {
                id: result.insertId,
                nombre_recurso,
                cantidad_planificada,
                estado_asignacion: 'planificado'
            }
        });

    } catch (error) {
        console.error('Error planificando recurso:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PUT /api/resources/:id - Actualizar recurso planificado (RF01)
router.put('/:id', [
    body('nombre_recurso').optional().isLength({ min: 3 }).withMessage('Nombre del recurso debe tener al menos 3 caracteres'),
    body('cantidad_planificada').optional().isFloat({ min: 0.001 }).withMessage('Cantidad debe ser mayor a 0'),
    body('costo_unitario_estimado').optional().isFloat({ min: 0 }).withMessage('Costo unitario debe ser mayor o igual a 0'),
    body('estado_asignacion').optional().isIn(['planificado', 'asignado', 'en_uso', 'completado', 'cancelado']).withMessage('Estado inválido')
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

        const resourceId = req.params.id;

        // Verificar acceso al recurso
        const resourceQuery = `
            SELECT rp.*, f.estado_fase, p.id_productor, p.id_asesor
            FROM recursos_planificados_fase rp
            JOIN fases_proyecto f ON rp.id_fase = f.id_fase
            JOIN proyectos p ON f.id_proyecto = p.id_proyecto
            WHERE rp.id_recurso_planificado = ?
        `;
        
        const resources = await executeQuery(resourceQuery, [resourceId]);
        
        if (resources.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Recurso no encontrado'
            });
        }

        const resource = resources[0];

        // Verificar permisos
        const hasAccess = req.user.id === resource.id_productor || 
                         req.user.id === resource.id_asesor || 
                         req.user.rol === 'administrador';

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a este recurso'
            });
        }

        // Validar restricción: No se pueden modificar recursos de fases cerradas
        if (resource.estado_fase === 'completada') {
            return res.status(400).json({
                success: false,
                message: 'No se pueden modificar recursos de fases completadas'
            });
        }

        const { 
            nombre_recurso, 
            cantidad_planificada, 
            costo_unitario_estimado,
            fecha_inicio_uso,
            fecha_fin_uso,
            descripcion,
            estado_asignacion,
            observaciones
        } = req.body;

        const updateFields = [];
        const values = [];

        if (nombre_recurso) {
            updateFields.push('nombre_recurso = ?');
            values.push(nombre_recurso);
        }
        if (cantidad_planificada !== undefined) {
            updateFields.push('cantidad_planificada = ?');
            values.push(cantidad_planificada);
        }
        if (costo_unitario_estimado !== undefined) {
            updateFields.push('costo_unitario_estimado = ?');
            values.push(costo_unitario_estimado);
        }
        if (fecha_inicio_uso !== undefined) {
            updateFields.push('fecha_inicio_uso = ?');
            values.push(fecha_inicio_uso);
        }
        if (fecha_fin_uso !== undefined) {
            updateFields.push('fecha_fin_uso = ?');
            values.push(fecha_fin_uso);
        }
        if (descripcion !== undefined) {
            updateFields.push('descripcion = ?');
            values.push(descripcion);
        }
        if (estado_asignacion) {
            updateFields.push('estado_asignacion = ?');
            values.push(estado_asignacion);
        }
        if (observaciones !== undefined) {
            updateFields.push('observaciones = ?');
            values.push(observaciones);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        values.push(resourceId);

        const updateQuery = `
            UPDATE recursos_planificados_fase 
            SET ${updateFields.join(', ')}
            WHERE id_recurso_planificado = ?
        `;

        await executeQuery(updateQuery, values);

        res.json({
            success: true,
            message: 'Recurso actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error actualizando recurso:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// DELETE /api/resources/:id - Eliminar recurso planificado (RF01)
router.delete('/:id', async (req, res) => {
    try {
        const resourceId = req.params.id;

        // Verificar acceso al recurso
        const resourceQuery = `
            SELECT rp.*, f.estado_fase, p.id_productor, p.id_asesor
            FROM recursos_planificados_fase rp
            JOIN fases_proyecto f ON rp.id_fase = f.id_fase
            JOIN proyectos p ON f.id_proyecto = p.id_proyecto
            WHERE rp.id_recurso_planificado = ?
        `;
        
        const resources = await executeQuery(resourceQuery, [resourceId]);
        
        if (resources.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Recurso no encontrado'
            });
        }

        const resource = resources[0];

        // Verificar permisos
        const hasAccess = req.user.id === resource.id_productor || 
                         req.user.id === resource.id_asesor || 
                         req.user.rol === 'administrador';

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'No tienes acceso a este recurso'
            });
        }

        // Validar que no se pueda eliminar si está en uso o completado
        if (['en_uso', 'completado'].includes(resource.estado_asignacion)) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar un recurso en uso o completado'
            });
        }

        await executeQuery('DELETE FROM recursos_planificados_fase WHERE id_recurso_planificado = ?', [resourceId]);

        res.json({
            success: true,
            message: 'Recurso eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error eliminando recurso:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;