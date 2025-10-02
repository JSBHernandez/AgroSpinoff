const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const pool = require('../config/database');
const ExcelJS = require('exceljs');
const puppeteer = require('puppeteer');
const moment = require('moment');
const path = require('path');
const fs = require('fs');

// Middleware de autenticación
const { authenticateToken } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

// =============================================================================
// RUTAS DE CONSULTA DE REPORTES RF05
// =============================================================================

// GET /api/reports-rf05/resources/utilization - Reporte de utilización de recursos
router.get('/resources/utilization', async (req, res) => {
    try {
        const { 
            proyecto_id, 
            fase_id, 
            tipo_recurso_id, 
            fecha_inicio, 
            fecha_fin,
            categoria_recurso,
            estado_proyecto,
            limite = 100,
            offset = 0 
        } = req.query;

        let query = `
            SELECT * FROM vista_utilizacion_recursos
            WHERE 1=1
        `;
        
        const params = [];

        // Aplicar filtros
        if (proyecto_id) {
            query += ` AND id_proyecto = ?`;
            params.push(proyecto_id);
        }

        if (fase_id) {
            query += ` AND id_fase = ?`;
            params.push(fase_id);
        }

        if (tipo_recurso_id) {
            query += ` AND id_tipo_recurso = ?`;
            params.push(tipo_recurso_id);
        }

        if (categoria_recurso) {
            query += ` AND recurso_categoria = ?`;
            params.push(categoria_recurso);
        }

        if (estado_proyecto) {
            query += ` AND proyecto_estado = ?`;
            params.push(estado_proyecto);
        }

        if (fecha_inicio) {
            query += ` AND fecha_inicio_uso >= ?`;
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            query += ` AND fecha_fin_uso <= ?`;
            params.push(fecha_fin);
        }

        query += ` ORDER BY proyecto_nombre, fase_nombre, tipo_recurso_nombre`;
        query += ` LIMIT ? OFFSET ?`;
        params.push(parseInt(limite), parseInt(offset));

        const [rows] = await pool.execute(query, params);

        // Calcular totales
        let totalQuery = `
            SELECT 
                COUNT(*) as total_registros,
                SUM(cantidad_planificada) as total_planificado,
                SUM(cantidad_real_utilizada) as total_utilizado,
                SUM(costo_total_planificado) as total_costo_planificado,
                SUM(costo_real_estimado) as total_costo_real,
                AVG(variacion_porcentual_cantidad) as promedio_variacion_cantidad,
                AVG(variacion_porcentual_costo) as promedio_variacion_costo
            FROM vista_utilizacion_recursos WHERE 1=1
        `;

        // Aplicar los mismos filtros para el total (sin límite y offset)
        const totalParams = params.slice(0, -2); // Remover limite y offset
        if (proyecto_id) totalQuery += ` AND id_proyecto = ?`;
        if (fase_id) totalQuery += ` AND id_fase = ?`;
        if (tipo_recurso_id) totalQuery += ` AND id_tipo_recurso = ?`;
        if (categoria_recurso) totalQuery += ` AND recurso_categoria = ?`;
        if (estado_proyecto) totalQuery += ` AND proyecto_estado = ?`;
        if (fecha_inicio) totalQuery += ` AND fecha_inicio_uso >= ?`;
        if (fecha_fin) totalQuery += ` AND fecha_fin_uso <= ?`;

        const [totales] = await pool.execute(totalQuery, totalParams);

        res.json({
            success: true,
            data: {
                reportes: rows,
                totales: totales[0],
                filtros_aplicados: {
                    proyecto_id,
                    fase_id, 
                    tipo_recurso_id,
                    fecha_inicio,
                    fecha_fin,
                    categoria_recurso,
                    estado_proyecto
                },
                paginacion: {
                    limite: parseInt(limite),
                    offset: parseInt(offset),
                    total_registros: totales[0].total_registros
                }
            }
        });

    } catch (error) {
        console.error('Error generando reporte de utilización:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/reports-rf05/resources/summary - Resumen por proyecto
router.get('/resources/summary', async (req, res) => {
    try {
        const { proyecto_id, estado_proyecto } = req.query;

        let query = `SELECT * FROM vista_resumen_recursos_proyecto WHERE 1=1`;
        const params = [];

        if (proyecto_id) {
            query += ` AND id_proyecto = ?`;
            params.push(proyecto_id);
        }

        if (estado_proyecto) {
            query += ` AND proyecto_estado = ?`;
            params.push(estado_proyecto);
        }

        query += ` ORDER BY proyecto_nombre`;

        const [rows] = await pool.execute(query, params);

        res.json({
            success: true,
            data: {
                resumen_proyectos: rows,
                fecha_generacion: new Date(),
                filtros_aplicados: { proyecto_id, estado_proyecto }
            }
        });

    } catch (error) {
        console.error('Error generando resumen por proyecto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/reports-rf05/resources/trends - Tendencias de consumo
router.get('/resources/trends', async (req, res) => {
    try {
        const { 
            proyecto_id, 
            tipo_recurso_id, 
            fecha_inicio, 
            fecha_fin,
            agrupacion = 'diario' // diario, semanal, mensual
        } = req.query;

        let query = `SELECT * FROM vista_tendencias_consumo WHERE 1=1`;
        const params = [];

        if (proyecto_id) {
            query += ` AND id_proyecto = ?`;
            params.push(proyecto_id);
        }

        if (tipo_recurso_id) {
            query += ` AND id_tipo_recurso = ?`;
            params.push(tipo_recurso_id);
        }

        if (fecha_inicio) {
            query += ` AND fecha_consumo >= ?`;
            params.push(fecha_inicio);
        }

        if (fecha_fin) {
            query += ` AND fecha_consumo <= ?`;
            params.push(fecha_fin);
        }

        // Ordenar según la agrupación solicitada
        if (agrupacion === 'semanal') {
            query += ` ORDER BY proyecto_nombre, tipo_recurso_nombre, año_consumo, semana_consumo`;
        } else if (agrupacion === 'mensual') {
            query += ` ORDER BY proyecto_nombre, tipo_recurso_nombre, año_consumo, mes_consumo`;
        } else {
            query += ` ORDER BY proyecto_nombre, tipo_recurso_nombre, fecha_consumo`;
        }

        const [rows] = await pool.execute(query, params);

        res.json({
            success: true,
            data: {
                tendencias: rows,
                agrupacion,
                fecha_generacion: new Date(),
                filtros_aplicados: { proyecto_id, tipo_recurso_id, fecha_inicio, fecha_fin }
            }
        });

    } catch (error) {
        console.error('Error generando tendencias de consumo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// GET /api/reports-rf05/export/pdf - Exportar reporte a PDF
router.get('/export/pdf', async (req, res) => {
    try {
        const { tipo_reporte = 'utilizacion', ...filtros } = req.query;

        // Obtener datos según el tipo de reporte
        let datos;
        let tituloReporte;

        switch (tipo_reporte) {
            case 'utilizacion':
                const utilizacionResponse = await obtenerDatosUtilizacion(filtros);
                datos = utilizacionResponse.reportes;
                tituloReporte = 'Reporte de Utilización de Recursos';
                break;
            case 'resumen':
                const resumenResponse = await obtenerDatosResumen(filtros);
                datos = resumenResponse.resumen_proyectos;
                tituloReporte = 'Resumen de Recursos por Proyecto';
                break;
            case 'tendencias':
                const tendenciasResponse = await obtenerDatosTendencias(filtros);
                datos = tendenciasResponse.tendencias;
                tituloReporte = 'Tendencias de Consumo de Recursos';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de reporte no válido'
                });
        }

        // Generar HTML para el PDF
        const htmlContent = generarHTMLReporte(tituloReporte, datos, filtros);

        // Configurar Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent);

        // Generar PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            },
            printBackground: true
        });

        await browser.close();

        // Configurar respuesta
        const fileName = `reporte_${tipo_reporte}_${moment().format('YYYYMMDD_HHmm')}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error exportando a PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Error generando archivo PDF'
        });
    }
});

// GET /api/reports-rf05/export/excel - Exportar reporte a Excel
router.get('/export/excel', async (req, res) => {
    try {
        const { tipo_reporte = 'utilizacion', ...filtros } = req.query;

        // Obtener datos según el tipo de reporte
        let datos;
        let nombreHoja;
        let tituloReporte;

        switch (tipo_reporte) {
            case 'utilizacion':
                const utilizacionResponse = await obtenerDatosUtilizacion(filtros);
                datos = utilizacionResponse.reportes;
                nombreHoja = 'Utilización de Recursos';
                tituloReporte = 'Reporte de Utilización de Recursos';
                break;
            case 'resumen':
                const resumenResponse = await obtenerDatosResumen(filtros);
                datos = resumenResponse.resumen_proyectos;
                nombreHoja = 'Resumen por Proyecto';
                tituloReporte = 'Resumen de Recursos por Proyecto';
                break;
            case 'tendencias':
                const tendenciasResponse = await obtenerDatosTendencias(filtros);
                datos = tendenciasResponse.tendencias;
                nombreHoja = 'Tendencias de Consumo';
                tituloReporte = 'Tendencias de Consumo de Recursos';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de reporte no válido'
                });
        }

        // Crear libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(nombreHoja);

        // Configurar metadatos
        workbook.creator = 'AgroTechNova';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Título del reporte
        worksheet.mergeCells('A1:H1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = tituloReporte;
        titleCell.font = { bold: true, size: 16 };
        titleCell.alignment = { horizontal: 'center' };

        // Información de generación
        worksheet.mergeCells('A2:H2');
        const dateCell = worksheet.getCell('A2');
        dateCell.value = `Generado el: ${moment().format('DD/MM/YYYY HH:mm')}`;
        dateCell.font = { italic: true };
        dateCell.alignment = { horizontal: 'center' };

        // Espacio
        worksheet.addRow([]);

        if (datos && datos.length > 0) {
            // Encabezados
            const headers = Object.keys(datos[0]);
            const headerRow = worksheet.addRow(headers);
            headerRow.font = { bold: true };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE6F3FF' }
            };

            // Datos
            datos.forEach(row => {
                const values = headers.map(header => row[header]);
                worksheet.addRow(values);
            });

            // Autoajustar columnas
            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: false }, cell => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                column.width = maxLength < 10 ? 10 : maxLength > 50 ? 50 : maxLength;
            });
        } else {
            worksheet.addRow(['No hay datos disponibles para los filtros seleccionados']);
        }

        // Configurar respuesta
        const fileName = `reporte_${tipo_reporte}_${moment().format('YYYYMMDD_HHmm')}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exportando a Excel:', error);
        res.status(500).json({
            success: false,
            message: 'Error generando archivo Excel'
        });
    }
});

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================

async function obtenerDatosUtilizacion(filtros) {
    const { 
        proyecto_id, fase_id, tipo_recurso_id, fecha_inicio, fecha_fin,
        categoria_recurso, estado_proyecto 
    } = filtros;

    let query = `SELECT * FROM vista_utilizacion_recursos WHERE 1=1`;
    const params = [];

    if (proyecto_id) {
        query += ` AND id_proyecto = ?`;
        params.push(proyecto_id);
    }
    if (fase_id) {
        query += ` AND id_fase = ?`;
        params.push(fase_id);
    }
    if (tipo_recurso_id) {
        query += ` AND id_tipo_recurso = ?`;
        params.push(tipo_recurso_id);
    }
    if (categoria_recurso) {
        query += ` AND recurso_categoria = ?`;
        params.push(categoria_recurso);
    }
    if (estado_proyecto) {
        query += ` AND proyecto_estado = ?`;
        params.push(estado_proyecto);
    }
    if (fecha_inicio) {
        query += ` AND fecha_inicio_uso >= ?`;
        params.push(fecha_inicio);
    }
    if (fecha_fin) {
        query += ` AND fecha_fin_uso <= ?`;
        params.push(fecha_fin);
    }

    query += ` ORDER BY proyecto_nombre, fase_nombre, tipo_recurso_nombre`;

    const [rows] = await pool.execute(query, params);
    return { reportes: rows };
}

async function obtenerDatosResumen(filtros) {
    const { proyecto_id, estado_proyecto } = filtros;

    let query = `SELECT * FROM vista_resumen_recursos_proyecto WHERE 1=1`;
    const params = [];

    if (proyecto_id) {
        query += ` AND id_proyecto = ?`;
        params.push(proyecto_id);
    }
    if (estado_proyecto) {
        query += ` AND proyecto_estado = ?`;
        params.push(estado_proyecto);
    }

    query += ` ORDER BY proyecto_nombre`;

    const [rows] = await pool.execute(query, params);
    return { resumen_proyectos: rows };
}

async function obtenerDatosTendencias(filtros) {
    const { proyecto_id, tipo_recurso_id, fecha_inicio, fecha_fin } = filtros;

    let query = `SELECT * FROM vista_tendencias_consumo WHERE 1=1`;
    const params = [];

    if (proyecto_id) {
        query += ` AND id_proyecto = ?`;
        params.push(proyecto_id);
    }
    if (tipo_recurso_id) {
        query += ` AND id_tipo_recurso = ?`;
        params.push(tipo_recurso_id);
    }
    if (fecha_inicio) {
        query += ` AND fecha_consumo >= ?`;
        params.push(fecha_inicio);
    }
    if (fecha_fin) {
        query += ` AND fecha_consumo <= ?`;
        params.push(fecha_fin);
    }

    query += ` ORDER BY proyecto_nombre, tipo_recurso_nombre, fecha_consumo`;

    const [rows] = await pool.execute(query, params);
    return { tendencias: rows };
}

function generarHTMLReporte(titulo, datos, filtros) {
    const fechaGeneracion = moment().format('DD/MM/YYYY HH:mm');
    
    // Generar filtros aplicados
    const filtrosTexto = Object.entries(filtros)
        .filter(([key, value]) => value && key !== 'tipo_reporte')
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ') || 'Ningún filtro aplicado';

    let tablaHTML = '';
    if (datos && datos.length > 0) {
        const headers = Object.keys(datos[0]);
        
        // Encabezados de tabla
        tablaHTML = `
            <table class="tabla-datos">
                <thead>
                    <tr>
                        ${headers.map(header => `<th>${header.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${datos.map(row => `
                        <tr>
                            ${headers.map(header => {
                                let valor = row[header];
                                // Formatear números y fechas
                                if (typeof valor === 'number') {
                                    valor = valor.toLocaleString('es-ES', { maximumFractionDigits: 2 });
                                } else if (valor && typeof valor === 'string' && valor.includes('-') && valor.length === 10) {
                                    valor = moment(valor).format('DD/MM/YYYY');
                                }
                                return `<td>${valor || '-'}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } else {
        tablaHTML = '<p class="sin-datos">No hay datos disponibles para los filtros seleccionados.</p>';
    }

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${titulo}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                    line-height: 1.6;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #2c3e50;
                    padding-bottom: 20px;
                }
                
                .header h1 {
                    color: #2c3e50;
                    margin: 0 0 10px 0;
                    font-size: 24px;
                }
                
                .header .empresa {
                    color: #7f8c8d;
                    font-size: 16px;
                    margin-bottom: 10px;
                }
                
                .header .fecha {
                    color: #34495e;
                    font-size: 14px;
                }
                
                .filtros {
                    background-color: #ecf0f1;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }
                
                .filtros h3 {
                    margin: 0 0 10px 0;
                    color: #2c3e50;
                    font-size: 16px;
                }
                
                .filtros p {
                    margin: 0;
                    font-size: 14px;
                    color: #7f8c8d;
                }
                
                .tabla-datos {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    font-size: 12px;
                }
                
                .tabla-datos th {
                    background-color: #3498db;
                    color: white;
                    padding: 10px 8px;
                    text-align: left;
                    border: 1px solid #2980b9;
                    font-weight: bold;
                }
                
                .tabla-datos td {
                    padding: 8px;
                    border: 1px solid #bdc3c7;
                    text-align: left;
                }
                
                .tabla-datos tbody tr:nth-child(even) {
                    background-color: #f8f9fa;
                }
                
                .tabla-datos tbody tr:hover {
                    background-color: #e8f4f8;
                }
                
                .sin-datos {
                    text-align: center;
                    color: #7f8c8d;
                    font-style: italic;
                    margin: 40px 0;
                    font-size: 16px;
                }
                
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #bdc3c7;
                    text-align: center;
                    font-size: 12px;
                    color: #7f8c8d;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="empresa">AgroTechNova - Sistema de Gestión Agroindustrial</div>
                <h1>${titulo}</h1>
                <div class="fecha">Generado el: ${fechaGeneracion}</div>
            </div>
            
            <div class="filtros">
                <h3>Filtros Aplicados:</h3>
                <p>${filtrosTexto}</p>
            </div>
            
            ${tablaHTML}
            
            <div class="footer">
                <p>Reporte generado automáticamente por AgroTechNova © 2025</p>
            </div>
        </body>
        </html>
    `;
}

module.exports = router;