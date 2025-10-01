// Funciones utilitarias para dashboard.js (duplicadas por si main.js no carga)
function isAuthenticated() {
    return localStorage.getItem('authToken') !== null;
}

function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-CO');
}

function handleAuthError(error) {
    if (error.message.includes('Token') || error.message.includes('401')) {
        logout();
    }
}

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch('/api' + endpoint, finalOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error en la petición');
        }
        
        return data;
    } catch (error) {
        console.error('Error en API:', error);
        throw error;
    }
}

// Script para el dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Verificar autenticación
    if (!requireAuth()) {
        return;
    }

    // Obtener elementos del DOM
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const logoutBtn = document.getElementById('logoutBtn');
    const totalProjectsElement = document.getElementById('totalProjects');
    const pendingAdviceElement = document.getElementById('pendingAdvice');
    const totalBudgetElement = document.getElementById('totalBudget');
    const activeUsersElement = document.getElementById('activeUsers');
    const activityListElement = document.getElementById('activityList');

    // Configurar información del usuario
    const currentUser = getCurrentUser();
    if (currentUser) {
        userNameElement.textContent = `${currentUser.nombre} ${currentUser.apellido}`;
        userRoleElement.textContent = currentUser.rol.charAt(0).toUpperCase() + currentUser.rol.slice(1);
    }

    // Manejar cerrar sesión
    logoutBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            logout();
        }
    });

    // Cargar datos del dashboard
    loadDashboardData();

    async function loadDashboardData() {
        try {
            // Cargar proyectos
            const projectsResponse = await apiRequest('/projects');
            if (projectsResponse.success) {
                const projects = projectsResponse.data.projects || [];
                totalProjectsElement.textContent = projects.length;
                
                // Calcular presupuesto total
                const totalBudget = projects.reduce((sum, project) => {
                    return sum + (parseFloat(project.presupuesto_total) || 0);
                }, 0);
                totalBudgetElement.textContent = formatCurrency(totalBudget);
                
                // Mostrar actividad reciente basada en proyectos
                updateRecentActivity(projects);
            }

        } catch (error) {
            console.error('Error cargando datos del dashboard:', error);
            handleAuthError(error);
            
            // Mostrar datos por defecto en caso de error
            totalProjectsElement.textContent = '0';
            totalBudgetElement.textContent = '$0';
            activityListElement.innerHTML = '<p>Error cargando actividad reciente</p>';
        }

        try {
            // Cargar usuarios (solo para administradores)
            if (currentUser && currentUser.rol === 'administrador') {
                const usersResponse = await apiRequest('/users');
                if (usersResponse.success) {
                    const users = usersResponse.data.users || [];
                    const activeUsers = users.filter(user => user.activo);
                    activeUsersElement.textContent = activeUsers.length;
                }
            } else {
                activeUsersElement.textContent = '-';
            }
        } catch (error) {
            console.error('Error cargando usuarios:', error);
            activeUsersElement.textContent = '0';
        }

        // Simular asesorías pendientes (ya que no está implementado en el backend)
        pendingAdviceElement.textContent = '2';
    }

    function updateRecentActivity(projects) {
        if (!projects || projects.length === 0) {
            activityListElement.innerHTML = '<p>No hay actividad reciente</p>';
            return;
        }

        // Mostrar los proyectos más recientes
        const recentProjects = projects
            .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
            .slice(0, 5);

        const activityHTML = recentProjects.map(project => {
            const fechaCreacion = formatDate(project.fecha_creacion);
            return `
                <div style="padding: 0.5rem 0; border-bottom: 1px solid #ecf0f1;">
                    <strong>${project.nombre}</strong><br>
                    <small>Creado el ${fechaCreacion} - Estado: ${project.estado}</small>
                </div>
            `;
        }).join('');

        activityListElement.innerHTML = activityHTML || '<p>No hay actividad reciente</p>';
    }
});