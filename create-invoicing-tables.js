const { executeQuery } = require('./backend/config/database');

async function createInvoicingTables() {
    try {
        console.log('📄 Creando tablas de facturación...');
        
        // 1. Tabla configuracion_empresa
        console.log('1. Creando tabla configuracion_empresa...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS configuracion_empresa (
                id INT PRIMARY KEY AUTO_INCREMENT,
                nombre_empresa VARCHAR(255) NOT NULL,
                nit VARCHAR(50) NOT NULL,
                direccion TEXT,
                telefono VARCHAR(50),
                email VARCHAR(100),
                sitio_web VARCHAR(100),
                logo_url VARCHAR(255),
                regimen_fiscal VARCHAR(100),
                actividad_economica TEXT,
                resolucion_dian VARCHAR(255),
                prefijo_facturacion VARCHAR(10) DEFAULT 'FAC',
                numeracion_desde INT DEFAULT 1,
                numeracion_hasta INT DEFAULT 99999,
                numeracion_actual INT DEFAULT 1,
                iva_porcentaje DECIMAL(5,2) DEFAULT 19.00,
                activa BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabla configuracion_empresa creada');
        
        // 2. Insertar configuración de empresa
        console.log('2. Insertando configuración de empresa...');
        await executeQuery(`
            INSERT IGNORE INTO configuracion_empresa (
                nombre_empresa, nit, direccion, telefono, email,
                regimen_fiscal, actividad_economica, resolucion_dian
            ) VALUES (
                'AgroTechNova S.A.S.',
                '900123456-7',
                'Calle 123 #45-67, Bogotá, Colombia',
                '+57 1 234 5678',
                'facturacion@agrotechnova.com',
                'Régimen Ordinario',
                'Desarrollo de software agroindustrial y consultoría técnica',
                'Resolución DIAN No. 18764003123456 del 2024'
            )
        `);
        console.log('✅ Configuración de empresa insertada');
        
        // 3. Tabla facturas
        console.log('3. Creando tabla facturas...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS facturas (
                id INT PRIMARY KEY AUTO_INCREMENT,
                numero_factura VARCHAR(50) UNIQUE NOT NULL,
                prefijo VARCHAR(10) NOT NULL,
                consecutivo INT NOT NULL,
                
                cliente_id INT NULL,
                tipo_cliente ENUM('cliente', 'proveedor') NOT NULL,
                
                cliente_nombre VARCHAR(255) NOT NULL,
                cliente_documento VARCHAR(50),
                cliente_tipo_documento ENUM('CC', 'NIT', 'CE', 'PP') DEFAULT 'CC',
                cliente_direccion TEXT,
                cliente_telefono VARCHAR(50),
                cliente_email VARCHAR(100),
                cliente_ciudad VARCHAR(100),
                
                fecha_factura DATE NOT NULL,
                fecha_vencimiento DATE,
                
                subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                descuento DECIMAL(15,2) DEFAULT 0.00,
                base_gravable DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                valor_iva DECIMAL(15,2) DEFAULT 0.00,
                total DECIMAL(15,2) NOT NULL DEFAULT 0.00,
                
                estado ENUM('borrador', 'enviada', 'pagada', 'vencida', 'anulada') DEFAULT 'borrador',
                observaciones TEXT,
                terminos_condiciones TEXT,
                metodo_pago ENUM('efectivo', 'transferencia', 'cheque', 'tarjeta', 'credito') DEFAULT 'efectivo',
                dias_credito INT DEFAULT 0,
                
                creado_por_id INT NULL,
                creado_por_nombre VARCHAR(255),
                proyecto_id INT NULL,
                proyecto_nombre VARCHAR(255),
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_numero_factura (numero_factura),
                INDEX idx_cliente (cliente_id),
                INDEX idx_fecha (fecha_factura),
                INDEX idx_estado (estado)
            )
        `);
        console.log('✅ Tabla facturas creada');
        
        // 4. Tabla detalles_factura
        console.log('4. Creando tabla detalles_factura...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS detalles_factura (
                id INT PRIMARY KEY AUTO_INCREMENT,
                factura_id INT NOT NULL,
                
                producto_id INT NULL,
                codigo_producto VARCHAR(100),
                descripcion TEXT NOT NULL,
                categoria VARCHAR(100),
                
                cantidad DECIMAL(10,3) NOT NULL,
                unidad_medida VARCHAR(50) DEFAULT 'unidad',
                precio_unitario DECIMAL(15,2) NOT NULL,
                descuento_item DECIMAL(15,2) DEFAULT 0.00,
                subtotal_item DECIMAL(15,2) NOT NULL,
                
                aplica_iva BOOLEAN DEFAULT TRUE,
                porcentaje_iva DECIMAL(5,2) DEFAULT 19.00,
                valor_iva_item DECIMAL(15,2) DEFAULT 0.00,
                total_item DECIMAL(15,2) NOT NULL,
                
                orden_item INT DEFAULT 1,
                notas_item TEXT,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
                
                INDEX idx_factura (factura_id),
                INDEX idx_producto (producto_id)
            )
        `);
        console.log('✅ Tabla detalles_factura creada');
        
        // 5. Tabla datos_fiscales_usuarios
        console.log('5. Creando tabla datos_fiscales_usuarios...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS datos_fiscales_usuarios (
                id INT PRIMARY KEY AUTO_INCREMENT,
                usuario_id INT NULL,
                
                razon_social VARCHAR(255),
                nombre_comercial VARCHAR(255),
                tipo_documento ENUM('CC', 'NIT', 'CE', 'PP') DEFAULT 'CC',
                numero_documento VARCHAR(50) NOT NULL,
                digito_verificacion CHAR(1),
                
                direccion_fiscal TEXT,
                ciudad VARCHAR(100),
                departamento VARCHAR(100),
                codigo_postal VARCHAR(10),
                pais VARCHAR(100) DEFAULT 'Colombia',
                
                telefono_fiscal VARCHAR(50),
                email_facturacion VARCHAR(100),
                
                regimen_fiscal ENUM('simplificado', 'ordinario', 'gran_contribuyente') DEFAULT 'simplificado',
                responsabilidad_fiscal SET('iva', 'ica', 'renta', 'no_responsable') DEFAULT 'no_responsable',
                actividad_economica VARCHAR(255),
                codigo_ciiu VARCHAR(10),
                
                activo BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                UNIQUE KEY idx_documento (numero_documento),
                INDEX idx_usuario (usuario_id)
            )
        `);
        console.log('✅ Tabla datos_fiscales_usuarios creada');
        
        // 6. Insertar datos fiscales de ejemplo
        console.log('6. Insertando datos fiscales de ejemplo...');
        await executeQuery(`
            INSERT IGNORE INTO datos_fiscales_usuarios (
                razon_social, numero_documento, tipo_documento, direccion_fiscal, 
                ciudad, telefono_fiscal, email_facturacion, regimen_fiscal
            ) VALUES 
            ('Cliente de Prueba S.A.S.', '900123456-7', 'NIT', 'Calle 123 #45-67', 'Bogotá', '+57 300 123 4567', 'cliente@ejemplo.com', 'ordinario'),
            ('Proveedor Agrícola Ltda.', '890987654-3', 'NIT', 'Carrera 45 #78-90', 'Medellín', '+57 301 987 6543', 'proveedor@agricola.com', 'ordinario'),
            ('Juan Pérez', '12345678', 'CC', 'Calle 56 #34-12', 'Cali', '+57 302 456 7890', 'juan.perez@email.com', 'simplificado')
        `);
        console.log('✅ Datos fiscales de ejemplo insertados');
        
        // 7. Tabla historial_facturas
        console.log('7. Creando tabla historial_facturas...');
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS historial_facturas (
                id INT PRIMARY KEY AUTO_INCREMENT,
                factura_id INT NOT NULL,
                accion ENUM('creada', 'modificada', 'enviada', 'impresa', 'anulada', 'pagada') NOT NULL,
                usuario_id INT NULL,
                usuario_nombre VARCHAR(255),
                detalles TEXT,
                ip_address VARCHAR(45),
                user_agent TEXT,
                fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (factura_id) REFERENCES facturas(id) ON DELETE CASCADE,
                INDEX idx_factura_historial (factura_id),
                INDEX idx_fecha_historial (fecha_accion)
            )
        `);
        console.log('✅ Tabla historial_facturas creada');
        
        // 8. Factura de ejemplo
        console.log('8. Insertando factura de ejemplo...');
        await executeQuery(`
            INSERT IGNORE INTO facturas (
                numero_factura, prefijo, consecutivo, cliente_id, tipo_cliente,
                cliente_nombre, cliente_documento, cliente_direccion, cliente_telefono, cliente_email,
                fecha_factura, subtotal, base_gravable, valor_iva, total, 
                creado_por_nombre, estado
            ) VALUES (
                'FAC000001', 'FAC', 1, 1, 'cliente',
                'Cliente de Prueba S.A.S.', '900123456-7', 'Calle 123 #45-67', '+57 300 123 4567', 'cliente@ejemplo.com',
                CURDATE(), 1000000.00, 1000000.00, 190000.00, 1190000.00, 
                'Administrador', 'borrador'
            )
        `);
        console.log('✅ Factura de ejemplo insertada');
        
        // 9. Detalles de factura de ejemplo
        console.log('9. Insertando detalles de factura de ejemplo...');
        await executeQuery(`
            INSERT IGNORE INTO detalles_factura (
                factura_id, codigo_producto, descripcion, cantidad, unidad_medida,
                precio_unitario, subtotal_item, valor_iva_item, total_item
            ) VALUES 
            (1, 'FERT001', 'Fertilizante NPK 20-20-20 x 50kg', 10.000, 'saco', 50000.00, 500000.00, 95000.00, 595000.00),
            (1, 'SEM001', 'Semilla de Maíz Híbrido x 20kg', 5.000, 'saco', 80000.00, 400000.00, 76000.00, 476000.00),
            (1, 'HERB001', 'Herbicida Glifosato x 1L', 20.000, 'litro', 5000.00, 100000.00, 19000.00, 119000.00)
        `);
        console.log('✅ Detalles de factura de ejemplo insertados');
        
        // Verificación final
        console.log('\n📊 Verificando tablas creadas...');
        const tables = await executeQuery("SHOW TABLES LIKE '%factura%'");
        console.log(`Tablas de facturación: ${tables.length}`);
        tables.forEach(table => {
            console.log(`   - ${Object.values(table)[0]}`);
        });
        
        const config = await executeQuery('SELECT * FROM configuracion_empresa WHERE activa = 1');
        if (config.length > 0) {
            console.log(`\n🏢 Configuración: ${config[0].nombre_empresa} - ${config[0].nit}`);
        }
        
        console.log('\n🎉 ¡Sistema de facturación configurado exitosamente!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Ejecutar
createInvoicingTables()
    .then(() => {
        console.log('\n✨ Configuración completada');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Error fatal:', error);
        process.exit(1);
    });