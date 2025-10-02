// Dashboard.js simplificado - Solo funcionalidad esencial
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard cargado');
    
    // Función básica para mostrar información estática
    function initializeBasicDashboard() {
        // Valores por defecto para evitar errores
        document.getElementById('totalProjects').textContent = '0';
        document.getElementById('pendingAdvice').textContent = '0';
        document.getElementById('totalBudget').textContent = '$0';
        document.getElementById('activeUsers').textContent = '0';
        
        // Mensaje simple para actividad reciente
        document.getElementById('activityList').innerHTML = '<p>No hay actividad reciente disponible</p>';
        document.getElementById('alertsList').innerHTML = '<p>No hay alertas pendientes</p>';
        
        console.log('Dashboard básico inicializado');
    }
    
    // Inicializar inmediatamente sin peticiones API
    initializeBasicDashboard();
    
    // Manejar logout de forma segura
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Limpiar almacenamiento local
            localStorage.clear();
            sessionStorage.clear();
            // Redirigir al login
            window.location.href = 'login.html';
        });
    }
    
    console.log('Dashboard simplificado configurado correctamente');
});