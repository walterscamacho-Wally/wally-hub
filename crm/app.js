/* --- LÓGICA DE CONTROL DEL CRM "BAILA CON WALLY" --- */
window.addEventListener("error", (event) => {
    alert("CRM JS Error:\n" + event.message + "\nEn: " + (event.filename ? event.filename.split('/').pop() : 'unknown') + " línea " + event.lineno);
});


// --- DATOS INICIALES (SEMILLA) ---
const INITIAL_DATA = {
    settings: {
        combustiblePrecio: 950.00,
        combustibleRendimiento: 12.5,
        logisticaBase: "Sede Central (San Isidro)"
    },
    sedes: [
        {
            id: "sede-1",
            nombre: "Glorietas",
            precios: { 1: 5000, 2: 8500, 3: 11000 },
            alquiler: 15000,
            distancia: 12.4,
            viajesSemanales: 2
        },
        {
            id: "sede-2",
            nombre: "Remeros",
            precios: { 1: 5500, 2: 9500, 3: 12500 },
            alquiler: 18000,
            distancia: 21.8,
            viajesSemanales: 1
        },
        {
            id: "sede-3",
            nombre: "Pioneras",
            precios: { 1: 5200, 2: 9000, 3: 11800 },
            alquiler: 16000,
            distancia: 16.5,
            viajesSemanales: 2
        }
    ],
    descuentos: [
        {
            id: "desc-1",
            nombre: "Descuento Familiar",
            tipo: "porcentaje",
            valor: 10
        },
        {
            id: "desc-2",
            nombre: "Beca Parcial",
            tipo: "porcentaje",
            valor: 50
        },
        {
            id: "desc-3",
            nombre: "Descuento Amigo",
            tipo: "fijo",
            valor: 1500
        }
    ],
    alumnos: [],
    asistencias: [],
    liquidaciones: []
};

// --- INITIALIZE SUPABASE CLIENT ---
const SUPABASE_URL = "https://ykbtnebrxdajyulbderj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jkhz6TgXqBkBGYnyOW5I_A_UQeiRZ06";
const supabaseLib = window.supabase || globalThis.supabase;
const supabaseClient = supabaseLib ? supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;
let isSyncing = false;

// --- ESTADO GLOBAL ---
let db = { ...INITIAL_DATA };

// --- CARGAR / GUARDAR LOCALSTORAGE Y NUBE ---
function loadDB() {
    const rawData = localStorage.getItem("baila_con_wally_crm_data");
    if (rawData) {
        try {
            db = JSON.parse(rawData);
            // Asegurar que existan todos los nodos
            if (!db.settings) db.settings = { ...INITIAL_DATA.settings };
            if (!db.sedes) db.sedes = [...INITIAL_DATA.sedes];
            if (!db.descuentos) db.descuentos = [...INITIAL_DATA.descuentos];
            if (!db.alumnos) db.alumnos = [];
            if (!db.asistencias) db.asistencias = [];
            if (!db.liquidaciones) db.liquidaciones = [];
        } catch (e) {
            console.error("Error cargando base de datos, usando datos iniciales", e);
            db = { ...INITIAL_DATA };
        }
    } else {
        db = { ...INITIAL_DATA };
        saveDB();
    }
}

function saveDB() {
    localStorage.setItem("baila_con_wally_crm_data", JSON.stringify(db));
    pushToCloud();
}

async function pullFromCloud() {
    if (!supabaseClient || !currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from("crm_data")
            .select("db_json")
            .eq("user_id", currentUser.id)
            .maybeSingle();
            
        if (error) throw error;
        
        if (data && data.db_json) {
            let cloudDB = typeof data.db_json === "string" ? JSON.parse(data.db_json) : data.db_json;
            if (cloudDB && (cloudDB.alumnos || cloudDB.sedes)) {
                db = cloudDB;
                localStorage.setItem("baila_con_wally_crm_data", JSON.stringify(db));
                console.log("Datos cargados desde la nube.");
                renderAll();
            }
        } else {
            console.log("No hay datos en la nube. Inicializando...");
            await pushToCloud();
        }
    } catch (e) {
        console.error("Error al descargar desde la nube:", e);
        showToast("Error al conectar con la nube. Usando base local.", "error");
    }
}

async function pushToCloud() {
    if (!supabaseClient || !currentUser || isSyncing) return;
    isSyncing = true;
    try {
        const { error } = await supabaseClient
            .from("crm_data")
            .upsert({
                user_id: currentUser.id,
                db_json: db,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });
            
        if (error) throw error;
        console.log("Datos sincronizados en la nube.");
    } catch (e) {
        console.error("Error al subir cambios a la nube:", e);
    } finally {
        isSyncing = false;
    }
}

function renderAll() {
    renderSedes();
    renderDescuentos();
    initLogisticaInputs();
    populateAlumnoDropdowns();
    renderAlumnos();
    populatePresentismoSedeDropdown();
    renderPresentismo();
    renderLiquidaciones();
    renderTablero();
    if (typeof renderReporte === "function") renderReporte();
}

// --- UTILIDADES: NOTIFICACIONES (TOAST) ---
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <span class="toast-close">&times;</span>
    `;
    container.appendChild(toast);
    
    // Trigger animación entrada
    setTimeout(() => toast.classList.add("show"), 10);
    
    // Remover después de 3.5 segundos
    const dismissTimer = setTimeout(() => dismiss(), 3500);
    
    function dismiss() {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }
    
    toast.querySelector(".toast-close").addEventListener("click", () => {
        clearTimeout(dismissTimer);
        dismiss();
    });
}

// --- FORMATO DE MONEDA Y NÚMEROS ---
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(amount);
}

function formatKm(val) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val) + " km";
}

// --- NAVEGACIÓN DE VISTAS (TABS) ---
const VIEW_INFO = {
    cimientos: { title: "Configuración de Clases y Precios", subtitle: "Gestiona clases, precios, descuentos y costos logísticos iniciales." },
    alumnos: { title: "Gestión de Alumnos", subtitle: "Define la clase principal, frecuencia, pases y notas adicionales." },
    presentismo: { title: "Control de Asistencias", subtitle: "Registra asistencias y controla el presentismo en tiempo real." },
    liquidacion: { title: "Control de Cuotas y Pagos", subtitle: "Genera las cuotas mensuales y registra los pagos manuales o automáticos de tus alumnos." },
    tablero: { title: "Tablero Operativo de Control", subtitle: "Analiza el rendimiento general, la ocupación de salas y la rentabilidad." },
    reportes: { title: "Reportes Mensuales Operativos", subtitle: "Visualiza desgloses de ingresos, gastos mensuales y copia reportes listos para administración." }
};

function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".view-section");
    const viewTitle = document.getElementById("view-title");
    const viewSubtitle = document.getElementById("view-subtitle");

    navItems.forEach(item => {
        const tabId = item.getAttribute("data-tab");
        if (!tabId) return; // Enlaces sin data-tab (como Volver al Hub) no se interceptan y navegan normal
        
        item.addEventListener("click", (e) => {
            e.preventDefault();
            
            navItems.forEach(nav => nav.classList.remove("active"));
            sections.forEach(sec => sec.classList.remove("active"));
            
            item.classList.add("active");
            
            const targetSec = document.getElementById(`view-${tabId}`);
            if (targetSec) targetSec.classList.add("active");
            
            // Actualizar títulos
            if (VIEW_INFO[tabId]) {
                if (viewTitle) viewTitle.innerText = VIEW_INFO[tabId].title;
                if (viewSubtitle) viewSubtitle.innerText = VIEW_INFO[tabId].subtitle;
            }
            
            // Refresh views upon activation
            if (tabId === "tablero") {
                renderTablero();
            } else if (tabId === "reportes") {
                renderReporte();
            }
        });
    });
}

// --- LÓGICA DE LA FASE 1: CONFIGURACIÓN DE CIMIENTOS ---

// Renderizar Sedes
function renderSedes() {
    const tbody = document.getElementById("tbody-sedes");
    tbody.innerHTML = "";
    
    db.sedes.forEach(sede => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--text-primary);">${sede.nombre}</td>
            <td>${formatCurrency(sede.precios[1])}</td>
            <td>${formatCurrency(sede.precios[2])}</td>
            <td>${formatCurrency(sede.precios[3])}</td>
            <td>${formatCurrency(sede.alquiler)}</td>
            <td>
                <button class="btn btn-secondary btn-sm btn-icon-only" onclick="editSede('${sede.id}')" title="Editar Sede"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn btn-danger-outline btn-sm btn-icon-only" onclick="deleteSede('${sede.id}')" title="Eliminar Sede"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Al actualizar sedes, actualizamos la tabla logística
    renderLogistica();
    
    // Sincronizar selectores y vistas de alumnos y presentismo
    if (typeof populateAlumnoDropdowns === 'function') {
        populateAlumnoDropdowns();
        renderAlumnos();
    }
    if (typeof populatePresentismoSedeDropdown === 'function') {
        populatePresentismoSedeDropdown();
        renderPresentismo();
    }
}

// Renderizar Descuentos
function renderDescuentos() {
    const container = document.getElementById("list-descuentos");
    container.innerHTML = "";
    
    if (db.descuentos.length === 0) {
        container.innerHTML = `<p class="text-muted text-center text-sm mt-3">No hay etiquetas de descuento configuradas.</p>`;
        return;
    }
    
    db.descuentos.forEach(desc => {
        const div = document.createElement("div");
        div.className = "list-item";
        
        const valorText = desc.tipo === "porcentaje" ? `${desc.valor}%` : formatCurrency(desc.valor);
        
        div.innerHTML = `
            <div class="discount-badge">
                <span class="discount-tag">${desc.nombre}</span>
                <span class="discount-value">${valorText}</span>
            </div>
            <div style="display: flex; gap: 4px;">
                <button class="btn btn-secondary btn-sm btn-icon-only" onclick="editDescuento('${desc.id}')" style="height:26px; width:26px; padding:0; font-size:10px;" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn btn-danger-outline btn-sm btn-icon-only" onclick="deleteDescuento('${desc.id}')" style="height:26px; width:26px; padding:0; font-size:10px;" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        container.appendChild(div);
    });

    // Sincronizar selectores y vistas de alumnos (si la función existe)
    if (typeof populateAlumnoDropdowns === 'function') {
        populateAlumnoDropdowns();
        renderAlumnos();
    }
}

// Calcular y Renderizar Logística
function renderLogistica() {
    const tbody = document.getElementById("tbody-logistica");
    tbody.innerHTML = "";
    
    const precioLitro = parseFloat(document.getElementById("input-combustible-precio").value) || 0;
    const rendimiento = parseFloat(document.getElementById("input-combustible-rendimiento").value) || 1;
    
    if (db.sedes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Configura al menos una sede para ver los costos logísticos.</td></tr>`;
        return;
    }

    let totalTeoricoSemanal = 0;

    db.sedes.forEach(sede => {
        const distanciaIdaVuelta = sede.distancia * 2;
        const consumoViaje = distanciaIdaVuelta / rendimiento;
        const costoViaje = consumoViaje * precioLitro;
        
        // Viajes semanales configurados
        const viajesSem = sede.viajesSemanales || 2;
        const costoTeoricoSede = costoViaje * viajesSem;
        totalTeoricoSemanal += costoTeoricoSede;
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight: 600;">${sede.nombre}</td>
            <td>${formatKm(sede.distancia)} (${formatKm(distanciaIdaVuelta)} ida/vuelta)</td>
            <td class="text-muted">
                ${distanciaIdaVuelta.toFixed(1)} km / ${rendimiento.toFixed(1)} km/L = <strong>${consumoViaje.toFixed(2)} L</strong> (×${viajesSem} viajes/sem)
            </td>
            <td style="color: var(--accent-light); font-weight: 600;">
                ${formatCurrency(costoViaje)} viaje / <span class="text-muted" style="font-size: 11px;">${formatCurrency(costoTeoricoSede)} sem</span>
            </td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="editDistancia('${sede.id}')"><i class="fa-solid fa-road" style="margin-right: 4px;"></i> Editar km</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Actualizar Comparador Logístico
    const gastoReal = db.settings.logisticaGastoReal || 0;
    const desviacion = gastoReal - totalTeoricoSemanal;
    
    document.getElementById("logistica-costo-teorico").innerText = formatCurrency(totalTeoricoSemanal);
    document.getElementById("logistica-costo-real").innerText = formatCurrency(gastoReal);
    
    const desviacionEl = document.getElementById("logistica-desviacion");
    desviacionEl.innerText = (desviacion > 0 ? "+" : "") + formatCurrency(desviacion);
    
    if (desviacion > 0) {
        desviacionEl.style.color = "var(--danger-light)";
    } else if (desviacion < 0) {
        desviacionEl.style.color = "var(--success-light)";
    } else {
        desviacionEl.style.color = "var(--text-primary)";
    }
}

// Cargar Valores Iniciales de Combustible en inputs
function initLogisticaInputs() {
    const inputPrecio = document.getElementById("input-combustible-precio");
    const inputRendimiento = document.getElementById("input-combustible-rendimiento");
    const inputBase = document.getElementById("input-logistica-base");
    const inputGastoReal = document.getElementById("input-logistica-gasto-real");
    
    inputPrecio.value = db.settings.combustiblePrecio;
    inputRendimiento.value = db.settings.combustibleRendimiento;
    inputBase.value = db.settings.logisticaBase;
    inputGastoReal.value = db.settings.logisticaGastoReal || "";
    
    // Listeners para recálculo instantáneo
    [inputPrecio, inputRendimiento].forEach(input => {
        input.addEventListener("input", () => {
            db.settings.combustiblePrecio = parseFloat(inputPrecio.value) || 0;
            db.settings.combustibleRendimiento = parseFloat(inputRendimiento.value) || 1;
            saveDB();
            renderLogistica();
        });
    });
    
    inputBase.addEventListener("change", () => {
        db.settings.logisticaBase = inputBase.value;
        saveDB();
        showToast("Ubicación de base actualizada");
    });

    inputGastoReal.addEventListener("input", () => {
        db.settings.logisticaGastoReal = parseFloat(inputGastoReal.value) || 0;
        saveDB();
        renderLogistica();
    });
}

// --- OPERACIONES DE SEDES ---
const modalSede = document.getElementById("modal-sede");
const formSede = document.getElementById("form-sede");

document.getElementById("btn-add-sede").addEventListener("click", () => {
    document.getElementById("modal-sede-title").innerText = "Nueva Clase / Actividad";
    formSede.reset();
    document.getElementById("form-sede-id").value = "";
    document.getElementById("form-input-sede-viajes").value = 2; // Valor por defecto
    openModal(modalSede);
});

document.getElementById("close-modal-sede").addEventListener("click", () => closeModal(modalSede));
document.getElementById("btn-cancel-sede").addEventListener("click", () => closeModal(modalSede));

formSede.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("form-sede-id").value;
    const nombre = document.getElementById("form-input-sede-nombre").value.trim();
    const p1 = parseFloat(document.getElementById("form-input-sede-precio1").value) || 0;
    const p2 = parseFloat(document.getElementById("form-input-sede-precio2").value) || 0;
    const p3 = parseFloat(document.getElementById("form-input-sede-precio3").value) || 0;
    const alquiler = parseFloat(document.getElementById("form-input-sede-alquiler").value) || 0;
    const distancia = parseFloat(document.getElementById("form-input-sede-distancia").value) || 0;
    const viajesSemanales = parseInt(document.getElementById("form-input-sede-viajes").value) || 2;
    
    if (id) {
        // Editar existente
        const index = db.sedes.findIndex(s => s.id === id);
        if (index !== -1) {
            db.sedes[index] = { id, nombre, precios: { 1: p1, 2: p2, 3: p3 }, alquiler, distancia, viajesSemanales };
            showToast(`Clase "${nombre}" actualizada correctamente.`);
        }
    } else {
        // Crear nueva
        const newId = "sede-" + Date.now();
        db.sedes.push({ id: newId, nombre, precios: { 1: p1, 2: p2, 3: p3 }, alquiler, distancia, viajesSemanales });
        showToast(`Clase "${nombre}" agregada con éxito.`);
    }
    
    saveDB();
    renderSedes();
    closeModal(modalSede);
});

function editSede(id) {
    const sede = db.sedes.find(s => s.id === id);
    if (!sede) return;
    
    document.getElementById("modal-sede-title").innerText = "Editar Clase / Actividad";
    document.getElementById("form-sede-id").value = sede.id;
    document.getElementById("form-input-sede-nombre").value = sede.nombre;
    document.getElementById("form-input-sede-precio1").value = sede.precios[1];
    document.getElementById("form-input-sede-precio2").value = sede.precios[2];
    document.getElementById("form-input-sede-precio3").value = sede.precios[3];
    document.getElementById("form-input-sede-alquiler").value = sede.alquiler;
    document.getElementById("form-input-sede-distancia").value = sede.distancia;
    document.getElementById("form-input-sede-viajes").value = sede.viajesSemanales || 2;
    
    openModal(modalSede);
}

function deleteSede(id) {
    const sede = db.sedes.find(s => s.id === id);
    if (!sede) return;
    
    if (confirm(`¿Estás seguro de que deseas eliminar la clase "${sede.nombre}"? Esto afectará los cálculos logísticos.`)) {
        db.sedes = db.sedes.filter(s => s.id !== id);
        saveDB();
        renderSedes();
        showToast(`Clase "${sede.nombre}" eliminada.`, "danger");
    }
}

function editDistancia(id) {
    const sede = db.sedes.find(s => s.id === id);
    if (!sede) return;
    
    const nuevaDist = prompt(`Introduce la distancia de ida en km para la clase ${sede.nombre}:`, sede.distancia);
    if (nuevaDist !== null) {
        const val = parseFloat(nuevaDist);
        if (!isNaN(val) && val >= 0) {
            sede.distancia = val;
            saveDB();
            renderSedes();
            showToast(`Distancia de ${sede.nombre} actualizada.`);
        } else {
            showToast("Valor de distancia inválido", "danger");
        }
    }
}



// --- OPERACIONES DE DESCUENTOS ---
const modalDescuento = document.getElementById("modal-descuento");
const formDescuento = document.getElementById("form-descuento");

document.getElementById("btn-add-descuento").addEventListener("click", () => {
    document.getElementById("modal-descuento-title").innerText = "Nueva Etiqueta de Descuento";
    formDescuento.reset();
    document.getElementById("form-descuento-id").value = "";
    openModal(modalDescuento);
});

document.getElementById("close-modal-descuento").addEventListener("click", () => closeModal(modalDescuento));
document.getElementById("btn-cancel-descuento").addEventListener("click", () => closeModal(modalDescuento));

formDescuento.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("form-descuento-id").value;
    const nombre = document.getElementById("form-input-descuento-nombre").value.trim();
    const tipo = document.getElementById("form-input-descuento-tipo").value;
    const valor = parseFloat(document.getElementById("form-input-descuento-valor").value) || 0;
    
    if (id) {
        const index = db.descuentos.findIndex(d => d.id === id);
        if (index !== -1) {
            db.descuentos[index] = { id, nombre, tipo, valor };
            showToast(`Descuento "${nombre}" actualizado.`);
        }
    } else {
        const newId = "desc-" + Date.now();
        db.descuentos.push({ id: newId, nombre, tipo, valor });
        showToast(`Descuento "${nombre}" creado.`);
    }
    
    saveDB();
    renderDescuentos();
    closeModal(modalDescuento);
});

function editDescuento(id) {
    const desc = db.descuentos.find(d => d.id === id);
    if (!desc) return;
    
    document.getElementById("modal-descuento-title").innerText = "Editar Etiqueta de Descuento";
    document.getElementById("form-descuento-id").value = desc.id;
    document.getElementById("form-input-descuento-nombre").value = desc.nombre;
    document.getElementById("form-input-descuento-tipo").value = desc.tipo;
    document.getElementById("form-input-descuento-valor").value = desc.valor;
    
    openModal(modalDescuento);
}

function deleteDescuento(id) {
    const desc = db.descuentos.find(d => d.id === id);
    if (!desc) return;
    
    if (confirm(`¿Eliminar la etiqueta de descuento "${desc.nombre}"?`)) {
        db.descuentos = db.descuentos.filter(d => d.id !== id);
        saveDB();
        renderDescuentos();
        showToast(`Descuento "${desc.nombre}" eliminado.`, "danger");
    }
}

// --- MODAL UTILS ---
const modalAlumno = document.getElementById("modal-alumno");
const formAlumno = document.getElementById("form-alumno");

function openModal(modal) {
    modal.classList.add("show");
}

function closeModal(modal) {
    modal.classList.remove("show");
}

// Cerrar modales si se hace clic fuera del contenido
window.addEventListener("click", (e) => {
    if (e.target === modalSede) closeModal(modalSede);
    if (e.target === modalDescuento) closeModal(modalDescuento);
    if (e.target === modalAlumno) closeModal(modalAlumno);
});

// --- LÓGICA DE LA FASE 2: GESTIÓN DE ALUMNOS ---

const DEMO_ALUMNOS = [
    {
        id: "alum-1",
        nombre: "Delfina Maranzana",
        telefono: "5491138402941",
        sedeId: "sede-1",
        frecuencia: 2,
        descuentoId: "desc-1", // Descuento Familiar
        clasesDisponibles: 8,
        clasesTotales: 8
    },
    {
        id: "alum-2",
        nombre: "Bautista Mitre",
        telefono: "5491150493821",
        sedeId: "sede-2",
        frecuencia: 3,
        descuentoId: "desc-2", // Beca Parcial
        clasesDisponibles: 12,
        clasesTotales: 12
    },
    {
        id: "alum-3",
        nombre: "Juana Martínez",
        telefono: "5491129481039",
        sedeId: "sede-3",
        frecuencia: 1,
        descuentoId: "",
        clasesDisponibles: 4,
        clasesTotales: 4
    },
    {
        id: "alum-4",
        nombre: "Catalina Rodríguez",
        telefono: "5491162049182",
        sedeId: "sede-1",
        frecuencia: 2,
        descuentoId: "",
        clasesDisponibles: 8,
        clasesTotales: 8
    }
];

// Llenar selectores dinámicos
function populateAlumnoDropdowns() {
    const filterSede = document.getElementById("select-filter-sede");
    const formSede = document.getElementById("form-input-alumno-sede");
    const formSedeExtra = document.getElementById("form-input-alumno-sede-extra");
    const formDescuento = document.getElementById("form-input-alumno-descuento");
    
    // Guardar selecciones actuales
    const currentFilter = filterSede.value;
    const currentFormSede = formSede.value;
    const currentFormSedeExtra = formSedeExtra ? formSedeExtra.value : "";
    const currentFormDesc = formDescuento.value;
    
    // 1. Selector de filtro
    filterSede.innerHTML = '<option value="">Todas las clases</option>';
    db.sedes.forEach(s => {
        filterSede.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
    });
    filterSede.value = currentFilter;
    
    // 2. Selector en formulario (clase principal)
    formSede.innerHTML = '<option value="" disabled selected>Selecciona una clase</option>';
    db.sedes.forEach(s => {
        formSede.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
    });
    if (db.sedes.find(s => s.id === currentFormSede)) {
        formSede.value = currentFormSede;
    }
    
    // 2b. Selector en formulario (clase extra)
    if (formSedeExtra) {
        formSedeExtra.innerHTML = '<option value="">Ninguna</option>';
        db.sedes.forEach(s => {
            formSedeExtra.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
        });
        if (!currentFormSedeExtra || db.sedes.find(s => s.id === currentFormSedeExtra)) {
            formSedeExtra.value = currentFormSedeExtra;
        }
    }
    
    // 3. Selector en formulario (descuento)
    formDescuento.innerHTML = '<option value="">Ninguno</option>';
    db.descuentos.forEach(d => {
        const valorText = d.tipo === "porcentaje" ? `${d.valor}%` : `$${d.valor}`;
        formDescuento.innerHTML += `<option value="${d.id}">${d.nombre} (${valorText})</option>`;
    });
    formDescuento.value = currentFormDesc;
}

// Renderizar listado de alumnos y estadísticas
function renderAlumnos() {
    const tbody = document.getElementById("tbody-alumnos");
    tbody.innerHTML = "";
    
    const searchTerm = document.getElementById("input-search-alumnos").value.toLowerCase().trim();
    const filterSede = document.getElementById("select-filter-sede").value;
    
    let totalAlumnosValue = 0;
    let totalClasesValue = 0;
    let alumnosDescuentoValue = 0;
    
    const alumnosFiltrados = db.alumnos.filter(al => {
        // Filtro por búsqueda
        const matchSearch = al.nombre.toLowerCase().includes(searchTerm) || al.telefono.includes(searchTerm);
        // Filtro por clase
        const matchSede = !filterSede || al.sedeId === filterSede || al.sedeExtraId === filterSede;
        return matchSearch && matchSede;
    });

    // Calcular estadísticas sobre los alumnos de la base general
    db.alumnos.forEach(al => {
        totalAlumnosValue++;
        totalClasesValue += al.clasesDisponibles;
        if (al.descuentoId) alumnosDescuentoValue++;
    });
    
    document.getElementById("stat-total-alumnos").innerText = totalAlumnosValue;
    document.getElementById("stat-total-clases").innerText = totalClasesValue;
    document.getElementById("stat-alumnos-descuento").innerText = alumnosDescuentoValue;

    if (alumnosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No se encontraron alumnos registrados. ${db.alumnos.length === 0 ? 'Presiona "Registrar Alumno" o "Cargar Demo".' : ''}</td></tr>`;
        return;
    }

    alumnosFiltrados.forEach(al => {
        const sedeObj = db.sedes.find(s => s.id === al.sedeId);
        const sedeNombre = sedeObj ? sedeObj.nombre : "Clase Desconocida";
        
        let claseColTexto = sedeNombre;
        if (al.sedeExtraId) {
            const sedeExtraObj = db.sedes.find(s => s.id === al.sedeExtraId);
            if (sedeExtraObj) {
                claseColTexto += `<div class="text-muted text-xs" style="margin-top: 4px; font-weight: 500;"><i class="fa-solid fa-plus" style="font-size:8px; margin-right:4px; color:var(--accent-primary);"></i>${sedeExtraObj.nombre}</div>`;
            }
        }
        
        const freqColTexto = al.sedeExtraId && al.frecuenciaExtra
            ? `${al.frecuencia} + ${al.frecuenciaExtra} vez/sem`
            : `${al.frecuencia} vez/sem`;
        
        const descObj = db.descuentos.find(d => d.id === al.descuentoId);
        const descBadge = descObj 
            ? `<span class="discount-tag">${descObj.nombre}</span>` 
            : `<span class="text-muted text-sm">-</span>`;
            
        const notasHtml = al.notas 
            ? `<div class="text-muted text-xs" style="font-weight: 400; margin-top: 4px; font-style: italic;"><i class="fa-solid fa-note-sticky" style="margin-right: 4px; font-size: 10px;"></i>${al.notas}</div>` 
            : "";
            
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--text-primary);">
                ${al.nombre}
                ${notasHtml}
            </td>
            <td>
                <a href="https://wa.me/${al.telefono}" target="_blank" style="color: var(--success-light); text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Enviar WhatsApp">
                    <i class="fa-brands fa-whatsapp" style="font-size: 1.1rem; margin-right: 4px;"></i> ${al.telefono}
                </a>
            </td>
            <td>${claseColTexto}</td>
            <td>${freqColTexto}</td>
            <td>${descBadge}</td>
            <td>
                <span class="status-indicator" style="background-color: ${al.clasesDisponibles > 2 ? 'var(--success)' : al.clasesDisponibles > 0 ? 'var(--warning)' : 'var(--danger)'}; width:6px; height:6px;"></span>
                <strong>${al.clasesDisponibles}</strong> / ${al.clasesTotales} clases
            </td>
            <td>
                <button class="btn btn-secondary btn-sm btn-icon-only" onclick="editAlumno('${al.id}')" title="Editar Alumno"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn btn-danger-outline btn-sm btn-icon-only" onclick="deleteAlumno('${al.id}')" title="Eliminar Alumno"><i class="fa-solid fa-trash-can"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Inicializar listeners de la sección Alumnos
function initAlumnosListeners() {
    const btnAdd = document.getElementById("btn-add-alumno");
    const btnCancel = document.getElementById("btn-cancel-alumno");
    const closeBtn = document.getElementById("close-modal-alumno");
    const selectFrecuencia = document.getElementById("form-input-alumno-frecuencia");
    const selectSedeExtra = document.getElementById("form-input-alumno-sede-extra");
    const selectFrecuenciaExtra = document.getElementById("form-input-alumno-frecuencia-extra");
    const inputClases = document.getElementById("form-input-alumno-clases");
    
    // Abrir modal
    btnAdd.addEventListener("click", () => {
        document.getElementById("modal-alumno-title").innerText = "Registrar Alumno";
        formAlumno.reset();
        document.getElementById("form-alumno-id").value = "";
        
        // Auto-calcular clases en base a la frecuencia predeterminada (2 veces/sem = 8 clases)
        inputClases.value = 8;
        openModal(modalAlumno);
    });
    
    btnCancel.addEventListener("click", () => closeModal(modalAlumno));
    closeBtn.addEventListener("click", () => closeModal(modalAlumno));
    
    // Auto-calcular clases estimadas cuando cambian las frecuencias
    function recalculateTotalClases() {
        const freq1 = parseInt(selectFrecuencia.value) || 2;
        const freq2 = selectSedeExtra.value !== "" ? (parseInt(selectFrecuenciaExtra.value) || 0) : 0;
        inputClases.value = (freq1 * 4) + (freq2 * 4);
    }
    
    selectSedeExtra.addEventListener("change", () => {
        if (selectSedeExtra.value === "") {
            selectFrecuenciaExtra.value = "0";
        } else if (selectFrecuenciaExtra.value === "0") {
            selectFrecuenciaExtra.value = "2";
        }
        recalculateTotalClases();
    });
    
    selectFrecuencia.addEventListener("change", recalculateTotalClases);
    selectFrecuenciaExtra.addEventListener("change", recalculateTotalClases);
    
    // Buscar y Filtrar Alumnos en tiempo real
    document.getElementById("input-search-alumnos").addEventListener("input", renderAlumnos);
    document.getElementById("select-filter-sede").addEventListener("change", renderAlumnos);
    
    // Guardar Alumno
    formAlumno.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("form-alumno-id").value;
        const nombre = document.getElementById("form-input-alumno-nombre").value.trim();
        const telefono = document.getElementById("form-input-alumno-telefono").value.replace(/\D/g, ""); // Limpiar no numéricos
        const sedeId = document.getElementById("form-input-alumno-sede").value;
        const frecuencia = parseInt(selectFrecuencia.value);
        const sedeExtraId = selectSedeExtra.value || "";
        const frecuenciaExtra = sedeExtraId ? (parseInt(selectFrecuenciaExtra.value) || 0) : 0;
        const descuentoId = document.getElementById("form-input-alumno-descuento").value;
        const clasesTotales = parseInt(inputClases.value) || 8;
        const notas = document.getElementById("form-input-alumno-notas").value.trim();
        
        if (!sedeId) {
            showToast("Debes seleccionar una clase válida.", "danger");
            return;
        }
        
        if (id) {
            // Editar
            const index = db.alumnos.findIndex(al => al.id === id);
            if (index !== -1) {
                const viejo = db.alumnos[index];
                // Mantener los pases restantes si el total no cambió, o ajustarlo si cambió
                let clasesDisponibles = viejo.clasesDisponibles;
                if (clasesTotales !== viejo.clasesTotales) {
                    clasesDisponibles = clasesTotales;
                }
                db.alumnos[index] = { id, nombre, telefono, sedeId, frecuencia, descuentoId, clasesDisponibles, clasesTotales, notas, sedeExtraId, frecuenciaExtra };
                showToast(`Alumno "${nombre}" actualizado.`);
            }
        } else {
            // Crear
            const newId = "alum-" + Date.now();
            db.alumnos.push({
                id: newId,
                nombre,
                telefono,
                sedeId,
                frecuencia,
                sedeExtraId,
                frecuenciaExtra,
                descuentoId,
                clasesDisponibles: clasesTotales,
                clasesTotales,
                notas
            });
            showToast(`Alumno "${nombre}" registrado.`);
        }
        
        saveDB();
        renderAlumnos();
        closeModal(modalAlumno);
    });
    
    // Cargar alumnos demo
    document.getElementById("btn-load-demo-alumnos").addEventListener("click", () => {
        if (confirm("¿Quieres cargar el listado de alumnos de demostración para testear el sistema?")) {
            // Asegurar que las sedes por defecto existan
            db.alumnos = JSON.parse(JSON.stringify(DEMO_ALUMNOS));
            saveDB();
            renderAlumnos();
            showToast("Alumnos demo cargados exitosamente.");
        }
    });
}

function editAlumno(id) {
    const al = db.alumnos.find(alumno => alumno.id === id);
    if (!al) return;
    
    document.getElementById("modal-alumno-title").innerText = "Editar Alumno";
    document.getElementById("form-alumno-id").value = al.id;
    document.getElementById("form-input-alumno-nombre").value = al.nombre;
    document.getElementById("form-input-alumno-telefono").value = al.telefono;
    document.getElementById("form-input-alumno-sede").value = al.sedeId;
    document.getElementById("form-input-alumno-frecuencia").value = al.frecuencia;
    document.getElementById("form-input-alumno-sede-extra").value = al.sedeExtraId || "";
    document.getElementById("form-input-alumno-frecuencia-extra").value = al.frecuenciaExtra || "0";
    document.getElementById("form-input-alumno-descuento").value = al.descuentoId;
    document.getElementById("form-input-alumno-clases").value = al.clasesTotales;
    document.getElementById("form-input-alumno-notas").value = al.notas || "";
    
    openModal(modalAlumno);
}

function deleteAlumno(id) {
    const al = db.alumnos.find(alumno => alumno.id === id);
    if (!al) return;
    
    if (confirm(`¿Dar de baja al alumno "${al.nombre}"?`)) {
        db.alumnos = db.alumnos.filter(alumno => alumno.id !== id);
        saveDB();
        renderAlumnos();
        showToast(`Alumno "${al.nombre}" eliminado.`, "danger");
    }
}

// --- IMPORTACIÓN / EXPORTACIÓN JSON ---
document.getElementById("btn-export").addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `baila_con_wally_crm_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Copia de seguridad exportada con éxito.");
});

const fileInput = document.getElementById("file-import-input");
document.getElementById("btn-import").addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData.sedes && importedData.descuentos && importedData.settings) {
                db = importedData;
                if (!db.alumnos) db.alumnos = [];
                if (!db.asistencias) db.asistencias = [];
                saveDB();
                loadDB();
                renderSedes();
                renderDescuentos();
                initLogisticaInputs();
                populateAlumnoDropdowns();
                renderAlumnos();
                
                // Fase 3
                populatePresentismoSedeDropdown();
                renderPresentismo();
                
                showToast("Datos importados y aplicados correctamente.");
            } else {
                showToast("Formato de archivo inválido. Falta estructura central.", "danger");
            }
        } catch (err) {
            showToast("Error al leer el archivo JSON.", "danger");
            console.error(err);
        }
    };
    reader.readAsText(file);
    fileInput.value = ""; // Limpiar input
});

// --- REINICIAR DATOS A SEMILLA ---
document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("¿Estás seguro de que quieres restablecer todos los datos a la configuración inicial? Perderás cualquier cambio realizado.")) {
        db = { 
            settings: { ...INITIAL_DATA.settings },
            sedes: JSON.parse(JSON.stringify(INITIAL_DATA.sedes)),
            descuentos: JSON.parse(JSON.stringify(INITIAL_DATA.descuentos)),
            alumnos: [],
            asistencias: []
        };
        saveDB();
        renderSedes();
        renderDescuentos();
        initLogisticaInputs();
        populateAlumnoDropdowns();
        renderAlumnos();
        
        // Fase 3
        populatePresentismoSedeDropdown();
        renderPresentismo();
        
        showToast("Base de datos restablecida a los valores iniciales.", "warning");
    }
});

// --- LÓGICA DE LA FASE 3: PRESENTISMO Y AUTOMATIZACIÓN ---

function populatePresentismoSedeDropdown() {
    const selectSede = document.getElementById("select-presentismo-sede");
    if (!selectSede) return;
    const currentVal = selectSede.value;
    
    selectSede.innerHTML = '<option value="" disabled selected>Selecciona una clase</option>';
    db.sedes.forEach(s => {
        selectSede.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
    });
    
    if (db.sedes.find(s => s.id === currentVal)) {
        selectSede.value = currentVal;
    }
}

function initPresentismo() {
    const inputFecha = document.getElementById("input-presentismo-fecha");
    const selectSede = document.getElementById("select-presentismo-sede");
    
    if (!inputFecha) return;
    
    // Set fecha hoy por defecto en formato YYYY-MM-DD
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    const hoyLocal = new Date(hoy.getTime() - (offset * 60 * 1000));
    inputFecha.value = hoyLocal.toISOString().slice(0, 10);
    
    selectSede.addEventListener("change", renderPresentismo);
    inputFecha.addEventListener("change", renderPresentismo);
}

function renderPresentismo() {
    const selectSede = document.getElementById("select-presentismo-sede");
    const inputFecha = document.getElementById("input-presentismo-fecha");
    const tbodyPendientes = document.getElementById("tbody-presentismo-pendientes");
    const listAsistieron = document.getElementById("list-presentismo-asistieron");
    const tbodyAusentes = document.getElementById("tbody-presentismo-ausentes");
    
    if (!selectSede || !selectSede.value) {
        tbodyPendientes.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Selecciona una clase arriba para comenzar a tomar asistencia.</td></tr>';
        listAsistieron.innerHTML = '<p class="text-muted text-center text-sm mt-3">Nadie ha sido registrado en esta clase todavía.</p>';
        tbodyAusentes.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Selecciona una clase arriba para ver el seguimiento de ausencias.</td></tr>';
        document.getElementById("presentismo-pendientes-count").innerText = "Selecciona una clase.";
        document.getElementById("presentismo-asistieron-count").innerText = "0 alumnos registrados hoy.";
        return;
    }
    
    const sedeId = selectSede.value;
    const fecha = inputFecha.value;
    const sedeObj = db.sedes.find(s => s.id === sedeId);
    const sedeNombre = sedeObj ? sedeObj.nombre : "";
    
    // Alumnos asignados a esta clase (principal o extra)
    const alumnosSede = db.alumnos.filter(al => al.sedeId === sedeId || al.sedeExtraId === sedeId);
    
    // Filtrar en asistieron y pendientes
    const asistieron = [];
    const pendientes = [];
    
    alumnosSede.forEach(al => {
        const haAsistido = db.asistencias.some(asist => asist.fecha === fecha && asist.alumnoId === al.id);
        if (haAsistido) {
            asistieron.push(al);
        } else {
            pendientes.push(al);
        }
    });
    
    // 1. RENDER PENDIENTES
    tbodyPendientes.innerHTML = "";
    document.getElementById("presentismo-pendientes-count").innerText = `${pendientes.length} alumnos pendientes de registro.`;
    
    if (pendientes.length === 0) {
        tbodyPendientes.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay alumnos pendientes para esta clase hoy.</td></tr>';
    } else {
        pendientes.forEach(al => {
            const tr = document.createElement("tr");
            
            // Determinar si le quedan pocas clases
            let alertBadge = "";
            let presentBtnDisabled = "";
            if (al.clasesDisponibles === 0) {
                alertBadge = '<span class="discount-tag" style="background-color:rgba(239,68,68,0.1); color:var(--danger-light); border-color:rgba(239,68,68,0.25);">Agotado (0)</span>';
                presentBtnDisabled = "disabled";
            } else if (al.clasesDisponibles <= 2) {
                alertBadge = `<span class="discount-tag" style="background-color:rgba(245,158,11,0.1); color:var(--warning); border-color:rgba(245,158,11,0.25);">Por vencer (${al.clasesDisponibles})</span>`;
            }
            
            // Botón WhatsApp si quedan 1 o 2 clases
            let whatsappBtn = "-";
            if (al.clasesDisponibles <= 2) {
                const wsMsg = encodeURIComponent(`Hola ${al.nombre}! Te queríamos avisar que te quedan ${al.clasesDisponibles} clases en tu paquete de danza para ${sedeNombre}. ¡Nos vemos en clase! Baila con Wally.`);
                whatsappBtn = `
                    <a href="https://wa.me/${al.telefono}?text=${wsMsg}" target="_blank" class="btn btn-secondary btn-sm" style="color: var(--warning); border-color: rgba(245,158,11,0.3); padding: 4px 8px; font-size:9px;">
                        <i class="fa-brands fa-whatsapp"></i> Avisar
                    </a>
                `;
            }
            
            tr.innerHTML = `
                <td style="font-weight:600; color: var(--text-primary);">${al.nombre}</td>
                <td><strong>${al.clasesDisponibles}</strong> / ${al.clasesTotales} pases</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="marcarPresente('${al.id}', '${fecha}', '${sedeId}')" ${presentBtnDisabled} style="padding: 6px 12px; font-size:10px;">
                        <i class="fa-solid fa-check"></i> Presente
                    </button>
                </td>
                <td>${alertBadge} ${whatsappBtn}</td>
            `;
            tbodyPendientes.appendChild(tr);
        });
    }
    
    // 2. RENDER ASISTIERON
    listAsistieron.innerHTML = "";
    document.getElementById("presentismo-asistieron-count").innerText = `${asistieron.length} alumnos registrados hoy.`;
    
    if (asistieron.length === 0) {
        listAsistieron.innerHTML = '<p class="text-muted text-center text-sm mt-3">Nadie ha sido registrado en esta clase todavía.</p>';
    } else {
        asistieron.forEach(al => {
            const div = document.createElement("div");
            div.className = "list-item";
            div.innerHTML = `
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:600; font-size:12px; color: var(--text-primary);">${al.nombre}</span>
                    <span class="text-muted" style="font-size:10px;">Pases: ${al.clasesDisponibles} restantes</span>
                </div>
                <button class="btn btn-danger-outline btn-sm" onclick="deshacerAsistencia('${al.id}', '${fecha}')" style="padding:4px 8px; font-size:9px;">
                    Deshacer
                </button>
            `;
            listAsistieron.appendChild(div);
        });
    }
    
    // 3. RENDER SEGUIMIENTO AUSENTES (No asistieron hoy)
    tbodyAusentes.innerHTML = "";
    if (pendientes.length === 0) {
        tbodyAusentes.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Todos los alumnos asistieron hoy. ¡Excelente retención!</td></tr>';
    } else {
        pendientes.forEach(al => {
            // Encontrar última asistencia en base de datos
            const asistenciasAlumno = db.asistencias.filter(as => as.alumnoId === al.id);
            let ultimaAsistText = "Nunca asistió";
            if (asistenciasAlumno.length > 0) {
                // Ordenar por fecha descendente
                asistenciasAlumno.sort((a,b) => b.fecha.localeCompare(a.fecha));
                ultimaAsistText = asistenciasAlumno[0].fecha;
            }
            
            const wsMsg = encodeURIComponent(`Hola ${al.nombre}! Te extrañamos hoy en clase de danza en ${sedeNombre}. ¿Todo bien? ¡Esperamos verte la próxima! Baila con Wally.`);
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="font-weight:600; color: var(--text-primary);">${al.nombre}</td>
                <td class="text-muted">${ultimaAsistText}</td>
                <td>
                    <a href="https://wa.me/${al.telefono}?text=${wsMsg}" target="_blank" class="btn btn-secondary btn-sm" style="color: var(--danger-light); border-color: rgba(239,68,68,0.2); padding: 4px 8px; font-size: 10px;">
                        <i class="fa-brands fa-whatsapp"></i> Alerta Ausente
                    </a>
                </td>
            `;
            tbodyAusentes.appendChild(tr);
        });
    }
}

function marcarPresente(alumnoId, fecha, SedeId) {
    const al = db.alumnos.find(alumno => alumno.id === alumnoId);
    if (!al) return;
    
    if (al.clasesDisponibles <= 0) {
        showToast(`El alumno ${al.nombre} no tiene clases disponibles.`, "danger");
        return;
    }
    
    // Descontar pase
    al.clasesDisponibles--;
    
    // Registrar asistencia
    db.asistencias.push({
        id: "asist-" + Date.now(),
        fecha,
        alumnoId,
        sedeId: SedeId
    });
    
    saveDB();
    renderPresentismo();
    renderAlumnos(); // Refrescar vista alumnos para mantener contadores sincronizados
    showToast(`Asistencia registrada para ${al.nombre}. Pases: ${al.clasesDisponibles}/${al.clasesTotales}`);
}

function deshacerAsistencia(alumnoId, fecha) {
    const al = db.alumnos.find(alumno => alumno.id === alumnoId);
    if (!al) return;
    
    // Sumar pase de vuelta (sin pasarse del total)
    if (al.clasesDisponibles < al.clasesTotales) {
        al.clasesDisponibles++;
    }
    
    // Eliminar registro asistencia
    db.asistencias = db.asistencias.filter(as => !(as.fecha === fecha && as.alumnoId === alumnoId));
    
    saveDB();
    renderPresentismo();
    renderAlumnos();
    showToast(`Asistencia de ${al.nombre} revertida.`, "warning");
}

// --- LÓGICA DE LA FASE 4: LIQUIDACIONES Y TABLERO ---

let chartOcupacion = null;
let chartCaja = null;

const MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function initLiquidaciones() {
    const selectMes = document.getElementById("select-liquidacion-mes");
    const btnGenerar = document.getElementById("btn-generar-liquidacion");
    const searchLiq = document.getElementById("input-search-liquidaciones");
    const filterEstado = document.getElementById("select-filter-liquidacion-estado");
    
    if (!selectMes) return;
    
    // Generar opciones de meses (últimos 3 meses y próximo)
    const hoy = new Date();
    selectMes.innerHTML = "";
    
    for (let i = -2; i <= 1; i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${yyyy}-${mm}`;
        const label = `${MESES_NOMBRES[d.getMonth()]} ${yyyy}`;
        
        const option = document.createElement("option");
        option.value = key;
        option.innerText = label;
        if (i === 0) option.selected = true; // Mes actual por defecto
        
        selectMes.appendChild(option);
    }
    
    // Listeners
    selectMes.addEventListener("change", () => {
        renderLiquidaciones();
        renderTablero();
    });
    if (btnGenerar) btnGenerar.addEventListener("click", generarLiquidacionesCiclo);
    if (searchLiq) searchLiq.addEventListener("input", renderLiquidaciones);
    if (filterEstado) filterEstado.addEventListener("change", renderLiquidaciones);

    // Modal de Pago Manual
    const btnAddPagoManual = document.getElementById("btn-add-pago-manual");
    const modalPagoManual = document.getElementById("modal-pago-manual");
    const formPagoManual = document.getElementById("form-pago-manual");
    const selectEstadoPago = document.getElementById("form-input-pago-estado");
    const groupPagoMetodo = document.getElementById("group-pago-manual-metodo");
    
    if (btnAddPagoManual && modalPagoManual && formPagoManual) {
        btnAddPagoManual.addEventListener("click", () => {
            try {
                formPagoManual.reset();
                if (groupPagoMetodo) groupPagoMetodo.style.display = "block"; // Mostrar por defecto ya que "Pagado" está seleccionado
                populatePagoManualAlumnos();
                openModal(modalPagoManual);
            } catch (err) {
                alert("Error al abrir modal de pago manual:\n" + err.message + "\nStack:\n" + err.stack);
            }
        });
        
        const closeBtn = document.getElementById("close-modal-pago-manual");
        if (closeBtn) closeBtn.addEventListener("click", () => closeModal(modalPagoManual));
        
        const cancelBtn = document.getElementById("btn-cancel-pago-manual");
        if (cancelBtn) cancelBtn.addEventListener("click", () => closeModal(modalPagoManual));
        
        if (selectEstadoPago && groupPagoMetodo) {
            selectEstadoPago.addEventListener("change", () => {
                if (selectEstadoPago.value === "Pendiente") {
                    groupPagoMetodo.style.display = "none";
                } else {
                    groupPagoMetodo.style.display = "block";
                }
            });
        }
        
        formPagoManual.addEventListener("submit", (e) => {
            e.preventDefault();
            const alumnoId = document.getElementById("form-input-pago-alumno").value;
            const concepto = document.getElementById("form-input-pago-concepto").value.trim();
            const monto = parseFloat(document.getElementById("form-input-pago-monto").value) || 0;
            const estado = document.getElementById("form-input-pago-estado").value;
            const selectedMonth = selectMes.value;
            const metodo = estado === "Pagado" ? (document.getElementById("form-input-pago-metodo").value || "Transferencia") : undefined;
            
            if (!alumnoId) {
                showToast("Debes seleccionar un alumno.", "danger");
                return;
            }
            
            const newLiq = {
                id: "liq-manual-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
                alumnoId: alumnoId,
                mes: selectedMonth,
                montoBase: monto,
                descuentoMonto: 0,
                montoNeto: monto,
                descuentoNombre: concepto,
                estado: estado,
                esManual: true,
                metodoPago: metodo
            };
            
            db.liquidaciones.push(newLiq);
            saveDB();
            renderLiquidaciones();
            renderTablero();
            closeModal(modalPagoManual);
            showToast(`Pago de ${formatCurrency(monto)} registrado correctamente.`);
        });
    }

    // Modal Confirmar Cobro (para cuotas automáticas y manuales pendientes)
    const modalCobrar = document.getElementById("modal-cobrar-cuota");
    const formCobrar = document.getElementById("form-cobrar-cuota");
    
    if (modalCobrar && formCobrar) {
        const closeCobrarBtn = document.getElementById("close-modal-cobrar-cuota");
        if (closeCobrarBtn) closeCobrarBtn.addEventListener("click", () => closeModal(modalCobrar));
        
        const cancelCobrarBtn = document.getElementById("btn-cancel-cobrar-cuota");
        if (cancelCobrarBtn) cancelCobrarBtn.addEventListener("click", () => closeModal(modalCobrar));
        
        formCobrar.addEventListener("submit", (e) => {
            e.preventDefault();
            const id = document.getElementById("form-cobrar-liq-id").value;
            const metodo = document.getElementById("form-cobrar-metodo").value;
            
            const liq = db.liquidaciones.find(l => l.id === id);
            if (liq) {
                liq.estado = "Pagado";
                liq.metodoPago = metodo;
                saveDB();
                renderLiquidaciones();
                renderTablero();
                closeModal(modalCobrar);
                showToast(`Pago registrado con éxito (${metodo}).`);
            }
        });
    }
}

function populatePagoManualAlumnos() {
    const select = document.getElementById("form-input-pago-alumno");
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Selecciona un alumno</option>';
    if (!db.alumnos || !Array.isArray(db.alumnos)) return;
    
    try {
        const sortedAlumnos = [...db.alumnos].sort((a, b) => {
            const nameA = String(a.nombre || "").trim();
            const nameB = String(b.nombre || "").trim();
            return nameA.localeCompare(nameB);
        });
        sortedAlumnos.forEach(al => {
            if (al && al.id) {
                const label = al.nombre || "Sin nombre";
                select.innerHTML += `<option value="${al.id}">${label}</option>`;
            }
        });
    } catch (err) {
        console.error("Error populating manual payment alumnos:", err);
        db.alumnos.forEach(al => {
            if (al && al.id) {
                select.innerHTML += `<option value="${al.id}">${al.nombre || "Sin nombre"}</option>`;
            }
        });
    }
}

function deleteLiquidacion(id) {
    const liq = db.liquidaciones.find(l => l.id === id);
    if (!liq) return;
    
    const isManual = liq.esManual || liq.id.startsWith("liq-manual-");
    const confirmMsg = isManual 
        ? "¿Estás seguro de que deseas eliminar este pago manual?"
        : "¿Estás seguro de que deseas eliminar esta cuota mensual? Podrás volver a generarla haciendo clic en el botón 'Generar Liquidación del Mes' tras actualizar la ficha del alumno.";
        
    if (confirm(confirmMsg)) {
        db.liquidaciones = db.liquidaciones.filter(l => l.id !== id);
        saveDB();
        renderLiquidaciones();
        renderTablero();
        showToast(isManual ? "Pago manual eliminado." : "Cuota eliminada. Lista para regenerar.", "danger");
    }
}

function generarLiquidacionesCiclo() {
    const selectMes = document.getElementById("select-liquidacion-mes");
    const selectedMonth = selectMes.value;
    const mesLabel = selectMes.options[selectMes.selectedIndex].text;
    
    if (db.alumnos.length === 0) {
        showToast("No hay alumnos registrados para generar liquidaciones.", "warning");
        return;
    }
    
    let creados = 0;
    
    db.alumnos.forEach(al => {
        // Verificar si ya existe liquidación para este alumno en este mes
        const existe = db.liquidaciones.some(liq => liq.alumnoId === al.id && liq.mes === selectedMonth);
        if (existe) return;
        
        // Calcular cuota
        const sede = db.sedes.find(s => s.id === al.sedeId);
        if (!sede) return;
        
        const freq = al.frecuencia; // 1, 2 o 3
        const base1 = sede.precios[freq] || 0;
        
        let base2 = 0;
        if (al.sedeExtraId && al.frecuenciaExtra) {
            const sedeExtra = db.sedes.find(s => s.id === al.sedeExtraId);
            if (sedeExtra) {
                base2 = sedeExtra.precios[al.frecuenciaExtra] || 0;
            }
        }
        
        const montoBase = base1 + base2;
        
        // Calcular descuento
        let descuentoMonto = 0;
        let descNombre = "Ninguno";
        if (al.descuentoId) {
            const desc = db.descuentos.find(d => d.id === al.descuentoId);
            if (desc) {
                descNombre = desc.nombre;
                if (desc.tipo === "porcentaje") {
                    descuentoMonto = montoBase * (desc.valor / 100);
                } else if (desc.tipo === "fijo") {
                    descuentoMonto = desc.valor;
                }
            }
        }
        
        const montoNeto = Math.max(0, montoBase - descuentoMonto);
        
        db.liquidaciones.push({
            id: "liq-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
            alumnoId: al.id,
            mes: selectedMonth,
            montoBase,
            descuentoMonto,
            montoNeto,
            descuentoNombre: descNombre,
            estado: "Pendiente"
        });
        
        creados++;
    });
    
    if (creados > 0) {
        saveDB();
        renderLiquidaciones();
        renderTablero();
        showToast(`Se generaron ${creados} órdenes de pago para el ciclo ${mesLabel}.`);
    } else {
        showToast(`Las cuotas del ciclo ${mesLabel} ya se encontraban liquidadas.`, "warning");
    }
}

function renderLiquidaciones() {
    const selectMes = document.getElementById("select-liquidacion-mes");
    const tbody = document.getElementById("tbody-liquidaciones");
    const countEl = document.getElementById("liquidaciones-count");
    const searchVal = document.getElementById("input-search-liquidaciones").value.toLowerCase().trim();
    const filterEstado = document.getElementById("select-filter-liquidacion-estado").value;
    
    if (!selectMes || !tbody) return;
    
    const selectedMonth = selectMes.value;
    const mesLabel = selectMes.options[selectMes.selectedIndex].text;
    
    // Filtrar por mes
    let filtrados = db.liquidaciones.filter(liq => liq.mes === selectedMonth);
    
    // Cruzar con alumnos y filtrar por buscador
    const result = [];
    filtrados.forEach(liq => {
        const al = db.alumnos.find(alumno => alumno.id === liq.alumnoId);
        if (!al) return; // Alumno eliminado posterior a la liquidación
        
        const sede = db.sedes.find(s => s.id === al.sedeId);
        const sedeNombre = sede ? sede.nombre : "Desconocida";
        
        // Filtro buscador (nombre o teléfono)
        if (searchVal && !al.nombre.toLowerCase().includes(searchVal) && !al.telefono.includes(searchVal)) return;
        
        // Filtro estado
        if (filterEstado && liq.estado !== filterEstado) return;
        
        result.push({ liq, al, sedeNombre });
    });
    
    tbody.innerHTML = "";
    countEl.innerText = `${result.length} órdenes de pago listadas para ${mesLabel}.`;
    
    if (result.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No se encontraron órdenes de pago para los filtros seleccionados.</td></tr>`;
        return;
    }
    
    result.forEach(({ liq, al, sedeNombre }) => {
        const tr = document.createElement("tr");
        
        let badgeEstado = "";
        if (liq.estado === "Pagado") {
            const metodo = liq.metodoPago || "Transferencia";
            let icon = '<i class="fa-solid fa-money-bill-transfer"></i>';
            if (metodo === "Efectivo") {
                icon = '<i class="fa-solid fa-money-bill-wave" style="color:var(--success-light);"></i>';
            } else if (metodo === "Mercado Pago") {
                icon = '<i class="fa-solid fa-wallet" style="color:#00b1ea;"></i>';
            }
            badgeEstado = `
                <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
                    <span class="discount-tag" style="background-color:rgba(16,185,129,0.1); color:var(--success-light); border-color:rgba(16,185,129,0.25);">Pagado</span>
                    <span class="text-muted" style="font-size:10px; display:inline-flex; align-items:center; gap:3px; font-weight:500;">${icon} ${metodo}</span>
                </div>
            `;
        } else {
            badgeEstado = '<span class="discount-tag" style="background-color:rgba(245,158,11,0.1); color:var(--warning); border-color:rgba(245,158,11,0.25);">Pendiente</span>';
        }
            
        const btnToggle = liq.estado === "Pagado"
            ? `<button class="btn btn-danger-outline btn-sm" onclick="toggleEstadoLiquidacion('${liq.id}')" style="padding:4px 8px; font-size:10px;"><i class="fa-solid fa-rotate-left"></i> Revertir</button>`
            : `<button class="btn btn-primary btn-sm" onclick="toggleEstadoLiquidacion('${liq.id}')" style="padding:4px 8px; font-size:10px;"><i class="fa-solid fa-circle-check"></i> Cobrar</button>`;
            
        const isManual = liq.esManual || liq.id.startsWith("liq-manual-");
        
        // Detalle de descuento o concepto descriptivo
        const descTexto = isManual
            ? `<span class="discount-tag" style="background-color:rgba(255,107,0,0.1); color:var(--accent-secondary); border-color:rgba(255,107,0,0.25);">${liq.descuentoNombre}</span>`
            : liq.descuentoMonto > 0 
                ? `${formatCurrency(liq.montoBase)} - ${formatCurrency(liq.descuentoMonto)} <span class="text-muted" style="font-size:10px;">(${liq.descuentoNombre})</span>`
                : `${formatCurrency(liq.montoBase)}`;
                
        let claseColTexto = "";
        if (isManual) {
            claseColTexto = '<span class="text-muted" style="font-style:italic;">Pago Adicional</span>';
        } else {
            claseColTexto = `${sedeNombre} <span class="text-muted" style="font-size:11px;">(${al.frecuencia} vez/sem)</span>`;
            if (al.sedeExtraId) {
                const sedeExtra = db.sedes.find(s => s.id === al.sedeExtraId);
                const extraNombre = sedeExtra ? sedeExtra.nombre : "Clase Extra";
                claseColTexto += `<div class="text-muted text-xs" style="margin-top: 4px; font-weight: 500;"><i class="fa-solid fa-plus" style="font-size:8px; margin-right:4px; color:var(--accent-primary);"></i>${extraNombre} (${al.frecuenciaExtra} vez/sem)</div>`;
            }
        }
            
        // Enlace de WhatsApp con el desglose de cuota
        let wsMsg = "";
        if (isManual) {
            wsMsg = encodeURIComponent(`Hola ${al.nombre}! Te compartimos el detalle de tu pago adicional para el ciclo de ${mesLabel}:\n\n- Concepto: ${liq.descuentoNombre}\n- Monto: *${formatCurrency(liq.montoNeto)}*\n\nPodés realizar el pago por transferencia bancaria y enviarnos el comprobante por este medio. ¡Muchas gracias! Baila con Wally.`);
        } else {
            let claseDetalleMsg = `- Clase: ${sedeNombre} (${al.frecuencia} vez/sem)`;
            if (al.sedeExtraId) {
                const sedeExtra = db.sedes.find(s => s.id === al.sedeExtraId);
                const extraNombre = sedeExtra ? sedeExtra.nombre : "Clase Extra";
                claseDetalleMsg = `- Clase Principal: ${sedeNombre} (${al.frecuencia} vez/sem)\n- Clase Extra: ${extraNombre} (${al.frecuenciaExtra} vez/sem)`;
            }
            wsMsg = encodeURIComponent(`Hola ${al.nombre}! Te compartimos el detalle de tu cuota mensual para el ciclo de ${mesLabel}:\n\n${claseDetalleMsg}\n- Monto Base: ${formatCurrency(liq.montoBase)}\n${liq.descuentoMonto > 0 ? `- Descuento: ${formatCurrency(liq.descuentoMonto)} (${liq.descuentoNombre})\n` : ""}- Total Neto: *${formatCurrency(liq.montoNeto)}*\n\nPodés realizar el pago por transferencia bancaria y enviarnos el comprobante por este medio. ¡Muchas gracias! Baila con Wally.`);
        }
        
        const whatsappBtn = `
            <a href="https://wa.me/${al.telefono}?text=${wsMsg}" target="_blank" class="btn btn-secondary btn-sm" style="color:var(--accent-primary); border-color:rgba(255,107,0,0.3); padding:4px 8px; font-size:10px;">
                <i class="fa-brands fa-whatsapp"></i> Notificar
            </a>
        `;
        
        const deleteBtn = (isManual || liq.estado === "Pendiente")
            ? `<button class="btn btn-danger-outline btn-sm btn-icon-only" onclick="deleteLiquidacion('${liq.id}')" style="height:26px; width:26px; padding:0; font-size:10px; margin-left:4px;" title="${isManual ? 'Eliminar Pago Manual' : 'Eliminar cuota para volver a calcular'}"><i class="fa-solid fa-trash-can"></i></button>`
            : '';
        
        tr.innerHTML = `
            <td style="font-weight:600; color:var(--text-primary);">${al.nombre}</td>
            <td>${claseColTexto}</td>
            <td>${descTexto}</td>
            <td style="font-weight:700; color:var(--text-primary);">${formatCurrency(liq.montoNeto)}</td>
            <td>${badgeEstado}</td>
            <td>${btnToggle}</td>
            <td>
                <div style="display:flex; align-items:center; gap:4px;">
                    ${whatsappBtn}
                    ${deleteBtn}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleEstadoLiquidacion(id) {
    try {
        const liq = db.liquidaciones.find(l => l.id === id);
        if (!liq) return;
        
        const al = db.alumnos.find(a => a.id === liq.alumnoId);
        const alNombre = al ? al.nombre : "Alumno Desconocido";
        
        if (liq.estado === "Pagado") {
            // Revertir a pendiente directamente (se borra el método de pago)
            liq.estado = "Pendiente";
            delete liq.metodoPago;
            saveDB();
            renderLiquidaciones();
            renderTablero();
            showToast(`Pago revertido para ${alNombre}.`, "warning");
        } else {
            // Abrir modal para elegir método de pago
            const isManual = liq.esManual || liq.id.startsWith("liq-manual-");
            let conceptoText = "";
            if (isManual) {
                conceptoText = liq.descuentoNombre;
            } else if (al) {
                const sede = db.sedes.find(s => s.id === al.sedeId);
                conceptoText = sede ? sede.nombre : "Clase Principal";
                if (al.sedeExtraId) {
                    const SedeExtra = db.sedes.find(s => s.id === al.sedeExtraId);
                    if (SedeExtra) {
                        conceptoText += ` + ${SedeExtra.nombre}`;
                    }
                }
            }
            
            const elId = document.getElementById("form-cobrar-liq-id");
            const elNombre = document.getElementById("cobrar-alumno-nombre");
            const elConcepto = document.getElementById("cobrar-concepto");
            const elMonto = document.getElementById("cobrar-monto");
            const elMetodo = document.getElementById("form-cobrar-metodo");
            
            if (elId) elId.value = liq.id;
            if (elNombre) elNombre.innerText = alNombre;
            if (elConcepto) elConcepto.innerText = conceptoText || "Cobranza de clase";
            if (elMonto) elMonto.innerText = formatCurrency(liq.montoNeto);
            if (elMetodo) elMetodo.value = "Transferencia"; // Valor inicial por defecto
            
            const modalCobrar = document.getElementById("modal-cobrar-cuota");
            if (modalCobrar) {
                openModal(modalCobrar);
            } else {
                alert("Error: No se encontró el modal-cobrar-cuota en la página.");
            }
        }
    } catch (err) {
        alert("Error en toggleEstadoLiquidacion:\n" + err.message + "\nStack:\n" + err.stack);
    }
}

function renderTablero() {
    const selectMes = document.getElementById("select-liquidacion-mes");
    if (!selectMes) return;
    const selectedMonth = selectMes.value;
    
    const liquidacionesMes = db.liquidaciones.filter(l => l.mes === selectedMonth);
    
    // 1. CÁLCULO FINANCIERO
    let totalEsperado = 0;
    let totalRecaudado = 0;
    let cuotasPagasCount = 0;
    
    liquidacionesMes.forEach(liq => {
        totalEsperado += liq.montoNeto;
        if (liq.estado === "Pagado") {
            totalRecaudado += liq.montoNeto;
            cuotasPagasCount++;
        }
    });
    
    // Costo Alquileres mensual fijo
    let totalAlquileres = 0;
    db.sedes.forEach(s => totalAlquileres += s.alquiler);
    
    // Costo Combustible mensual (Teorico semanal * 4.33 semanas/mes)
    const precioLitro = parseFloat(document.getElementById("input-combustible-precio").value) || 0;
    const rendimiento = parseFloat(document.getElementById("input-combustible-rendimiento").value) || 1;
    
    let combustibleSemanal = 0;
    db.sedes.forEach(s => {
        const distIdaVuelta = s.distancia * 2;
        const consumoViaje = distIdaVuelta / rendimiento;
        const costoViaje = consumoViaje * precioLitro;
        combustibleSemanal += costoViaje * (s.viajesSemanales || 2);
    });
    const combustibleMensual = combustibleSemanal * 4.33;
    
    const totalGastos = totalAlquileres + combustibleMensual;
    const cajaNeta = totalRecaudado - totalGastos;
    
    // Pintar tarjetas
    document.getElementById("tablero-monto-esperado").innerText = formatCurrency(totalEsperado);
    document.getElementById("tablero-sub-esperado").innerText = `${liquidacionesMes.length} cuotas facturadas`;
    
    document.getElementById("tablero-monto-recaudado").innerText = formatCurrency(totalRecaudado);
    document.getElementById("tablero-sub-recaudado").innerText = `${cuotasPagasCount} cobradas | ${liquidacionesMes.length - cuotasPagasCount} pendientes`;
    
    document.getElementById("tablero-monto-gastos").innerText = formatCurrency(totalGastos);
    document.getElementById("tablero-sub-gastos").innerText = `Sala: ${formatCurrency(totalAlquileres)} | Comb: ${formatCurrency(combustibleMensual)}`;
    
    const cajaNetaEl = document.getElementById("tablero-caja-neta");
    cajaNetaEl.innerText = (cajaNeta >= 0 ? "" : "-") + formatCurrency(Math.abs(cajaNeta));
    if (cajaNeta >= 0) {
        cajaNetaEl.style.color = "var(--success-light)";
    } else {
        cajaNetaEl.style.color = "var(--danger-light)";
    }
    
    // 2. CÁLCULOS OPERATIVOS DE PRESENTISMO
    const asistenciasMes = db.asistencias.filter(as => as.fecha.startsWith(selectedMonth));
    document.getElementById("tablero-total-asistencias").innerText = asistenciasMes.length;
    
    // Calcular slots esperados: suma de frecuencias * 4 clases estimadas/mes por alumno
    let slotsEsperadosTotal = 0;
    db.alumnos.forEach(al => {
        slotsEsperadosTotal += (al.frecuencia || 2) * 4;
    });
    
    const tasaPresentismo = slotsEsperadosTotal > 0
        ? Math.min(100, Math.round((asistenciasMes.length / slotsEsperadosTotal) * 100))
        : 0;
    document.getElementById("tablero-tasa-presentismo").innerText = `${tasaPresentismo}%`;
    
    // Alumnos inactivos: no tienen asistencias en este mes
    let inactivosCount = 0;
    db.alumnos.forEach(al => {
        const asistioEnMes = db.asistencias.some(as => as.alumnoId === al.id && as.fecha.startsWith(selectedMonth));
        if (!asistioEnMes) inactivosCount++;
    });
    document.getElementById("tablero-alumnos-inactivos").innerText = inactivosCount;
    
    // 3. RENDERIZACIÓN DE GRÁFICOS (CHART.JS)
    renderCharts(liquidacionesMes, totalAlquileres, combustibleMensual, totalRecaudado);
}

function renderCharts(liquidacionesMes, totalAlquileres, combustibleMensual, totalRecaudado) {
    // Preparar datos de sedes
    const sedesData = db.sedes.map(sede => {
        // Alumnos matriculados en esta sede
        const alumnosCount = db.alumnos.filter(al => al.sedeId === sede.id).length;
        // Facturación en esta sede
        let facturacionSede = 0;
        liquidacionesMes.forEach(liq => {
            const al = db.alumnos.find(a => a.id === liq.alumnoId);
            if (al && al.sedeId === sede.id) {
                facturacionSede += liq.montoNeto;
            }
        });
        return {
            nombre: sede.nombre,
            alumnos: alumnosCount,
            ingresos: facturacionSede
        };
    });
    
    const labelsSedes = sedesData.map(s => s.nombre);
    const dataAlumnos = sedesData.map(s => s.alumnos);
    const dataIngresos = sedesData.map(s => s.ingresos);
    
    // Destruir gráficos previos si existen
    if (chartOcupacion) chartOcupacion.destroy();
    if (chartCaja) chartCaja.destroy();
    
    // --- GRÁFICO 1: OCUPACIÓN Y FACTURACIÓN POR SEDE ---
    const ctxOcupacion = document.getElementById('chart-ocupacion');
    if (ctxOcupacion) {
        chartOcupacion = new Chart(ctxOcupacion, {
            type: 'bar',
            data: {
                labels: labelsSedes,
                datasets: [
                    {
                        label: 'Alumnos Matriculados',
                        data: dataAlumnos,
                        backgroundColor: 'rgba(255, 107, 0, 0.25)',
                        borderColor: '#ff6b00',
                        borderWidth: 1.5,
                        borderRadius: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Ingresos Esperados ($)',
                        data: dataIngresos,
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        borderColor: '#fafafa',
                        borderWidth: 1.5,
                        borderRadius: 1,
                        type: 'line',
                        tension: 0.1,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#aaaaaa',
                            font: { family: 'Montserrat', size: 10, weight: '600' }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,107,0,0.05)' },
                        ticks: { color: '#aaaaaa', font: { family: 'Montserrat', size: 10 } }
                    },
                    y: {
                        position: 'left',
                        grid: { color: 'rgba(255,107,0,0.05)' },
                        ticks: { color: '#aaaaaa', font: { family: 'Montserrat', size: 10 } },
                        title: { display: true, text: 'Alumnos', color: '#aaaaaa' }
                    },
                    y1: {
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { color: '#aaaaaa', font: { family: 'Montserrat', size: 10 } },
                        title: { display: true, text: 'Pesos ($)', color: '#aaaaaa' }
                    }
                }
            }
        });
    }
    
    // --- GRÁFICO 2: CAJA NETA (ESTRUCTURA DE GASTOS) ---
    const ctxCaja = document.getElementById('chart-caja-distribucion');
    if (ctxCaja) {
        const ingresosLibres = Math.max(0, totalRecaudado - (totalAlquileres + combustibleMensual));
        
        chartCaja = new Chart(ctxCaja, {
            type: 'doughnut',
            data: {
                labels: ['Caja Neta Libres', 'Alquiler Salones', 'Costo Combustible'],
                datasets: [{
                    data: [ingresosLibres, totalAlquileres, combustibleMensual],
                    backgroundColor: [
                        '#ff6b00',   // Orange
                        '#2e2e2e',   // Medium Gray
                        '#ffaa66'    // Soft Orange
                    ],
                    borderColor: '#1a1a1a',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#aaaaaa',
                            font: { family: 'Montserrat', size: 9, weight: '600' },
                            padding: 12
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}
// --- FUNCIONES DE AUTENTICACIÓN ---
function initAuth() {
    if (!supabaseClient) {
        console.error("Supabase CDN not loaded.");
        const desc = document.querySelector(".auth-description");
        if (desc) {
            desc.innerHTML = '<span style="color: #ff3b30; font-weight: bold;">Error: No se pudo conectar con Supabase.</span><br>Por favor verifica tu conexión a internet o desactiva bloqueadores de anuncios que puedan restringir el script.';
        }
        return;
    }
    
    // Iniciar con Google
    document.getElementById("btn-login-google").addEventListener("click", async () => {
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            });
            if (error) throw error;
        } catch (e) {
            console.error("Error al iniciar sesión con Google:", e);
            alert("Error al iniciar sesión con Google:\n" + (e.message || e) + (e.stack ? "\nStack:\n" + e.stack : ""));
            showToast("Error de conexión con Google", "danger");
        }
    });
    
    // Iniciar con Email / Password
    document.getElementById("auth-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email").value.trim();
        const password = document.getElementById("auth-password").value;
        const btnSubmit = document.getElementById("btn-login-submit");
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Ingresando...";
        
        try {
            const { error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) throw error;
            showToast("Sesión iniciada correctamente", "success");
        } catch (err) {
            console.error("Error de login por email:", err);
            showToast("Credenciales inválidas o no configuradas", "danger");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Ingresar";
        }
    });
    
    // Cerrar sesión
    document.getElementById("btn-logout").addEventListener("click", async () => {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            showToast("Sesión cerrada", "success");
        } catch (e) {
            console.error("Error al cerrar sesión:", e);
        }
    });

    // Escuchar estado de autenticación
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth event:", event, session);
        const gate = document.getElementById("w-gatekeeper") || document.getElementById("auth-overlay");
        if (session) {
            currentUser = session.user;
            if (gate) gate.style.display = "none";
            document.getElementById("btn-logout").style.display = "block";
            const dot = document.getElementById("auth-status-dot");
            if (dot) dot.style.backgroundColor = "var(--success-color)";
            const text = document.getElementById("auth-status-text");
            if (text) text.innerText = currentUser.email.split("@")[0];
            
            // Cargar datos de la nube
            await pullFromCloud();
        } else {
            currentUser = null;
            if (gate) gate.style.display = "flex";
            document.getElementById("btn-logout").style.display = "none";
            const dot = document.getElementById("auth-status-dot");
            if (dot) dot.style.backgroundColor = "var(--danger-light)";
            const text = document.getElementById("auth-status-text");
            if (text) text.innerText = "Desconectado";
        }
    });
}

// --- MÓDULO DE REPORTES MENSUALES ---
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function getMonthLabel(yearMonth) {
    if (!yearMonth) return "";
    const [year, month] = yearMonth.split("-");
    const monthIdx = parseInt(month) - 1;
    return `${MESES[monthIdx]} ${year}`;
}

function initReportes() {
    const selectorMes = document.getElementById("reporte-mes-anio");
    if (!selectorMes) return;
    
    // Establecer mes actual por defecto (formato YYYY-MM)
    const hoy = new Date();
    const mesActual = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0");
    selectorMes.value = mesActual;
    
    // Listener de cambios
    selectorMes.addEventListener("change", renderReporte);
    
    // Botones de acción
    document.getElementById("btn-reporte-copiar").addEventListener("click", copyReportToClipboard);
    document.getElementById("btn-reporte-imprimir").addEventListener("click", () => {
        window.print();
    });
}

function getReportData() {
    const selectorMes = document.getElementById("reporte-mes-anio");
    if (!selectorMes) return null;
    
    const selectedMonth = selectorMes.value;
    const mesLabel = getMonthLabel(selectedMonth);
    
    const liquidacionesMes = db.liquidaciones.filter(l => l.mes === selectedMonth);
    
    // Ingresos y desglose de método de pago
    let totalEsperado = 0;
    let totalRecaudado = 0;
    let cuotasPagasCount = 0;
    let totalTransferencia = 0;
    let totalEfectivo = 0;
    let totalMercadoPago = 0;
    
    liquidacionesMes.forEach(liq => {
        totalEsperado += liq.montoNeto;
        if (liq.estado === "Pagado") {
            totalRecaudado += liq.montoNeto;
            cuotasPagasCount++;
            
            const metodo = liq.metodoPago || "Transferencia";
            if (metodo === "Transferencia") {
                totalTransferencia += liq.montoNeto;
            } else if (metodo === "Efectivo") {
                totalEfectivo += liq.montoNeto;
            } else if (metodo === "Mercado Pago") {
                totalMercadoPago += liq.montoNeto;
            }
        }
    });
    
    const totalPendiente = totalEsperado - totalRecaudado;
    
    // Alquileres de Sedes
    let totalAlquileres = 0;
    db.sedes.forEach(s => totalAlquileres += s.alquiler);
    
    // Combustible
    const precioLitro = parseFloat(document.getElementById("input-combustible-precio").value) || 0;
    const rendimiento = parseFloat(document.getElementById("input-combustible-rendimiento").value) || 1;
    
    let combustibleSemanal = 0;
    db.sedes.forEach(s => {
        const distIdaVuelta = s.distancia * 2;
        const consumoViaje = distIdaVuelta / rendimiento;
        const costoViaje = consumoViaje * precioLitro;
        combustibleSemanal += costoViaje * (s.viajesSemanales || 2);
    });
    
    const combustibleTeoricoMensual = combustibleSemanal * 4.33;
    const combustibleRealSemanal = db.settings.logisticaGastoReal || 0;
    const combustibleRealMensual = combustibleRealSemanal * 4.33;
    
    const gastoCombustible = combustibleRealMensual > 0 ? combustibleRealMensual : combustibleTeoricoMensual;
    const totalGastos = totalAlquileres + gastoCombustible;
    const cajaNeta = totalRecaudado - totalGastos;
    
    // Métricas de Asistencia
    const asistenciasMes = db.asistencias.filter(as => as.fecha.startsWith(selectedMonth));
    let slotsEsperadosTotal = 0;
    db.alumnos.forEach(al => {
        slotsEsperadosTotal += (al.frecuencia || 2) * 4;
    });
    
    const tasaPresentismo = slotsEsperadosTotal > 0
        ? Math.min(100, Math.round((asistenciasMes.length / slotsEsperadosTotal) * 100))
        : 0;
        
    // Agrupar Ingresos por Sede
    const sedesResumen = db.sedes.map(sede => {
        const alumnosSede = db.alumnos.filter(al => al.sedeId === sede.id);
        let recaudadoSede = 0;
        
        liquidacionesMes.forEach(liq => {
            const al = alumnosSede.find(a => a.id === liq.alumnoId);
            if (al && liq.estado === "Pagado") {
                recaudadoSede += liq.montoNeto;
            }
        });
        
        return {
            nombre: sede.nombre,
            alumnosCount: alumnosSede.length,
            recaudado: recaudadoSede
        };
    });
    
    return {
        mesLabel,
        totalEsperado,
        totalRecaudado,
        totalPendiente,
        cuotasPagasCount,
        cuotasTotalCount: liquidacionesMes.length,
        totalAlquileres,
        gastoCombustible,
        totalGastos,
        cajaNeta,
        asistenciasMesCount: asistenciasMes.length,
        alumnosActivosCount: db.alumnos.length,
        tasaPresentismo,
        sedesResumen,
        totalTransferencia,
        totalEfectivo,
        totalMercadoPago
    };
}

function renderReporte() {
    const r = getReportData();
    if (!r) return;
    
    // Pintar KPIs
    document.getElementById("rep-kpi-ingresos").innerText = formatCurrency(r.totalRecaudado);
    document.getElementById("rep-kpi-ingresos-desc").innerText = `${r.cuotasPagasCount} cuotas cobradas (de ${r.cuotasTotalCount} generadas)`;
    
    document.getElementById("rep-kpi-egresos").innerText = formatCurrency(r.totalGastos);
    document.getElementById("rep-kpi-egresos-desc").innerText = `Alquileres: ${formatCurrency(r.totalAlquileres)} | Combustible: ${formatCurrency(r.gastoCombustible)}`;
    
    const netoEl = document.getElementById("rep-kpi-neto");
    netoEl.innerText = (r.cajaNeta >= 0 ? "" : "-") + formatCurrency(Math.abs(r.cajaNeta));
    netoEl.style.color = r.cajaNeta >= 0 ? "var(--success-light)" : "var(--danger-light)";
    document.getElementById("rep-kpi-neto-desc").innerText = `Recaudado Real - Gastos Operativos`;
    
    document.getElementById("rep-kpi-asistencia").innerText = `${r.tasaPresentismo}%`;
    document.getElementById("rep-kpi-asistencia-desc").innerText = `Alumnos activos: ${r.alumnosActivosCount} | Clases: ${r.asistenciasMesCount}`;
    
    // Renderizar Tabla de Ingresos por Sede
    const tbodyIngresos = document.getElementById("rep-table-ingresos-body");
    tbodyIngresos.innerHTML = "";
    r.sedesResumen.forEach(s => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight: 600; color: var(--text-primary);">${s.nombre}</td>
            <td style="text-align: right;">${s.alumnosCount} alumnos</td>
            <td style="text-align: right; font-weight: 700; color: var(--success-light);">${formatCurrency(s.recaudado)}</td>
        `;
        tbodyIngresos.appendChild(tr);
    });
    
    // Renderizar Tabla de Ingresos por Método de Pago
    const tbodyMetodos = document.getElementById("rep-table-metodos-body");
    if (tbodyMetodos) {
        tbodyMetodos.innerHTML = `
            <tr>
                <td style="font-weight: 600; color: var(--text-primary);"><i class="fa-solid fa-money-bill-transfer" style="margin-right: 6px; width: 16px; color: var(--text-secondary);"></i>Transferencia Bancaria</td>
                <td style="text-align: right; font-weight: 700; color: var(--success-light);">${formatCurrency(r.totalTransferencia)}</td>
            </tr>
            <tr>
                <td style="font-weight: 600; color: var(--text-primary);"><i class="fa-solid fa-money-bill-wave" style="margin-right: 6px; width: 16px; color: var(--success-light);"></i>Efectivo</td>
                <td style="text-align: right; font-weight: 700; color: var(--success-light);">${formatCurrency(r.totalEfectivo)}</td>
            </tr>
            <tr>
                <td style="font-weight: 600; color: var(--text-primary);"><i class="fa-solid fa-wallet" style="margin-right: 6px; width: 16px; color: #00b1ea;"></i>Mercado Pago</td>
                <td style="text-align: right; font-weight: 700; color: var(--success-light);">${formatCurrency(r.totalMercadoPago)}</td>
            </tr>
        `;
    }
    
    // Renderizar Tabla de Egresos
    const tbodyEgresos = document.getElementById("rep-table-egresos-body");
    tbodyEgresos.innerHTML = `
        <tr>
            <td style="font-weight: 600;">Alquileres de Salones (Fijos)</td>
            <td style="text-align: right; font-weight: 700; color: var(--danger-light);">${formatCurrency(r.totalAlquileres)}</td>
        </tr>
        <tr>
            <td style="font-weight: 600;">Logística / Combustible</td>
            <td style="text-align: right; font-weight: 700; color: var(--danger-light);">${formatCurrency(r.gastoCombustible)}</td>
        </tr>
        <tr style="border-top: 2px solid var(--border-color); background: rgba(255,255,255,0.02);">
            <td style="font-weight: 700; color: var(--text-primary);">TOTAL EGRESOS</td>
            <td style="text-align: right; font-weight: 800; color: var(--danger-light);">${formatCurrency(r.totalGastos)}</td>
        </tr>
    `;
}

function copyReportToClipboard() {
    const r = getReportData();
    if (!r) return;
    
    const line = "=========================================";
    const separator = "-----------------------------------------";
    
    let sedesTexto = "";
    r.sedesResumen.forEach(s => {
        sedesTexto += `- ${s.nombre}: ${formatCurrency(s.recaudado)} (${s.alumnosCount} alumnos)\n`;
    });
    
    const texto = `${line}
BAILA CON WALLY - REPORTE MENSUAL OPERATIVO
Período: ${r.mesLabel}
${line}

RESUMEN FINANCIERO:
- Ingresos Recaudados (Real): ${formatCurrency(r.totalRecaudado)}
- Ingresos Pendientes de Cobro: ${formatCurrency(r.totalPendiente)}
- Total Facturado Esperado: ${formatCurrency(r.totalEsperado)}
${separator}
COBROS POR MÉTODO DE PAGO:
- Transferencia Bancaria: ${formatCurrency(r.totalTransferencia)}
- Efectivo: ${formatCurrency(r.totalEfectivo)}
- Mercado Pago: ${formatCurrency(r.totalMercadoPago)}
${separator}
- Gastos de Alquileres: ${formatCurrency(r.totalAlquileres)}
- Gasto de Combustible: ${formatCurrency(r.gastoCombustible)}
- TOTAL EGRESOS OPERATIVOS: ${formatCurrency(r.totalGastos)}
${separator}
=> CAJA NETA REAL LIBRE: ${formatCurrency(r.cajaNeta)}

MÉTRICAS OPERATIVAS:
- Alumnos Activos Matriculados: ${r.alumnosActivosCount}
- Clases Dictadas / Asistencias: ${r.asistenciasMesCount}
- Tasa de Asistencia General: ${r.tasaPresentismo}%

DESGLOSE DE INGRESOS POR CLASE:
${sedesTexto}${line}
Generado automáticamente por Wally CRM.`;

    navigator.clipboard.writeText(texto).then(() => {
        showToast("¡Reporte mensual copiado al portapapeles!", "success");
    }).catch(err => {
        console.error("No se pudo copiar el reporte:", err);
        showToast("Error al copiar al portapapeles", "danger");
    });
}

// --- INITIALIZE APPLICATION ---
function initializeApp() {
    initAuth();
    initNavigation();
    renderSedes();
    renderDescuentos();
    initLogisticaInputs();
    
    // Fase 2: Alumnos
    initAlumnosListeners();
    populateAlumnoDropdowns();
    renderAlumnos();
    
    // Fase 3: Presentismo
    initPresentismo();
    populatePresentismoSedeDropdown();
    renderPresentismo();

    // Fase 4: Liquidación y Tablero
    initLiquidaciones();
    renderLiquidaciones();
    renderTablero();

    // Módulo de Reportes
    initReportes();
    renderReporte();
}

// --- BOOTSTRAP APP ---
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}

// Exponer funciones globales para los manejadores onclick en HTML
window.toggleEstadoLiquidacion = toggleEstadoLiquidacion;
window.deleteLiquidacion = deleteLiquidacion;
window.editAlumno = editAlumno;
window.deleteAlumno = deleteAlumno;
window.marcarPresente = marcarPresente;
window.deshacerAsistencia = deshacerAsistencia;
window.editSede = editSede;
window.deleteSede = deleteSede;
window.editDescuento = editDescuento;
window.deleteDescuento = deleteDescuento;
window.editDistancia = editDistancia;
