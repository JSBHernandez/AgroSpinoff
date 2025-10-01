const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
    console.log('🗄️ Configurando base de datos AgroTechNova...\n');
    
    try {
        // Conectar a MySQL
        const connection = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'agrotech_nova',
            multipleStatements: true
        });
        
        console.log('✅ Conectado a MySQL');
        
        // Leer y ejecutar schema.sql
        console.log('📋 Ejecutando schema.sql...');
        const schemaSQL = fs.readFileSync(path.join(__dirname, 'database/schema.sql'), 'utf8');
        
        // Dividir por declaraciones
        const statements = schemaSQL.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                try {
                    await connection.execute(statement);
                    if (statement.toUpperCase().includes('CREATE TABLE')) {
                        const tableName = statement.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?/i);
                        if (tableName) {
                            console.log(`   ✅ Tabla ${tableName[1]} creada`);
                        }
                    }
                } catch (error) {
                    // Ignorar errores de "tabla ya existe"
                    if (!error.message.includes('already exists')) {
                        console.log(`   ⚠️ Error en declaración ${i + 1}:`, error.message);
                    }
                }
            }
        }
        
        console.log('\n📊 Ejecutando seeds.sql...');
        const seedsSQL = fs.readFileSync(path.join(__dirname, 'database/seeds.sql'), 'utf8');
        const seedStatements = seedsSQL.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (let i = 0; i < seedStatements.length; i++) {
            const statement = seedStatements[i].trim();
            if (statement) {
                try {
                    await connection.execute(statement);
                } catch (error) {
                    // Ignorar errores de duplicados
                    if (!error.message.includes('Duplicate entry')) {
                        console.log(`   ⚠️ Error en seed ${i + 1}:`, error.message);
                    }
                }
            }
        }
        
        // Verificar tablas creadas
        console.log('\n🔍 Verificando tablas creadas...');
        const [tables] = await connection.execute('SHOW TABLES');
        console.log(`✅ Total de tablas: ${tables.length}`);
        
        tables.forEach((table, index) => {
            console.log(`   ${index + 1}. ${Object.values(table)[0]}`);
        });
        
        // Verificar datos iniciales
        console.log('\n👥 Verificando usuarios...');
        const [users] = await connection.execute('SELECT COUNT(*) as total FROM usuarios');
        console.log(`✅ Usuarios registrados: ${users[0].total}`);
        
        await connection.end();
        console.log('\n🎉 ¡Base de datos configurada exitosamente!');
        console.log('🚀 Ahora puedes ejecutar: npm start');
        
    } catch (error) {
        console.error('❌ Error configurando base de datos:', error.message);
    }
}

setupDatabase();