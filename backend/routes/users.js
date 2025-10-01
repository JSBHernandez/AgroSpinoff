const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole, requireActiveUser } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveUser);

// GET /api/users/profile - Obtener perfil del usuario actual
router.get('/profile', async (req, res) => {
    try {
        const query = `
            SELECT id_usuario, nombre, apellido, email, rol, activo, fecha_registro
            FROM usuarios 
            WHERE id_usuario = ?
        `;
        
        const users = await executeQuery(query, [req.user.id]);
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            data: users[0]
        });

    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PUT /api/users/profile - Actualizar perfil del usuario (RF50)
router.put('/profile', [
    body('nombre').optional().isLength({ min: 2 }).withMessage('Nombre debe tener al menos 2 caracteres'),
    body('apellido').optional().isLength({ min: 2 }).withMessage('Apellido debe tener al menos 2 caracteres'),
    body('telefono').optional().isMobilePhone().withMessage('Teléfono inválido')
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

        const { nombre, apellido, telefono } = req.body;
        const updateFields = [];
        const values = [];

        if (nombre) {
            updateFields.push('nombre = ?');
            values.push(nombre);
        }
        if (apellido) {
            updateFields.push('apellido = ?');
            values.push(apellido);
        }
        if (telefono) {
            updateFields.push('telefono = ?');
            values.push(telefono);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        values.push(req.user.id);

        const query = `
            UPDATE usuarios 
            SET ${updateFields.join(', ')}, fecha_modificacion = NOW()
            WHERE id_usuario = ?
        `;

        await executeQuery(query, values);

        res.json({
            success: true,
            message: 'Perfil actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error actualizando perfil:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/users - Listar usuarios (solo administradores) (RF39)
router.get('/', requireRole(['administrador']), async (req, res) => {
    try {
        const { page = 1, limit = 10, rol, activo } = req.query;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];

        if (rol) {
            whereConditions.push('rol = ?');
            params.push(rol);
        }

        if (activo !== undefined) {
            whereConditions.push('activo = ?');
            params.push(activo === 'true');
        }

        const whereClause = whereConditions.length > 0 ? 
            `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
            SELECT id_usuario, nombre, apellido, email, rol, activo, fecha_registro
            FROM usuarios 
            ${whereClause}
            ORDER BY fecha_registro DESC
            LIMIT ? OFFSET ?
        `;

        params.push(parseInt(limit), parseInt(offset));
        const users = await executeQuery(query, params);

        // Contar total para paginación
        const countQuery = `SELECT COUNT(*) as total FROM usuarios ${whereClause}`;
        const countResult = await executeQuery(countQuery, params.slice(0, -2));
        const total = countResult[0].total;

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(total / limit),
                    total_records: total,
                    per_page: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Error listando usuarios:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// PUT /api/users/:id/status - Activar/Desactivar usuario (RF51)
router.put('/:id/status', requireRole(['administrador']), [
    body('activo').isBoolean().withMessage('Estado activo debe ser true o false')
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

        const userId = req.params.id;
        const { activo } = req.body;

        // Verificar que el usuario existe
        const userExists = await executeQuery(
            'SELECT id_usuario FROM usuarios WHERE id_usuario = ?',
            [userId]
        );

        if (userExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // No permitir que el administrador se desactive a sí mismo
        if (userId == req.user.id && !activo) {
            return res.status(400).json({
                success: false,
                message: 'No puedes desactivarte a ti mismo'
            });
        }

        const query = 'UPDATE usuarios SET activo = ? WHERE id_usuario = ?';
        await executeQuery(query, [activo, userId]);

        res.json({
            success: true,
            message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`
        });

    } catch (error) {
        console.error('Error cambiando estado del usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;