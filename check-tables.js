const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkResourceTables() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    console.log('Verificando tablas de recursos...');
    
    const [tables] = await connection.execute("SHOW TABLES LIKE '%recurso%'");
    console.log('Tablas relacionadas con recursos:');
    tables.forEach(table => console.log(' -', Object.values(table)[0]));
    
    // También verificar todas las tablas que podrían tener recursos
    const [allTables] = await connection.execute("SHOW TABLES");
    console.log('\nTodas las tablas:');
    allTables.forEach(table => console.log(' -', Object.values(table)[0]));
    
    await connection.end();
}

checkResourceTables();