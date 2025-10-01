const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole, requireActiveUser } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveUser);

// GET /api/projects - Listar proyectos (RF41)
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, categoria, estado, search } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;
        const offset = (pageNum - 1) * limitNum;
        
        console.log('DEBUG - Paginación projects:', { page, limit, pageNum, limitNum, offset });

        let whereConditions = [];
        let params = [];

        // Filtrar por rol del usuario
        if (req.user.rol === 'productor') {
            whereConditions.push('p.id_productor = ?');
            params.push(req.user.id);
        } else if (req.user.rol === 'asesor') {
            whereConditions.push('p.id_asesor = ?');
            params.push(req.user.id);
        }

        if (categoria) {
            whereConditions.push('p.categoria = ?');
            params.push(categoria);
        }

        if (estado) {
            whereConditions.push('p.estado = ?');
            params.push(estado);
        }

        if (search) {
            whereConditions.push('(p.nombre LIKE ? OR p.descripcion LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const whereClause = whereConditions.length > 0 ? 
            `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
            SELECT 
                p.id_proyecto,
                p.nombre,
                p.descripcion,
                p.categoria,
                p.estado,
                p.fecha_inicio,
                p.fecha_fin,
                p.presupuesto_total,
                CONCAT(prod.nombre, ' ', prod.apellido) as productor,
                CONCAT(ases.nombre, ' ', ases.apellido) as asesor,
                p.fecha_creacion
            FROM proyectos p
            LEFT JOIN usuarios prod ON p.id_productor = prod.id_usuario
            LEFT JOIN usuarios ases ON p.id_asesor = ases.id_usuario
            ${whereClause}
            ORDER BY p.fecha_creacion DESC
            LIMIT 50
        `;

        console.log('DEBUG - Params antes de query:', params);
        const projects = await executeQuery(query, params);

        res.json({
            success: true,
            data: {
                projects,
                total: projects.length,
                page: 1,
                totalPages: 1
            }
        });

    } catch (error) {
        console.error('Error listando proyectos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/projects - Crear nuevo proyecto (RF41)
router.post('/', [
    body('nombre').isLength({ min: 3 }).withMessage('Nombre debe tener al menos 3 caracteres'),
    body('descripcion').isLength({ min: 10 }).withMessage('Descripción debe tener al menos 10 caracteres'),
    body('categoria').isIn(['agricola', 'pecuario', 'agroindustrial', 'mixto']).withMessage('Categoría inválida'),
    body('fecha_inicio').isISO8601().withMessage('Fecha de inicio inválida'),
    body('fecha_fin').isISO8601().withMessage('Fecha de fin inválida'),
    body('presupuesto_total').isFloat({ min: 0 }).withMessage('Presupuesto debe ser mayor o igual a 0')
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

        const { nombre, descripcion, categoria, fecha_inicio, fecha_fin, presupuesto_total } = req.body;

        // Validar que la fecha de inicio no sea posterior a la de fin
        if (new Date(fecha_inicio) >= new Date(fecha_fin)) {
            return res.status(400).json({
                success: false,
                message: 'La fecha de inicio debe ser anterior a la fecha de fin'
            });
        }

        // Verificar que el nombre del proyecto sea único
        const existingProject = await executeQuery(
            'SELECT id_proyecto FROM proyectos WHERE nombre = ?',
            [nombre]
        );

        if (existingProject.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un proyecto con ese nombre'
            });
        }

        const insertQuery = `
            INSERT INTO proyectos (
                nombre, descripcion, categoria, fecha_inicio, fecha_fin, 
                presupuesto_total, id_productor, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'planificacion')
        `;

        const result = await executeQuery(insertQuery, [
            nombre, descripcion, categoria, fecha_inicio, 
            fecha_fin, presupuesto_total, req.user.id
        ]);

        res.status(201).json({
            success: true,
            message: 'Proyecto creado exitosamente',
            data: {
                id: result.insertId,
                nombre,
                descripcion,
                categoria,
                estado: 'planificacion'
            }
        });

    } catch (error) {
        console.error('Error creando proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/projects/:id - Obtener proyecto por ID
router.get('/:id', async (req, res) => {
    try {
        const projectId = req.params.id;

        const query = `
            SELECT 
                p.*,
                CONCAT(prod.nombre, ' ', prod.apellido) as productor_nombre,
                prod.email as productor_email,
                CONCAT(ases.nombre, ' ', ases.apellido) as asesor_nombre,
                ases.email as asesor_email
            FROM proyectos p
            LEFT JOIN usuarios prod ON p.id_productor = prod.id_usuario
            LEFT JOIN usuarios ases ON p.id_asesor = ases.id_usuario
            WHERE p.id_proyecto = ?
        `;

        const projects = await executeQuery(query, [projectId]);

        if (projects.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        const project = projects[0];

        // Verificar permisos de acceso
        if (req.user.rol === 'productor' && project.id_productor !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver este proyecto'
            });
        }

        if (req.user.rol === 'asesor' && project.id_asesor !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver este proyecto'
            });
        }

        res.json({
            success: true,
            data: project
        });

    } catch (error) {
        console.error('Error obteniendo proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PUT /api/projects/:id - Actualizar proyecto (RF15)
router.put('/:id', [
    body('nombre').optional().isLength({ min: 3 }).withMessage('Nombre debe tener al menos 3 caracteres'),
    body('descripcion').optional().isLength({ min: 10 }).withMessage('Descripción debe tener al menos 10 caracteres'),
    body('categoria').optional().isIn(['agricola', 'pecuario', 'agroindustrial', 'mixto']).withMessage('Categoría inválida'),
    body('fecha_inicio').optional().isISO8601().withMessage('Fecha de inicio inválida'),
    body('fecha_fin').optional().isISO8601().withMessage('Fecha de fin inválida'),
    body('presupuesto_total').optional().isFloat({ min: 0 }).withMessage('Presupuesto debe ser mayor o igual a 0')
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

        const projectId = req.params.id;

        // Verificar que el proyecto existe y obtener sus datos
        const existingProject = await executeQuery(
            'SELECT * FROM proyectos WHERE id_proyecto = ?',
            [projectId]
        );

        if (existingProject.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        const project = existingProject[0];

        // Verificar permisos de edición
        if (req.user.rol === 'productor' && project.id_productor !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para editar este proyecto'
            });
        }

        // Verificar estado del proyecto (RF15)
        if (!['planificacion', 'ejecucion'].includes(project.estado)) {
            return res.status(400).json({
                success: false,
                message: 'No se puede editar un proyecto finalizado, cancelado o suspendido'
            });
        }

        const updateFields = [];
        const values = [];
        const allowedFields = ['nombre', 'descripcion', 'categoria', 'fecha_inicio', 'fecha_fin', 'presupuesto_total'];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        values.push(projectId);

        const query = `
            UPDATE proyectos 
            SET ${updateFields.join(', ')}, fecha_modificacion = NOW()
            WHERE id_proyecto = ?
        `;

        await executeQuery(query, values);

        res.json({
            success: true,
            message: 'Proyecto actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error actualizando proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;