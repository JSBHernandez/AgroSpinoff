const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { InvoicePDFGenerator } = require('../utils/invoicePDFGenerator');

// RF07.1 - Obtener listado de facturas
router.get('/lista', verifyToken, async (req, res) => {
    try {
        const { estado, cliente, fecha_desde, fecha_hasta, limite = 20, pagina = 1 } = req.query;
        const usuario = req.user;
        
        let whereClause = 'WHERE 1=1';
        let queryParams = [];
        
        // Filtros
        if (estado && estado !== 'todos') {
            whereClause += ' AND f.estado = ?';
            queryParams.push(estado);
        }
        
        if (cliente) {
            whereClause += ' AND (f.cliente_nombre LIKE ? OR f.cliente_documento LIKE ?)';
            queryParams.push(`%${cliente}%`, `%${cliente}%`);
        }
        
        if (fecha_desde) {
            whereClause += ' AND f.fecha_factura >= ?';
            queryParams.push(fecha_desde);
        }
        
        if (fecha_hasta) {
            whereClause += ' AND f.fecha_factura <= ?';
            queryParams.push(fecha_hasta);
        }
        
        // Si no es administrador, solo ver sus propias facturas
        if (usuario.rol !== 'administrador') {
            whereClause += ' AND f.creado_por_id = ?';
            queryParams.push(usuario.id);
        }
        
        // Paginación
        const offset = (pagina - 1) * limite;
        
        const query = `
            SELECT 
                f.id,
                f.numero_factura,
                f.fecha_factura,
                f.fecha_vencimiento,
                f.cliente_nombre,
                f.cliente_documento,
                f.tipo_cliente,
                f.subtotal,
                f.valor_iva,
                f.total,
                f.estado,
                f.metodo_pago,
                f.proyecto_nombre,
                f.creado_por_nombre,
                CASE 
                    WHEN f.estado = 'vencida' OR (f.estado = 'enviada' AND f.fecha_vencimiento < CURDATE()) THEN 'VENCIDA'
                    WHEN f.estado = 'pagada' THEN 'PAGADA'
                    WHEN f.estado = 'anulada' THEN 'ANULADA'
                    WHEN f.estado = 'enviada' THEN 'PENDIENTE'
                    ELSE 'BORRADOR'
                END as estado_visual,
                CASE 
                    WHEN f.fecha_vencimiento IS NOT NULL THEN DATEDIFF(CURDATE(), f.fecha_vencimiento)
                    ELSE NULL
                END as dias_vencimiento,
                (SELECT COUNT(*) FROM detalles_factura WHERE factura_id = f.id) as total_items
            FROM facturas f
            ${whereClause}
            ORDER BY f.fecha_factura DESC, f.numero_factura DESC
            LIMIT ? OFFSET ?
        `;
        
        queryParams.push(parseInt(limite), parseInt(offset));
        
        const facturas = await executeQuery(query, queryParams);
        
        // Contar total para paginación
        const countQuery = `
            SELECT COUNT(*) as total
            FROM facturas f
            ${whereClause}
        `;
        
        const [countResult] = await executeQuery(countQuery, queryParams.slice(0, -2));
        const total = countResult.total;
        
        res.json({
            facturas,
            pagination: {
                total,
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total_paginas: Math.ceil(total / limite)
            }
        });
        
    } catch (error) {
        console.error('Error al obtener facturas:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF07.2 - Obtener detalles de una factura específica
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = req.user;
        
        // Obtener factura principal
        let whereClause = 'WHERE f.id = ?';
        let queryParams = [id];
        
        // Si no es administrador, solo puede ver sus propias facturas
        if (usuario.rol !== 'administrador') {
            whereClause += ' AND f.creado_por_id = ?';
            queryParams.push(usuario.id);
        }
        
        const facturaQuery = `
            SELECT 
                f.*,
                (SELECT COUNT(*) FROM detalles_factura WHERE factura_id = f.id) as total_items
            FROM facturas f
            ${whereClause}
        `;
        
        const [factura] = await executeQuery(facturaQuery, queryParams);
        
        if (!factura) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        
        // Obtener detalles de la factura
        const detallesQuery = `
            SELECT 
                d.*
            FROM detalles_factura d
            WHERE d.factura_id = ?
            ORDER BY d.orden_item ASC, d.id ASC
        `;
        
        const detalles = await executeQuery(detallesQuery, [id]);
        
        // Obtener historial de acciones
        const historialQuery = `
            SELECT 
                h.accion,
                h.usuario_nombre,
                h.detalles,
                h.fecha_accion
            FROM historial_facturas h
            WHERE h.factura_id = ?
            ORDER BY h.fecha_accion DESC
            LIMIT 10
        `;
        
        const historial = await executeQuery(historialQuery, [id]);
        
        res.json({
            ...factura,
            detalles,
            historial
        });
        
    } catch (error) {
        console.error('Error al obtener factura:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF07.3 - Crear nueva factura
router.post('/', verifyToken, async (req, res) => {
    try {
        const {
            cliente_id,
            tipo_cliente,
            cliente_nombre,
            cliente_documento,
            cliente_tipo_documento,
            cliente_direccion,
            cliente_telefono,
            cliente_email,
            cliente_ciudad,
            fecha_factura,
            dias_credito,
            observaciones,
            terminos_condiciones,
            metodo_pago,
            proyecto_id,
            proyecto_nombre,
            detalles
        } = req.body;
        
        const usuario = req.user;
        
        // Validaciones básicas
        if (!cliente_nombre || !tipo_cliente || !detalles || detalles.length === 0) {
            return res.status(400).json({ error: 'Datos requeridos faltantes' });
        }
        
        // Obtener siguiente número de factura
        const [config] = await executeQuery('SELECT * FROM configuracion_empresa WHERE activa = 1');
        if (!config) {
            return res.status(500).json({ error: 'Configuración de empresa no encontrada' });
        }
        
        const prefijo = config.prefijo_facturacion;
        const consecutivo = config.numeracion_actual;
        const numero_factura = `${prefijo}${String(consecutivo).padStart(6, '0')}`;
        
        // Calcular totales
        let subtotal = 0;
        let valor_iva = 0;
        let total = 0;
        
        const detallesCalculados = detalles.map((detalle, index) => {
            const cantidad = parseFloat(detalle.cantidad) || 0;
            const precio_unitario = parseFloat(detalle.precio_unitario) || 0;
            const descuento_item = parseFloat(detalle.descuento_item) || 0;
            const porcentaje_iva = parseFloat(detalle.porcentaje_iva) || config.iva_porcentaje;
            const aplica_iva = detalle.aplica_iva !== false;
            
            const subtotal_item = (cantidad * precio_unitario) - descuento_item;
            const valor_iva_item = aplica_iva ? (subtotal_item * porcentaje_iva / 100) : 0;
            const total_item = subtotal_item + valor_iva_item;
            
            subtotal += subtotal_item;
            valor_iva += valor_iva_item;
            total += total_item;
            
            return {
                ...detalle,
                cantidad,
                precio_unitario,
                descuento_item,
                subtotal_item,
                aplica_iva,
                porcentaje_iva,
                valor_iva_item,
                total_item,
                orden_item: index + 1
            };
        });
        
        // Calcular fecha de vencimiento
        const fecha_vencimiento = dias_credito > 0 ? 
            new Date(new Date(fecha_factura || new Date()).getTime() + (dias_credito * 24 * 60 * 60 * 1000)) :
            null;
        
        // Crear factura
        const insertFacturaQuery = `
            INSERT INTO facturas (
                numero_factura, prefijo, consecutivo, cliente_id, tipo_cliente,
                cliente_nombre, cliente_documento, cliente_tipo_documento,
                cliente_direccion, cliente_telefono, cliente_email, cliente_ciudad,
                fecha_factura, fecha_vencimiento, subtotal, base_gravable, valor_iva, total,
                observaciones, terminos_condiciones, metodo_pago, dias_credito,
                creado_por_id, creado_por_nombre, proyecto_id, proyecto_nombre
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const facturaResult = await executeQuery(insertFacturaQuery, [
            numero_factura, prefijo, consecutivo, cliente_id, tipo_cliente,
            cliente_nombre, cliente_documento, cliente_tipo_documento || 'CC',
            cliente_direccion, cliente_telefono, cliente_email, cliente_ciudad,
            fecha_factura || new Date().toISOString().split('T')[0],
            fecha_vencimiento ? fecha_vencimiento.toISOString().split('T')[0] : null,
            subtotal, subtotal, valor_iva, total,
            observaciones, terminos_condiciones, metodo_pago || 'efectivo', 
            dias_credito || 0,
            usuario.id, `${usuario.nombre} ${usuario.apellido}`, 
            proyecto_id, proyecto_nombre
        ]);
        
        const factura_id = facturaResult.insertId;
        
        // Insertar detalles
        for (const detalle of detallesCalculados) {
            const insertDetalleQuery = `
                INSERT INTO detalles_factura (
                    factura_id, producto_id, codigo_producto, descripcion, categoria,
                    cantidad, unidad_medida, precio_unitario, descuento_item, subtotal_item,
                    aplica_iva, porcentaje_iva, valor_iva_item, total_item, orden_item, notas_item
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await executeQuery(insertDetalleQuery, [
                factura_id, detalle.producto_id, detalle.codigo_producto,
                detalle.descripcion, detalle.categoria,
                detalle.cantidad, detalle.unidad_medida || 'unidad',
                detalle.precio_unitario, detalle.descuento_item, detalle.subtotal_item,
                detalle.aplica_iva, detalle.porcentaje_iva, detalle.valor_iva_item,
                detalle.total_item, detalle.orden_item, detalle.notas_item
            ]);
        }
        
        // Actualizar numeración
        await executeQuery(
            'UPDATE configuracion_empresa SET numeracion_actual = numeracion_actual + 1 WHERE activa = 1'
        );
        
        // Registrar en historial
        await executeQuery(`
            INSERT INTO historial_facturas (factura_id, accion, usuario_id, usuario_nombre, detalles)
            VALUES (?, 'creada', ?, ?, ?)
        `, [factura_id, usuario.id, `${usuario.nombre} ${usuario.apellido}`, 'Factura creada']);
        
        res.status(201).json({
            message: 'Factura creada exitosamente',
            factura_id,
            numero_factura,
            total
        });
        
    } catch (error) {
        console.error('Error al crear factura:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF07.4 - Actualizar estado de factura
router.put('/:id/estado', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, observaciones } = req.body;
        const usuario = req.user;
        
        const estadosValidos = ['borrador', 'enviada', 'pagada', 'vencida', 'anulada'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ error: 'Estado no válido' });
        }
        
        // Verificar que la factura existe y permisos
        let whereClause = 'WHERE id = ?';
        let queryParams = [id];
        
        if (usuario.rol !== 'administrador') {
            whereClause += ' AND creado_por_id = ?';
            queryParams.push(usuario.id);
        }
        
        const [factura] = await executeQuery(`SELECT * FROM facturas ${whereClause}`, queryParams);
        
        if (!factura) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        
        // Actualizar estado
        await executeQuery(
            'UPDATE facturas SET estado = ?, fecha_actualizacion = NOW() WHERE id = ?',
            [estado, id]
        );
        
        // Registrar en historial
        const accionDescripcion = observaciones || `Estado cambiado a: ${estado}`;
        await executeQuery(`
            INSERT INTO historial_facturas (factura_id, accion, usuario_id, usuario_nombre, detalles)
            VALUES (?, 'modificada', ?, ?, ?)
        `, [id, usuario.id, `${usuario.nombre} ${usuario.apellido}`, accionDescripcion]);
        
        res.json({ message: 'Estado actualizado exitosamente' });
        
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF07.5 - Obtener datos fiscales de clientes
router.get('/clientes/fiscales', verifyToken, async (req, res) => {
    try {
        const { busqueda } = req.query;
        
        let whereClause = 'WHERE activo = 1';
        let queryParams = [];
        
        if (busqueda) {
            whereClause += ' AND (razon_social LIKE ? OR numero_documento LIKE ?)';
            queryParams.push(`%${busqueda}%`, `%${busqueda}%`);
        }
        
        const query = `
            SELECT 
                id,
                razon_social,
                nombre_comercial,
                tipo_documento,
                numero_documento,
                direccion_fiscal,
                ciudad,
                telefono_fiscal,
                email_facturacion,
                regimen_fiscal
            FROM datos_fiscales_usuarios
            ${whereClause}
            ORDER BY razon_social ASC
            LIMIT 50
        `;
        
        const clientes = await executeQuery(query, queryParams);
        
        res.json(clientes);
        
    } catch (error) {
        console.error('Error al obtener clientes fiscales:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF07.6 - Obtener configuración de empresa
router.get('/configuracion', verifyToken, async (req, res) => {
    try {
        const [config] = await executeQuery('SELECT * FROM configuracion_empresa WHERE activa = 1');
        
        if (!config) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        
        res.json(config);
        
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF07.7 - Obtener resumen de facturación
router.get('/resumen/financiero', verifyToken, async (req, res) => {
    try {
        const { periodo } = req.query; // YYYY-MM opcional
        
        let whereClause = "WHERE estado != 'anulada'";
        let queryParams = [];
        
        if (periodo) {
            whereClause += " AND DATE_FORMAT(fecha_factura, '%Y-%m') = ?";
            queryParams.push(periodo);
        }
        
        const resumenQuery = `
            SELECT 
                COUNT(*) as total_facturas,
                SUM(CASE WHEN estado = 'pagada' THEN 1 ELSE 0 END) as facturas_pagadas,
                SUM(CASE WHEN estado = 'enviada' THEN 1 ELSE 0 END) as facturas_pendientes,
                SUM(CASE WHEN estado = 'vencida' OR (estado = 'enviada' AND fecha_vencimiento < CURDATE()) THEN 1 ELSE 0 END) as facturas_vencidas,
                SUM(total) as total_facturado,
                SUM(CASE WHEN estado = 'pagada' THEN total ELSE 0 END) as total_recaudado,
                SUM(CASE WHEN estado = 'enviada' OR estado = 'vencida' THEN total ELSE 0 END) as total_por_cobrar,
                AVG(total) as promedio_factura
            FROM facturas
            ${whereClause}
        `;
        
        const [resumen] = await executeQuery(resumenQuery, queryParams);
        
        res.json(resumen);
        
    } catch (error) {
        console.error('Error al obtener resumen financiero:', error);
        res.status(500).json({ 
            error: 'Error interno del servidor',
            message: error.message 
        });
    }
});

// RF07.7 - Generar PDF de factura
router.get('/pdf/:id', verifyToken, async (req, res) => {
    try {
        const facturaId = parseInt(req.params.id);
        
        if (!facturaId || facturaId <= 0) {
            return res.status(400).json({ error: 'ID de factura inválido' });
        }
        
        // Verificar que la factura existe y el usuario tiene acceso
        const [factura] = await executeQuery(`
            SELECT id, numero_factura, cliente_nombre 
            FROM facturas 
            WHERE id = ?
        `, [facturaId]);
        
        if (!factura) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        
        // Generar PDF
        const pdfGenerator = new InvoicePDFGenerator();
        const pdfBuffer = await pdfGenerator.generateInvoicePDF(facturaId);
        
        // Configurar headers para descarga
        const fileName = `Factura_${factura.numero_factura}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        // Enviar PDF
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Error al generar PDF de factura:', error);
        res.status(500).json({ 
            error: 'Error al generar PDF',
            message: error.message 
        });
    }
});

// RF07.8 - Vista previa PDF en navegador
router.get('/preview/:id', verifyToken, async (req, res) => {
    try {
        const facturaId = parseInt(req.params.id);
        
        if (!facturaId || facturaId <= 0) {
            return res.status(400).json({ error: 'ID de factura inválido' });
        }
        
        // Verificar que la factura existe
        const [factura] = await executeQuery(`
            SELECT id, numero_factura 
            FROM facturas 
            WHERE id = ?
        `, [facturaId]);
        
        if (!factura) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        
        // Generar PDF
        const pdfGenerator = new InvoicePDFGenerator();
        const pdfBuffer = await pdfGenerator.generateInvoicePDF(facturaId);
        
        // Configurar headers para vista previa
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Content-Length', pdfBuffer.length);
        
        // Enviar PDF para vista previa
        res.send(pdfBuffer);
        
    } catch (error) {
        console.error('Error al generar vista previa de factura:', error);
        res.status(500).json({ 
            error: 'Error al generar vista previa',
            message: error.message 
        });
    }
});

module.exports = router;