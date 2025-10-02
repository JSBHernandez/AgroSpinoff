// reports.js - Funcionalidad para el sistema de reportes RF05

let currentTab = 'utilizacion';
let currentData = null;
let currentPage = 0;
const pageSize = 20;

// Verificar autenticación al cargar
document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
    cargarDatosIniciales();
});

// =============================================================================
// GESTIÓN DE TABS
// =============================================================================

function switchTab(tabName) {
    // Remover clase active de todos los tabs
    document.querySelectorAll('.reports-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activar tab seleccionado
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    currentTab = tabName;
    
    // Limpiar contenido anterior
    limpiarResultados(tabName);
}

// =============================================================================
// CARGA DE DATOS INICIALES
// =============================================================================

async function cargarDatosIniciales() {
    try {
        await Promise.all([
            cargarProyectos(),
            cargarFases(),
            cargarTiposRecurso()
        ]);
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        showNotification('Error cargando datos iniciales', 'error');
    }
}

async function cargarProyectos() {
    try {
        const response = await apiRequest('/projects');
        if (response.success) {
            const proyectos = response.data.projects || [];
            
            // Llenar selectores de proyectos
            ['proyecto-utilizacion', 'proyecto-resumen', 'proyecto-tendencias'].forEach(selectId => {
                const select = document.getElementById(selectId);
                select.innerHTML = '<option value="">Todos los proyectos</option>';
                
                proyectos.forEach(proyecto => {
                    const option = document.createElement('option');
                    option.value = proyecto.id_proyecto;
                    option.textContent = `${proyecto.nombre} (${proyecto.estado})`;
                    select.appendChild(option);
                });
            });
        }
    } catch (error) {
        console.error('Error cargando proyectos:', error);
    }
}

async function cargarFases() {
    try {
        const response = await apiRequest('/phases');
        if (response.success) {
            const fases = response.data || [];
            
            const select = document.getElementById('fase-utilizacion');
            select.innerHTML = '<option value="">Todas las fases</option>';
            
            fases.forEach(fase => {
                const option = document.createElement('option');
                option.value = fase.id_fase;
                option.textContent = `${fase.nombre} - ${fase.proyecto_nombre}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error cargando fases:', error);
    }
}

async function cargarTiposRecurso() {
    try {
        const response = await apiRequest('/resources/types');
        if (response.success) {
            const tipos = response.data || [];
            
            ['tipo-recurso-utilizacion', 'tipo-recurso-tendencias'].forEach(selectId => {
                const select = document.getElementById(selectId);
                select.innerHTML = '<option value="">Todos los tipos</option>';
                
                tipos.forEach(tipo => {
                    const option = document.createElement('option');
                    option.value = tipo.id_tipo_recurso;
                    option.textContent = `${tipo.nombre} (${tipo.categoria})`;
                    select.appendChild(option);
                });
            });
        }
    } catch (error) {
        console.error('Error cargando tipos de recurso:', error);
        
        // Datos de respaldo si no hay endpoint
        const tiposRespaldo = [
            { id_tipo_recurso: 1, nombre: 'Fertilizante NPK', categoria: 'material' },
            { id_tipo_recurso: 2, nombre: 'Semillas Maíz', categoria: 'material' },
            { id_tipo_recurso: 3, nombre: 'Agua Riego', categoria: 'recurso' }
        ];
        
        ['tipo-recurso-utilizacion', 'tipo-recurso-tendencias'].forEach(selectId => {
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Todos los tipos</option>';
            
            tiposRespaldo.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo.id_tipo_recurso;
                option.textContent = `${tipo.nombre} (${tipo.categoria})`;
                select.appendChild(option);
            });
        });
    }
}

// =============================================================================
// GENERACIÓN DE REPORTES
// =============================================================================

async function cargarReporteUtilizacion() {
    const filtros = obtenerFiltros('utilizacion');
    await cargarReporte('utilizacion', '/reports-rf05/resources/utilization', filtros);
}

async function cargarReporteResumen() {
    const filtros = obtenerFiltros('resumen');
    await cargarReporte('resumen', '/reports-rf05/resources/summary', filtros);
}

async function cargarReporteTendencias() {
    const filtros = obtenerFiltros('tendencias');
    await cargarReporte('tendencias', '/reports-rf05/resources/trends', filtros);
}

async function cargarReporte(tipo, endpoint, filtros) {
    const contentDiv = document.getElementById(`content-${tipo}`);
    const statsDiv = document.getElementById(`stats-${tipo}`);
    
    // Mostrar indicador de carga
    contentDiv.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>Generando reporte...</p>
        </div>
    `;
    
    try {
        // Construir query string
        const queryParams = new URLSearchParams();
        Object.entries(filtros).forEach(([key, value]) => {
            if (value && value !== '') {
                queryParams.append(key, value);
            }
        });
        
        // Agregar paginación para utilización
        if (tipo === 'utilizacion') {
            queryParams.append('limite', pageSize);
            queryParams.append('offset', currentPage * pageSize);
        }
        
        const response = await apiRequest(`${endpoint}?${queryParams.toString()}`);
        
        if (response.success) {
            currentData = response.data;
            
            // Mostrar estadísticas
            mostrarEstadisticas(tipo, response.data);
            
            // Mostrar resultados
            mostrarResultados(tipo, response.data);
            
            showNotification('Reporte generado exitosamente', 'success');
        } else {
            throw new Error(response.message || 'Error generando reporte');
        }
        
    } catch (error) {
        console.error('Error generando reporte:', error);
        contentDiv.innerHTML = `
            <div class="no-data">
                ❌ Error generando reporte: ${error.message}
            </div>
        `;
        showNotification('Error generando reporte', 'error');
    }
}

function obtenerFiltros(tipo) {
    const filtros = {};
    
    switch (tipo) {
        case 'utilizacion':
            filtros.proyecto_id = document.getElementById('proyecto-utilizacion').value;
            filtros.fase_id = document.getElementById('fase-utilizacion').value;
            filtros.tipo_recurso_id = document.getElementById('tipo-recurso-utilizacion').value;
            filtros.categoria_recurso = document.getElementById('categoria-utilizacion').value;
            filtros.fecha_inicio = document.getElementById('fecha-inicio-utilizacion').value;
            filtros.fecha_fin = document.getElementById('fecha-fin-utilizacion').value;
            break;
            
        case 'resumen':
            filtros.proyecto_id = document.getElementById('proyecto-resumen').value;
            filtros.estado_proyecto = document.getElementById('estado-proyecto-resumen').value;
            break;
            
        case 'tendencias':
            filtros.proyecto_id = document.getElementById('proyecto-tendencias').value;
            filtros.tipo_recurso_id = document.getElementById('tipo-recurso-tendencias').value;
            filtros.fecha_inicio = document.getElementById('fecha-inicio-tendencias').value;
            filtros.fecha_fin = document.getElementById('fecha-fin-tendencias').value;
            filtros.agrupacion = document.getElementById('agrupacion-tendencias').value;
            break;
    }
    
    return filtros;
}

function mostrarEstadisticas(tipo, data) {
    const statsDiv = document.getElementById(`stats-${tipo}`);
    
    switch (tipo) {
        case 'utilizacion':
            if (data.totales) {
                statsDiv.innerHTML = `
                    <span>Total registros: ${data.totales.total_registros || 0}</span>
                    <span>Planificado: ${formatNumber(data.totales.total_planificado || 0)}</span>
                    <span>Utilizado: ${formatNumber(data.totales.total_utilizado || 0)}</span>
                `;
            }
            break;
            
        case 'resumen':
            if (data.resumen_proyectos) {
                const totalProyectos = data.resumen_proyectos.length;
                statsDiv.innerHTML = `<span>Total proyectos: ${totalProyectos}</span>`;
            }
            break;
            
        case 'tendencias':
            if (data.tendencias) {
                const totalRegistros = data.tendencias.length;
                statsDiv.innerHTML = `<span>Total registros: ${totalRegistros}</span>`;
            }
            break;
    }
}

function mostrarResultados(tipo, data) {
    const contentDiv = document.getElementById(`content-${tipo}`);
    
    let datos;
    switch (tipo) {
        case 'utilizacion':
            datos = data.reportes || [];
            break;
        case 'resumen':
            datos = data.resumen_proyectos || [];
            break;
        case 'tendencias':
            datos = data.tendencias || [];
            break;
    }
    
    if (!datos || datos.length === 0) {
        contentDiv.innerHTML = `
            <div class="no-data">
                📊 No hay datos disponibles para los filtros seleccionados
            </div>
        `;
        return;
    }
    
    // Generar tabla
    const headers = Object.keys(datos[0]);
    const tabla = `
        <table class="data-table">
            <thead>
                <tr>
                    ${headers.map(header => `<th>${formatHeader(header)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${datos.map(row => `
                    <tr>
                        ${headers.map(header => `<td>${formatValue(row[header], header)}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    contentDiv.innerHTML = tabla;
    
    // Agregar paginación si es necesario (solo para utilización)
    if (tipo === 'utilizacion' && data.paginacion) {
        agregarPaginacion(contentDiv, data.paginacion);
    }
}

function formatHeader(header) {
    return header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatValue(value, header) {
    if (value === null || value === undefined) {
        return '-';
    }
    
    // Formatear números
    if (typeof value === 'number') {
        if (header.includes('porcentual') || header.includes('porcentaje')) {
            return `${value.toFixed(2)}%`;
        }
        if (header.includes('costo') || header.includes('presupuesto')) {
            return `$${value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
        }
        return value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
    }
    
    // Formatear fechas
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
        return formatDate(value);
    }
    
    return value;
}

function agregarPaginacion(contentDiv, paginacion) {
    const totalPages = Math.ceil(paginacion.total_registros / pageSize);
    
    if (totalPages <= 1) return;
    
    const paginationHTML = `
        <div class="pagination">
            <button onclick="cambiarPagina(0)" ${currentPage === 0 ? 'disabled' : ''}>
                Primera
            </button>
            <button onclick="cambiarPagina(${currentPage - 1})" ${currentPage === 0 ? 'disabled' : ''}>
                Anterior
            </button>
            <span>Página ${currentPage + 1} de ${totalPages}</span>
            <button onclick="cambiarPagina(${currentPage + 1})" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>
                Siguiente
            </button>
            <button onclick="cambiarPagina(${totalPages - 1})" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>
                Última
            </button>
        </div>
    `;
    
    contentDiv.innerHTML += paginationHTML;
}

function cambiarPagina(newPage) {
    currentPage = newPage;
    cargarReporteUtilizacion();
}

// =============================================================================
// EXPORTACIÓN
// =============================================================================

async function exportarExcel(tipo) {
    await exportarReporte(tipo, 'excel');
}

async function exportarPDF(tipo) {
    await exportarReporte(tipo, 'pdf');
}

async function exportarReporte(tipo, formato) {
    try {
        const filtros = obtenerFiltros(tipo);
        filtros.tipo_reporte = tipo;
        
        // Construir query string
        const queryParams = new URLSearchParams();
        Object.entries(filtros).forEach(([key, value]) => {
            if (value && value !== '') {
                queryParams.append(key, value);
            }
        });
        
        // Mostrar indicador de carga
        showNotification(`Generando archivo ${formato.toUpperCase()}...`, 'info');
        
        // Crear enlace de descarga
        const url = `${API_BASE_URL}/reports-rf05/export/${formato}?${queryParams.toString()}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        // Obtener el blob del archivo
        const blob = await response.blob();
        
        // Crear nombre del archivo
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
        const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
        const fileName = `reporte_${tipo}_${timestamp}.${extension}`;
        
        // Crear enlace de descarga
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Limpiar
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        
        showNotification(`Archivo ${formato.toUpperCase()} descargado exitosamente`, 'success');
        
    } catch (error) {
        console.error('Error exportando reporte:', error);
        showNotification(`Error exportando a ${formato.toUpperCase()}: ${error.message}`, 'error');
    }
}

// =============================================================================
// UTILIDADES
// =============================================================================

function limpiarFiltros(tipo) {
    switch (tipo) {
        case 'utilizacion':
            document.getElementById('proyecto-utilizacion').value = '';
            document.getElementById('fase-utilizacion').value = '';
            document.getElementById('tipo-recurso-utilizacion').value = '';
            document.getElementById('categoria-utilizacion').value = '';
            document.getElementById('fecha-inicio-utilizacion').value = '';
            document.getElementById('fecha-fin-utilizacion').value = '';
            break;
            
        case 'resumen':
            document.getElementById('proyecto-resumen').value = '';
            document.getElementById('estado-proyecto-resumen').value = '';
            break;
            
        case 'tendencias':
            document.getElementById('proyecto-tendencias').value = '';
            document.getElementById('tipo-recurso-tendencias').value = '';
            document.getElementById('fecha-inicio-tendencias').value = '';
            document.getElementById('fecha-fin-tendencias').value = '';
            document.getElementById('agrupacion-tendencias').value = 'diario';
            break;
    }
    
    limpiarResultados(tipo);
    showNotification('Filtros limpiados', 'info');
}

function limpiarResultados(tipo) {
    const contentDiv = document.getElementById(`content-${tipo}`);
    const statsDiv = document.getElementById(`stats-${tipo}`);
    
    contentDiv.innerHTML = `
        <div class="no-data">
            Selecciona los filtros y genera el reporte para ver los resultados
        </div>
    `;
    
    statsDiv.innerHTML = '';
    currentData = null;
    currentPage = 0;
}

function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0';
    }
    return num.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES');
    } catch (error) {
        return dateString;
    }
}

function showNotification(message, type = 'info') {
    // Implementación simple de notificaciones
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}