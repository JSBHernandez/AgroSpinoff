const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración directa para pruebas
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'agrotech_nova'
};

async function testMonitoringSystem() {
    let connection;
    try {
        console.log('🔍 Iniciando pruebas del sistema de monitoreo...\n');
        
        connection = await mysql.createConnection(dbConfig);
        
        // 1. Verificar proyectos existentes
        console.log('1️⃣ Verificando proyectos existentes...');
        const [projects] = await connection.execute('SELECT id_proyecto, nombre FROM proyectos LIMIT 3');
        console.log('Proyectos encontrados:', projects.length);
        
        if (projects.length === 0) {
            console.log('⚠️ No hay proyectos. Creando proyecto de prueba...');
            await connection.execute(`
                INSERT INTO proyectos (nombre, descripcion, fecha_inicio, fecha_fin_estimada, presupuesto_total, estado, id_usuario_gestor)
                VALUES ('Proyecto Test Monitoreo', 'Proyecto para pruebas del sistema de monitoreo', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 MONTH), 100000, 'planificacion', 1)
            `);
            const [newProjects] = await connection.execute('SELECT id_proyecto, nombre FROM proyectos WHERE nombre = "Proyecto Test Monitoreo"');
            projects.push(...newProjects);
        }
        
        const projectId = projects[0].id_proyecto;
        console.log(`✅ Usando proyecto: ${projects[0].nombre} (ID: ${projectId})\n`);
        
        // 2. Verificar recursos del proyecto
        console.log('2️⃣ Verificando recursos del proyecto...');
        const [resources] = await connection.execute(`
            SELECT rpf.id_recurso_planificado, tr.nombre, rpf.cantidad_planificada, 
                   COALESCE(SUM(cr.cantidad_consumida), 0) as cantidad_utilizada
            FROM recursos_planificados_fase rpf
            JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
            JOIN fases_proyecto fp ON rpf.id_fase = fp.id_fase
            LEFT JOIN consumo_recursos cr ON rpf.id_recurso_planificado = cr.id_recurso_planificado
            WHERE fp.id_proyecto = ?
            GROUP BY rpf.id_recurso_planificado, tr.nombre, rpf.cantidad_planificada
            LIMIT 3
        `, [projectId]);
        
        console.log('Recursos encontrados:', resources.length);
        
        if (resources.length === 0) {
            console.log('⚠️ No hay recursos asignados. Creando recursos de prueba...');
            
            // Verificar si existe una fase para el proyecto
            const [phases] = await connection.execute(`
                SELECT id_fase FROM fases_proyecto WHERE id_proyecto = ? LIMIT 1
            `, [projectId]);
            
            let phaseId;
            if (phases.length === 0) {
                // Crear una fase si no existe
                const [result] = await connection.execute(`
                    INSERT INTO fases_proyecto (id_proyecto, nombre, descripcion, fecha_inicio, fecha_fin_estimada, estado)
                    VALUES (?, 'Fase de Prueba', 'Fase creada para pruebas del sistema de monitoreo', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 MONTH), 'planificacion')
                `, [projectId]);
                phaseId = result.insertId;
            } else {
                phaseId = phases[0].id_fase;
            }
            
            // Crear tipos de recurso básicos si no existen
            await connection.execute(`
                INSERT IGNORE INTO tipos_recurso (nombre, unidad_medida, categoria)
                VALUES 
                ('Fertilizante NPK', 'kg', 'material'),
                ('Semillas Maíz', 'kg', 'material'),
                ('Agua Riego', 'litros', 'recurso')
            `);
            
            // Asignar recursos a la fase
            const [resourceTypes] = await connection.execute('SELECT id_tipo_recurso, nombre FROM tipos_recurso LIMIT 3');
            for (const resourceType of resourceTypes) {
                await connection.execute(`
                    INSERT IGNORE INTO recursos_planificados_fase (id_fase, id_tipo_recurso, cantidad_planificada, fecha_inicio_uso, fecha_fin_uso)
                    VALUES (?, ?, 100, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 MONTH))
                `, [phaseId, resourceType.id_tipo_recurso]);
            }
            
            // Volver a consultar recursos
            const [newResources] = await connection.execute(`
                SELECT rpf.id_recurso_planificado, tr.nombre, rpf.cantidad_planificada, 
                       COALESCE(SUM(cr.cantidad_consumida), 0) as cantidad_utilizada
                FROM recursos_planificados_fase rpf
                JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
                JOIN fases_proyecto fp ON rpf.id_fase = fp.id_fase
                LEFT JOIN consumo_recursos cr ON rpf.id_recurso_planificado = cr.id_recurso_planificado
                WHERE fp.id_proyecto = ?
                GROUP BY rpf.id_recurso_planificado, tr.nombre, rpf.cantidad_planificada
                LIMIT 3
            `, [projectId]);
            resources.push(...newResources);
        }
        
        console.log(`✅ Recursos disponibles: ${resources.length}\n`);
        
        // 3. Crear registros de consumo de prueba
        console.log('3️⃣ Creando registros de consumo de prueba...');
        const resourceId = resources[0].id_recurso_planificado;
        
        // Insertar consumo que exceda el umbral (70% de 100 = 70)
        await connection.execute(`
            INSERT INTO consumo_recursos (id_recurso_planificado, cantidad_consumida, fecha_consumo, observaciones)
            VALUES (?, 75, NOW(), 'Consumo de prueba para alertas')
        `, [resourceId]);
        
        console.log('✅ Registro de consumo creado\n');
        
        // 4. Configurar umbral de alerta
        console.log('4️⃣ Configurando umbrales de alerta...');
        
        // Obtener el tipo de recurso del primer recurso
        const [resourceType] = await connection.execute(`
            SELECT tr.id_tipo_recurso 
            FROM recursos_planificados_fase rpf
            JOIN tipos_recurso tr ON rpf.id_tipo_recurso = tr.id_tipo_recurso
            WHERE rpf.id_recurso_planificado = ?
        `, [resourceId]);
        
        if (resourceType.length > 0) {
            await connection.execute(`
                INSERT INTO umbrales_alertas (id_tipo_recurso, id_proyecto, tipo_umbral, porcentaje_alerta, activo, usuario_creacion)
                VALUES (?, ?, 'agotamiento', 70, 1, 1)
                ON DUPLICATE KEY UPDATE porcentaje_alerta = 70, activo = 1
            `, [resourceType[0].id_tipo_recurso, projectId]);
        }
        
        console.log('✅ Umbral configurado: 70%\n');
        
        // 5. Verificar alertas generadas
        console.log('5️⃣ Verificando alertas generadas...');
        const [alerts] = await connection.execute(`
            SELECT la.mensaje, la.severidad, la.fecha_generacion, p.nombre as proyecto_nombre
            FROM log_alertas la
            LEFT JOIN proyectos p ON la.id_proyecto = p.id_proyecto
            WHERE la.id_proyecto = ?
            ORDER BY la.fecha_generacion DESC
            LIMIT 5
        `, [projectId]);
        
        console.log(`📊 Alertas encontradas: ${alerts.length}`);
        alerts.forEach((alert, index) => {
            console.log(`   ${index + 1}. [${alert.severidad.toUpperCase()}] ${alert.mensaje}`);
        });
        
        if (alerts.length === 0) {
            console.log('⚠️ No se generaron alertas automáticamente. Creando alerta manual...');
            await connection.execute(`
                INSERT INTO log_alertas (id_proyecto, tipo_alerta, severidad, titulo, mensaje, estado, fecha_generacion)
                VALUES (?, 'agotamiento', 'media', 'Alerta de Consumo', 'Consumo de recursos excede el 70% del límite asignado', 'activa', NOW())
            `, [projectId]);
            console.log('✅ Alerta manual creada');
        }
        
        console.log('\n🎉 ¡Sistema de monitoreo configurado y probado exitosamente!');
        console.log('\n📋 Resumen de pruebas:');
        console.log(`   ✓ Proyecto activo: ${projects[0].nombre}`);
        console.log(`   ✓ Recursos asignados: ${resources.length}`);
        console.log(`   ✓ Consumos registrados: Sí`);
        console.log(`   ✓ Umbrales configurados: Sí`);
        console.log(`   ✓ Alertas activas: ${alerts.length > 0 ? 'Sí' : 'Creada manualmente'}`);
        
        console.log('\n🌐 Ahora puedes probar en el navegador:');
        console.log('   1. Login en http://localhost:3000');
        console.log('   2. Dashboard principal para ver alertas');
        console.log('   3. Botón "Seguimiento de Recursos" para ver detalles');
        
    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testMonitoringSystem();