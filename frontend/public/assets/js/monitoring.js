// Seguimiento de Recursos - JavaScript
let currentProject = null;
let consumptionData = [];
let alertsData = [];
let projects = [];

// Cargar página al inicializar
document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    
    await loadProjects();
    await loadNotificationConfig();
    
    // Configurar fecha de hoy por defecto
    document.getElementById('fechaConsumo').value = new Date().toISOString().split('T')[0];
});

// Cargar lista de proyectos
async function loadProjects() {
    try {
        const response = await fetch('/api/projects', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar proyectos');
        }
        
        const result = await response.json();
        projects = result.data.projects;
        
        const projectSelect = document.getElementById('projectFilter');
        projectSelect.innerHTML = '<option value="">Seleccionar proyecto...</option>' +
            projects.map(project => `
                <option value="${project.id_proyecto}">${project.nombre}</option>
            `).join('');
            
    } catch (error) {
        console.error('Error cargando proyectos:', error);
        showAlert('Error al cargar los proyectos', 'error');
    }
}

// Cargar datos del proyecto seleccionado
async function loadProjectData() {
    const projectId = document.getElementById('projectFilter').value;
    
    if (!projectId) {
        clearData();
        return;
    }
    
    currentProject = projects.find(p => p.id_proyecto == projectId);
    
    if (currentProject) {
        document.getElementById('projectSubtitle').textContent = 
            `Monitoreo y alertas - ${currentProject.nombre}`;
        
        await loadConsumptionData(projectId);
        await loadAlerts();
        await loadResourcesForConsumption(projectId);
    }
}

// Cargar datos de consumo del proyecto
async function loadConsumptionData(projectId) {
    try {
        const response = await fetch(`/api/monitoring/project/${projectId}/consumption`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar datos de consumo');
        }
        
        const result = await response.json();
        consumptionData = result.data.consumption;
        
        renderStatistics(result.data.statistics);
        renderConsumption(result.data.consumption);
        
    } catch (error) {
        console.error('Error cargando datos de consumo:', error);
        showAlert('Error al cargar los datos de consumo', 'error');
    }
}

// Renderizar estadísticas generales
function renderStatistics(stats) {
    const container = document.getElementById('statsContainer');
    
    if (!stats || Object.keys(stats).length === 0) {
        container.innerHTML = '<p>No hay datos estadísticos disponibles.</p>';
        return;
    }
    
    const promedioConsumo = stats.promedio_consumo || 0;
    const totalRecursos = stats.total_recursos || 0;
    const eficienciaPresupuestaria = stats.costo_total_planificado > 0 ? 
        (stats.costo_total_consumido / stats.costo_total_planificado * 100) : 0;
    
    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${totalRecursos}</div>
            <div>Recursos Monitoreados</div>
        </div>
        <div class="stat-card ${getStatClass(promedioConsumo)}">
            <div class="stat-number ${getStatClass(promedioConsumo)}">${promedioConsumo.toFixed(1)}%</div>
            <div>Promedio de Consumo</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${formatCurrency(stats.costo_total_consumido || 0)}</div>
            <div>Costo Consumido</div>
        </div>
        <div class="stat-card ${getStatClass(eficienciaPresupuestaria)}">
            <div class="stat-number ${getStatClass(eficienciaPresupuestaria)}">${eficienciaPresupuestaria.toFixed(1)}%</div>
            <div>Eficiencia Presupuestaria</div>
        </div>
    `;
}

// Renderizar consumo por recurso
function renderConsumption(consumption) {
    const container = document.getElementById('consumptionContainer');
    
    if (consumption.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                <h3>No hay recursos con consumo registrado</h3>
                <p>Los recursos aparecerán aquí una vez que se registre su consumo.</p>
            </div>
        `;
        return;
    }
    
    const consumptionHtml = consumption.map(resource => `
        <div class="consumption-card">
            <div class="consumption-header">
                <div class="consumption-meta">
                    <span class="phase-badge">${resource.fase_nombre}</span>
                    <span class="alert-badge alert-${resource.nivel_alerta}">
                        ${getAlertText(resource.nivel_alerta)}
                    </span>
                </div>
                <h3 class="consumption-title">${resource.tipo_recurso}</h3>
                <p style="color: #7f8c8d; font-size: 14px;">${resource.categoria_recurso}</p>
            </div>
            
            <div class="consumption-body">
                <div class="progress-section">
                    <div class="progress-label">
                        <span>Consumo</span>
                        <span>${resource.porcentaje_consumo.toFixed(1)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${getProgressClass(resource.porcentaje_consumo)}" 
                             style="width: ${Math.min(resource.porcentaje_consumo, 100)}%"></div>
                    </div>
                </div>
                
                <div class="consumption-details">
                    <div class="detail-item">
                        <div class="detail-label">Planificado:</div>
                        <div>${resource.cantidad_planificada} unidades</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Consumido:</div>
                        <div>${resource.cantidad_consumida} unidades</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Restante:</div>
                        <div>${resource.cantidad_restante} unidades</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Costo Total:</div>
                        <div>${formatCurrency(resource.costo_consumido)}</div>
                    </div>
                </div>
                
                ${resource.fecha_fin_uso ? `
                    <div style="margin-top: 15px; padding: 10px; background: ${resource.dias_restantes <= 3 ? '#ffe6e6' : '#f8f9fa'}; border-radius: 5px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span><strong>Vence:</strong> ${formatDate(resource.fecha_fin_uso)}</span>
                            <span><strong>Días restantes:</strong> ${resource.dias_restantes}</span>
                        </div>
                    </div>
                ` : ''}
                
                <div class="consumption-actions">
                    <button class="btn btn-success" onclick="showConsumptionModalFor(${resource.id_recurso_planificado})">
                        Registrar Consumo
                    </button>
                    <button class="btn" onclick="viewConsumptionHistory(${resource.id_recurso_planificado})">
                        Ver Historial
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = consumptionHtml;
}

// Cargar alertas
async function loadAlerts() {
    try {
        const projectId = document.getElementById('projectFilter').value;
        const status = document.getElementById('alertStatusFilter').value;
        
        if (!projectId) return;
        
        const response = await fetch(`/api/monitoring/alerts?projectId=${projectId}&status=${status}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar alertas');
        }
        
        const result = await response.json();
        alertsData = result.data.alerts;
        
        renderAlerts(result.data.alerts);
        
    } catch (error) {
        console.error('Error cargando alertas:', error);
        showAlert('Error al cargar las alertas', 'error');
    }
}

// Renderizar alertas
function renderAlerts(alerts) {
    const container = document.getElementById('alertsList');
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <h3>No hay alertas</h3>
                <p>No se encontraron alertas para los filtros seleccionados.</p>
            </div>
        `;
        return;
    }
    
    const alertsHtml = alerts.map(alert => `
        <div class="alert-item ${alert.severidad}">
            <div class="alert-header">
                <h4 class="alert-title">${alert.titulo}</h4>
                <span class="alert-severity alert-${alert.severidad}">${getSeverityText(alert.severidad)}</span>
            </div>
            
            <div class="alert-message">${alert.mensaje}</div>
            
            <div class="alert-meta">
                <div>
                    <strong>Tipo:</strong> ${getAlertTypeText(alert.tipo_alerta)} | 
                    <strong>Fecha:</strong> ${formatDateTime(alert.fecha_generacion)}
                    ${alert.tipo_recurso_nombre ? ` | <strong>Recurso:</strong> ${alert.tipo_recurso_nombre}` : ''}
                </div>
                <div class="alert-actions">
                    ${alert.estado === 'activa' ? `
                        <button class="btn" onclick="markAlertAsRead(${alert.id_alerta})">
                            Marcar Leída
                        </button>
                        <button class="btn btn-success" onclick="resolveAlert(${alert.id_alerta})">
                            Resolver
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = alertsHtml;
}

// Cargar recursos para el modal de consumo
async function loadResourcesForConsumption(projectId) {
    try {
        const response = await fetch(`/api/resources/project/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            const recursos = result.data.phases.flatMap(phase => 
                phase.recursos.map(recurso => ({
                    ...recurso,
                    display_name: `${recurso.tipo_recurso} - ${phase.nombre}`
                }))
            );
            
            const select = document.getElementById('recursoSelect');
            select.innerHTML = '<option value="">Seleccionar recurso...</option>' +
                recursos.map(recurso => `
                    <option value="${recurso.id_recurso_planificado}">
                        ${recurso.display_name} (${recurso.cantidad_restante} disponible)
                    </option>
                `).join('');
        }
    } catch (error) {
        console.error('Error cargando recursos:', error);
    }
}

// Mostrar modal para registrar consumo
function showConsumptionModal() {
    if (!currentProject) {
        showAlert('Primero seleccione un proyecto', 'warning');
        return;
    }
    
    document.getElementById('consumptionForm').reset();
    document.getElementById('fechaConsumo').value = new Date().toISOString().split('T')[0];
    document.getElementById('consumptionModal').style.display = 'block';
}

// Mostrar modal para registrar consumo de un recurso específico
function showConsumptionModalFor(resourceId) {
    showConsumptionModal();
    document.getElementById('recursoSelect').value = resourceId;
}

// Manejar envío del formulario de consumo
document.getElementById('consumptionForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        id_recurso_planificado: parseInt(document.getElementById('recursoSelect').value),
        cantidad_consumida: parseFloat(document.getElementById('cantidadConsumida').value),
        fecha_consumo: document.getElementById('fechaConsumo').value,
        observaciones: document.getElementById('observacionesConsumo').value.trim() || null
    };
    
    try {
        const response = await fetch('/api/monitoring/consumption', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al registrar el consumo');
        }
        
        showAlert('Consumo registrado exitosamente', 'success');
        closeConsumptionModal();
        await loadProjectData(); // Recargar datos
        
    } catch (error) {
        console.error('Error registrando consumo:', error);
        showAlert(error.message, 'error');
    }
});

// Cargar configuración de notificaciones
async function loadNotificationConfig() {
    try {
        const response = await fetch('/api/monitoring/notifications/config', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            const config = result.data.config;
            
            document.getElementById('alertasPlataforma').checked = config.alertas_plataforma;
            document.getElementById('alertasEmail').checked = config.alertas_email;
            document.getElementById('frecuenciaResumen').value = config.frecuencia_resumen;
            document.getElementById('horarioPreferido').value = config.horario_preferido;
            
            // Configurar checkboxes de tipos de alerta
            const tiposAlerta = config.tipos_alerta || [];
            document.getElementById('alertaAgotamiento').checked = tiposAlerta.includes('agotamiento');
            document.getElementById('alertaSobrecosto').checked = tiposAlerta.includes('sobrecosto');
            document.getElementById('alertaRetraso').checked = tiposAlerta.includes('retraso');
            document.getElementById('alertaReasignacion').checked = tiposAlerta.includes('reasignacion');
        }
    } catch (error) {
        console.error('Error cargando configuración:', error);
    }
}

// Manejar envío de configuración de notificaciones
document.getElementById('notificationConfigForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const tiposAlerta = [];
    if (document.getElementById('alertaAgotamiento').checked) tiposAlerta.push('agotamiento');
    if (document.getElementById('alertaSobrecosto').checked) tiposAlerta.push('sobrecosto');
    if (document.getElementById('alertaRetraso').checked) tiposAlerta.push('retraso');
    if (document.getElementById('alertaReasignacion').checked) tiposAlerta.push('reasignacion');
    
    const configData = {
        alertas_plataforma: document.getElementById('alertasPlataforma').checked,
        alertas_email: document.getElementById('alertasEmail').checked,
        frecuencia_resumen: document.getElementById('frecuenciaResumen').value,
        tipos_alerta: tiposAlerta,
        horario_preferido: document.getElementById('horarioPreferido').value + ':00'
    };
    
    try {
        const response = await fetch('/api/monitoring/notifications/config', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(configData)
        });
        
        if (!response.ok) {
            throw new Error('Error al actualizar la configuración');
        }
        
        showAlert('Configuración actualizada exitosamente', 'success');
        
    } catch (error) {
        console.error('Error actualizando configuración:', error);
        showAlert('Error al actualizar la configuración', 'error');
    }
});

// Marcar alerta como leída
async function markAlertAsRead(alertId) {
    await updateAlertStatus(alertId, 'leida');
}

// Resolver alerta
async function resolveAlert(alertId) {
    await updateAlertStatus(alertId, 'resuelta');
}

// Actualizar estado de alerta
async function updateAlertStatus(alertId, status) {
    try {
        const response = await fetch(`/api/monitoring/alerts/${alertId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ estado: status })
        });
        
        if (!response.ok) {
            throw new Error('Error al actualizar el estado de la alerta');
        }
        
        showAlert('Alerta actualizada exitosamente', 'success');
        await loadAlerts();
        
    } catch (error) {
        console.error('Error actualizando alerta:', error);
        showAlert('Error al actualizar la alerta', 'error');
    }
}

// Navegación entre tabs
function showTab(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Quitar clase active de todos los botones
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar tab seleccionado
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Activar botón correspondiente
    event.target.classList.add('active');
}

// Mostrar/cerrar modales
function showConfigModal() {
    document.getElementById('configModal').style.display = 'block';
}

function closeConsumptionModal() {
    document.getElementById('consumptionModal').style.display = 'none';
}

function closeConfigModal() {
    document.getElementById('configModal').style.display = 'none';
}

// Funciones auxiliares
function getStatClass(value) {
    if (value >= 90) return 'critical';
    if (value >= 75) return 'warning';
    return 'success';
}

function getAlertText(nivel) {
    const alerts = {
        'normal': 'Normal',
        'medio': 'Medio',
        'alto': 'Alto',
        'critico': 'Crítico'
    };
    return alerts[nivel] || nivel;
}

function getProgressClass(percentage) {
    if (percentage >= 90) return 'danger';
    if (percentage >= 75) return 'warning';
    return '';
}

function getSeverityText(severity) {
    const severities = {
        'baja': 'Baja',
        'media': 'Media',
        'alta': 'Alta',
        'critica': 'Crítica'
    };
    return severities[severity] || severity;
}

function getAlertTypeText(type) {
    const types = {
        'agotamiento': 'Agotamiento',
        'sobrecosto': 'Sobrecosto',
        'retraso': 'Retraso',
        'reasignacion': 'Reasignación'
    };
    return types[type] || type;
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-ES');
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alertClass = type === 'error' ? 'alert-danger' : 
                      type === 'warning' ? 'alert-warning' : 'alert-success';
    
    alertContainer.innerHTML = `
        <div class="alert ${alertClass}">
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

function clearData() {
    document.getElementById('statsContainer').innerHTML = '';
    document.getElementById('consumptionContainer').innerHTML = '';
    document.getElementById('alertsList').innerHTML = '';
    document.getElementById('projectSubtitle').textContent = 'Monitoreo y alertas de consumo';
}

function viewConsumptionHistory(resourceId) {
    showAlert('Funcionalidad de historial en desarrollo', 'warning');
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const consumptionModal = document.getElementById('consumptionModal');
    const configModal = document.getElementById('configModal');
    
    if (event.target === consumptionModal) {
        closeConsumptionModal();
    }
    if (event.target === configModal) {
        closeConfigModal();
    }
}