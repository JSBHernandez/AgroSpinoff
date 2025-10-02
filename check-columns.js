const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkColumn() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    const [info] = await connection.execute('SHOW COLUMNS FROM log_alertas WHERE Field = "tipo_alerta"');
    console.log('Info tipo_alerta:', info[0]);
    
    const [info2] = await connection.execute('SHOW COLUMNS FROM log_alertas WHERE Field = "severidad"');
    console.log('Info severidad:', info2[0]);
    
    await connection.end();
}

checkColumn();