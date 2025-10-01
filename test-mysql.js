const mysql = require('mysql2/promise');

async function testMySQL() {
    console.log('🔍 Probando conexión directa a MySQL...');
    
    try {
        // Probar conexión sin base de datos primero
        const connection = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root'
        });
        
        console.log('✅ Conexión a MySQL servidor exitosa!');
        
        // Verificar que la base de datos existe
        const [databases] = await connection.execute('SHOW DATABASES LIKE "agrotech_nova"');
        if (databases.length > 0) {
            console.log('✅ Base de datos "agrotech_nova" encontrada!');
        } else {
            console.log('❌ Base de datos "agrotech_nova" no encontrada');
        }
        
        await connection.end();
        
        // Ahora probar conexión con la base de datos
        const dbConnection = await mysql.createConnection({
            host: 'localhost',
            port: 3306,
            user: 'root',
            password: 'root',
            database: 'agrotech_nova'
        });
        
        console.log('✅ Conexión a base de datos "agrotech_nova" exitosa!');
        
        // Verificar si hay tablas
        const [tables] = await dbConnection.execute('SHOW TABLES');
        console.log(`📊 Tablas encontradas: ${tables.length}`);
        
        await dbConnection.end();
        
        return true;
        
    } catch (error) {
        console.log('❌ Error:', error.message);
        console.log('💡 Verifica que:');
        console.log('   - MySQL esté ejecutándose');
        console.log('   - Usuario "root" tenga contraseña "root"');
        console.log('   - Base de datos "agrotech_nova" exista');
        return false;
    }
}

testMySQL();