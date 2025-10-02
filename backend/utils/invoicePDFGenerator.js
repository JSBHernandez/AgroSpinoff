const puppeteer = require('puppeteer');
const { executeQuery } = require('../config/database');

/**
 * Generador de facturas en PDF - RF07
 * Genera facturas profesionales con datos fiscales completos
 */
class InvoicePDFGenerator {
    
    /**
     * Generar PDF de factura
     * @param {number} facturaId - ID de la factura
     * @param {object} options - Opciones de generación
     * @returns {Buffer} - Buffer del PDF generado
     */
    async generateInvoicePDF(facturaId, options = {}) {
        try {
            // Obtener datos completos de la factura
            const facturaData = await this.getInvoiceData(facturaId);
            
            if (!facturaData) {
                throw new Error('Factura no encontrada');
            }
            
            // Generar HTML de la factura
            const htmlContent = this.generateInvoiceHTML(facturaData);
            
            // Configurar Puppeteer
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            
            // Configurar viewport y contenido
            await page.setViewport({ width: 1200, height: 1600 });
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            
            // Generar PDF
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    right: '15mm',
                    bottom: '20mm',
                    left: '15mm'
                },
                ...options
            });
            
            await browser.close();
            
            return pdfBuffer;
            
        } catch (error) {
            console.error('Error generando PDF de factura:', error);
            throw error;
        }
    }
    
    /**
     * Obtener datos completos de la factura
     */
    async getInvoiceData(facturaId) {
        try {
            // Obtener factura principal
            const [factura] = await executeQuery(`
                SELECT f.*, 
                       (SELECT COUNT(*) FROM detalles_factura WHERE factura_id = f.id) as total_items
                FROM facturas f
                WHERE f.id = ?
            `, [facturaId]);
            
            if (!factura) {
                return null;
            }
            
            // Obtener detalles
            const detalles = await executeQuery(`
                SELECT * FROM detalles_factura
                WHERE factura_id = ?
                ORDER BY orden_item ASC, id ASC
            `, [facturaId]);
            
            // Obtener configuración de empresa
            const [empresa] = await executeQuery(`
                SELECT * FROM configuracion_empresa WHERE activa = 1
            `);
            
            return {
                factura,
                detalles,
                empresa: empresa || {}
            };
            
        } catch (error) {
            console.error('Error obteniendo datos de factura:', error);
            throw error;
        }
    }
    
    /**
     * Generar HTML de la factura
     */
    generateInvoiceHTML(data) {
        const { factura, detalles, empresa } = data;
        
        return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Factura ${factura.numero_factura}</title>
            <style>
                ${this.getInvoiceCSS()}
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <!-- Header con información de la empresa -->
                <div class="invoice-header">
                    <div class="company-info">
                        <div class="company-logo">
                            ${empresa.logo_url ? 
                                `<img src="${empresa.logo_url}" alt="Logo ${empresa.nombre_empresa}">` :
                                `<div class="logo-placeholder">${empresa.nombre_empresa ? empresa.nombre_empresa.charAt(0) : 'A'}</div>`
                            }
                        </div>
                        <div class="company-details">
                            <h1>${empresa.nombre_empresa || 'AgroTechNova S.A.S.'}</h1>
                            <p><strong>NIT:</strong> ${empresa.nit || '900123456-7'}</p>
                            <p>${empresa.direccion || 'Dirección no configurada'}</p>
                            <p><strong>Teléfono:</strong> ${empresa.telefono || 'N/A'}</p>
                            <p><strong>Email:</strong> ${empresa.email || 'N/A'}</p>
                            ${empresa.resolucion_dian ? `<p class="resolution"><strong>Resolución DIAN:</strong> ${empresa.resolucion_dian}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="invoice-info">
                        <div class="invoice-number">
                            <h2>FACTURA DE VENTA</h2>
                            <div class="number">${factura.numero_factura}</div>
                        </div>
                        <div class="invoice-dates">
                            <p><strong>Fecha:</strong> ${this.formatDate(factura.fecha_factura)}</p>
                            ${factura.fecha_vencimiento ? 
                                `<p><strong>Vencimiento:</strong> ${this.formatDate(factura.fecha_vencimiento)}</p>` : ''
                            }
                        </div>
                    </div>
                </div>
                
                <!-- Información del cliente -->
                <div class="client-info">
                    <h3>INFORMACIÓN DEL CLIENTE</h3>
                    <div class="client-details">
                        <div class="client-main">
                            <p><strong>Razón Social:</strong> ${factura.cliente_nombre}</p>
                            <p><strong>Documento:</strong> ${factura.cliente_tipo_documento || 'CC'} ${factura.cliente_documento || 'N/A'}</p>
                            <p><strong>Dirección:</strong> ${factura.cliente_direccion || 'N/A'}</p>
                        </div>
                        <div class="client-contact">
                            <p><strong>Ciudad:</strong> ${factura.cliente_ciudad || 'N/A'}</p>
                            <p><strong>Teléfono:</strong> ${factura.cliente_telefono || 'N/A'}</p>
                            <p><strong>Email:</strong> ${factura.cliente_email || 'N/A'}</p>
                        </div>
                    </div>
                </div>
                
                <!-- Detalles de productos/servicios -->
                <div class="invoice-details">
                    <table class="details-table">
                        <thead>
                            <tr>
                                <th class="item-code">Código</th>
                                <th class="item-description">Descripción</th>
                                <th class="item-quantity">Cant.</th>
                                <th class="item-unit">Unidad</th>
                                <th class="item-price">Precio Unit.</th>
                                <th class="item-discount">Descuento</th>
                                <th class="item-subtotal">Subtotal</th>
                                <th class="item-tax">IVA</th>
                                <th class="item-total">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detalles.map(detalle => `
                                <tr>
                                    <td class="item-code">${detalle.codigo_producto || 'N/A'}</td>
                                    <td class="item-description">
                                        ${detalle.descripcion}
                                        ${detalle.categoria ? `<br><small class="category">${detalle.categoria}</small>` : ''}
                                        ${detalle.notas_item ? `<br><small class="notes">${detalle.notas_item}</small>` : ''}
                                    </td>
                                    <td class="item-quantity">${this.formatNumber(detalle.cantidad)}</td>
                                    <td class="item-unit">${detalle.unidad_medida || 'und'}</td>
                                    <td class="item-price">$${this.formatCurrency(detalle.precio_unitario)}</td>
                                    <td class="item-discount">$${this.formatCurrency(detalle.descuento_item)}</td>
                                    <td class="item-subtotal">$${this.formatCurrency(detalle.subtotal_item)}</td>
                                    <td class="item-tax">
                                        ${detalle.aplica_iva ? 
                                            `${detalle.porcentaje_iva}%<br>$${this.formatCurrency(detalle.valor_iva_item)}` : 
                                            'Exento'
                                        }
                                    </td>
                                    <td class="item-total">$${this.formatCurrency(detalle.total_item)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <!-- Totales -->
                <div class="invoice-totals">
                    <div class="totals-section">
                        <div class="totals-row">
                            <span class="label">Subtotal:</span>
                            <span class="value">$${this.formatCurrency(factura.subtotal)}</span>
                        </div>
                        ${factura.descuento > 0 ? `
                            <div class="totals-row">
                                <span class="label">Descuento:</span>
                                <span class="value">-$${this.formatCurrency(factura.descuento)}</span>
                            </div>
                        ` : ''}
                        <div class="totals-row">
                            <span class="label">Base Gravable:</span>
                            <span class="value">$${this.formatCurrency(factura.base_gravable)}</span>
                        </div>
                        <div class="totals-row">
                            <span class="label">IVA (${empresa.iva_porcentaje || 19}%):</span>
                            <span class="value">$${this.formatCurrency(factura.valor_iva)}</span>
                        </div>
                        <div class="totals-row total-row">
                            <span class="label">TOTAL A PAGAR:</span>
                            <span class="value">$${this.formatCurrency(factura.total)}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Información adicional -->
                <div class="additional-info">
                    ${factura.observaciones ? `
                        <div class="observations">
                            <h4>Observaciones:</h4>
                            <p>${factura.observaciones}</p>
                        </div>
                    ` : ''}
                    
                    <div class="payment-info">
                        <p><strong>Método de Pago:</strong> ${this.getPaymentMethodLabel(factura.metodo_pago)}</p>
                        ${factura.dias_credito > 0 ? 
                            `<p><strong>Días de Crédito:</strong> ${factura.dias_credito}</p>` : ''
                        }
                    </div>
                    
                    ${factura.terminos_condiciones ? `
                        <div class="terms">
                            <h4>Términos y Condiciones:</h4>
                            <p>${factura.terminos_condiciones}</p>
                        </div>
                    ` : ''}
                </div>
                
                <!-- Footer -->
                <div class="invoice-footer">
                    <div class="footer-content">
                        <p class="generated-info">
                            Factura generada electrónicamente el ${this.formatDateTime(new Date())}
                        </p>
                        <p class="software-info">
                            Generado por AgroTechNova - Sistema de Gestión Agroindustrial
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
    }
    
    /**
     * CSS para el diseño de la factura
     */
    getInvoiceCSS() {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
                background: #fff;
            }
            
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background: #fff;
                padding: 20px;
            }
            
            /* Header */
            .invoice-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #4a90e2;
            }
            
            .company-info {
                display: flex;
                align-items: flex-start;
                gap: 15px;
                flex: 1;
            }
            
            .company-logo img {
                max-width: 80px;
                max-height: 80px;
            }
            
            .logo-placeholder {
                width: 60px;
                height: 60px;
                background: #4a90e2;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                font-weight: bold;
                border-radius: 8px;
            }
            
            .company-details h1 {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 8px;
            }
            
            .company-details p {
                margin-bottom: 4px;
                font-size: 11px;
            }
            
            .resolution {
                font-size: 10px !important;
                color: #666;
                margin-top: 8px;
            }
            
            .invoice-info {
                text-align: right;
                min-width: 200px;
            }
            
            .invoice-number h2 {
                font-size: 16px;
                color: #2c3e50;
                margin-bottom: 8px;
            }
            
            .invoice-number .number {
                font-size: 24px;
                font-weight: bold;
                color: #4a90e2;
                margin-bottom: 10px;
            }
            
            .invoice-dates p {
                margin-bottom: 4px;
                font-size: 11px;
            }
            
            /* Cliente */
            .client-info {
                margin-bottom: 25px;
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
            }
            
            .client-info h3 {
                font-size: 14px;
                color: #2c3e50;
                margin-bottom: 12px;
                border-bottom: 1px solid #dee2e6;
                padding-bottom: 5px;
            }
            
            .client-details {
                display: flex;
                gap: 30px;
            }
            
            .client-main, .client-contact {
                flex: 1;
            }
            
            .client-details p {
                margin-bottom: 6px;
                font-size: 11px;
            }
            
            /* Tabla de detalles */
            .invoice-details {
                margin-bottom: 25px;
            }
            
            .details-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            
            .details-table th {
                background: #4a90e2;
                color: white;
                padding: 10px 6px;
                text-align: center;
                font-size: 10px;
                font-weight: bold;
                text-transform: uppercase;
            }
            
            .details-table td {
                padding: 8px 6px;
                border-bottom: 1px solid #dee2e6;
                font-size: 10px;
                vertical-align: top;
            }
            
            .details-table tbody tr:nth-child(even) {
                background: #f8f9fa;
            }
            
            .item-code { width: 10%; text-align: center; }
            .item-description { width: 30%; }
            .item-quantity { width: 8%; text-align: center; }
            .item-unit { width: 8%; text-align: center; }
            .item-price { width: 12%; text-align: right; }
            .item-discount { width: 10%; text-align: right; }
            .item-subtotal { width: 12%; text-align: right; }
            .item-tax { width: 10%; text-align: center; }
            .item-total { width: 12%; text-align: right; font-weight: bold; }
            
            .category {
                color: #666;
                font-style: italic;
            }
            
            .notes {
                color: #888;
            }
            
            /* Totales */
            .invoice-totals {
                margin-bottom: 25px;
                display: flex;
                justify-content: flex-end;
            }
            
            .totals-section {
                min-width: 300px;
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #dee2e6;
            }
            
            .totals-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 4px 0;
            }
            
            .totals-row.total-row {
                border-top: 2px solid #4a90e2;
                margin-top: 10px;
                padding-top: 10px;
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
            }
            
            .totals-row .label {
                font-weight: 500;
            }
            
            .totals-row .value {
                font-weight: bold;
                color: #2c3e50;
            }
            
            /* Información adicional */
            .additional-info {
                margin-bottom: 25px;
            }
            
            .observations, .payment-info, .terms {
                margin-bottom: 15px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 5px;
            }
            
            .additional-info h4 {
                font-size: 12px;
                color: #2c3e50;
                margin-bottom: 6px;
            }
            
            .additional-info p {
                font-size: 11px;
                margin-bottom: 4px;
            }
            
            /* Footer */
            .invoice-footer {
                border-top: 1px solid #dee2e6;
                padding-top: 15px;
                text-align: center;
            }
            
            .footer-content p {
                margin-bottom: 4px;
                font-size: 10px;
                color: #666;
            }
            
            .generated-info {
                font-style: italic;
            }
            
            .software-info {
                font-weight: 500;
                color: #4a90e2;
            }
            
            /* Print styles */
            @media print {
                body {
                    margin: 0;
                    padding: 0;
                }
                
                .invoice-container {
                    padding: 10px;
                    max-width: none;
                }
                
                .invoice-header {
                    page-break-inside: avoid;
                }
                
                .details-table {
                    page-break-inside: auto;
                }
                
                .details-table tr {
                    page-break-inside: avoid;
                    page-break-after: auto;
                }
                
                .invoice-totals {
                    page-break-inside: avoid;
                }
            }
        `;
    }
    
    /**
     * Utilidades de formateo
     */
    formatDate(date) {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    formatDateTime(date) {
        return new Date(date).toLocaleString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    formatCurrency(amount) {
        if (!amount && amount !== 0) return '0';
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Math.round(amount));
    }
    
    formatNumber(number) {
        if (!number && number !== 0) return '0';
        return new Intl.NumberFormat('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        }).format(number);
    }
    
    getPaymentMethodLabel(method) {
        const methods = {
            'efectivo': 'Efectivo',
            'transferencia': 'Transferencia Bancaria',
            'cheque': 'Cheque',
            'tarjeta': 'Tarjeta',
            'credito': 'Crédito'
        };
        return methods[method] || method || 'No especificado';
    }
}

module.exports = { InvoicePDFGenerator };