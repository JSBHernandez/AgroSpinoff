// Gestión de Presupuestos - JavaScript
let currentProject = null;
let budgetData = null;

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
    
    await loadProjectBudget(projectId);
});

// Cargar información completa del presupuesto del proyecto
async function loadProjectBudget(projectId) {
    try {
        const response = await fetch(`/api/budgets/project/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar información del presupuesto');
        }
        
        const result = await response.json();
        budgetData = result.data;
        currentProject = { id_proyecto: projectId };
        
        renderBudgetInfo();
        
    } catch (error) {
        console.error('Error cargando presupuesto:', error);
        showAlert('Error al cargar la información del presupuesto', 'error');
    }
}

// Renderizar información del presupuesto
function renderBudgetInfo() {
    const { proyecto, limites_financieros, fases, historial_cambios, alertas } = budgetData;

    // Actualizar header
    document.getElementById('projectTitle').textContent = `Gestión de Presupuestos - ${proyecto.nombre}`;

    // Actualizar estadísticas
    document.getElementById('totalBudget').textContent = formatCurrency(proyecto.presupuesto_total);
    document.getElementById('totalSpent').textContent = formatCurrency(proyecto.total_gastado);
    document.getElementById('remainingBudget').textContent = formatCurrency(proyecto.presupuesto_restante);
    document.getElementById('usagePercentage').textContent = `${proyecto.porcentaje_usado.toFixed(1)}%`;

    // Actualizar barra de progreso
    const progressFill = document.getElementById('progressFill');
    progressFill.style.width = `${Math.min(proyecto.porcentaje_usado, 100)}%`;
    
    if (proyecto.porcentaje_usado >= 90) {
        progressFill.className = 'progress-fill danger';
    } else if (proyecto.porcentaje_usado >= 75) {
        progressFill.className = 'progress-fill warning';
    } else {
        progressFill.className = 'progress-fill';
    }

    // Mostrar alertas
    renderAlerts(alertas);

    // Renderizar fases
    renderPhaseBudgets(fases);

    // Renderizar historial
    renderBudgetHistory(historial_cambios);

    // Renderizar límites actuales
    renderCurrentLimits(limites_financieros);
}

// Renderizar alertas
function renderAlerts(alertas) {
    const alertContainer = document.getElementById('alertContainer');
    
    if (alertas.length === 0) {
        alertContainer.innerHTML = '';
        return;
    }

    const alertsHtml = alertas.map(alerta => {
        const alertClass = alerta.severidad === 'alta' ? 'alert-danger' : 
                          alerta.severidad === 'media' ? 'alert-warning' : 'alert-success';
        
        return `
            <div class="alert ${alertClass}">
                <strong>${alerta.tipo.replace('_', ' ').toUpperCase()}:</strong> ${alerta.mensaje}
            </div>
        `;
    }).join('');

    alertContainer.innerHTML = alertsHtml;
}

// Renderizar presupuestos por fase
function renderPhaseBudgets(fases) {
    const container = document.getElementById('phaseBudgets');
    
    if (fases.length === 0) {
        container.innerHTML = '<p>No hay fases definidas para este proyecto.</p>';
        return;
    }

    const phasesHtml = fases.map(fase => `
        <div class="phase-budget-item">
            <div>
                <strong>${fase.nombre}</strong>
                <br>
                <small>Estado: ${getStatusText(fase.estado_fase)}</small>
            </div>
            <div style="text-align: right;">
                <div>${formatCurrency(fase.presupuesto_fase)}</div>
                <button onclick="showUpdatePhaseBudgetModal(${fase.id_fase}, '${fase.nombre}', ${fase.presupuesto_fase})" 
                        class="btn btn-primary" style="font-size: 12px; padding: 5px 10px; margin-top: 5px;">
                    Editar
                </button>
            </div>
        </div>
    `).join('');

    container.innerHTML = phasesHtml;
}

// Renderizar historial de cambios
function renderBudgetHistory(historial) {
    const container = document.getElementById('budgetHistory');
    
    if (historial.length === 0) {
        container.innerHTML = '<p>No hay cambios registrados.</p>';
        return;
    }

    const historyHtml = historial.slice(0, 10).map(cambio => {
        const isPositive = cambio.diferencia > 0;
        const changeClass = isPositive ? 'change-positive' : 'change-negative';
        const changeIcon = isPositive ? '+' : '';
        
        return `
            <div class="history-item">
                <div class="history-meta">
                    <strong>${cambio.entidad_nombre}</strong>
                    <span class="budget-change ${changeClass}">
                        ${changeIcon}${formatCurrency(cambio.diferencia)}
                    </span>
                </div>
                <div class="history-details">
                    <div>Por: ${cambio.usuario_nombre} | ${formatDateTime(cambio.fecha_cambio)}</div>
                    ${cambio.motivo_cambio ? `<div><em>Motivo: ${cambio.motivo_cambio}</em></div>` : ''}
                    <div>
                        <small>
                            ${formatCurrency(cambio.valor_anterior)} → ${formatCurrency(cambio.valor_nuevo)}
                        </small>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = historyHtml;
}

// Renderizar límites financieros actuales
function renderCurrentLimits(limites) {
    const container = document.getElementById('currentLimits');
    
    if (!limites) {
        container.innerHTML = `
            <p>No hay límites financieros configurados.</p>
            <button onclick="showLimitsModal()" class="btn btn-warning">
                Configurar Límites
            </button>
        `;
        return;
    }

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div>
                <strong>Presupuesto Máximo Total:</strong><br>
                ${formatCurrency(limites.presupuesto_maximo_total)}
            </div>
            <div>
                <strong>Presupuesto Máximo por Fase:</strong><br>
                ${limites.presupuesto_maximo_fase ? formatCurrency(limites.presupuesto_maximo_fase) : 'No definido'}
            </div>
            <div>
                <strong>Margen de Variación:</strong><br>
                ${limites.margen_variacion_porcentaje}%
            </div>
            <div>
                <strong>Definido por:</strong><br>
                ${formatDateTime(limites.fecha_definicion)}
            </div>
        </div>
        ${limites.observaciones ? `
            <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                <strong>Observaciones:</strong><br>
                ${limites.observaciones}
            </div>
        ` : ''}
        <div style="margin-top: 15px;">
            <button onclick="showLimitsModal()" class="btn btn-warning">
                Actualizar Límites
            </button>
        </div>
    `;
}

// Mostrar modal para actualizar presupuesto total
function showUpdateBudgetModal() {
    document.getElementById('currentBudgetDisplay').value = formatCurrency(budgetData.proyecto.presupuesto_total);
    document.getElementById('newBudget').value = budgetData.proyecto.presupuesto_total;
    document.getElementById('changeReason').value = '';
    
    document.getElementById('budgetModal').style.display = 'block';
}

// Mostrar modal para actualizar presupuesto de fase
function showUpdatePhaseBudgetModal(phaseId, phaseName, currentBudget) {
    // Por simplicidad, usar prompt para fases individuales
    const newBudget = prompt(`Nuevo presupuesto para la fase "${phaseName}":`, currentBudget);
    
    if (newBudget === null || newBudget === '') return;
    
    const motivo = prompt('Motivo del cambio de presupuesto:');
    
    if (motivo === null || motivo.trim() === '') {
        alert('Debe especificar un motivo para el cambio');
        return;
    }

    updatePhaseBudget(phaseId, parseFloat(newBudget), motivo);
}

// Mostrar modal para configurar límites
function showLimitsModal() {
    if (budgetData.limites_financieros) {
        document.getElementById('maxTotalBudget').value = budgetData.limites_financieros.presupuesto_maximo_total;
        document.getElementById('maxPhaseBudget').value = budgetData.limites_financieros.presupuesto_maximo_fase || '';
        document.getElementById('variationMargin').value = budgetData.limites_financieros.margen_variacion_porcentaje;
        document.getElementById('limitsObservations').value = budgetData.limites_financieros.observaciones || '';
    } else {
        document.getElementById('limitsForm').reset();
        document.getElementById('variationMargin').value = 10;
    }
    
    document.getElementById('limitsModal').style.display = 'block';
}

// Manejar envío de formulario de presupuesto
document.getElementById('budgetForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const newBudget = parseFloat(document.getElementById('newBudget').value);
    const reason = document.getElementById('changeReason').value.trim();
    
    if (newBudget === budgetData.proyecto.presupuesto_total) {
        showAlert('El nuevo presupuesto debe ser diferente al actual', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/budgets/project/${currentProject.id_proyecto}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                presupuesto_total: newBudget,
                motivo_cambio: reason
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al actualizar presupuesto');
        }
        
        showAlert('Presupuesto actualizado exitosamente', 'success');
        closeBudgetModal();
        await loadProjectBudget(currentProject.id_proyecto);
        
    } catch (error) {
        console.error('Error actualizando presupuesto:', error);
        showAlert(error.message, 'error');
    }
});

// Manejar envío de formulario de límites
document.getElementById('limitsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = {
        id_proyecto: currentProject.id_proyecto,
        presupuesto_maximo_total: parseFloat(document.getElementById('maxTotalBudget').value),
        presupuesto_maximo_fase: document.getElementById('maxPhaseBudget').value ? 
                                parseFloat(document.getElementById('maxPhaseBudget').value) : null,
        margen_variacion_porcentaje: parseFloat(document.getElementById('variationMargin').value),
        observaciones: document.getElementById('limitsObservations').value.trim() || null
    };
    
    try {
        const response = await fetch('/api/budgets/limits', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al configurar límites');
        }
        
        showAlert('Límites financieros configurados exitosamente', 'success');
        closeLimitsModal();
        await loadProjectBudget(currentProject.id_proyecto);
        
    } catch (error) {
        console.error('Error configurando límites:', error);
        showAlert(error.message, 'error');
    }
});

// Actualizar presupuesto de fase
async function updatePhaseBudget(phaseId, newBudget, motivo) {
    try {
        const response = await fetch(`/api/budgets/phase/${phaseId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                presupuesto_fase: newBudget,
                motivo_cambio: motivo
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al actualizar presupuesto de fase');
        }
        
        showAlert('Presupuesto de fase actualizado exitosamente', 'success');
        await loadProjectBudget(currentProject.id_proyecto);
        
    } catch (error) {
        console.error('Error actualizando presupuesto de fase:', error);
        showAlert(error.message, 'error');
    }
}

// Exportar reporte
function exportReport() {
    if (!budgetData) return;
    
    // Crear contenido del reporte
    const reportContent = `
REPORTE DE PRESUPUESTO - ${budgetData.proyecto.nombre}
=================================================

RESUMEN FINANCIERO:
- Presupuesto Total: ${formatCurrency(budgetData.proyecto.presupuesto_total)}
- Total Gastado: ${formatCurrency(budgetData.proyecto.total_gastado)}
- Presupuesto Restante: ${formatCurrency(budgetData.proyecto.presupuesto_restante)}
- Porcentaje Usado: ${budgetData.proyecto.porcentaje_usado.toFixed(1)}%

PRESUPUESTO POR FASES:
${budgetData.fases.map(fase => 
    `- ${fase.nombre}: ${formatCurrency(fase.presupuesto_fase)} (Estado: ${getStatusText(fase.estado_fase)})`
).join('\n')}

LÍMITES FINANCIEROS:
${budgetData.limites_financieros ? `
- Presupuesto Máximo Total: ${formatCurrency(budgetData.limites_financieros.presupuesto_maximo_total)}
- Presupuesto Máximo por Fase: ${budgetData.limites_financieros.presupuesto_maximo_fase ? formatCurrency(budgetData.limites_financieros.presupuesto_maximo_fase) : 'No definido'}
- Margen de Variación: ${budgetData.limites_financieros.margen_variacion_porcentaje}%
` : 'No hay límites financieros configurados'}

HISTORIAL DE CAMBIOS RECIENTES:
${budgetData.historial_cambios.slice(0, 10).map(cambio => 
    `- ${formatDateTime(cambio.fecha_cambio)}: ${cambio.entidad_nombre} - ${formatCurrency(cambio.diferencia)} (${cambio.usuario_nombre})`
).join('\n')}

Reporte generado el: ${new Date().toLocaleString('es-ES')}
    `.trim();
    
    // Crear y descargar archivo
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_presupuesto_${budgetData.proyecto.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showAlert('Reporte exportado exitosamente', 'success');
}

// Cerrar modales
function closeBudgetModal() {
    document.getElementById('budgetModal').style.display = 'none';
}

function closeLimitsModal() {
    document.getElementById('limitsModal').style.display = 'none';
}

// Funciones auxiliares
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0.00';
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    }).format(amount);
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-ES');
}

function getStatusText(status) {
    const statusMap = {
        'pendiente': 'Pendiente',
        'en_progreso': 'En Progreso',
        'completada': 'Completada',
        'suspendida': 'Suspendida'
    };
    return statusMap[status] || status;
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
    window.location.href = 'dashboard.html';
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    const budgetModal = document.getElementById('budgetModal');
    const limitsModal = document.getElementById('limitsModal');
    
    if (event.target === budgetModal) {
        closeBudgetModal();
    }
    if (event.target === limitsModal) {
        closeLimitsModal();
    }
}