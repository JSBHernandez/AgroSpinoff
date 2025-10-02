// Gestión de Fases - JavaScript
let currentProject = null;
let currentPhase = null;
let resourceTypes = [];

// Cargar página al inicializar
document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    
    if (!projectId) {
        showAlert('No se especificó un proyecto', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
        return;
    }
    
    await loadProject(projectId);
    await loadPhases(projectId);
    await loadResourceTypes();
});

// Cargar información del proyecto
async function loadProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar el proyecto');
        }
        
        currentProject = await response.json();
        
        document.getElementById('projectTitle').textContent = `Gestión de Fases - ${currentProject.data.nombre}`;
        document.getElementById('projectDescription').textContent = currentProject.data.descripcion || 'Proyecto agroindustrial';
        
    } catch (error) {
        console.error('Error cargando proyecto:', error);
        showAlert('Error al cargar el proyecto', 'error');
    }
}

// Cargar fases del proyecto
async function loadPhases(projectId) {
    try {
        const response = await fetch(`/api/phases/project/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar las fases');
        }
        
        const result = await response.json();
        renderPhases(result.data);
        
    } catch (error) {
        console.error('Error cargando fases:', error);
        showAlert('Error al cargar las fases', 'error');
    }
}

// Renderizar fases en la interfaz
function renderPhases(phases) {
    const phasesGrid = document.getElementById('phasesGrid');
    
    if (phases.length === 0) {
        phasesGrid.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <h3>No hay fases creadas</h3>
                <p>Comienza creando la primera fase de tu proyecto</p>
                <button onclick="showCreatePhaseModal()" class="btn btn-success">
                    <i class="fas fa-plus"></i> Crear Primera Fase
                </button>
            </div>
        `;
        return;
    }
    
    phasesGrid.innerHTML = phases.map(phase => `
        <div class="phase-card">
            <div class="phase-header">
                <div>
                    <h4>${phase.nombre}</h4>
                    <small>Orden: ${phase.orden_fase}</small>
                </div>
                <span class="phase-status status-${phase.estado_fase}">${getStatusText(phase.estado_fase)}</span>
            </div>
            <div class="phase-content">
                <div class="phase-info">
                    <div>
                        <strong>Inicio:</strong><br>
                        ${formatDate(phase.fecha_inicio_planificada)}
                    </div>
                    <div>
                        <strong>Fin:</strong><br>
                        ${formatDate(phase.fecha_fin_planificada)}
                    </div>
                    <div>
                        <strong>Presupuesto:</strong><br>
                        $${formatNumber(phase.presupuesto_fase)}
                    </div>
                    <div>
                        <strong>Avance:</strong><br>
                        ${phase.porcentaje_avance}%
                    </div>
                </div>
                
                ${phase.descripcion ? `<p><strong>Descripción:</strong> ${phase.descripcion}</p>` : ''}
                
                <div class="resources-summary">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span><strong>Recursos:</strong> ${phase.total_recursos_planificados} planificados</span>
                        <span><strong>Costo estimado:</strong> $${formatNumber(phase.costo_total_recursos)}</span>
                    </div>
                </div>
                
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="editPhase(${phase.id_fase})" class="btn btn-warning" style="font-size: 12px; padding: 5px 10px;">
                        Editar
                    </button>
                    <button onclick="manageResources(${phase.id_fase})" class="btn btn-primary" style="font-size: 12px; padding: 5px 10px;">
                        Recursos
                    </button>
                    <button onclick="manageTasks(${phase.id_fase})" class="btn btn-success" style="font-size: 12px; padding: 5px 10px;">
                        Tareas
                    </button>
                    ${phase.estado_fase === 'pendiente' ? `
                        <button onclick="deletePhase(${phase.id_fase})" class="btn btn-danger" style="font-size: 12px; padding: 5px 10px;">
                            Eliminar
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// Cargar tipos de recurso
async function loadResourceTypes() {
    try {
        const response = await fetch('/api/resources/types', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar tipos de recurso');
        }
        
        const result = await response.json();
        resourceTypes = result.data;
        
        // Llenar el select de tipos de recurso
        const resourceTypeSelect = document.getElementById('resourceType');
        resourceTypeSelect.innerHTML = resourceTypes.map(type => 
            `<option value="${type.id_tipo_recurso}">${type.nombre} (${type.categoria})</option>`
        ).join('');
        
    } catch (error) {
        console.error('Error cargando tipos de recurso:', error);
    }
}

// Mostrar modal para crear fase
function showCreatePhaseModal() {
    currentPhase = null;
    document.getElementById('phaseModalTitle').textContent = 'Nueva Fase';
    document.getElementById('phaseForm').reset();
    document.getElementById('phaseStatus').value = 'pendiente';
    
    // Sugerir próximo orden
    const phases = document.querySelectorAll('.phase-card');
    document.getElementById('phaseOrder').value = phases.length + 1;
    
    document.getElementById('phaseModal').style.display = 'block';
}

// Editar fase
async function editPhase(phaseId) {
    try {
        const response = await fetch(`/api/phases/project/${currentProject.data.id_proyecto}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Error al cargar fase');
        
        const result = await response.json();
        const phase = result.data.find(p => p.id_fase === phaseId);
        
        if (!phase) {
            showAlert('Fase no encontrada', 'error');
            return;
        }
        
        currentPhase = phase;
        
        // Llenar formulario
        document.getElementById('phaseModalTitle').textContent = 'Editar Fase';
        document.getElementById('phaseName').value = phase.nombre;
        document.getElementById('phaseDescription').value = phase.descripcion || '';
        document.getElementById('phaseStartDate').value = phase.fecha_inicio_planificada;
        document.getElementById('phaseEndDate').value = phase.fecha_fin_planificada;
        document.getElementById('phaseBudget').value = phase.presupuesto_fase;
        document.getElementById('phaseOrder').value = phase.orden_fase;
        document.getElementById('phaseStatus').value = phase.estado_fase;
        
        document.getElementById('phaseModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error cargando fase:', error);
        showAlert('Error al cargar la fase', 'error');
    }
}

// Gestionar recursos de una fase
async function manageResources(phaseId) {
    try {
        const response = await fetch(`/api/resources/phase/${phaseId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Error al cargar recursos');
        
        const result = await response.json();
        currentPhase = { id_fase: phaseId };
        
        // Mostrar recursos existentes
        const resourcesContainer = document.getElementById('resourcesContainer');
        if (result.data.resources.length === 0) {
            resourcesContainer.innerHTML = '<p>No hay recursos planificados para esta fase.</p>';
        } else {
            resourcesContainer.innerHTML = `
                <h4>Recursos Planificados</h4>
                <div class="resources-list">
                    ${result.data.resources.map(resource => `
                        <div class="resource-item">
                            <div>
                                <strong>${resource.nombre_recurso}</strong>
                                <span class="resource-type">${resource.tipo_recurso_categoria}</span>
                                <br>
                                <small>${resource.cantidad_utilizada} ${resource.unidad_medida} - $${formatNumber(resource.costo_total_estimado || 0)}</small>
                            </div>
                            <div>
                                <span class="phase-status status-${resource.estado_asignacion}">${getStatusText(resource.estado_asignacion)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        document.getElementById('resourceModal').style.display = 'block';
        
    } catch (error) {
        console.error('Error cargando recursos:', error);
        showAlert('Error al cargar los recursos', 'error');
    }
}

// Eliminar fase
async function deletePhase(phaseId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta fase? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/phases/${phaseId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar fase');
        }
        
        showAlert('Fase eliminada exitosamente', 'success');
        await loadPhases(currentProject.data.id_proyecto);
        
    } catch (error) {
        console.error('Error eliminando fase:', error);
        showAlert(error.message, 'error');
    }
}

// Manejar envío de formulario de fase
document.getElementById('phaseForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        nombre: document.getElementById('phaseName').value,
        descripcion: document.getElementById('phaseDescription').value,
        fecha_inicio_planificada: document.getElementById('phaseStartDate').value,
        fecha_fin_planificada: document.getElementById('phaseEndDate').value,
        presupuesto_fase: parseFloat(document.getElementById('phaseBudget').value) || 0,
        orden_fase: parseInt(document.getElementById('phaseOrder').value)
    };
    
    // Solo incluir estado si estamos editando
    if (currentPhase) {
        formData.estado_fase = document.getElementById('phaseStatus').value;
    }
    
    try {
        const url = currentPhase ? 
            `/api/phases/${currentPhase.id_fase}` :
            `/api/phases/project/${currentProject.data.id_proyecto}`;
        
        const method = currentPhase ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar fase');
        }
        
        showAlert(`Fase ${currentPhase ? 'actualizada' : 'creada'} exitosamente`, 'success');
        closePhaseModal();
        await loadPhases(currentProject.data.id_proyecto);
        
    } catch (error) {
        console.error('Error guardando fase:', error);
        showAlert(error.message, 'error');
    }
});

// Manejar envío de formulario de recurso
document.getElementById('resourceForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        id_tipo_recurso: parseInt(document.getElementById('resourceType').value),
        nombre_recurso: document.getElementById('resourceName').value,
        cantidad_planificada: parseFloat(document.getElementById('resourceQuantity').value),
        unidad_medida: document.getElementById('resourceUnit').value,
        costo_unitario_estimado: parseFloat(document.getElementById('resourceCost').value) || null,
        descripcion: document.getElementById('resourceDescription').value || null
    };
    
    try {
        const response = await fetch(`/api/resources/phase/${currentPhase.id_fase}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al planificar recurso');
        }
        
        showAlert('Recurso planificado exitosamente', 'success');
        document.getElementById('resourceForm').reset();
        
        // Recargar recursos
        await manageResources(currentPhase.id_fase);
        
    } catch (error) {
        console.error('Error planificando recurso:', error);
        showAlert(error.message, 'error');
    }
});

// Cerrar modales
function closePhaseModal() {
    document.getElementById('phaseModal').style.display = 'none';
    currentPhase = null;
}

function closeResourceModal() {
    document.getElementById('resourceModal').style.display = 'none';
    currentPhase = null;
}

// Funciones auxiliares
function getStatusText(status) {
    const statusMap = {
        'pendiente': 'Pendiente',
        'en_progreso': 'En Progreso',
        'completada': 'Completada',
        'suspendida': 'Suspendida',
        'planificado': 'Planificado',
        'asignado': 'Asignado',
        'en_uso': 'En Uso',
        'completado': 'Completado',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES');
}

function formatNumber(number) {
    if (number === null || number === undefined) return '0.00';
    return parseFloat(number).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alertClass = type === 'error' ? 'alert-error' : 'alert-success';
    
    alertContainer.innerHTML = `
        <div class="alert ${alertClass}">
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

function goBack() {
    window.location.href = 'dashboard.html';
}

// Navegar a gestión de tareas de una fase
function manageTasks(phaseId) {
    window.location.href = `tasks.html?phaseId=${phaseId}`;
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const phaseModal = document.getElementById('phaseModal');
    const resourceModal = document.getElementById('resourceModal');
    
    if (event.target === phaseModal) {
        closePhaseModal();
    }
    if (event.target === resourceModal) {
        closeResourceModal();
    }
}