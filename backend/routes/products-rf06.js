const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configuración de Multer para imágenes de productos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/productos/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'producto-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB límite
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif)'));
        }
    }
});

// RF06.1 - Obtener listado de productos con precios según rol
router.get('/lista', verifyToken, async (req, res) => {
    try {
        const { categoria, busqueda, orden, limite = 20, pagina = 1 } = req.query;
        const usuario = req.user;
        
        let whereClause = 'WHERE p.activo = 1';
        let queryParams = [usuario.id];
        
        // Filtro por categoría
        if (categoria) {
            whereClause += ' AND p.categoria_id = ?';
            queryParams.push(categoria);
        }
        
        // Filtro de búsqueda
        if (busqueda) {
            whereClause += ' AND (p.nombre LIKE ? OR p.descripcion LIKE ?)';
            queryParams.push(`%${busqueda}%`, `%${busqueda}%`);
        }
        
        // Ordenamiento
        let orderClause = 'ORDER BY p.nombre ASC';
        if (orden === 'precio_asc') orderClause = 'ORDER BY precio_usuario ASC';
        if (orden === 'precio_desc') orderClause = 'ORDER BY precio_usuario DESC';
        if (orden === 'fecha_desc') orderClause = 'ORDER BY p.fecha_creacion DESC';
        
        // Paginación
        const offset = (pagina - 1) * limite;
        
        const query = `
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                p.descripcion,
                p.categoria_id,
                c.nombre as categoria_nombre,
                p.unidad_medida,
                p.stock_actual,
                p.stock_minimo,
                CASE 
                    WHEN EXISTS(SELECT 1 FROM usuarios WHERE id = ? AND rol = 'proveedor') THEN pr.precio_proveedor
                    ELSE pr.precio_cliente
                END as precio_usuario,
                pr.precio_cliente,
                pr.precio_proveedor,
                p.imagen_principal,
                p.activo,
                p.fecha_creacion,
                (SELECT COUNT(*) FROM imagenes_productos WHERE producto_id = p.id) as total_imagenes
            FROM productos p
            JOIN categorias_productos c ON p.categoria_id = c.id
            LEFT JOIN precios_productos pr ON p.id = pr.producto_id
            ${whereClause}
            ${orderClause}
            LIMIT ? OFFSET ?
        `;
        
        queryParams.push(parseInt(limite), parseInt(offset));
        
        const productos = await database.query(query, queryParams);
        
        // Contar total para paginación
        const countQuery = `
            SELECT COUNT(*) as total
            FROM productos p
            JOIN categorias_productos c ON p.categoria_id = c.id
            ${whereClause}
        `;
        
        const [countResult] = await database.query(countQuery, queryParams.slice(1, -2));
        const total = countResult.total;
        
        res.json({
            productos,
            pagination: {
                total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total_paginas: Math.ceil(total / limite)
            }
        });
        
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF06.2 - Obtener detalles de un producto específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = req.user;
        
        // Obtener producto principal
        const productoQuery = `
            SELECT 
                p.*,
                c.nombre as categoria_nombre,
                CASE 
                    WHEN EXISTS(SELECT 1 FROM usuarios WHERE id = ? AND rol = 'proveedor') THEN pr.precio_proveedor
                    ELSE pr.precio_cliente
                END as precio_usuario,
                pr.precio_cliente,
                pr.precio_proveedor
            FROM productos p
            JOIN categorias_productos c ON p.categoria_id = c.id
            LEFT JOIN precios_productos pr ON p.id = pr.producto_id
            WHERE p.id = ? AND p.activo = 1
        `;
        
        const [producto] = await database.query(productoQuery, [usuario.id, id]);
        
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Obtener especificaciones
        const especificacionesQuery = `
            SELECT nombre, valor, unidad
            FROM especificaciones_productos
            WHERE producto_id = ?
            ORDER BY orden ASC
        `;
        
        const especificaciones = await database.query(especificacionesQuery, [id]);
        
        // Obtener imágenes
        const imagenesQuery = `
            SELECT id, ruta, alt_text, es_principal
            FROM imagenes_productos
            WHERE producto_id = ?
            ORDER BY es_principal DESC, orden ASC
        `;
        
        const imagenes = await database.query(imagenesQuery, [id]);
        
        // Obtener productos relacionados
        const relacionadosQuery = `
            SELECT 
                p.id,
                p.codigo,
                p.nombre,
                p.imagen_principal,
                CASE 
                    WHEN EXISTS(SELECT 1 FROM usuarios WHERE id = ? AND rol = 'proveedor') THEN pr.precio_proveedor
                    ELSE pr.precio_cliente
                END as precio_usuario
            FROM productos p
            LEFT JOIN precios_productos pr ON p.id = pr.producto_id
            WHERE p.id IN (
                SELECT producto_relacionado_id
                FROM relaciones_productos
                WHERE producto_id = ?
            ) AND p.activo = 1
            LIMIT 5
        `;
        
        const relacionados = await database.query(relacionadosQuery, [usuario.id, id]);
        
        res.json({
            ...producto,
            especificaciones,
            imagenes,
            relacionados
        });
        
    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF06.3 - Obtener categorías de productos
router.get('/categorias/lista', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT 
                c.*,
                COUNT(p.id) as total_productos
            FROM categorias_productos c
            LEFT JOIN productos p ON c.id = p.categoria_id AND p.activo = 1
            WHERE c.activa = 1
            GROUP BY c.id
            ORDER BY c.orden ASC, c.nombre ASC
        `;
        
        const categorias = await database.query(query);
        
        res.json(categorias);
        
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF06.4 - Crear nuevo producto (solo administradores)
router.post('/', verifyToken, upload.single('imagen'), async (req, res) => {
    try {
        // Verificar permisos
        if (req.user.rol !== 'administrador') {
            return res.status(403).json({ error: 'Sin permisos para crear productos' });
        }
        
        const {
            codigo,
            nombre,
            descripcion,
            categoria_id,
            unidad_medida,
            stock_actual,
            stock_minimo,
            precio_cliente,
            precio_proveedor,
            especificaciones
        } = req.body;
        
        // Validaciones básicas
        if (!codigo || !nombre || !categoria_id || !precio_cliente) {
            return res.status(400).json({ error: 'Campos requeridos faltantes' });
        }
        
        const imagen_principal = req.file ? req.file.filename : null;
        
        // Crear producto
        const insertQuery = `
            INSERT INTO productos (
                codigo, nombre, descripcion, categoria_id, 
                unidad_medida, stock_actual, stock_minimo, 
                imagen_principal, creado_por
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await database.query(insertQuery, [
            codigo, nombre, descripcion, categoria_id,
            unidad_medida || 'unidad', 
            parseInt(stock_actual) || 0,
            parseInt(stock_minimo) || 0,
            imagen_principal,
            req.user.id
        ]);
        
        const producto_id = result.insertId;
        
        // Insertar precios
        const preciosQuery = `
            INSERT INTO precios_productos (producto_id, precio_cliente, precio_proveedor)
            VALUES (?, ?, ?)
        `;
        
        await database.query(preciosQuery, [
            producto_id,
            parseFloat(precio_cliente),
            parseFloat(precio_proveedor) || parseFloat(precio_cliente)
        ]);
        
        // Insertar especificaciones si existen
        if (especificaciones && typeof especificaciones === 'string') {
            const specs = JSON.parse(especificaciones);
            if (Array.isArray(specs) && specs.length > 0) {
                const specQuery = `
                    INSERT INTO especificaciones_productos (producto_id, nombre, valor, unidad, orden)
                    VALUES (?, ?, ?, ?, ?)
                `;
                
                for (let i = 0; i < specs.length; i++) {
                    const spec = specs[i];
                    await database.query(specQuery, [
                        producto_id,
                        spec.nombre,
                        spec.valor,
                        spec.unidad || '',
                        i + 1
                    ]);
                }
            }
        }
        
        res.status(201).json({
            message: 'Producto creado exitosamente',
            producto_id,
            codigo
        });
        
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF06.5 - Actualizar producto (solo administradores)
router.put('/:id', verifyToken, upload.single('imagen'), async (req, res) => {
    try {
        // Verificar permisos
        if (req.user.rol !== 'administrador') {
            return res.status(403).json({ error: 'Sin permisos para actualizar productos' });
        }
        
        const { id } = req.params;
        const {
            codigo,
            nombre,
            descripcion,
            categoria_id,
            unidad_medida,
            stock_actual,
            stock_minimo,
            precio_cliente,
            precio_proveedor,
            activo
        } = req.body;
        
        // Verificar que el producto existe
        const [producto] = await database.query(
            'SELECT id FROM productos WHERE id = ?', 
            [id]
        );
        
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Actualizar producto
        const updateFields = [];
        const updateValues = [];
        
        if (codigo) { updateFields.push('codigo = ?'); updateValues.push(codigo); }
        if (nombre) { updateFields.push('nombre = ?'); updateValues.push(nombre); }
        if (descripcion !== undefined) { updateFields.push('descripcion = ?'); updateValues.push(descripcion); }
        if (categoria_id) { updateFields.push('categoria_id = ?'); updateValues.push(categoria_id); }
        if (unidad_medida) { updateFields.push('unidad_medida = ?'); updateValues.push(unidad_medida); }
        if (stock_actual !== undefined) { updateFields.push('stock_actual = ?'); updateValues.push(parseInt(stock_actual)); }
        if (stock_minimo !== undefined) { updateFields.push('stock_minimo = ?'); updateValues.push(parseInt(stock_minimo)); }
        if (activo !== undefined) { updateFields.push('activo = ?'); updateValues.push(activo === 'true' || activo === true ? 1 : 0); }
        
        if (req.file) {
            updateFields.push('imagen_principal = ?');
            updateValues.push(req.file.filename);
        }
        
        if (updateFields.length > 0) {
            const updateQuery = `
                UPDATE productos 
                SET ${updateFields.join(', ')}, fecha_actualizacion = NOW()
                WHERE id = ?
            `;
            updateValues.push(id);
            
            await database.query(updateQuery, updateValues);
        }
        
        // Actualizar precios si se proporcionan
        if (precio_cliente || precio_proveedor) {
            const preciosUpdateFields = [];
            const preciosUpdateValues = [];
            
            if (precio_cliente) {
                preciosUpdateFields.push('precio_cliente = ?');
                preciosUpdateValues.push(parseFloat(precio_cliente));
            }
            
            if (precio_proveedor) {
                preciosUpdateFields.push('precio_proveedor = ?');
                preciosUpdateValues.push(parseFloat(precio_proveedor));
            }
            
            if (preciosUpdateFields.length > 0) {
                preciosUpdateValues.push(id);
                const preciosQuery = `
                    UPDATE precios_productos 
                    SET ${preciosUpdateFields.join(', ')}
                    WHERE producto_id = ?
                `;
                
                await database.query(preciosQuery, preciosUpdateValues);
            }
        }
        
        res.json({ message: 'Producto actualizado exitosamente' });
        
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF06.6 - Eliminar producto (solo administradores)
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        // Verificar permisos
        if (req.user.rol !== 'administrador') {
            return res.status(403).json({ error: 'Sin permisos para eliminar productos' });
        }
        
        const { id } = req.params;
        
        // Verificar que el producto existe
        const [producto] = await database.query(
            'SELECT id FROM productos WHERE id = ?', 
            [id]
        );
        
        if (!producto) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        
        // Eliminar (desactivar) producto
        await database.query(
            'UPDATE productos SET activo = 0, fecha_actualizacion = NOW() WHERE id = ?',
            [id]
        );
        
        res.json({ message: 'Producto eliminado exitosamente' });
        
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

module.exports = router;