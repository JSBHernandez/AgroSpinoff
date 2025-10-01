const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken, requireRole, requireActiveUser } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);
router.use(requireActiveUser);

// GET /api/reports/project/:id - Generar reporte de avance de proyecto (RF20)
router.get('/project/:id', async (req, res) => {
    try {
        const projectId = req.params.id;

        // Verificar que el proyecto existe y el usuario tiene permisos
        const projectQuery = `
            SELECT p.*, 
                   CONCAT(prod.nombre, ' ', prod.apellido) as productor_nombre,
                   CONCAT(ases.nombre, ' ', ases.apellido) as asesor_nombre
            FROM proyectos p
            LEFT JOIN usuarios prod ON p.id_productor = prod.id_usuario
            LEFT JOIN usuarios ases ON p.id_asesor = ases.id_usuario
            WHERE p.id_proyecto = ?
        `;

        const projects = await executeQuery(projectQuery, [projectId]);

        if (projects.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        const project = projects[0];

        // Verificar permisos
        if (req.user.rol === 'productor' && project.id_productor !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver este reporte'
            });
        }

        if (req.user.rol === 'asesor' && project.id_asesor !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver este reporte'
            });
        }

        // Obtener fases del proyecto
        const fasesQuery = `
            SELECT * FROM fases_proyecto 
            WHERE id_proyecto = ? 
            ORDER BY orden_fase
        `;
        const fases = await executeQuery(fasesQuery, [projectId]);

        // Obtener insumos utilizados
        const insumosQuery = `
            SELECT i.*, ti.nombre as tipo_insumo
            FROM insumos_proyecto i
            LEFT JOIN tipos_insumo ti ON i.id_tipo_insumo = ti.id_tipo_insumo
            WHERE i.id_proyecto = ?
            ORDER BY i.fecha_uso DESC
        `;
        const insumos = await executeQuery(insumosQuery, [projectId]);

        // Obtener gastos
        const gastosQuery = `
            SELECT * FROM gastos_proyecto 
            WHERE id_proyecto = ?
            ORDER BY fecha_gasto DESC
        `;
        const gastos = await executeQuery(gastosQuery, [projectId]);

        // Calcular resumen financiero
        const totalGastos = gastos.reduce((sum, gasto) => sum + parseFloat(gasto.monto), 0);
        const presupuestoRestante = parseFloat(project.presupuesto_total) - totalGastos;
        const porcentajeUsado = (totalGastos / parseFloat(project.presupuesto_total)) * 100;

        const reportData = {
            proyecto: project,
            fases: fases,
            insumos: insumos,
            gastos: gastos,
            resumen_financiero: {
                presupuesto_total: parseFloat(project.presupuesto_total),
                total_gastado: totalGastos,
                presupuesto_restante: presupuestoRestante,
                porcentaje_usado: Math.round(porcentajeUsado * 100) / 100
            },
            fecha_generacion: new Date().toISOString()
        };

        res.json({
            success: true,
            data: reportData
        });

    } catch (error) {
        console.error('Error generando reporte de proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/reports/financial - Reporte financiero general (RF28)
router.get('/financial', requireRole(['administrador', 'asesor']), async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, categoria } = req.query;

        let whereConditions = ['p.estado != "cancelado"'];
        let params = [];

        if (fecha_inicio) {
            whereConditions.push('p.fecha_inicio >= ?');
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            whereConditions.push('p.fecha_fin <= ?');
            params.push(fecha_fin);
        }

        if (categoria) {
            whereConditions.push('p.categoria = ?');
            params.push(categoria);
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        // Resumen por proyecto
        const proyectosQuery = `
            SELECT 
                p.id_proyecto,
                p.nombre,
                p.categoria,
                p.estado,
                p.presupuesto_total,
                COALESCE(SUM(g.monto), 0) as total_gastado,
                (p.presupuesto_total - COALESCE(SUM(g.monto), 0)) as presupuesto_restante,
                ROUND((COALESCE(SUM(g.monto), 0) / p.presupuesto_total) * 100, 2) as porcentaje_usado
            FROM proyectos p
            LEFT JOIN gastos_proyecto g ON p.id_proyecto = g.id_proyecto
            ${whereClause}
            GROUP BY p.id_proyecto
            ORDER BY p.fecha_creacion DESC
        `;

        const proyectos = await executeQuery(proyectosQuery, params);

        // Resumen general
        const resumenQuery = `
            SELECT 
                COUNT(p.id_proyecto) as total_proyectos,
                SUM(p.presupuesto_total) as presupuesto_total_general,
                COALESCE(SUM(g.monto), 0) as total_gastado_general,
                COUNT(CASE WHEN p.estado = 'finalizado' THEN 1 END) as proyectos_finalizados,
                COUNT(CASE WHEN p.estado = 'ejecucion' THEN 1 END) as proyectos_en_ejecucion,
                COUNT(CASE WHEN p.estado = 'planificacion' THEN 1 END) as proyectos_en_planificacion
            FROM proyectos p
            LEFT JOIN gastos_proyecto g ON p.id_proyecto = g.id_proyecto
            ${whereClause}
        `;

        const resumen = await executeQuery(resumenQuery, params);

        res.json({
            success: true,
            data: {
                resumen_general: resumen[0],
                proyectos: proyectos,
                filtros_aplicados: {
                    fecha_inicio,
                    fecha_fin,
                    categoria
                },
                fecha_generacion: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error generando reporte financiero:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/reports/resources/:projectId - Reporte de utilización de recursos (RF05)
router.get('/resources/:projectId', async (req, res) => {
    try {
        const projectId = req.params.projectId;

        // Verificar que el proyecto existe y permisos
        const projectExists = await executeQuery(
            'SELECT id_proyecto, id_productor, id_asesor FROM proyectos WHERE id_proyecto = ?',
            [projectId]
        );

        if (projectExists.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Proyecto no encontrado'
            });
        }

        const project = projectExists[0];

        // Verificar permisos
        if (req.user.rol === 'productor' && project.id_productor !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para ver este reporte'
            });
        }

        // Obtener recursos planificados vs utilizados por fase
        const recursosQuery = `
            SELECT 
                f.nombre as fase,
                f.presupuesto_fase,
                COALESCE(SUM(g.monto), 0) as gastado_real,
                COUNT(i.id_insumo) as total_insumos,
                COUNT(DISTINCT i.id_tipo_insumo) as tipos_insumos_diferentes
            FROM fases_proyecto f
            LEFT JOIN gastos_proyecto g ON f.id_fase = g.id_fase
            LEFT JOIN insumos_proyecto i ON f.id_proyecto = i.id_proyecto
            WHERE f.id_proyecto = ?
            GROUP BY f.id_fase, f.nombre, f.presupuesto_fase
            ORDER BY f.orden_fase
        `;

        const recursos = await executeQuery(recursosQuery, [projectId]);

        // Obtener detalle de insumos más utilizados
        const insumosQuery = `
            SELECT 
                ti.nombre as tipo_insumo,
                COUNT(i.id_insumo) as cantidad_usos,
                SUM(i.cantidad_utilizada) as cantidad_total,
                i.unidad_medida,
                AVG(i.costo_unitario) as costo_promedio
            FROM insumos_proyecto i
            LEFT JOIN tipos_insumo ti ON i.id_tipo_insumo = ti.id_tipo_insumo
            WHERE i.id_proyecto = ?
            GROUP BY i.id_tipo_insumo, ti.nombre, i.unidad_medida
            ORDER BY cantidad_total DESC
        `;

        const insumos = await executeQuery(insumosQuery, [projectId]);

        res.json({
            success: true,
            data: {
                recursos_por_fase: recursos,
                insumos_utilizados: insumos,
                fecha_generacion: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error generando reporte de recursos:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;