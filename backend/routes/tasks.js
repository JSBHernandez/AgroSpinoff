const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole, requireActiveUser } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveUser);

// ================================================================
// RUTAS PARA GESTIÓN DE TAREAS
// ================================================================

// GET /api/tasks/phase/:phaseId - Obtener tareas de una fase específica
router.get('/phase/:phaseId', async (req, res) => {
    try {
        const phaseId = req.params.phaseId;

        // Verificar acceso a la fase
        const phaseAccessQuery = `
            SELECT fp.*, p.id_productor, p.nombre as proyecto_nombre
            FROM fases_proyecto fp
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            WHERE fp.id_fase = ?
              AND (p.id_productor = ? OR ? IN (
                  SELECT id_usuario FROM usuarios WHERE rol IN ('administrador', 'asesor')
              ))
        `;
        
        const phaseResult = await executeQuery(phaseAccessQuery, [phaseId, req.user.id_usuario, req.user.id_usuario]);
        
        if (phaseResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Fase no encontrada o sin permisos de acceso'
            });
        }

        const phase = phaseResult[0];

        // Obtener tareas de la fase con asignaciones
        const tasksQuery = `
            SELECT 
                tp.*,
                COUNT(ap.id_asignacion) as total_asignados,
                COALESCE(SUM(ap.horas_trabajadas), 0) as total_horas_trabajadas,
                GROUP_CONCAT(
                    CONCAT(u.nombre, ' ', u.apellido, ' (', rt.nombre, ')')
                    SEPARATOR ', '
                ) as asignados_info
            FROM tareas_proyecto tp
            LEFT JOIN asignaciones_personal ap ON tp.id_tarea = ap.id_tarea 
                AND ap.estado_asignacion IN ('asignada', 'activa')
            LEFT JOIN usuarios u ON ap.id_usuario = u.id_usuario
            LEFT JOIN roles_tarea rt ON ap.id_rol_tarea = rt.id_rol_tarea
            WHERE tp.id_fase = ?
            GROUP BY tp.id_tarea
            ORDER BY tp.prioridad DESC, tp.fecha_inicio ASC
        `;

        const tasks = await executeQuery(tasksQuery, [phaseId]);

        res.json({
            success: true,
            data: {
                phase,
                tasks: tasks.map(task => ({
                    ...task,
                    dependencias: task.dependencias ? JSON.parse(task.dependencias) : [],
                    asignados_info: task.asignados_info || 'Sin asignar'
                }))
            }
        });

    } catch (error) {
        console.error('Error obteniendo tareas de fase:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/tasks - Crear nueva tarea
router.post('/', [
    body('id_fase').isInt({ min: 1 }).withMessage('ID de fase requerido'),
    body('nombre').trim().isLength({ min: 1, max: 200 }).withMessage('Nombre de tarea requerido (1-200 caracteres)'),
    body('descripcion').optional().isLength({ max: 1000 }),
    body('fecha_inicio').optional().isISO8601().withMessage('Formato de fecha inválido'),
    body('fecha_fin').optional().isISO8601().withMessage('Formato de fecha inválido'),
    body('prioridad').optional().isIn(['baja', 'media', 'alta', 'critica']),
    body('horas_estimadas').optional().isFloat({ min: 0 }).withMessage('Horas estimadas debe ser un número positivo'),
    body('dependencias').optional().isArray().withMessage('Dependencias debe ser un array')
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
            id_fase, nombre, descripcion, fecha_inicio, fecha_fin, 
            prioridad = 'media', horas_estimadas, dependencias = [] 
        } = req.body;

        // Verificar permisos sobre la fase
        const phaseAccessQuery = `
            SELECT fp.*, p.id_productor
            FROM fases_proyecto fp
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            WHERE fp.id_fase = ?
              AND (p.id_productor = ? OR ? IN (
                  SELECT id_usuario FROM usuarios WHERE rol IN ('administrador', 'asesor')
              ))
        `;
        
        const phaseResult = await executeQuery(phaseAccessQuery, [id_fase, req.user.id_usuario, req.user.id_usuario]);
        
        if (phaseResult.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Sin permisos para crear tareas en esta fase'
            });
        }

        // Validar fechas
        if (fecha_inicio && fecha_fin && new Date(fecha_inicio) > new Date(fecha_fin)) {
            return res.status(400).json({
                success: false,
                message: 'La fecha de inicio no puede ser posterior a la fecha de fin'
            });
        }

        // Validar dependencias
        if (dependencias.length > 0) {
            const dependenciesQuery = `
                SELECT COUNT(*) as valid_count
                FROM tareas_proyecto tp
                INNER JOIN fases_proyecto fp ON tp.id_fase = fp.id_fase
                WHERE tp.id_tarea IN (${dependencias.map(() => '?').join(',')})
                  AND fp.id_proyecto = (
                      SELECT id_proyecto FROM fases_proyecto WHERE id_fase = ?
                  )
            `;
            
            const depResult = await executeQuery(dependenciesQuery, [...dependencias, id_fase]);
            
            if (depResult[0].valid_count !== dependencias.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Una o más dependencias no son válidas'
                });
            }
        }

        // Crear la tarea
        const insertQuery = `
            INSERT INTO tareas_proyecto (
                id_fase, nombre, descripcion, fecha_inicio, fecha_fin, 
                prioridad, horas_estimadas, dependencias, usuario_creacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const insertParams = [
            id_fase, nombre, descripcion, fecha_inicio, fecha_fin, 
            prioridad, horas_estimadas, JSON.stringify(dependencias), req.user.id_usuario
        ];

        const result = await executeQuery(insertQuery, insertParams);

        // Obtener la tarea creada
        const newTaskQuery = `
            SELECT tp.*, fp.nombre as fase_nombre, p.nombre as proyecto_nombre
            FROM tareas_proyecto tp
            INNER JOIN fases_proyecto fp ON tp.id_fase = fp.id_fase
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            WHERE tp.id_tarea = ?
        `;

        const newTask = await executeQuery(newTaskQuery, [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Tarea creada exitosamente',
            data: {
                task: {
                    ...newTask[0],
                    dependencias: dependencias
                }
            }
        });

    } catch (error) {
        console.error('Error creando tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT /api/tasks/:taskId - Actualizar tarea
router.put('/:taskId', [
    body('nombre').optional().trim().isLength({ min: 1, max: 200 }),
    body('descripcion').optional().isLength({ max: 1000 }),
    body('fecha_inicio').optional().isISO8601(),
    body('fecha_fin').optional().isISO8601(),
    body('estado').optional().isIn(['pendiente', 'en_progreso', 'completada', 'suspendida', 'cancelada']),
    body('prioridad').optional().isIn(['baja', 'media', 'alta', 'critica']),
    body('progreso_porcentaje').optional().isFloat({ min: 0, max: 100 }),
    body('horas_estimadas').optional().isFloat({ min: 0 })
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

        const taskId = req.params.taskId;

        // Verificar permisos sobre la tarea
        const taskAccessQuery = `
            SELECT tp.*, fp.id_proyecto, p.id_productor
            FROM tareas_proyecto tp
            INNER JOIN fases_proyecto fp ON tp.id_fase = fp.id_fase
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            WHERE tp.id_tarea = ?
              AND (p.id_productor = ? OR ? IN (
                  SELECT id_usuario FROM usuarios WHERE rol IN ('administrador', 'asesor')
              ) OR EXISTS (
                  SELECT 1 FROM asignaciones_personal ap
                  WHERE ap.id_tarea = tp.id_tarea 
                    AND ap.id_usuario = ?
                    AND ap.estado_asignacion IN ('asignada', 'activa')
              ))
        `;
        
        const taskResult = await executeQuery(taskAccessQuery, [taskId, req.user.id_usuario, req.user.id_usuario, req.user.id_usuario]);
        
        if (taskResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada o sin permisos de acceso'
            });
        }

        const allowedUpdates = ['nombre', 'descripcion', 'fecha_inicio', 'fecha_fin', 'estado', 'prioridad', 'progreso_porcentaje', 'horas_estimadas', 'observaciones'];
        const updates = {};
        const updateParams = [];
        
        for (const field of allowedUpdates) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
                updateParams.push(req.body[field]);
            }
        }

        if (updateParams.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron campos para actualizar'
            });
        }

        // Validar fechas si se proporcionan ambas
        if (updates.fecha_inicio && updates.fecha_fin && new Date(updates.fecha_inicio) > new Date(updates.fecha_fin)) {
            return res.status(400).json({
                success: false,
                message: 'La fecha de inicio no puede ser posterior a la fecha de fin'
            });
        }

        const updateQuery = `
            UPDATE tareas_proyecto 
            SET ${Object.keys(updates).map(field => `${field} = ?`).join(', ')}
            WHERE id_tarea = ?
        `;

        await executeQuery(updateQuery, [...updateParams, taskId]);

        // Obtener tarea actualizada
        const updatedTaskQuery = `
            SELECT tp.*, fp.nombre as fase_nombre, p.nombre as proyecto_nombre
            FROM tareas_proyecto tp
            INNER JOIN fases_proyecto fp ON tp.id_fase = fp.id_fase
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            WHERE tp.id_tarea = ?
        `;

        const updatedTask = await executeQuery(updatedTaskQuery, [taskId]);

        res.json({
            success: true,
            message: 'Tarea actualizada exitosamente',
            data: {
                task: updatedTask[0]
            }
        });

    } catch (error) {
        console.error('Error actualizando tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// DELETE /api/tasks/:taskId - Eliminar tarea
router.delete('/:taskId', requireRole(['administrador', 'asesor']), async (req, res) => {
    try {
        const taskId = req.params.taskId;

        // Verificar que la tarea existe y obtener información
        const taskQuery = `
            SELECT tp.*, fp.nombre as fase_nombre, p.nombre as proyecto_nombre
            FROM tareas_proyecto tp
            INNER JOIN fases_proyecto fp ON tp.id_fase = fp.id_fase
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            WHERE tp.id_tarea = ?
        `;

        const taskResult = await executeQuery(taskQuery, [taskId]);

        if (taskResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada'
            });
        }

        // Verificar si hay asignaciones activas
        const activeAssignmentsQuery = `
            SELECT COUNT(*) as active_count
            FROM asignaciones_personal
            WHERE id_tarea = ? AND estado_asignacion IN ('asignada', 'activa')
        `;

        const activeResult = await executeQuery(activeAssignmentsQuery, [taskId]);

        if (activeResult[0].active_count > 0) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar una tarea con asignaciones activas'
            });
        }

        // Eliminar la tarea (las asignaciones se eliminan en cascada)
        const deleteQuery = 'DELETE FROM tareas_proyecto WHERE id_tarea = ?';
        await executeQuery(deleteQuery, [taskId]);

        res.json({
            success: true,
            message: 'Tarea eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error eliminando tarea:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ================================================================
// RUTAS PARA GESTIÓN DE ASIGNACIONES
// ================================================================

// GET /api/tasks/assignments/user/:userId - Obtener asignaciones de un usuario
router.get('/assignments/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { includeCompleted = 'false' } = req.query;

        // Verificar permisos (solo el propio usuario o administradores/asesores)
        if (req.user.id_usuario !== parseInt(userId) && !['administrador', 'asesor'].includes(req.user.rol)) {
            return res.status(403).json({
                success: false,
                message: 'Sin permisos para ver las asignaciones de este usuario'
            });
        }

        const statusFilter = includeCompleted === 'true' 
            ? "ap.estado_asignacion IN ('asignada', 'activa', 'completada')"
            : "ap.estado_asignacion IN ('asignada', 'activa')";

        const assignmentsQuery = `
            SELECT 
                ap.*,
                tp.nombre as tarea_nombre,
                tp.descripcion as tarea_descripcion,
                tp.estado as tarea_estado,
                tp.prioridad as tarea_prioridad,
                tp.progreso_porcentaje,
                fp.nombre as fase_nombre,
                p.nombre as proyecto_nombre,
                rt.nombre as rol_nombre,
                rt.descripcion as rol_descripcion,
                u.nombre as usuario_nombre,
                u.apellido as usuario_apellido
            FROM asignaciones_personal ap
            INNER JOIN tareas_proyecto tp ON ap.id_tarea = tp.id_tarea
            INNER JOIN fases_proyecto fp ON tp.id_fase = fp.id_fase
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            INNER JOIN roles_tarea rt ON ap.id_rol_tarea = rt.id_rol_tarea
            INNER JOIN usuarios u ON ap.id_usuario = u.id_usuario
            WHERE ap.id_usuario = ? AND ${statusFilter}
            ORDER BY tp.prioridad DESC, ap.fecha_inicio_asignacion ASC
        `;

        const assignments = await executeQuery(assignmentsQuery, [userId]);

        res.json({
            success: true,
            data: { assignments }
        });

    } catch (error) {
        console.error('Error obteniendo asignaciones de usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/tasks/:taskId/assignments - Asignar personal a una tarea
router.post('/:taskId/assignments', [
    body('id_usuario').isInt({ min: 1 }).withMessage('ID de usuario requerido'),
    body('id_rol_tarea').isInt({ min: 1 }).withMessage('ID de rol requerido'),
    body('fecha_inicio_asignacion').optional().isISO8601(),
    body('fecha_fin_asignacion').optional().isISO8601(),
    body('horas_asignadas').optional().isFloat({ min: 0 }),
    body('porcentaje_dedicacion').optional().isFloat({ min: 0, max: 100 })
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

        const taskId = req.params.taskId;
        const { 
            id_usuario, id_rol_tarea, fecha_inicio_asignacion, fecha_fin_asignacion,
            horas_asignadas, porcentaje_dedicacion = 100.00, observaciones
        } = req.body;

        // Verificar permisos sobre la tarea
        const taskAccessQuery = `
            SELECT tp.*, fp.id_proyecto, p.id_productor
            FROM tareas_proyecto tp
            INNER JOIN fases_proyecto fp ON tp.id_fase = fp.id_fase
            INNER JOIN proyectos p ON fp.id_proyecto = p.id_proyecto
            WHERE tp.id_tarea = ?
              AND (p.id_productor = ? OR ? IN (
                  SELECT id_usuario FROM usuarios WHERE rol IN ('administrador', 'asesor')
              ))
        `;
        
        const taskResult = await executeQuery(taskAccessQuery, [taskId, req.user.id_usuario, req.user.id_usuario]);
        
        if (taskResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarea no encontrada o sin permisos de acceso'
            });
        }

        // Verificar que el usuario y rol existen y están activos
        const userRoleQuery = `
            SELECT u.activo as usuario_activo, rt.activo as rol_activo
            FROM usuarios u, roles_tarea rt
            WHERE u.id_usuario = ? AND rt.id_rol_tarea = ?
        `;

        const userRoleResult = await executeQuery(userRoleQuery, [id_usuario, id_rol_tarea]);

        if (userRoleResult.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Usuario o rol no encontrados'
            });
        }

        if (!userRoleResult[0].usuario_activo) {
            return res.status(400).json({
                success: false,
                message: 'No se puede asignar un usuario inactivo'
            });
        }

        if (!userRoleResult[0].rol_activo) {
            return res.status(400).json({
                success: false,
                message: 'No se puede asignar un rol inactivo'
            });
        }

        // Verificar si ya existe esta asignación
        const existingAssignmentQuery = `
            SELECT id_asignacion 
            FROM asignaciones_personal 
            WHERE id_tarea = ? AND id_usuario = ? AND id_rol_tarea = ?
              AND estado_asignacion IN ('asignada', 'activa')
        `;

        const existingResult = await executeQuery(existingAssignmentQuery, [taskId, id_usuario, id_rol_tarea]);

        if (existingResult.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'El usuario ya tiene este rol asignado en la tarea'
            });
        }

        // Configurar variable de sesión para el trigger
        await executeQuery('SET @current_user_id = ?', [req.user.id_usuario]);

        // Crear la asignación (el trigger validará conflictos automáticamente)
        const insertQuery = `
            INSERT INTO asignaciones_personal (
                id_tarea, id_usuario, id_rol_tarea, fecha_inicio_asignacion,
                fecha_fin_asignacion, horas_asignadas, porcentaje_dedicacion,
                observaciones, usuario_asignador
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await executeQuery(insertQuery, [
            taskId, id_usuario, id_rol_tarea, fecha_inicio_asignacion,
            fecha_fin_asignacion, horas_asignadas, porcentaje_dedicacion,
            observaciones, req.user.id_usuario
        ]);

        // Obtener la asignación creada con información completa
        const newAssignmentQuery = `
            SELECT 
                ap.*,
                tp.nombre as tarea_nombre,
                u.nombre as usuario_nombre,
                u.apellido as usuario_apellido,
                rt.nombre as rol_nombre
            FROM asignaciones_personal ap
            INNER JOIN tareas_proyecto tp ON ap.id_tarea = tp.id_tarea
            INNER JOIN usuarios u ON ap.id_usuario = u.id_usuario
            INNER JOIN roles_tarea rt ON ap.id_rol_tarea = rt.id_rol_tarea
            WHERE ap.id_asignacion = ?
        `;

        const newAssignment = await executeQuery(newAssignmentQuery, [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Asignación creada exitosamente',
            data: {
                assignment: newAssignment[0]
            }
        });

    } catch (error) {
        console.error('Error creando asignación:', error);
        
        // Manejar errores específicos del trigger
        if (error.message.includes('inactivo') || error.message.includes('asignaciones en el período')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;