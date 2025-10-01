const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const router = express.Router();

// Validaciones para login
const loginValidation = [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 1 }).withMessage('Password es requerido')
];

// Validaciones para registro
const registerValidation = [
    body('nombre').isLength({ min: 2 }).withMessage('Nombre debe tener al menos 2 caracteres'),
    body('apellido').isLength({ min: 2 }).withMessage('Apellido debe tener al menos 2 caracteres'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 8 }).withMessage('Password debe tener al menos 8 caracteres'),
    body('rol').isIn(['productor', 'asesor', 'administrador']).withMessage('Rol inválido')
];

// POST /api/auth/login - Iniciar sesión (RF58)
router.post('/login', loginValidation, async (req, res) => {
    try {
        // Verificar errores de validación
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Buscar usuario por email
        const query = 'SELECT * FROM usuarios WHERE email = ? AND activo = TRUE';
        const users = await executeQuery(query, [email]);

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        const user = users[0];

        // Verificar contraseña
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciales inválidas'
            });
        }

        // Generar JWT token
        const token = jwt.sign(
            {
                id: user.id_usuario,
                email: user.email,
                rol: user.rol,
                activo: user.activo
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Registrar sesión (RF47)
        const sessionQuery = `
            INSERT INTO sesiones_usuario (id_usuario, ip_address, user_agent, fecha_login)
            VALUES (?, ?, ?, NOW())
        `;
        await executeQuery(sessionQuery, [
            user.id_usuario,
            req.ip || req.connection.remoteAddress,
            req.get('User-Agent') || 'Unknown'
        ]);

        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                token,
                user: {
                    id: user.id_usuario,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    email: user.email,
                    rol: user.rol
                }
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/auth/register - Registrar usuario (RF39)
router.post('/register', registerValidation, async (req, res) => {
    try {
        // Verificar errores de validación
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errors: errors.array()
            });
        }

        const { nombre, apellido, email, password, rol } = req.body;

        // Verificar si el email ya existe
        const existingUser = await executeQuery(
            'SELECT id_usuario FROM usuarios WHERE email = ?',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        // Encriptar contraseña
        const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

        // Insertar nuevo usuario
        const insertQuery = `
            INSERT INTO usuarios (nombre, apellido, email, password_hash, rol)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        const result = await executeQuery(insertQuery, [
            nombre, apellido, email, passwordHash, rol
        ]);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            data: {
                id: result.insertId,
                nombre,
                apellido,
                email,
                rol
            }
        });

    } catch (error) {
        console.error('Error en registro:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// POST /api/auth/forgot-password - Recuperar contraseña (RF59)
router.post('/forgot-password', [
    body('email').isEmail().withMessage('Email inválido')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Email inválido',
                errors: errors.array()
            });
        }

        const { email } = req.body;

        // Verificar si el usuario existe
        const users = await executeQuery(
            'SELECT id_usuario, nombre FROM usuarios WHERE email = ? AND activo = TRUE',
            [email]
        );

        // Siempre responder con éxito para no revelar si el email existe
        res.json({
            success: true,
            message: 'Si el email está registrado, recibirás un enlace de recuperación'
        });

        // Solo enviar email si el usuario existe
        if (users.length > 0) {
            // TODO: Implementar envío de email con token de recuperación
            // Por ahora solo logueamos
            console.log(`Solicitud de recuperación de contraseña para: ${email}`);
        }

    } catch (error) {
        console.error('Error en forgot-password:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;