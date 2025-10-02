// Gestión de Tareas - JavaScript
let currentPhase = null;
let currentTask = null;
let tasksData = [];

// Cargar página al inicializar
document.addEventListener('DOMContentLoaded', async function() {
    if (!requireAuth()) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const phaseId = urlParams.get('phaseId');
    
    if (!phaseId) {
        showAlert('No se especificó una fase', 'error');
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
        return;
    }
    
    await loadPhaseTasks(phaseId);
});

// Cargar tareas de una fase específica
async function loadPhaseTasks(phaseId) {
    try {
        const response = await fetch(`/api/tasks/phase/${phaseId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar tareas de la fase');
        }
        
        const result = await response.json();
        currentPhase = result.data.phase;
        tasksData = result.data.tasks;
        
        renderPhaseInfo();
        renderTasks();
        
    } catch (error) {
        console.error('Error cargando tareas:', error);
        showAlert('Error al cargar las tareas de la fase', 'error');
    }
}

// Renderizar información de la fase
function renderPhaseInfo() {
    document.getElementById('pageTitle').textContent = `Gestión de Tareas`;
    document.getElementById('phaseSubtitle').textContent = `${currentPhase.proyecto_nombre} - ${currentPhase.nombre}`;
    
    document.getElementById('phaseName').textContent = currentPhase.nombre;
    document.getElementById('phaseDescription').textContent = currentPhase.descripcion || 'Sin descripción';
    
    // Calcular estadísticas
    const totalTasks = tasksData.length;
    const completedTasks = tasksData.filter(task => task.estado === 'completada').length;
    const activeTasks = tasksData.filter(task => task.estado === 'en_progreso').length;
    const totalHours = tasksData.reduce((sum, task) => sum + (parseFloat(task.horas_estimadas) || 0), 0);
    
    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('completedTasks').textContent = completedTasks;
    document.getElementById('activeTasks').textContent = activeTasks;
    document.getElementById('totalHours').textContent = totalHours.toFixed(1);
    
    document.getElementById('phaseInfo').style.display = 'block';
}

// Renderizar tareas
function renderTasks() {
    const container = document.getElementById('tasksGrid');
    
    if (tasksData.length === 0) {
        container.innerHTML = `
            <div class="no-tasks" style="grid-column: 1 / -1;">
                <h3>No hay tareas en esta fase</h3>
                <p>Comience creando la primera tarea para esta fase del proyecto.</p>
                <button class="btn btn-success" onclick="showCreateTaskModal()">
                    Crear Primera Tarea
                </button>
            </div>
        `;
        return;
    }
    
    const tasksHtml = tasksData.map(task => `
        <div class="task-card">
            <div class="task-header">
                <div class="task-meta">
                    <span class="priority-badge priority-${task.prioridad}">
                        ${getPriorityText(task.prioridad)}
                    </span>
                    <span class="status-badge status-${task.estado}">
                        ${getStatusText(task.estado)}
                    </span>
                </div>
                <h3 class="task-title">${task.nombre}</h3>
                <p class="task-description">${task.descripcion || 'Sin descripción'}</p>
            </div>
            
            <div class="task-body">
                ${task.fecha_inicio || task.fecha_fin ? `
                    <div class="task-dates">
                        <div class="date-item">
                            <div class="date-label">Inicio:</div>
                            <div>${task.fecha_inicio ? formatDate(task.fecha_inicio) : 'No definido'}</div>
                        </div>
                        <div class="date-item">
                            <div class="date-label">Fin:</div>
                            <div>${task.fecha_fin ? formatDate(task.fecha_fin) : 'No definido'}</div>
                        </div>
                    </div>
                ` : ''}
                
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>Progreso</span>
                        <span>${task.progreso_porcentaje}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${getProgressClass(task.progreso_porcentaje)}" 
                             style="width: ${task.progreso_porcentaje}%"></div>
                    </div>
                </div>
                
                ${task.horas_estimadas ? `
                    <div style="margin-bottom: 15px; font-size: 14px;">
                        <strong>Horas:</strong> ${task.horas_reales || 0}/${task.horas_estimadas} 
                        (${task.horas_estimadas ? ((task.horas_reales || 0) / task.horas_estimadas * 100).toFixed(1) : 0}%)
                    </div>
                ` : ''}
                
                <div class="task-assignments">
                    <div class="assignments-title">Asignaciones:</div>
                    <div class="assignment-item">
                        ${task.asignados_info}
                    </div>
                </div>
                
                <div class="task-actions">
                    <button class="btn" onclick="showEditTaskModal(${task.id_tarea})">
                        Editar
                    </button>
                    <button class="btn btn-warning" onclick="showTaskAssignments(${task.id_tarea})">
                        Asignar
                    </button>
                    ${task.estado !== 'completada' ? `
                        <button class="btn btn-success" onclick="markTaskCompleted(${task.id_tarea})">
                            Completar
                        </button>
                    ` : ''}
                    <button class="btn btn-danger" onclick="deleteTask(${task.id_tarea})" 
                            style="margin-left: auto;">
                        Eliminar
                    </button>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = tasksHtml;
}

// Mostrar modal para crear nueva tarea
function showCreateTaskModal() {
    currentTask = null;
    document.getElementById('taskModalTitle').textContent = 'Nueva Tarea';
    document.getElementById('taskForm').reset();
    document.getElementById('taskModal').style.display = 'block';
}

// Mostrar modal para editar tarea
function showEditTaskModal(taskId) {
    currentTask = tasksData.find(task => task.id_tarea === taskId);
    if (!currentTask) return;
    
    document.getElementById('taskModalTitle').textContent = 'Editar Tarea';
    document.getElementById('taskName').value = currentTask.nombre;
    document.getElementById('taskDescription').value = currentTask.descripcion || '';
    document.getElementById('taskPriority').value = currentTask.prioridad;
    document.getElementById('taskStatus').value = currentTask.estado;
    document.getElementById('taskStartDate').value = currentTask.fecha_inicio || '';
    document.getElementById('taskEndDate').value = currentTask.fecha_fin || '';
    document.getElementById('taskHours').value = currentTask.horas_estimadas || '';
    document.getElementById('taskProgress').value = currentTask.progreso_porcentaje || 0;
    document.getElementById('taskObservations').value = currentTask.observaciones || '';
    
    document.getElementById('taskModal').style.display = 'block';
}

// Manejar envío del formulario de tarea
document.getElementById('taskForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        nombre: document.getElementById('taskName').value.trim(),
        descripcion: document.getElementById('taskDescription').value.trim() || null,
        prioridad: document.getElementById('taskPriority').value,
        estado: document.getElementById('taskStatus').value,
        fecha_inicio: document.getElementById('taskStartDate').value || null,
        fecha_fin: document.getElementById('taskEndDate').value || null,
        horas_estimadas: parseFloat(document.getElementById('taskHours').value) || null,
        progreso_porcentaje: parseFloat(document.getElementById('taskProgress').value) || 0,
        observaciones: document.getElementById('taskObservations').value.trim() || null
    };
    
    try {
        let response;
        
        if (currentTask) {
            // Actualizar tarea existente
            response = await fetch(`/api/tasks/${currentTask.id_tarea}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Crear nueva tarea
            formData.id_fase = currentPhase.id_fase;
            response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(formData)
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al guardar la tarea');
        }
        
        showAlert(currentTask ? 'Tarea actualizada exitosamente' : 'Tarea creada exitosamente', 'success');
        closeTaskModal();
        await loadPhaseTasks(currentPhase.id_fase);
        
    } catch (error) {
        console.error('Error guardando tarea:', error);
        showAlert(error.message, 'error');
    }
});

// Marcar tarea como completada
async function markTaskCompleted(taskId) {
    if (!confirm('¿Está seguro de marcar esta tarea como completada?')) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                estado: 'completada',
                progreso_porcentaje: 100
            })
        });
        
        if (!response.ok) {
            throw new Error('Error al completar la tarea');
        }
        
        showAlert('Tarea marcada como completada', 'success');
        await loadPhaseTasks(currentPhase.id_fase);
        
    } catch (error) {
        console.error('Error completando tarea:', error);
        showAlert('Error al completar la tarea', 'error');
    }
}

// Eliminar tarea
async function deleteTask(taskId) {
    if (!confirm('¿Está seguro de eliminar esta tarea? Esta acción no se puede deshacer.')) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al eliminar la tarea');
        }
        
        showAlert('Tarea eliminada exitosamente', 'success');
        await loadPhaseTasks(currentPhase.id_fase);
        
    } catch (error) {
        console.error('Error eliminando tarea:', error);
        showAlert(error.message, 'error');
    }
}

// Mostrar modal de gestión de asignaciones
function showAssignmentModal() {
    if (tasksData.length === 0) {
        showAlert('Primero debe crear tareas para poder asignar personal', 'warning');
        return;
    }
    
    const content = document.getElementById('assignmentContent');
    content.innerHTML = `
        <div class="form-group">
            <label>Seleccionar Tarea:</label>
            <select id="assignmentTaskSelect" class="form-control" onchange="loadTaskAssignments()">
                <option value="">Seleccione una tarea...</option>
                ${tasksData.map(task => `
                    <option value="${task.id_tarea}">${task.nombre}</option>
                `).join('')}
            </select>
        </div>
        <div id="assignmentDetails" style="display: none;">
            <h4>Asignaciones Actuales</h4>
            <div id="currentAssignments"></div>
            <h4>Nueva Asignación</h4>
            <form id="assignmentForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="assignmentUser">Usuario:</label>
                        <select id="assignmentUser" class="form-control" required>
                            <option value="">Seleccione usuario...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="assignmentRole">Rol:</label>
                        <select id="assignmentRole" class="form-control" required>
                            <option value="">Seleccione rol...</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="assignmentStartDate">Fecha Inicio:</label>
                        <input type="date" id="assignmentStartDate" class="form-control">
                    </div>
                    <div class="form-group">
                        <label for="assignmentEndDate">Fecha Fin:</label>
                        <input type="date" id="assignmentEndDate" class="form-control">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label for="assignmentHours">Horas Asignadas:</label>
                        <input type="number" id="assignmentHours" class="form-control" min="0" step="0.5">
                    </div>
                    <div class="form-group">
                        <label for="assignmentDedication">% Dedicación:</label>
                        <input type="number" id="assignmentDedication" class="form-control" min="0" max="100" value="100">
                    </div>
                </div>
                <div class="form-group">
                    <label for="assignmentObservations">Observaciones:</label>
                    <textarea id="assignmentObservations" class="form-control" rows="2"></textarea>
                </div>
                <button type="submit" class="btn btn-success">Crear Asignación</button>
            </form>
        </div>
    `;
    
    document.getElementById('assignmentModal').style.display = 'block';
    loadUsers();
    loadRoles();
}

// Cargar usuarios activos
async function loadUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            const users = result.data.users.filter(user => user.activo);
            
            const select = document.getElementById('assignmentUser');
            select.innerHTML = '<option value="">Seleccione usuario...</option>' +
                users.map(user => `
                    <option value="${user.id_usuario}">${user.nombre} ${user.apellido} (${user.rol})</option>
                `).join('');
        }
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

// Cargar roles de tarea
async function loadRoles() {
    try {
        // Por simplicidad, usar roles predefinidos
        const roles = [
            { id: 1, nombre: 'Responsable' },
            { id: 2, nombre: 'Colaborador' },
            { id: 3, nombre: 'Supervisor' },
            { id: 4, nombre: 'Especialista' }
        ];
        
        const select = document.getElementById('assignmentRole');
        select.innerHTML = '<option value="">Seleccione rol...</option>' +
            roles.map(role => `
                <option value="${role.id}">${role.nombre}</option>
            `).join('');
    } catch (error) {
        console.error('Error cargando roles:', error);
    }
}

// Cargar asignaciones de una tarea específica
async function loadTaskAssignments() {
    const taskId = document.getElementById('assignmentTaskSelect').value;
    if (!taskId) {
        document.getElementById('assignmentDetails').style.display = 'none';
        return;
    }
    
    document.getElementById('assignmentDetails').style.display = 'block';
    
    // Por simplicidad, mostrar mensaje básico
    document.getElementById('currentAssignments').innerHTML = `
        <p>Funcionalidad de visualización de asignaciones en desarrollo.</p>
        <p>Use el formulario para crear nuevas asignaciones.</p>
    `;
}

// Exportar reporte de tareas
function exportTasksReport() {
    if (tasksData.length === 0) {
        showAlert('No hay tareas para exportar', 'warning');
        return;
    }
    
    const reportContent = `
REPORTE DE TAREAS - ${currentPhase.proyecto_nombre}
FASE: ${currentPhase.nombre}
=================================================

ESTADÍSTICAS GENERALES:
- Total de Tareas: ${tasksData.length}
- Tareas Completadas: ${tasksData.filter(t => t.estado === 'completada').length}
- Tareas En Progreso: ${tasksData.filter(t => t.estado === 'en_progreso').length}
- Tareas Pendientes: ${tasksData.filter(t => t.estado === 'pendiente').length}

DETALLE DE TAREAS:
${tasksData.map(task => `
- ${task.nombre}
  Estado: ${getStatusText(task.estado)}
  Prioridad: ${getPriorityText(task.prioridad)}
  Progreso: ${task.progreso_porcentaje}%
  Horas: ${task.horas_reales || 0}/${task.horas_estimadas || 0}
  Asignados: ${task.asignados_info}
  ${task.fecha_inicio ? `Inicio: ${formatDate(task.fecha_inicio)}` : ''}
  ${task.fecha_fin ? `Fin: ${formatDate(task.fecha_fin)}` : ''}
  ${task.descripcion ? `Descripción: ${task.descripcion}` : ''}
`).join('\n')}

Reporte generado el: ${new Date().toLocaleString('es-ES')}
    `.trim();
    
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_tareas_${currentPhase.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showAlert('Reporte exportado exitosamente', 'success');
}

// Cerrar modales
function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
}

function closeAssignmentModal() {
    document.getElementById('assignmentModal').style.display = 'none';
}

// Funciones auxiliares
function getPriorityText(priority) {
    const priorities = {
        'baja': 'Baja',
        'media': 'Media',
        'alta': 'Alta',
        'critica': 'Crítica'
    };
    return priorities[priority] || priority;
}

function getStatusText(status) {
    const statuses = {
        'pendiente': 'Pendiente',
        'en_progreso': 'En Progreso',
        'completada': 'Completada',
        'suspendida': 'Suspendida',
        'cancelada': 'Cancelada'
    };
    return statuses[status] || status;
}

function getProgressClass(progress) {
    if (progress >= 90) return 'success';
    if (progress >= 75) return '';
    if (progress >= 50) return 'warning';
    return 'danger';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES');
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

function goBack() {
    if (currentPhase) {
        window.location.href = `phases.html?projectId=${currentPhase.id_proyecto}`;
    } else {
        window.location.href = 'dashboard.html';
    }
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const taskModal = document.getElementById('taskModal');
    const assignmentModal = document.getElementById('assignmentModal');
    
    if (event.target === taskModal) {
        closeTaskModal();
    }
    if (event.target === assignmentModal) {
        closeAssignmentModal();
    }
}