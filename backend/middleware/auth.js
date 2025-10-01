const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware para verificar token JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token de acceso requerido'
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'Token inválido o expirado'
            });
        }

        req.user = decoded;
        next();
    });
};

// Middleware para verificar roles específicos
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no autenticado'
            });
        }

        if (!roles.includes(req.user.rol)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para realizar esta acción'
            });
        }

        next();
    };
};

// Middleware para verificar que el usuario esté activo
const requireActiveUser = (req, res, next) => {
    if (!req.user || !req.user.activo) {
        return res.status(403).json({
            success: false,
            message: 'Usuario inactivo. Contacta al administrador.'
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireRole,
    requireActiveUser
};