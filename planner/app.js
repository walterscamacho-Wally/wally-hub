// ─────────────────────────────────────────────
// CONFIGURACIÓN Y ESTADO
// ─────────────────────────────────────────────
const CLIENTS_KEY = 'plannerPro_clients';
const DATA_PREFIX  = 'plannerPro_data_';

let clients  = [];       
let clientId = null;     
let clientData = { tasks: [], metrics: [], productionHTML: '' };     

let currentMonth = new Date().getMonth();
let currentYear  = new Date().getFullYear();
let metricsChart = null;
let distChart = null;

const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Pinterest', 'X / Twitter'];
const TYPES = ['Educativo', 'Inspirador', 'Informativo', 'Entretenimiento', 'Motivacional', 'Conversacional', 'Experiencial', 'Prueba social', 'Autoridad', 'Comercial'];
const STATUS_STYLES = {
    'Idea': { bg: '#fee2e2', text: '#b91c1c', label: 'Sin empezar' },
    'Progreso': { bg: '#fef3c7', text: '#b45309', label: 'En proceso' },
    'Hecho': { bg: '#dcfce7', text: '#15803d', label: 'Publicado' }
};

// ─────────────────────────────────────────────
// INICIO
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initModals();
    initCalendarControls();
    initProductionSheet();
    loadClients();
});

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.target);
            target.classList.add('active');
            
            // Re-renderizar si es necesario
            if (tab.dataset.target === 'vista-mensual') renderMonthly();
            if (tab.dataset.target === 'vista-editorial') renderEditorial();
            if (tab.dataset.target === 'vista-metricas') renderMetrics();
            if (tab.dataset.target === 'vista-produccion') loadProductionSheet();
        };
    });
}

// ─────────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────────
function loadClients() {
    clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
    if (clients.length === 0) {
        const defaultClient = { id: 'default', name: 'Mi Cuenta', color: '#3b82f6', platforms: PLATFORMS.join(', ') };
        clients.push(defaultClient);
        saveClients();
    }
    clientId = clients[0].id;
    renderClientSelector();
    activateClient(clientId);
}

function saveClients() { localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients)); }

function renderClientSelector() {
    const sel = document.getElementById('clientSelector');
    sel.innerHTML = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    sel.value = clientId;
    sel.onchange = () => activateClient(sel.value);
}

function activateClient(id) {
    clientId = id;
    const raw = localStorage.getItem(DATA_PREFIX + id);
    clientData = raw ? JSON.parse(raw) : { tasks: [], metrics: [], productionHTML: '' };
    
    const client = clients.find(c => c.id === id);
    document.getElementById('clientAvatar').textContent = client.name.charAt(0);
    document.getElementById('clientAvatar').style.background = client.color || '#3b82f6';
    
    updateFormSelects(client.platforms);
    refreshActiveView();
}

function refreshActiveView() {
    const activeTab = document.querySelector('.tab.active').dataset.target;
    if (activeTab === 'vista-mensual') renderMonthly();
    if (activeTab === 'vista-editorial') renderEditorial();
    if (activeTab === 'vista-metricas') renderMetrics();
    if (activeTab === 'vista-produccion') loadProductionSheet();
}

function updateFormSelects(platformsStr) {
    const pList = (platformsStr || '').split(',').map(p => p.trim()).filter(Boolean);
    const pSel = document.getElementById('taskPlatform');
    pSel.innerHTML = pList.map(p => `<option value="${p}">${p}</option>`).join('');
    
    const tSel = document.getElementById('taskType');
    tSel.innerHTML = TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
}

// ─────────────────────────────────────────────
// RENDER: CALENDARIO MENSUAL (IMAGEN 1)
// ─────────────────────────────────────────────
function renderMonthly() {
    const container = document.getElementById('monthlyCells');
    container.innerHTML = '';
    
    const months = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
    document.getElementById('month-title').textContent = `${months[currentMonth]} ${currentYear}`;

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Celdas mes anterior
    const prevDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
        container.innerHTML += `<div class="day-cell other-month"><div class="day-num">${prevDays - i}</div></div>`;
    }

    // Celdas mes actual
    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const tasks = clientData.tasks.filter(t => t.date === dateStr);
        const isToday = (d === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear());
        
        const tasksHtml = tasks.map(t => {
            const style = STATUS_STYLES[t.status] || STATUS_STYLES['Idea'];
            return `<div class="cell-post" style="background:${style.bg}; color:${style.text}" onclick="event.stopPropagation(); editTask('${t.id}')">${t.title}</div>`;
        }).join('');

        container.innerHTML += `
            <div class="day-cell ${isToday ? 'today' : ''}" onclick="openNewPostWithDate('${dateStr}')">
                <div class="day-num">${d}</div>
                ${tasksHtml}
            </div>
        `;
    }
}

function initCalendarControls() {
    document.getElementById('prevMonth').onclick = () => { currentMonth--; if(currentMonth<0){currentMonth=11;currentYear--;} renderMonthly(); };
    document.getElementById('nextMonth').onclick = () => { currentMonth++; if(currentMonth>11){currentMonth=0;currentYear++;} renderMonthly(); };
}

// ─────────────────────────────────────────────
// RENDER: EDITORIAL (IMAGEN 4)
// ─────────────────────────────────────────────
function renderEditorial() {
    const container = document.getElementById('weeklyContent');
    container.innerHTML = '';

    renderDistributionChart();

    // Agrupar por semana
    const weeks = {};
    clientData.tasks.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date + 'T12:00:00');
        if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear) return;
        
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        if (!weeks[weekKey]) weeks[weekKey] = [];
        weeks[weekKey].push(t);
    });

    const weekKeys = Object.keys(weeks).sort();
    if (weekKeys.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8">No hay contenido programado para este mes en la vista editorial.</div>';
        return;
    }

    weekKeys.forEach((wk, i) => {
        const block = document.createElement('div');
        block.className = 'week-block';
        block.innerHTML = `<h4>Semana ${i + 1} (${new Date(wk+'T12:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'short'})})</h4>`;
        
        const grid = document.createElement('div');
        grid.className = 'week-grid';
        weeks[wk].forEach(task => grid.appendChild(createEditorialCard(task)));
        
        block.appendChild(grid);
        container.appendChild(block);
    });
}

function createEditorialCard(task) {
    const card = document.createElement('div');
    card.className = 'post-card-xl';
    card.onclick = () => editTask(task.id);
    
    const style = STATUS_STYLES[task.status] || STATUS_STYLES['Idea'];
    const dateLabel = new Date(task.date + 'T12:00:00').toLocaleDateString('es-ES', {weekday:'long', day:'numeric'});

    card.innerHTML = `
        <div class="pc-header">
            <span>${dateLabel.toUpperCase()}</span>
            <span style="color:var(--excel-accent)">${task.platform}</span>
        </div>
        <div class="pc-img">
            ${task.image ? `<img src="${task.image}">` : `<div style="height:100%; display:grid; place-items:center; color:#cbd5e1; font-size:2rem">🖼️</div>`}
        </div>
        <div class="pc-body">
            <div class="pc-title">${task.title}</div>
            <div class="pc-info">
                <div><strong>Tipo:</strong> ${task.type}</div>
                <div><strong>CTA:</strong> ${task.cta || '-'}</div>
            </div>
        </div>
        <div class="pc-footer">
            <span class="pc-status" style="background:${style.bg}; color:${style.text}">${style.label}</span>
            <button class="icon-btn" onclick="event.stopPropagation(); deleteTask('${task.id}')">🗑️</button>
        </div>
    `;
    return card;
}

function renderDistributionChart() {
    const counts = {};
    TYPES.forEach(t => counts[t] = 0);
    clientData.tasks.forEach(t => { if(counts[t.type] !== undefined) counts[t.type]++; });

    const ctx = document.getElementById('distChart').getContext('2d');
    if (distChart) distChart.destroy();
    distChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{ data: Object.values(counts), backgroundColor: ['#3b82f6', '#8b5cf6', '#0ea5e9', '#f43f5e', '#f59e0b', '#d946ef', '#10b981', '#6366f1', '#f97316', '#475569'] }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, cutout: '70%' }
    });
}

// ─────────────────────────────────────────────
// MODALES Y CRUD
// ─────────────────────────────────────────────
function initModals() {
    document.querySelectorAll('.close-modal').forEach(btn => btn.onclick = () => document.getElementById(btn.dataset.modal).style.display = 'none');
    
    document.getElementById('btnNuevoPost').onclick = () => {
        document.getElementById('formTarea').reset();
        document.getElementById('taskId').value = '';
        document.getElementById('taskDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('modalTaskTitle').textContent = 'Crear Nuevo Post';
        document.getElementById('modalTarea').style.display = 'block';
    };

    document.getElementById('formTarea').onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('taskId').value || Date.now().toString();
        const task = {
            id,
            title: document.getElementById('taskTitle').value,
            date: document.getElementById('taskDate').value,
            platform: document.getElementById('taskPlatform').value,
            type: document.getElementById('taskType').value,
            status: document.getElementById('taskStatus').value,
            copy: document.getElementById('taskCopy').value,
            cta: document.getElementById('taskCta').value,
            hashtags: document.getElementById('taskHashtags').value,
            image: document.getElementById('taskImage').value
        };

        const idx = clientData.tasks.findIndex(t => t.id === id);
        if (idx > -1) clientData.tasks[idx] = task; else clientData.tasks.push(task);
        
        saveClientData();
        document.getElementById('modalTarea').style.display = 'none';
        refreshActiveView();
    };

    // Cliente Modal
    document.getElementById('btnNewClient').onclick = () => {
        document.getElementById('formCliente').reset();
        document.getElementById('clientId').value = '';
        document.getElementById('modalCliente').style.display = 'block';
    };
    document.getElementById('btnEditClient').onclick = () => {
        const client = clients.find(c => c.id === clientId);
        document.getElementById('clientId').value = client.id;
        document.getElementById('clientName').value = client.name;
        document.getElementById('clientColor').value = client.color;
        document.getElementById('clientPlatforms').value = client.platforms;
        document.getElementById('clientGuidelines').value = client.guidelines || '';
        document.getElementById('modalCliente').style.display = 'block';
    };
    document.getElementById('formCliente').onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('clientId').value || 'client_' + Date.now();
        const client = {
            id,
            name: document.getElementById('clientName').value,
            color: document.getElementById('clientColor').value,
            platforms: document.getElementById('clientPlatforms').value,
            guidelines: document.getElementById('clientGuidelines').value
        };
        const idx = clients.findIndex(c => c.id === id);
        if (idx > -1) clients[idx] = client; else clients.push(client);
        saveClients();
        renderClientSelector();
        activateClient(id);
        document.getElementById('modalCliente').style.display = 'none';
    };
}

window.openNewPostWithDate = (date) => {
    document.getElementById('formTarea').reset();
    document.getElementById('taskId').value = '';
    document.getElementById('taskDate').value = date;
    document.getElementById('modalTaskTitle').textContent = 'Crear Post para ' + date;
    document.getElementById('modalTarea').style.display = 'block';
};

window.editTask = (id) => {
    const t = clientData.tasks.find(x => x.id === id);
    if (!t) return;
    document.getElementById('taskId').value = t.id;
    document.getElementById('taskTitle').value = t.title;
    document.getElementById('taskDate').value = t.date;
    document.getElementById('taskPlatform').value = t.platform;
    document.getElementById('taskType').value = t.type;
    document.getElementById('taskStatus').value = t.status;
    document.getElementById('taskCopy').value = t.copy || '';
    document.getElementById('taskCta').value = t.cta || '';
    document.getElementById('taskHashtags').value = t.hashtags || '';
    document.getElementById('taskImage').value = t.image || '';
    document.getElementById('modalTaskTitle').textContent = 'Editar Contenido';
    document.getElementById('modalTarea').style.display = 'block';
};

window.deleteTask = (id) => {
    if (!confirm('¿Borrar este post?')) return;
    clientData.tasks = clientData.tasks.filter(t => t.id !== id);
    saveClientData();
    refreshActiveView();
};

function saveClientData() { localStorage.setItem(DATA_PREFIX + clientId, JSON.stringify(clientData)); }

// ─────────────────────────────────────────────
// MÉTRICAS
// ─────────────────────────────────────────────
function renderMetrics() {
    const tbody = document.querySelector('#metricsTable tbody');
    tbody.innerHTML = (clientData.metrics || []).map(m => `
        <tr>
            <td><strong>${m.label}</strong></td>
            <td>${m.followers}</td>
            <td>${m.reach}</td>
            <td><button class="icon-btn" onclick="deleteMetric('${m.id}')">🗑️</button></td>
        </tr>
    `).join('');
    
    const ctx = document.getElementById('growthChart').getContext('2d');
    if (metricsChart) metricsChart.destroy();
    metricsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: (clientData.metrics || []).map(m => m.label),
            datasets: [{ label: 'Seguidores', data: (clientData.metrics || []).map(m => m.followers), borderColor: '#3b82f6', tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}
document.getElementById('btnNuevaMetrica').onclick = () => {
    const label = prompt('Mes y Año (Ej: Mayo 2026):');
    const followers = prompt('Seguidores totales:');
    if(label && followers) {
        clientData.metrics.push({ id: Date.now().toString(), label, followers, reach: 0 });
        saveClientData();
        renderMetrics();
    }
};
window.deleteMetric = (id) => {
    clientData.metrics = clientData.metrics.filter(m => m.id !== id);
    saveClientData();
    renderMetrics();
};

// ─────────────────────────────────────────────
// PLANILLA DE PRODUCCIÓN
// ─────────────────────────────────────────────
function initProductionSheet() {
    const tbody = document.getElementById('productionBody');
    // Guardar cambios automáticamente al dejar de escribir
    tbody.addEventListener('blur', () => {
        clientData.productionHTML = tbody.innerHTML;
        saveClientData();
    }, true);
    
    document.getElementById('btnPrint').onclick = () => window.print();

    // Historial para Deshacer
    let historyStack = [];
    const btnUndo = document.getElementById('btnUndo');
    
    function saveHistory() {
        historyStack.push(tbody.innerHTML);
        if (historyStack.length > 5) historyStack.shift();
        btnUndo.style.display = 'inline-block';
    }

    btnUndo.onclick = () => {
        if (historyStack.length > 0) {
            tbody.innerHTML = historyStack.pop();
            clientData.productionHTML = tbody.innerHTML;
            saveClientData();
            if (historyStack.length === 0) btnUndo.style.display = 'none';
        }
    };

    // Botón de Sugerir Siguiente Semana
    document.getElementById('btnNextWeek').onclick = () => {
        const client = clients.find(c => c.id === clientId);
        const rules = client.guidelines ? client.guidelines : "Ninguna regla específica registrada.";
        
        // Solo copiamos el prompt, ya no agregamos la plantilla vacía para evitar duplicados
        const promptText = `Ayúdame a generar 7 ideas de contenido para la próxima semana para el cliente "${client.name}".

DIRECTRICES DE LA MARCA:
${rules}

INSTRUCCIONES DE FORMATO:
1. Entrégame el contenido en una sola tabla Markdown lista para copiar. Debe tener exactamente 8 columnas: Semana/Día | Formato | Tipo/Título | Gancho | Material/Escenas | Texto en Pantalla | Copy (Caption) | Música.
2. Si incluyes formatos de "Carrusel", al final de tu respuesta debes entregarme una SEGUNDA tabla aislada, exclusivamente con el formato: [Slide] | [Título] | [Frase] | [CTA] para que yo pueda exportarla a Canva Bulk Create.`;
        
        navigator.clipboard.writeText(promptText).then(() => {
            alert('¡Instrucción copiada al portapapeles!\n\nVe al chat de Antigravity, pega el texto y envíalo. Cuando la IA te responda, vuelve aquí y usa el botón "📋 Pegar de IA"');
        }).catch(err => {
            alert('Error al copiar al portapapeles. Dile a tu asistente: Genera la próxima semana para ' + client.name);
        });
    };

    // Limpiar Planilla
    document.getElementById('btnClearSheet').onclick = () => {
        if (confirm('¿Estás seguro de que quieres BORRAR TODA la planilla de producción actual? ¡Recuerda exportarla primero si quieres guardarla!')) {
            tbody.innerHTML = '';
            clientData.productionHTML = '';
            saveClientData();
        }
    };

    // Exportar CSV
    document.getElementById('btnExportCSV').onclick = () => {
        const rows = document.querySelectorAll('#productionTable tr');
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Agregar BOM para que Excel lea UTF-8 correctamente
        csvContent = "data:text/csv;charset=utf-8,\uFEFF";

        rows.forEach(row => {
            const cols = row.querySelectorAll('th, td');
            const rowData = Array.from(cols).map(col => {
                // Limpiar el texto: quitar saltos de línea HTML y limpiar comillas
                let text = col.innerText.replace(/(\r\n|\n|\r)/gm, " ");
                text = text.replace(/"/g, '""');
                return `"${text}"`;
            });
            csvContent += rowData.join(",") + "\r\n";
        });

        const client = clients.find(c => c.id === clientId);
        const dateStr = new Date().toISOString().split('T')[0];
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Produccion_${client.name}_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Pegar desde IA
    document.getElementById('btnPasteAI').onclick = () => {
        document.getElementById('aiPasteContent').innerHTML = '';
        document.getElementById('modalPaste').style.display = 'block';
    };

    document.getElementById('btnProcessPaste').onclick = () => {
        const pasteArea = document.getElementById('aiPasteContent');
        let htmlRows = '';

        // Estrategia 1: ¿El navegador pegó una tabla HTML real? (Lo más común al copiar del chat)
        const tables = pasteArea.querySelectorAll('table');
        if (tables.length > 0) {
            const rows = tables[0].querySelectorAll('tr');
            rows.forEach(row => {
                // Ignorar encabezados
                if (row.querySelector('th') || row.innerText.toLowerCase().includes('semana')) return;
                
                // Extraer el contenido de cada celda y limpiar estilos
                const cells = Array.from(row.querySelectorAll('td')).map(td => `<td>${td.innerHTML}</td>`);
                if (cells.length > 0) {
                    htmlRows += `<tr>${cells.join('')}</tr>`;
                }
            });
        } 
        // Estrategia 2: Fallback a texto plano (Markdown o TSV) si copiaron como texto sin formato
        else {
            const lines = pasteArea.innerText.split('\n');
            lines.forEach(line => {
                line = line.trim();
                if (!line) return;
                if (line.includes('|---') || line.includes('| :---') || line.includes('|:---')) return;

                let cells = [];
                if (line.includes('\t')) {
                    cells = line.split('\t').map(c => c.trim());
                } else if (line.includes('|')) {
                    cells = line.split('|').map(c => c.trim());
                    if (cells[0] === '') cells.shift();
                    if (cells[cells.length - 1] === '') cells.pop();
                } else {
                    return; 
                }

                if (cells.length > 0 && cells[0].toLowerCase().includes('semana')) return;

                if (cells.length > 0) {
                    const rowHtml = cells.map(cell => {
                        let c = cell.replace(/<br>/gi, '<br>');
                        c = c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        return `<td>${c}</td>`;
                    }).join('');
                    htmlRows += `<tr>${rowHtml}</tr>`;
                }
            });
        }

        if (htmlRows) {
            saveHistory();
            const headerRow = `<tr><td colspan="8" style="background:#f1f5f9; text-align:center;"><strong>--- NUEVA SEMANA A PLANIFICAR ---</strong></td></tr>`;
            tbody.innerHTML += headerRow + htmlRows;
            clientData.productionHTML = tbody.innerHTML;
            saveClientData();
            document.getElementById('modalPaste').style.display = 'none';
        } else {
            alert('No pude detectar una tabla válida. Asegúrate de seleccionar y copiar la tabla completa que generó la IA.');
        }
    };
}

function loadProductionSheet() {
    const tbody = document.getElementById('productionBody');
    if (clientData.productionHTML && clientData.productionHTML.trim() !== '') {
        tbody.innerHTML = clientData.productionHTML;
    } else {
        // Autocompletar con plantilla de Junio (Semana 1) para BailaConWally
        const template = `
            <tr>
                <td><strong>Junio<br>Semana 1<br>Lunes</strong></td>
                <td>Reel (Vertical)<br>+ IG / TikTok</td>
                <td>Educativo / Retención</td>
                <td>"3 errores que cometes al intentar aprender a bailar en casa y cómo solucionarlos hoy"</td>
                <td>1. Video bailando fluido con las chicas de la clase (dinámico).<br>2. Textos flotantes señalando los 3 errores.</td>
                <td><strong>Problema:</strong> Frustración al no coordinar.<br><strong>Solución:</strong> El método de cuenta de 8.<br><strong>CTA:</strong> Guarda este video para tu próxima práctica.</td>
                <td>¿Bailar en casa te frustra? 😅 Sigue este consejo clave. #BailaConWally #TipsDeBaile</td>
                <td>Trending track (Hip Hop chill).</td>
            </tr>
            <tr>
                <td><strong>Junio<br>Semana 1<br>Martes</strong></td>
                <td>Carrusel (5 slides)<br>+ IG</td>
                <td>Informativo / Beneficios</td>
                <td>"¿Sientes que tienes dos pies izquierdos? La ciencia dice lo contrario"</td>
                <td>Diseños Canva:<br>S1: Título llamativo<br>S2-4: Datos sobre neuroplasticidad y ritmo.<br>S5: CTA</td>
                <td>Slide a slide explicando cómo el cerebro aprende rutinas. Usa colores corporativos. <br><strong>CTA:</strong> ¿Qué ritmo te cuesta más? Comenta abajo.</td>
                <td>La neurociencia de aprender a bailar 🧠💃 #AprenderABailar #BailaConWally</td>
                <td>Audio en tendencia para Carruseles (Música lofi).</td>
            </tr>
            <tr>
                <td><strong>Junio<br>Semana 1<br>Miércoles</strong></td>
                <td>Reel (Vertical)<br>+ IG / TikTok</td>
                <td>Inspirador / Tribu</td>
                <td>"Mira cómo Ana pasó de no tener ritmo a bailar salsa en su primera clase social"</td>
                <td>Video de alumno (Testimonio/Antes y Después).<br>Texto sobre la pantalla contando su breve historia.</td>
                <td><strong>Historia:</strong> El miedo inicial de Ana vs su confianza actual.<br><strong>CTA:</strong> Todos empezamos desde cero. Únete a la tribu.</td>
                <td>De cero a salsera experta. Mira la historia de Ana 🔥 #SalsaSocial #BailaConWally</td>
                <td>Música emotiva que transiciona a salsa alegre.</td>
            </tr>
            <tr>
                <td><strong>Junio<br>Semana 1<br>Jueves</strong></td>
                <td>Foto / Imagen<br>+ IG</td>
                <td>Educativo / Reflexión</td>
                <td>"El secreto sobre el conteo musical que cambia todo"</td>
                <td>Foto profesional o captura estética de la clase con una frase superpuesta sobre el "contratiempo" en la salsa.</td>
                <td>Explicación escrita del concepto 1,2,3...5,6,7. <br><strong>CTA:</strong> ¿Lo habías notado? Pon un 🎵 en comentarios.</td>
                <td>El contratiempo es la clave de todo. ¿Ya lo dominas? ⏱️👇 #SalsaDancing #BailaConWally</td>
                <td>Música de fondo para posts de IG.</td>
            </tr>
            <tr>
                <td><strong>Junio<br>Semana 1<br>Viernes</strong></td>
                <td>Carrusel (6 slides)<br>+ IG</td>
                <td>Educativo / Checklist</td>
                <td>"Guía rápida: Cómo prepararte física y mentalmente para tu primera clase"</td>
                <td>Diseños Canva.<br>S1: Titulo.<br>S2: Outfit y calzado.<br>S3: Hidratación.<br>S4: Mentalidad sin juicio.<br>S5: Resumen.<br>S6: CTA.</td>
                <td>Puntos clave y accionables directos.<br><strong>CTA:</strong> Etiqueta a tu amigo que necesita ir a su primera clase.</td>
                <td>¡No vayas a tu primera clase sin leer esto! 🚨 Guardalo para más tarde. #BailaConWally</td>
                <td>Ninguna.</td>
            </tr>
            <tr>
                <td><strong>Junio<br>Semana 1<br>Sábado</strong></td>
                <td>Reel (Vertical)<br>+ IG / TikTok</td>
                <td>Entretenimiento / Humor</td>
                <td>"Expectativa vs Realidad: Bailando en el living vs Bailando en el antro"</td>
                <td>Pantalla dividida o transición rápida. 1. Yo bailando exagerado y perfecto en pijama. 2. Yo tímido con un vaso en la fiesta.</td>
                <td>Texto: "Yo practicando frente al espejo" vs "Yo cuando me sacan a bailar".<br><strong>CTA:</strong> ¿Quién más se identifica? 😂</td>
                <td>Expectativa vs realidad, ¿te ha pasado? 😂 #HumorBaile #BailaConWally</td>
                <td>Audio meme tendencia de TikTok.</td>
            </tr>
            <tr>
                <td><strong>Junio<br>Semana 1<br>Domingo</strong></td>
                <td>Reel (Vertical)<br>+ IG / TikTok</td>
                <td>Comercial / Autoridad</td>
                <td>"¿Listo para dar el primer paso? Únete a nuestras clases"</td>
                <td>Montaje rápido de las alumnas en la clase, risas, comunidad y el ambiente del estudio.</td>
                <td><strong>Problema:</strong> Quedarte afuera otra vez.<br><strong>Solución:</strong> Reserva hoy tu lugar.<br><strong>CTA:</strong> Link en la biografía.</td>
                <td>🚨 ¡Abrimos inscripciones! Quedan pocos cupos, reserva tu lugar en el link de mi bio. #ClasesDeBaile #BailaConWally</td>
                <td>Música electrónica/Upbeat muy enérgica.</td>
            </tr>
        `;
        tbody.innerHTML = template;
        clientData.productionHTML = template;
        saveClientData();
    }
}

// ─────────────────────────────────────────────
// EXPORTAR
// ─────────────────────────────────────────────
document.getElementById('btnExport').onclick = () => {
    const data = JSON.stringify({ clients, data: clients.reduce((acc, c) => {
        const raw = localStorage.getItem(DATA_PREFIX + c.id);
        acc[c.id] = raw ? JSON.parse(raw) : { tasks: [], metrics: [] };
        return acc;
    }, {}) });
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(data);
    a.download = 'planner_pro_export.json';
    a.click();
};
