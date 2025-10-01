const fetch = require('node-fetch');

async function testAPI() {
    try {
        // 1. Login
        console.log('🔐 Probando login...');
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@uprb.edu.co',
                password: 'admin123'
            })
        });

        const loginData = await loginResponse.json();
        
        if (!loginData.success) {
            console.error('❌ Error en login:', loginData.message);
            return;
        }

        console.log('✅ Login exitoso!');
        const token = loginData.data.token;

        // 2. Probar API de proyectos
        console.log('\n📊 Probando API de proyectos...');
        const projectsResponse = await fetch('http://localhost:3000/api/projects', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const projectsData = await projectsResponse.json();
        console.log('Proyectos response:', projectsData);

        // 3. Probar API de usuarios
        console.log('\n👥 Probando API de usuarios...');
        const usersResponse = await fetch('http://localhost:3000/api/users', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const usersData = await usersResponse.json();
        console.log('Usuarios response:', usersData);

        // 4. Probar API de reportes
        console.log('\n📈 Probando API de reportes...');
        const reportsResponse = await fetch('http://localhost:3000/api/reports/dashboard', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const reportsData = await reportsResponse.json();
        console.log('Reportes response:', reportsData);

    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
    }
}

testAPI();