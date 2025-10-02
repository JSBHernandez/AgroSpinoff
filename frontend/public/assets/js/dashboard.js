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
        
        // Cargar alertas recientes
        await loadRecentAlerts();
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

    async function loadRecentAlerts() {
        try {
            const alertsResponse = await apiRequest('/monitoring/alerts/recent');
            if (alertsResponse.success) {
                const alerts = alertsResponse.data || [];
                updateAlertsSection(alerts);
            }
        } catch (error) {
            console.error('Error cargando alertas:', error);
            updateAlertsSection([]);
        }
    }

    function updateAlertsSection(alerts) {
        const alertsList = document.getElementById('alertsList');
        if (!alertsList) return;

        if (!alerts || alerts.length === 0) {
            alertsList.innerHTML = '<p style="color: #7f8c8d; text-align: center; margin: 1rem 0;">No hay alertas recientes</p>';
            return;
        }

        const alertsHTML = alerts.slice(0, 5).map(alert => {
            const alertClass = alert.nivel === 'alto' ? 'alert-high' : 
                             alert.nivel === 'medio' ? 'alert-medium' : 'alert-low';
            const fecha = formatDate(alert.fecha_creacion);
            
            return `
                <div class="alert-item ${alertClass}" style="padding: 0.75rem; margin: 0.5rem 0; border-left: 4px solid; border-radius: 4px; background: #f8f9fa;">
                    <div style="font-weight: bold; margin-bottom: 0.25rem;">${alert.mensaje}</div>
                    <div style="font-size: 0.875rem; color: #6c757d;">
                        ${alert.proyecto_nombre} - ${fecha}
                    </div>
                </div>
            `;
        }).join('');

        alertsList.innerHTML = alertsHTML;
    }
});

// Función para mostrar modal de selección de proyectos para gestión de fases
async function showProjectPhasesModal() {
    const modal = document.getElementById('projectPhasesModal');
    const projectsList = document.getElementById('projectsList');
    
    modal.style.display = 'block';
    
    try {
        // Cargar proyectos del usuario
        const response = await fetch('/api/projects', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar proyectos');
        }
        
        const result = await response.json();
        const projects = result.data.projects;
        
        if (projects.length === 0) {
            projectsList.innerHTML = `
                <p style="text-align: center; padding: 20px; color: #666;">
                    No tienes proyectos disponibles.<br>
                    <a href="nuevo-proyecto.html" style="color: #2ecc71;">Crear mi primer proyecto</a>
                </p>
            `;
            return;
        }
        
        projectsList.innerHTML = `
            <div style="max-height: 400px; overflow-y: auto;">
                ${projects.map(project => `
                    <div style="
                        border: 1px solid #ddd; 
                        border-radius: 8px; 
                        padding: 15px; 
                        margin-bottom: 10px; 
                        cursor: pointer;
                        transition: all 0.3s;
                        background: white;
                    " onclick="goToProjectPhases(${project.id_proyecto})" 
                       onmouseover="this.style.background='#f8f9fa'; this.style.transform='translateY(-2px)'" 
                       onmouseout="this.style.background='white'; this.style.transform='translateY(0)'">
                        <h4 style="margin: 0 0 10px 0; color: #2c3e50;">${project.nombre}</h4>
                        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                            ${project.descripcion || 'Sin descripción'}
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="
                                background: ${getProjectStatusColor(project.estado)}; 
                                color: white; 
                                padding: 4px 12px; 
                                border-radius: 15px; 
                                font-size: 12px;
                                font-weight: bold;
                            ">
                                ${getProjectStatusText(project.estado)}
                            </span>
                            <span style="color: #7f8c8d; font-size: 12px;">
                                ${project.categoria.charAt(0).toUpperCase() + project.categoria.slice(1)}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Error cargando proyectos:', error);
        projectsList.innerHTML = `
            <p style="text-align: center; padding: 20px; color: #e74c3c;">
                Error al cargar los proyectos. Intenta nuevamente.
            </p>
        `;
    }
}

// Función para cerrar modal de proyectos
function closeProjectPhasesModal() {
    document.getElementById('projectPhasesModal').style.display = 'none';
}

// Función para cerrar modal de presupuestos
function closeProjectBudgetModal() {
    document.getElementById('projectBudgetModal').style.display = 'none';
}

// Función para mostrar modal de selección de proyecto para presupuestos
async function showProjectBudgetModal() {
    const modal = document.getElementById('projectBudgetModal');
    const projectsList = document.getElementById('projectsBudgetList');
    
    modal.style.display = 'block';
    
    try {
        // Cargar proyectos del usuario
        const response = await fetch('/api/projects', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar proyectos');
        }
        
        const result = await response.json();
        const projects = result.data.projects;
        
        if (projects.length === 0) {
            projectsList.innerHTML = `
                <p style="text-align: center; padding: 20px; color: #666;">
                    No tienes proyectos disponibles.<br>
                    <a href="nuevo-proyecto.html" style="color: #2ecc71;">Crear mi primer proyecto</a>
                </p>
            `;
            return;
        }
        
        projectsList.innerHTML = `
            <div style="max-height: 400px; overflow-y: auto;">
                ${projects.map(project => `
                    <div style="
                        border: 1px solid #ddd; 
                        border-radius: 8px; 
                        padding: 15px; 
                        margin-bottom: 10px; 
                        cursor: pointer;
                        transition: all 0.3s;
                        background: white;
                    " onclick="goToProjectBudget(${project.id_proyecto})" 
                       onmouseover="this.style.background='#f8f9fa'; this.style.transform='translateY(-2px)'" 
                       onmouseout="this.style.background='white'; this.style.transform='translateY(0)'">
                        <h4 style="margin: 0 0 10px 0; color: #2c3e50;">${project.nombre}</h4>
                        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                            ${project.descripcion || 'Sin descripción'}
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="
                                background: ${getProjectStatusColor(project.estado)}; 
                                color: white; 
                                padding: 4px 12px; 
                                border-radius: 15px; 
                                font-size: 12px;
                                font-weight: bold;
                            ">
                                ${getProjectStatusText(project.estado)}
                            </span>
                            <span style="color: #7f8c8d; font-size: 12px;">
                                Presupuesto: ${formatCurrency(project.presupuesto_total)}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Error cargando proyectos:', error);
        projectsList.innerHTML = `
            <p style="text-align: center; padding: 20px; color: #e74c3c;">
                Error al cargar los proyectos. Intenta nuevamente.
            </p>
        `;
    }
}

// Función para cerrar modal de proyectos
function closeProjectPhasesModal() {
    document.getElementById('projectPhasesModal').style.display = 'none';
}

// Función para ir a gestión de fases de un proyecto específico
function goToProjectPhases(projectId) {
    window.location.href = `phases.html?projectId=${projectId}`;
}

// Función para ir a gestión de presupuestos de un proyecto específico
function goToProjectBudget(projectId) {
    window.location.href = `budgets.html?projectId=${projectId}`;
}

// Función para mostrar modal de selección de proyectos para presupuestos
async function showProjectBudgetModal() {
    const modal = document.getElementById('projectBudgetModal');
    const projectsList = document.getElementById('projectsBudgetList');
    
    modal.style.display = 'block';
    
    try {
        // Cargar proyectos del usuario
        const response = await fetch('/api/projects', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar proyectos');
        }
        
        const result = await response.json();
        const projects = result.data.projects;
        
        if (projects.length === 0) {
            projectsList.innerHTML = `
                <p style="text-align: center; padding: 20px; color: #666;">
                    No tienes proyectos disponibles.<br>
                    <a href="nuevo-proyecto.html" style="color: #2ecc71;">Crear mi primer proyecto</a>
                </p>
            `;
            return;
        }
        
        projectsList.innerHTML = `
            <div style="max-height: 400px; overflow-y: auto;">
                ${projects.map(project => `
                    <div style="
                        border: 1px solid #ddd; 
                        border-radius: 8px; 
                        padding: 15px; 
                        margin-bottom: 10px; 
                        cursor: pointer;
                        transition: all 0.3s;
                        background: white;
                    " onclick="goToProjectBudget(${project.id_proyecto})" 
                       onmouseover="this.style.background='#f8f9fa'; this.style.transform='translateY(-2px)'" 
                       onmouseout="this.style.background='white'; this.style.transform='translateY(0)'">
                        <h4 style="margin: 0 0 10px 0; color: #2c3e50;">${project.nombre}</h4>
                        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                            ${project.descripcion || 'Sin descripción'}
                        </p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="
                                background: ${getProjectStatusColor(project.estado)}; 
                                color: white; 
                                padding: 4px 12px; 
                                border-radius: 15px; 
                                font-size: 12px;
                                font-weight: bold;
                            ">
                                ${getProjectStatusText(project.estado)}
                            </span>
                            <div style="text-align: right;">
                                <div style="color: #27ae60; font-weight: bold; font-size: 14px;">
                                    ${formatCurrency(project.presupuesto_total)}
                                </div>
                                <span style="color: #7f8c8d; font-size: 12px;">
                                    ${project.categoria.charAt(0).toUpperCase() + project.categoria.slice(1)}
                                </span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Error cargando proyectos:', error);
        projectsList.innerHTML = `
            <p style="text-align: center; padding: 20px; color: #e74c3c;">
                Error al cargar los proyectos. Intenta nuevamente.
            </p>
        `;
    }
}

// Función para cerrar modal de presupuestos
function closeProjectBudgetModal() {
    document.getElementById('projectBudgetModal').style.display = 'none';
}

// Función para ir a gestión de presupuestos de un proyecto específico
function goToProjectBudget(projectId) {
    window.location.href = `budgets.html?projectId=${projectId}`;
}

// Funciones auxiliares para el estado del proyecto
function getProjectStatusColor(status) {
    const colors = {
        'planificacion': '#f39c12',
        'ejecucion': '#3498db',
        'finalizado': '#2ecc71',
        'cancelado': '#e74c3c',
        'suspendido': '#95a5a6'
    };
    return colors[status] || '#95a5a6';
}

function getProjectStatusText(status) {
    const texts = {
        'planificacion': 'Planificación',
        'ejecucion': 'En Ejecución',
        'finalizado': 'Finalizado',
        'cancelado': 'Cancelado',
        'suspendido': 'Suspendido'
    };
    return texts[status] || status;
}

// Cerrar modal al hacer clic fuera
window.onclick = function(event) {
    const phasesModal = document.getElementById('projectPhasesModal');
    const budgetModal = document.getElementById('projectBudgetModal');
    
    if (event.target === phasesModal) {
        closeProjectPhasesModal();
    }
    if (event.target === budgetModal) {
        closeProjectBudgetModal();
    }
}