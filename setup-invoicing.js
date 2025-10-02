const fs = require('fs');
const path = require('path');
const { executeQuery } = require('./backend/config/database');

async function setupInvoicingSystem() {
    try {
        console.log('📄 Configurando sistema de facturación RF07...');
        
        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'database', 'invoicing_schema.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        // Dividir por declaraciones (usando delimitador personalizado para procedimientos)
        const statements = sqlContent
            .split(/(?:^|\n)(?=(?:CREATE|INSERT|UPDATE|ALTER|DROP|DELIMITER))/gm)
            .filter(stmt => stmt.trim().length > 0)
            .map(stmt => stmt.trim());
        
        console.log(`📋 Ejecutando ${statements.length} declaraciones SQL...`);
        
        // Ejecutar cada declaración
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            // Saltar declaraciones DELIMITER y comentarios
            if (statement.startsWith('--') || 
                statement.startsWith('DELIMITER') || 
                statement.trim() === '') {
                continue;
            }
            
            try {
                // Manejar procedimientos almacenados y funciones (contienen múltiples ;)
                if (statement.includes('CREATE OR REPLACE FUNCTION') || 
                    statement.includes('CREATE OR REPLACE PROCEDURE') ||
                    statement.includes('CREATE OR REPLACE TRIGGER')) {
                    
                    // Para procedimientos, encontrar el END$$ final
                    let procedureStatement = statement;
                    if (!procedureStatement.includes('END$$')) {
                        // Buscar las siguientes declaraciones hasta encontrar END$$
                        for (let j = i + 1; j < statements.length; j++) {
                            procedureStatement += '\n' + statements[j];
                            if (statements[j].includes('END$$')) {
                                i = j; // Saltar las declaraciones ya procesadas
                                break;
                            }
                        }
                    }
                    
                    // Limpiar el statement para MySQL
                    procedureStatement = procedureStatement
                        .replace(/DELIMITER \$\$/g, '')
                        .replace(/\$\$/g, ';')
                        .replace(/DELIMITER ;/g, '');
                    
                    await executeQuery(procedureStatement);
                } else {
                    // Declaración normal
                    await executeQuery(statement);
                }
                
                console.log(`✅ Declaración ${i + 1} ejecutada exitosamente`);
                
            } catch (error) {
                // Algunos errores son esperados (como "ya existe")
                if (error.message.includes('already exists') || 
                    error.message.includes('Duplicate entry') ||
                    error.message.includes('Table') && error.message.includes('already exists')) {
                    console.log(`⚠️  Declaración ${i + 1} - ${error.message} (continuando...)`);
                } else {
                    console.error(`❌ Error en declaración ${i + 1}:`, error.message);
                    console.log('Statement:', statement.substring(0, 200) + '...');
                }
            }
        }
        
        // Verificar que las tablas principales se crearon
        const tables = await executeQuery("SHOW TABLES LIKE '%factura%'");
        console.log(`\n📊 Tablas de facturación creadas: ${tables.length}`);
        tables.forEach(table => {
            console.log(`   - ${Object.values(table)[0]}`);
        });
        
        // Verificar configuración de empresa
        const [config] = await executeQuery('SELECT * FROM configuracion_empresa WHERE activa = 1');
        if (config) {
            console.log(`\n🏢 Configuración de empresa:`);
            console.log(`   - Nombre: ${config.nombre_empresa}`);
            console.log(`   - NIT: ${config.nit}`);
            console.log(`   - Prefijo: ${config.prefijo_facturacion}`);
            console.log(`   - Siguiente número: ${config.numeracion_actual}`);
        }
        
        // Verificar datos fiscales de usuarios
        const fiscalData = await executeQuery('SELECT COUNT(*) as total FROM datos_fiscales_usuarios');
        console.log(`\n👥 Datos fiscales configurados: ${fiscalData[0].total} usuarios`);
        
        console.log('\n🎉 Sistema de facturación configurado exitosamente');
        console.log('📄 RF07 - Impresión de cuentas y datos del usuario: LISTO');
        
    } catch (error) {
        console.error('❌ Error al configurar sistema de facturación:', error);
        throw error;
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    setupInvoicingSystem()
        .then(() => {
            console.log('\n✨ Configuración completada');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { setupInvoicingSystem };