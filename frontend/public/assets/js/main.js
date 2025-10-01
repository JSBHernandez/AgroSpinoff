// Configuración de la API
const API_BASE_URL = '/api';

// Funciones utilitarias
function showMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        element.className = type + '-message';
        
        // Ocultar después de 5 segundos
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }
}

function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

// Verificar si el usuario está autenticado
function isAuthenticated() {
    return localStorage.getItem('authToken') !== null;
}

// Obtener información del usuario actual
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
}

// Función para hacer peticiones a la API
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
        const response = await fetch(API_BASE_URL + endpoint, finalOptions);
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

// Redireccionar si no está autenticado
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Cerrar sesión
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// Formatear números como moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
    }).format(amount);
}

// Formatear fechas
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-CO');
}

// Función para manejar errores de autenticación
function handleAuthError(error) {
    if (error.message.includes('Token') || error.message.includes('401')) {
        logout();
    }
}