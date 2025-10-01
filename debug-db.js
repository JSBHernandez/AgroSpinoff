require('dotenv').config();

console.log('🔍 Debug de variables de entorno:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' + process.env.DB_PASSWORD.slice(-2) : 'VACÍO');
console.log('DB_NAME:', process.env.DB_NAME);

// Intentar conexión manual
const mysql = require('mysql2/promise');

async function testDirectConnection() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        
        console.log('✅ Conexión directa exitosa!');
        await connection.end();
        return true;
    } catch (error) {
        console.log('❌ Error en conexión directa:', error.message);
        return false;
    }
}

testDirectConnection();