// UI Elements
const analyzeBtn = document.getElementById('btn-analyze');
const ytInput = document.getElementById('yt-url');
const loadingState = document.getElementById('loading-state');
const resultContainer = document.getElementById('result-container');
const choreoBody = document.getElementById('choreo-body');
const songTitle = document.getElementById('song-title');
const saveBtn = document.getElementById('btn-save');

const btnNew = document.getElementById('btn-new');
const btnHistory = document.getElementById('btn-history');
const btnSettings = document.getElementById('btn-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');

const analyzeSection = document.getElementById('analyze-section');
const historySection = document.getElementById('history-section');
const settingsSection = document.getElementById('settings-section');
const apiKeyInput = document.getElementById('api-key');

// Initialize State
let apiKey = localStorage.getItem('wally_api_key') || '';
if (apiKey) apiKeyInput.value = apiKey;

// MEMORIA DEL ASISTENTE (Historial)
let history = JSON.parse(localStorage.getItem('wally_choreo_history') || '[]');

// RECUPERACIÓN DE SEGURIDAD (Amiga Mía)
if (history.length === 0) {
    history = [{
        id: 1715148000000,
        title: "La K'onga & Maxi Espindola - Amiga Mía",
        url: "https://www.youtube.com/watch?v=IH1Ni5g4Jhg",
        date: "08/05/2026",
        moments: [
            { name: "Intro", time: "0:00", lyrics: "amiga mía vamos Maxi", notes: "" },
            { name: "Verso 1", time: "0:10", lyrics: "amiga mía lo sé si no vives por él que lo sabe también...", notes: "" },
            { name: "Pre-Estribillo", time: "0:40", lyrics: "él no te ha visto temblar esperando una palabra...", notes: "" },
            { name: "Interludio", time: "1:05", lyrics: "vamos la suena el cuarteto de Córdoba...", notes: "" },
            { name: "Verso 2", time: "1:15", lyrics: "y amiga mía no sé qué decir ni qué hacer para verte feliz...", notes: "" },
            { name: "Estribillo", time: "1:40", lyrics: "amiga mía ojalá algún día escuchando mi canción...", notes: "" },
            { name: "Post-Estribillo", time: "2:10", lyrics: "amiga mía princesa de un cuento infinito...", notes: "" },
            { name: "Puente", time: "2:40", lyrics: "la coca mueva mueva mueva...", notes: "" },
            { name: "Final", time: "3:20", lyrics: "amiga mía princesa de un cuento infinito...", notes: "" }
        ]
    }];
    localStorage.setItem('wally_choreo_history', JSON.stringify(history));
}

// Navigation
function showSection(sectionId) {
    const sections = ['analyze-section', 'history-section', 'settings-section'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
}

// Event Listeners
btnNew.onclick = () => { showSection('analyze-section'); btnNew.classList.add('active'); };
btnHistory.onclick = () => { 
    renderHistory();
    showSection('history-section'); 
    btnHistory.classList.add('active'); 
};
btnSettings.onclick = () => { showSection('settings-section'); btnSettings.classList.add('active'); };
btnCloseSettings.onclick = () => { showSection('analyze-section'); btnNew.classList.add('active'); };

btnSaveSettings.onclick = () => {
    apiKey = apiKeyInput.value.trim();
    if (apiKey) {
        localStorage.setItem('wally_api_key', apiKey);
        alert('Configuración guardada correctamente.');
        showSection('analyze-section');
        btnNew.classList.add('active');
    } else {
        alert('Por favor, ingresa una clave válida.');
    }
};

// AI Logic
async function analyzeSong(url) {
    if (!apiKey) {
        alert('Por favor, configura tu API Key primero.');
        showSection('settings-section');
        return null;
    }
    const prompt = `Analiza este video de YouTube para un plan de coreografía: ${url}. Extrae la letra y sepárala en momentos (Intro, Verso, Estribillo, etc). Responde solo con JSON puro: { "title": "...", "moments": [{ "name": "...", "time": "...", "lyrics": "..." }] }`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const result = await response.json();
        const text = result.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        throw new Error("Error en el análisis: " + error.message);
    }
}

analyzeBtn.onclick = async () => {
    const url = ytInput.value.trim();
    if (!url) return alert('Pega un link de YouTube');
    loadingState.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    try {
        const data = await analyzeSong(url);
        if (data) {
            const newEntry = { id: Date.now(), ...data, url: url, date: new Date().toLocaleDateString() };
            history.unshift(newEntry);
            localStorage.setItem('wally_choreo_history', JSON.stringify(history));
            renderResult(data);
        }
    } catch (error) { alert(error.message); } finally { loadingState.classList.add('hidden'); }
};

function renderHistory() {
    historySection.innerHTML = `
        <div class="header-action"><h2>Tu Historial de Coreos</h2></div>
        <div class="history-list" style="margin-top: 20px;">
            ${history.map(item => `
                <div class="glass-card history-item" onclick="loadFromHistory(${item.id})" style="margin-bottom: 12px; cursor: pointer; padding: 18px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,107,0,0.1); border-radius: 15px;">
                    <div>
                        <strong style="display: block; color: #FF6B00; font-size: 1.1rem;">${item.title}</strong>
                        <small style="color: rgba(255,255,255,0.4);">${item.date} • ${item.moments.length} momentos</small>
                    </div>
                    <span style="font-size: 1.2rem;">👁️</span>
                </div>
            `).join('')}
        </div>
    `;
}

window.loadFromHistory = (id) => {
    const item = history.find(h => h.id === id);
    if (item) {
        renderResult(item);
        showSection('analyze-section');
        btnNew.classList.add('active');
    }
};

function renderResult(data) {
    resultContainer.classList.remove('hidden');
    songTitle.innerText = data.title;
    choreoBody.innerHTML = '';
    data.moments.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="moment-cell" contenteditable="true" style="color: #FF6B00; font-weight: bold;">${m.name}</td>
            <td class="time-cell" contenteditable="true">${m.time}</td>
            <td class="lyrics-cell" contenteditable="true">${m.lyrics}</td>
            <td class="notes-cell"><textarea placeholder="Pasos...">${m.notes || ''}</textarea></td>
        `;
        choreoBody.appendChild(tr);
    });
}

// Word Export
saveBtn.onclick = async () => {
    try {
        const docxLib = window.docx;
        const moments = Array.from(choreoBody.querySelectorAll('tr')).map(row => ({
            name: row.cells[0].innerText,
            time: row.cells[1].innerText,
            lyrics: row.cells[2].innerText,
            notes: row.querySelector('textarea').value
        }));
        const doc = new docxLib.Document({
            sections: [{
                children: [
                    new docxLib.Paragraph({ text: songTitle.innerText, heading: docxLib.HeadingLevel.HEADING_1, alignment: docxLib.AlignmentType.CENTER }),
                    new docxLib.Table({
                        width: { size: 100, type: docxLib.WidthType.PERCENTAGE },
                        rows: [
                            new docxLib.TableRow({
                                children: ["Momento", "Tiempo", "Letra", "Coreografía"].map(t => new docxLib.TableCell({ children: [new docxLib.Paragraph({ text: t, bold: true })] }))
                            }),
                            ...moments.map(m => new docxLib.TableRow({
                                children: [m.name, m.time, m.lyrics, m.notes].map(t => new docxLib.TableCell({ children: [new docxLib.Paragraph(t)] }))
                            }))
                        ]
                    })
                ]
            }]
        });
        const blob = await docxLib.Packer.toBlob(doc);
        saveAs(blob, `${songTitle.innerText}.docx`);
    } catch (e) { alert("Error: " + e.message); }
};
