// Funciones utilitarias para auth.js (duplicadas por si main.js no carga)
function isAuthenticated() {
    return localStorage.getItem('authToken') !== null;
}

function hideMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

function showMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        element.className = type + '-message';
        
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
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

// Script para la página de login
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si ya está autenticado
    if (isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const demoBtn = document.getElementById('demoBtn');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const loadingMessage = document.getElementById('loadingMessage');

    // Manejar el botón demo
    if (demoBtn) {
        demoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (emailInput && passwordInput) {
                emailInput.value = 'admin@agrotechnova.com';
                passwordInput.value = 'admin123';
            }
        });
    }

    // Manejar el formulario de login
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Ocultar mensajes anteriores
        hideMessage('errorMessage');
        document.getElementById('loadingMessage').style.display = 'block';

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const response = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            if (response.success) {
                // Guardar token y datos del usuario
                localStorage.setItem('authToken', response.data.token);
                localStorage.setItem('currentUser', JSON.stringify(response.data.user));
                
                // Redireccionar al dashboard
                window.location.href = 'dashboard.html';
            } else {
                throw new Error(response.message || 'Error en el login');
            }

        } catch (error) {
            console.error('Error en login:', error);
            document.getElementById('loadingMessage').style.display = 'none';
            showMessage('errorMessage', error.message || 'Error al iniciar sesión');
        }
    });
});