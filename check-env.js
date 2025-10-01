const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { testConnection } = require('./backend/config/database');

async function checkEnvironment() {
    console.log('🔧 Verificando configuración del entorno AgroTechNova...\n');
    
    // Verificar variables de entorno
    console.log('📋 Variables de entorno:');
    console.log(`   PORT: ${process.env.PORT || 'No definido'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'No definido'}`);
    console.log(`   DB_HOST: ${process.env.DB_HOST || 'No definido'}`);
    console.log(`   DB_NAME: ${process.env.DB_NAME || 'No definido'}`);
    console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Configurado' : '❌ No definido'}`);
    
    console.log('\n🗄️ Probando conexión a base de datos...');
    const dbConnected = await testConnection();
    
    console.log('\n📁 Verificando estructura de carpetas...');
    const fs = require('fs');
    const paths = [
        './frontend/public',
        './backend/routes',
        './database',
        './uploads'
    ];
    
    paths.forEach(path => {
        if (fs.existsSync(path)) {
            console.log(`   ✅ ${path}`);
        } else {
            console.log(`   ❌ ${path} - No existe`);
        }
    });
    
    console.log('\n🚀 Estado del entorno:');
    if (dbConnected && process.env.JWT_SECRET) {
        console.log('   ✅ Entorno configurado correctamente');
        console.log('   🎯 Listo para ejecutar: npm start');
    } else {
        console.log('   ⚠️ Revisar configuración antes de continuar');
        if (!dbConnected) {
            console.log('   - Configurar base de datos MySQL');
        }
        if (!process.env.JWT_SECRET) {
            console.log('   - Verificar archivo .env');
        }
    }
}

checkEnvironment().catch(console.error);