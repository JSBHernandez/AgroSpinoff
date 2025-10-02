const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function createViews() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    console.log('📊 Creando vistas para sistema de reportes...');
    
    const sql = fs.readFileSync('./database/views_reportes.sql', 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
        try {
            await connection.execute(statements[i]);
            console.log(`✅ Vista ${i + 1} creada exitosamente`);
        } catch (error) {
            console.log(`⚠️ Error en vista ${i + 1}: ${error.message}`);
        }
    }
    
    console.log('🎉 Vistas de reportes configuradas');
    await connection.end();
}

createViews();