const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function setupProductsSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    console.log('📦 Configurando esquema de productos RF06...');
    
    const sql = fs.readFileSync('./database/products_schema.sql', 'utf8');
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
        try {
            await connection.execute(statements[i]);
            console.log(`✅ Declaración ${i + 1} ejecutada exitosamente`);
        } catch (error) {
            console.log(`⚠️ Error en declaración ${i + 1}: ${error.message}`);
        }
    }
    
    console.log('🎉 Esquema de productos configurado exitosamente');
    await connection.end();
}

setupProductsSchema();