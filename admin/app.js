// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDGx0PmwYPZgwLFSAbm26VF_FTxry-ORMc",
  authDomain: "wallyadmin-9107f.firebaseapp.com",
  projectId: "wallyadmin-9107f",
  storageBucket: "wallyadmin-9107f.firebasestorage.app",
  messagingSenderId: "883208525115",
  appId: "1:883208525115:web:2aabd97f6824de211c931e",
  measurementId: "G-WH1Y0S4VVC"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// ESTADO DE LA APLICACIÓN (AppState)
// ==========================================
const AppState = {
    user: null,
    data: {
        accounts: {
            "Efectivo": 0.00,
            "Mercado Pago Disp.": 0.00,
            "Reservas MP": 0.00,
            "Personal Pay": 0.00,
            "BBVA": 0.00,
            "ICBC": 0.00
        },
        transactions: [],
        settings: { secretPin: null, usdRate: 1000, privacy: false },
        secretBalanceARS: 0,
        secretBalanceUSD: 0
    },
    
    init() {
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.user = user;
                // Show loading overlay
                const loader = document.getElementById('loading-overlay');
                if (loader) loader.classList.add('active');
                
                document.body.classList.remove('hidden'); // Mostrar app
                await this.startCloudSync();
            } else {
                // Redirigir a login si no hay sesión
                window.location.href = 'auth.html';
            }
        });
    },

    async startCloudSync() {
        const userDocRef = db.collection('users').doc(this.user.uid);
        
        // Listener en tiempo real de Firestore
        userDocRef.onSnapshot((doc) => {
            if (doc.exists) {
                this.data = doc.data();
                // Patch for existing cloud data (migration)
                if (this.data.secretBalance !== undefined) {
                    this.data.secretBalanceARS = this.data.secretBalance;
                    delete this.data.secretBalance;
                    this.save();
                }
                if (this.data.secretBalanceUSD === undefined) this.data.secretBalanceUSD = 0;
                
                // DATA REPAIR: Sanitize any existing NaN or malformed accounts
                this.sanitizeData();

                // Hide loader
                const loader = document.getElementById('loading-overlay');
                if (loader) loader.classList.remove('active');
                
                UI.renderAll();
            } else {
                // El documento no existe en la nube aún.
                // Intentamos migrar si hay algo en localStorage.
                this.migrateLocalToCloud();
            }
        }, (error) => {
            console.error("Error en sincronización:", error);
            alert("Error al conectar con la nube. Los cambios podrían no guardarse.");
        });
    },

    async migrateLocalToCloud() {
        const stored = localStorage.getItem('wally_admin_data');
        if (stored) {
            console.log("Migrando datos locales a la nube...");
            this.data = JSON.parse(stored);
            // Patch structure
            if (this.data.secretBalance !== undefined) {
                this.data.secretBalanceARS = this.data.secretBalance;
                delete this.data.secretBalance;
            }
            if (!this.data.settings) this.data.settings = { secretPin: null, usdRate: 1000 };
            if (this.data.secretBalanceARS === undefined) this.data.secretBalanceARS = 0;
            if (this.data.secretBalanceUSD === undefined) this.data.secretBalanceUSD = 0;
            
            await this.save();
            localStorage.removeItem('wally_admin_data');
            alert("¡Tus datos locales han sido sincronizados con la nube!");
        }
        
        // Hide loader even if no migration was needed
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.remove('active');
        
        UI.renderAll();
    },

    async save() {
        await db.collection('users').doc(this.user.uid).set(this.data);
    },

    sanitizeData() {
        let hasChanges = false;
        if (!this.data.accounts) {
            this.data.accounts = { "Efectivo": 0 };
            hasChanges = true;
        }
        Object.entries(this.data.accounts).forEach(([name, balance]) => {
            if (typeof balance !== 'number' || isNaN(balance)) {
                this.data.accounts[name] = 0;
                hasChanges = true;
            }
        });
        if (hasChanges) this.save();
    },

    async addTransaction(type, amount, desc, date, account) {
        // Ensure account existence defensively
        if (this.data.accounts[account] === undefined || isNaN(this.data.accounts[account])) {
            this.data.accounts[account] = 0;
        }

        // Adjust Account Balance
        if (type === 'ingreso') {
            this.data.accounts[account] += amount;
        } else if (type === 'egreso') {
            this.data.accounts[account] -= amount;
        }

        const monthStr = date.substring(0, 7); // Format: YYYY-MM
        
        this.data.transactions.push({
            id: Date.now(),
            type,
            amount,
            desc,
            date,
            monthStr,
            account
        });
        
        // Sort descending by date
        this.data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        await this.save();
    },

    async editTransaction(id, newType, newAmount, newDesc, newDate, newAccount) {
        const txIndex = this.data.transactions.findIndex(t => t.id === id);
        if (txIndex === -1) return;
        const oldTx = this.data.transactions[txIndex];

        // 1. Revert old transaction
        if (oldTx.type === 'ingreso') {
            this.data.accounts[oldTx.account] -= oldTx.amount;
        } else if (oldTx.type === 'egreso') {
            this.data.accounts[oldTx.account] += oldTx.amount;
        }

        // 2. Ensure new account exists defensively
        if (this.data.accounts[newAccount] === undefined || isNaN(this.data.accounts[newAccount])) {
            this.data.accounts[newAccount] = 0;
        }

        // 3. Apply new transaction
        if (newType === 'ingreso') {
            this.data.accounts[newAccount] += newAmount;
        } else if (newType === 'egreso') {
            this.data.accounts[newAccount] -= newAmount;
        }

        // 4. Update transaction data
        this.data.transactions[txIndex] = {
            id: oldTx.id, // keep original ID
            type: newType,
            amount: newAmount,
            desc: newDesc,
            date: newDate,
            monthStr: newDate.substring(0, 7),
            account: newAccount
        };

        // Sort descending by date
        this.data.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        await this.save();
    },

    async deleteTransaction(id) {
        const txIndex = this.data.transactions.findIndex(t => t.id === id);
        if (txIndex === -1) return;
        const oldTx = this.data.transactions[txIndex];

        // Revert old transaction
        if (oldTx.type === 'ingreso') {
            this.data.accounts[oldTx.account] -= oldTx.amount;
        } else if (oldTx.type === 'egreso') {
            this.data.accounts[oldTx.account] += oldTx.amount;
        }

        // Remove from array
        this.data.transactions.splice(txIndex, 1);
        await this.save();
    },
    
    getNetWorth() {
        return Object.values(this.data.accounts).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
    }
};

// ==========================================
// CONTROLADOR DE INTERFAZ (UI)
// ==========================================
const UI = {
    chartInstance: null,
    
    init() {
        // Update header date
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date-header').textContent = new Date().toLocaleDateString('es-AR', options);

        // Fetch web dollar rate upon loading
        this.fetchDolarBlue();

        // Privacy Toggle
        document.getElementById('privacy-toggle').addEventListener('click', () => this.togglePrivacy());
        
        // PDF Export
        document.getElementById('export-pdf-btn').addEventListener('click', () => this.exportToPDF());

        // Bind Navigation
        document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                const target = btn.getAttribute('data-target');
                btn.classList.add('active');
                
                document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
                document.getElementById(target).classList.remove('hidden');
                
                if (target === 'view-estadisticas') this.renderChart();
            });
        });

        // Modals & Basic UI Bindings
        document.getElementById('open-modal-btn').addEventListener('click', () => this.openModal());
        document.getElementById('close-modal-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('close-edit-btn').addEventListener('click', () => this.closeEditModal());
        document.getElementById('close-alert').addEventListener('click', (e) => e.target.parentElement.classList.add('hidden'));
        document.getElementById('save-reg-btn').addEventListener('click', () => this.handleSaveForm());
        document.getElementById('delete-tx-btn').addEventListener('click', () => this.handleDeleteTransaction());
        document.getElementById('save-edit-btn').addEventListener('click', () => this.handleSaveEdit());
        document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());

        // New features
        document.getElementById('sync-usd-btn').addEventListener('click', () => {
            document.getElementById('sync-usd-btn').style.transform = 'rotate(180deg)';
            setTimeout(() => document.getElementById('sync-usd-btn').style.transform = 'none', 500);
            this.fetchDolarBlue();
        });
        document.getElementById('edit-usd-btn').addEventListener('click', () => this.handleEditUsdRate());
        document.getElementById('new-account-btn').addEventListener('click', () => this.handleNewAccount());
        document.getElementById('delete-account-btn').addEventListener('click', () => this.handleDeleteAccount());
        
        // Vault bindings
        document.getElementById('vault-access-btn').addEventListener('click', () => this.openPinModal());
        document.getElementById('close-pin-btn').addEventListener('click', () => document.getElementById('pin-modal').classList.add('hidden'));
        document.getElementById('verify-pin-btn').addEventListener('click', () => this.verifyPin());
        document.getElementById('close-vault-btn').addEventListener('click', () => document.getElementById('vault-modal').classList.add('hidden'));
        document.getElementById('vault-withdraw-btn').addEventListener('click', () => this.handleVaultTransaction('withdraw'));
        document.getElementById('vault-deposit-btn').addEventListener('click', () => this.handleVaultTransaction('deposit'));

        // History Filters listeners
        ['ingresos-month-filter', 'ingresos-acc-filter', 'egresos-month-filter', 'egresos-acc-filter'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.renderTransactions());
        });

        // Mode Switchers inside Modal
        document.getElementById('mode-text-btn').addEventListener('click', () => this.switchModalMode('text'));
        document.getElementById('mode-voice-btn').addEventListener('click', () => this.switchModalMode('voice'));
        
        // Set today in Date input
        document.getElementById('reg-date').valueAsDate = new Date();

        // Filters
        document.getElementById('ingresos-month-filter').addEventListener('change', () => this.renderTransactions());
        document.getElementById('egresos-month-filter').addEventListener('change', () => this.renderTransactions());

        VoiceController.init();
        // Inicialización diferida tras login
        AppState.init();
    },

    renderAll() {
        this.renderTotal();
        this.updateFilterDropdowns();
        this.renderTransactions();
        this.checkAlerts();
    },

    renderTotal() {
        // Net worth
        let totalPesos = AppState.getNetWorth();
        if (isNaN(totalPesos)) totalPesos = 0;
        
        const usdRate = AppState.data.settings?.usdRate || 1000;
        
        document.getElementById('net-worth-ars').textContent = `$ ${totalPesos.toLocaleString('es-AR', {minimumFractionDigits: 2})}`;
        const estimatedUsd = totalPesos / (usdRate || 1);
        document.getElementById('net-worth-usd').textContent = `~ u$s ${estimatedUsd.toLocaleString('es-AR', {maximumFractionDigits: 2})}`;
        const currentRateEl = document.getElementById('current-usd-rate');
        if (!currentRateEl.textContent.includes('Consultando')) {
            currentRateEl.textContent = `1 USD = $${usdRate.toLocaleString('es-AR')}`;
        }

        // Accounts Grid
        const grid = document.getElementById('accounts-grid');
        if (!grid) return;
        grid.innerHTML = '';
        Object.entries(AppState.data.accounts).forEach(([name, balance]) => {
            grid.innerHTML += `
                <div class="glass-card account-card" onclick="UI.openEditModal('${name}', ${balance})" style="cursor: pointer;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <span class="acc-name">${name}</span>
                        <span style="font-size: 0.8rem; opacity: 0.6;">✎</span>
                    </div>
                    <span class="acc-balance mask-target" style="color: ${balance < 1000 ? 'var(--accent-red)' : 'var(--text-primary)'}">
                        $ ${balance.toLocaleString('es-AR')}
                    </span>
                </div>
            `;
        });
        
        // Re-apply privacy if active
        if (AppState.data.settings.privacy) document.body.classList.add('privacy-active');
    },

    updateFilterDropdowns() {
        const transactions = AppState.data.transactions;
        const months = [...new Set(transactions.map(t => t.monthStr))].sort().reverse();
        const accounts = Object.keys(AppState.data.accounts);

        const populateMonths = (selectId) => {
            const el = document.getElementById(selectId);
            if (!el) return;
            const currentVal = el.value;
            el.innerHTML = '<option value="all">Ver Todos</option>';
            months.forEach(m => {
                const [y, mth] = m.split('-');
                const monthName = new Date(y, mth - 1).toLocaleString('es', { month: 'long' });
                const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${y}`;
                el.innerHTML += `<option value="${m}">${label}</option>`;
            });
            if(months.includes(currentVal)) el.value = currentVal;
        };

        const populateAccounts = (selectId) => {
            const el = document.getElementById(selectId);
            if (!el) return;
            const currentVal = el.value;
            el.innerHTML = '<option value="all">Cuentas: Todas</option>';
            accounts.forEach(acc => {
                el.innerHTML += `<option value="${acc}">${acc}</option>`;
            });
            if(accounts.includes(currentVal)) el.value = currentVal;
        };

        populateMonths('ingresos-month-filter');
        populateMonths('egresos-month-filter');
        populateAccounts('ingresos-acc-filter');
        populateAccounts('egresos-acc-filter');
    },

    renderTransactions() {
        const renderList = (listId, type, monthFilter, accFilter) => {
            const container = document.getElementById(listId);
            if (!container) return;
            container.innerHTML = '';
            
            let filtered = AppState.data.transactions.filter(t => t.type === type);
            
            if (monthFilter !== 'all') {
                filtered = filtered.filter(t => t.monthStr === monthFilter);
            }
            
            if (accFilter !== 'all') {
                filtered = filtered.filter(t => t.account === accFilter);
            }

            if (filtered.length === 0) {
                container.innerHTML = `<p class="empty-state">No hay registros para mostrar.</p>`;
                return;
            }

            filtered.forEach(tx => {
                const sign = type === 'ingreso' ? '+' : '-';
                container.innerHTML += `
                    <div class="tx-item">
                        <div class="tx-info">
                            <span class="tx-desc">${tx.desc}</span>
                            <span class="tx-meta">${tx.date} • ${tx.account}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="tx-amount mask-target ${type}">${sign} $${tx.amount.toLocaleString('es-AR')}</span>
                            <button onclick="UI.openEditTransactionModal(${tx.id})" class="icon-btn" style="font-size: 0.8rem; opacity: 0.6; padding: 4px;">✎</button>
                        </div>
                    </div>
                `;
            });
        };

        renderList('ingresos-list', 'ingreso', 
            document.getElementById('ingresos-month-filter')?.value || 'all',
            document.getElementById('ingresos-acc-filter')?.value || 'all'
        );
        renderList('egresos-list', 'egreso', 
            document.getElementById('egresos-month-filter')?.value || 'all',
            document.getElementById('egresos-acc-filter')?.value || 'all'
        );
    },

    checkAlerts() {
        const icbc = AppState.data.accounts['ICBC'] || 0;
        const bbva = AppState.data.accounts['BBVA'] || 0;
        const banner = document.getElementById('alert-banner');
        if (!banner) return;
        if (icbc < 5000 || bbva < 5000) {
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    },

    renderChart() {
        const chartEl = document.getElementById('monthlyChart');
        if (!chartEl) return;
        const ctx = chartEl.getContext('2d');
        
        const monthlyData = {};
        AppState.data.transactions.forEach(tx => {
            if(!monthlyData[tx.monthStr]) {
                monthlyData[tx.monthStr] = { ingreso: 0, egreso: 0 };
            }
            monthlyData[tx.monthStr][tx.type] += tx.amount;
        });

        const labels = Object.keys(monthlyData).sort();
        const ingresosData = labels.map(m => monthlyData[m].ingreso);
        const egresosData = labels.map(m => monthlyData[m].egreso);
        
        const niceLabels = labels.map(m => {
            const [y, mth] = m.split('-');
            const mon = new Date(y, mth - 1).toLocaleString('es', { month: 'short' });
            return `${mon} ${y.substring(2)}`;
        });

        let bestMonth = "-";
        let bestScore = -Infinity;
        let totalAhorro = 0;
        
        labels.forEach(m => {
            const neto = monthlyData[m].ingreso - monthlyData[m].egreso;
            totalAhorro += neto;
            if (neto > bestScore) {
                bestScore = neto;
                bestMonth = m;
            }
        });
        
        if (labels.length > 0) {
            document.getElementById('stat-best-month').textContent = bestMonth;
            document.getElementById('stat-avg-savings').textContent = `$${Math.round(totalAhorro/labels.length).toLocaleString('es-AR')}`;
        }

        if (this.chartInstance) this.chartInstance.destroy();

        Chart.defaults.color = "#94a3b8";
        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: niceLabels,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: ingresosData,
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderRadius: 4
                    },
                    {
                        label: 'Egresos',
                        data: egresosData,
                        backgroundColor: 'rgba(239, 68, 68, 0.8)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { position: 'top' } }
            }
        });
    },

    openModal() {
        const accSelect = document.getElementById('reg-account');
        accSelect.innerHTML = '';
        Object.keys(AppState.data.accounts).forEach(acc => {
            accSelect.innerHTML += `<option value="${acc}">${acc}</option>`;
        });
        document.getElementById('input-modal-title').textContent = 'Nuevo Registro';
        document.getElementById('input-modal').dataset.editingTxId = '';
        document.getElementById('delete-tx-btn').classList.add('hidden');
        document.getElementById('input-modal').classList.remove('hidden');
    },

    openEditTransactionModal(id) {
        const tx = AppState.data.transactions.find(t => t.id === id);
        if (!tx) return;

        const accSelect = document.getElementById('reg-account');
        accSelect.innerHTML = '';
        Object.keys(AppState.data.accounts).forEach(acc => {
            accSelect.innerHTML += `<option value="${acc}">${acc}</option>`;
        });

        // Rellenar datos
        document.getElementById('reg-type').value = tx.type;
        document.getElementById('reg-amount').value = tx.amount;
        document.getElementById('reg-desc').value = tx.desc;
        document.getElementById('reg-date').value = tx.date;
        document.getElementById('reg-account').value = tx.account;

        // Cambiar modo a texto
        this.switchModalMode('text');

        // Configurar UI del modal
        document.getElementById('input-modal-title').textContent = 'Editar Registro';
        document.getElementById('input-modal').dataset.editingTxId = id;
        document.getElementById('delete-tx-btn').classList.remove('hidden');
        document.getElementById('input-modal').classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('input-modal').classList.add('hidden');
        document.getElementById('reg-amount').value = '';
        document.getElementById('reg-desc').value = '';
        document.getElementById('input-modal').dataset.editingTxId = '';
        this.switchModalMode('text');
    },

    switchModalMode(mode) {
        if (mode === 'text') {
            document.getElementById('mode-text-btn').classList.add('active');
            document.getElementById('mode-voice-btn').classList.remove('active');
            document.getElementById('text-mode').classList.remove('hidden');
            document.getElementById('voice-mode').classList.add('hidden');
        } else {
            document.getElementById('mode-voice-btn').classList.add('active');
            document.getElementById('mode-text-btn').classList.remove('active');
            document.getElementById('voice-mode').classList.remove('hidden');
            document.getElementById('text-mode').classList.add('hidden');
        }
    },

    async handleSaveForm() {
        const type = document.getElementById('reg-type').value;
        const amount = parseFloat(document.getElementById('reg-amount').value);
        const desc = document.getElementById('reg-desc').value;
        const date = document.getElementById('reg-date').value;
        const account = document.getElementById('reg-account').value;

        if (!amount || amount <= 0 || !desc || !date) {
            alert('Por favor completa Monto, Descripción y Fecha correctamente.');
            return;
        }

        const editingId = document.getElementById('input-modal').dataset.editingTxId;
        
        if (editingId) {
            await AppState.editTransaction(parseInt(editingId), type, amount, desc, date, account);
        } else {
            await AppState.addTransaction(type, amount, desc, date, account);
        }
        
        UI.closeModal();
        UI.renderAll();
    },

    async handleDeleteTransaction() {
        const editingId = document.getElementById('input-modal').dataset.editingTxId;
        if (!editingId) return;

        if (confirm('¿Estás seguro de que quieres eliminar este registro por completo?')) {
            await AppState.deleteTransaction(parseInt(editingId));
            UI.closeModal();
            UI.renderAll();
        }
    },

    openEditModal(accountName, currentBalance) {
        document.getElementById('edit-account-name').value = accountName;
        document.getElementById('edit-account-name').dataset.originalAccount = accountName;
        document.getElementById('edit-amount').value = currentBalance;
        
        // Render history for this specific account
        const historyContainer = document.getElementById('account-tx-history');
        if (historyContainer) {
            historyContainer.innerHTML = '';
            const filtered = AppState.data.transactions.filter(t => t.account === accountName);
            if (filtered.length === 0) {
                historyContainer.innerHTML = '<p class="empty-state" style="font-size: 0.8rem;">Sin movimientos aún.</p>';
            } else {
                filtered.forEach(tx => {
                    const sign = tx.type === 'ingreso' ? '+' : '-';
                    const color = tx.type === 'ingreso' ? 'var(--accent-green)' : 'var(--accent-red)';
                    historyContainer.innerHTML += `
                        <div class="tx-item" style="display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.03); border-radius: 8px; margin-bottom: 5px; padding: 8px;">
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-size: 0.85rem;">${tx.desc}</span>
                                <span style="font-size: 0.65rem; color: var(--text-secondary);">${tx.date}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span class="mask-target" style="color: ${color}; font-weight: 600; font-size: 0.9rem;">${sign} $${tx.amount.toLocaleString('es-AR')}</span>
                                <button onclick="UI.openEditTransactionModal(${tx.id})" class="icon-btn" style="font-size: 0.8rem; opacity: 0.6; padding: 4px;">✎</button>
                            </div>
                        </div>
                    `;
                });
            }
        }

        document.getElementById('edit-modal').classList.remove('hidden');
    },

    closeEditModal() {
        document.getElementById('edit-modal').classList.add('hidden');
        document.getElementById('edit-amount').value = '';
    },

    handleNewAccount() {
        const name = prompt("Nombre de la nueva billetera o tarjeta:");
        if (name && name.trim() !== '') {
            if (AppState.data.accounts[name] !== undefined) {
                alert("La cuenta ya existe.");
                return;
            }
            AppState.data.accounts[name] = 0;
            AppState.save();
        }
    },

    handleDeleteAccount() {
        if(confirm("¿Estás seguro de eliminar esta cuenta? Perderás el acceso rápido a ella, pero no su historial pasado.")) {
            const accountName = document.getElementById('edit-account-name').dataset.originalAccount;
            delete AppState.data.accounts[accountName];
            AppState.save();
            UI.closeEditModal();
        }
    },

    handleEditUsdRate() {
        const currentRate = AppState.data.settings.usdRate || 1000;
        const newRateStr = prompt("Ingresa la nueva cotización del Dólar Libre/Blue:", currentRate);
        if (newRateStr) {
            const newRate = parseFloat(newRateStr.replace(',', '.'));
            if (!isNaN(newRate) && newRate > 0) {
                AppState.data.settings.usdRate = newRate;
                document.getElementById('current-usd-rate').textContent = `1 USD = $${newRate.toLocaleString('es-AR')}`;
                AppState.save();
            }
        }
    },

    async fetchDolarBlue() {
        try {
            document.getElementById('current-usd-rate').textContent = 'Consultando...';
            const response = await fetch('https://dolarapi.com/v1/dolares/blue');
            const data = await response.json();
            if (data && data.venta) {
                AppState.data.settings.usdRate = data.venta;
                document.getElementById('current-usd-rate').textContent = `1 USD = $${data.venta.toLocaleString('es-AR')}`;
                AppState.save(); 
            }
        } catch (error) {
            const usdRate = AppState.data.settings.usdRate || 1000;
            document.getElementById('current-usd-rate').textContent = `1 USD = $${usdRate.toLocaleString('es-AR')}`;
        }
    },

    async handleSaveEdit() {
        const oldName = document.getElementById('edit-account-name').dataset.originalAccount;
        const newName = document.getElementById('edit-account-name').value.trim();
        const newBalance = parseFloat(document.getElementById('edit-amount').value);
        
        if (isNaN(newBalance) || !newName) {
            alert('Por favor ingresa datos válidos.');
            return;
        }

        if (oldName !== newName) {
            if (AppState.data.accounts[newName] !== undefined) return alert("Nombre existe");
            AppState.data.transactions.forEach(tx => { if (tx.account === oldName) tx.account = newName; });
            delete AppState.data.accounts[oldName];
        }
        
        AppState.data.accounts[newName] = newBalance;
        await AppState.save();
        UI.closeEditModal();
    },

    openPinModal() {
        document.getElementById('vault-pin-input').value = '';
        document.getElementById('pin-error').classList.add('hidden');
        if (AppState.data.settings.secretPin === null) {
            document.getElementById('pin-instruction').textContent = "Configura tu PIN Global";
            document.getElementById('verify-pin-btn').textContent = "Crear PIN";
        } else {
            document.getElementById('pin-instruction').textContent = "Ingresa tu PIN secreto";
            document.getElementById('verify-pin-btn').textContent = "Ingresar";
        }
        document.getElementById('pin-modal').classList.remove('hidden');
    },

    async verifyPin() {
        const inputPin = document.getElementById('vault-pin-input').value;
        if (inputPin.length < 4) return;

        // Ensure settings exists
        if (!AppState.data.settings) AppState.data.settings = { secretPin: null, usdRate: 1000 };

        if (AppState.data.settings.secretPin === null) {
             AppState.data.settings.secretPin = inputPin;
             await AppState.save();
             this.openVaultModal();
        } else {
             if (inputPin === AppState.data.settings.secretPin) {
                 this.openVaultModal();
             } else {
                 document.getElementById('pin-error').classList.remove('hidden');
             }
        }
    },

    openVaultModal() {
        // Close PIN modal
        document.getElementById('pin-modal').classList.add('hidden');
        
        // Defensive data checks
        const ars = AppState.data.secretBalanceARS || 0;
        const usd = AppState.data.secretBalanceUSD || 0;

        // Render with fallback
        const arsDisplay = document.getElementById('vault-ars-display');
        const usdDisplay = document.getElementById('vault-usd-display');
        
        if (arsDisplay) arsDisplay.textContent = `$ ${Number(ars).toLocaleString('es-AR')}`;
        if (usdDisplay) usdDisplay.textContent = `u$s ${Number(usd).toLocaleString('es-AR')}`;
        
        document.getElementById('vault-amount-input').value = '';
        document.getElementById('vault-modal').classList.remove('hidden');
    },

    async handleVaultTransaction(action) {
        const amt = parseFloat(document.getElementById('vault-amount-input').value);
        const currency = document.getElementById('vault-currency').value;
        if (isNaN(amt) || amt <= 0) return;

        const field = currency === 'ARS' ? 'secretBalanceARS' : 'secretBalanceUSD';
        
        if (action === 'withdraw') {
            AppState.data[field] -= amt;
        } else {
            AppState.data[field] += amt;
        }

        await AppState.save();
        
        // Update display immediately
        document.getElementById('vault-ars-display').textContent = `$ ${AppState.data.secretBalanceARS.toLocaleString('es-AR')}`;
        document.getElementById('vault-usd-display').textContent = `u$s ${AppState.data.secretBalanceUSD.toLocaleString('es-AR')}`;
        document.getElementById('vault-amount-input').value = '';
    },

    togglePrivacy() {
        AppState.data.settings.privacy = !AppState.data.settings.privacy;
        document.body.classList.toggle('privacy-active');
        document.getElementById('privacy-toggle').textContent = AppState.data.settings.privacy ? '🔒' : '👁️';
        AppState.save();
    },

    async exportToPDF() {
        const btn = document.getElementById('export-pdf-btn');
        const originalText = btn.textContent;
        btn.textContent = '⏳ Generando...';
        btn.disabled = true;

        const allTx = AppState.data.transactions;
        const netWorth = AppState.getNetWorth();

        // Create a hidden template for PDF
        const pdfContent = document.createElement('div');
        pdfContent.style.padding = '40px';
        pdfContent.style.background = '#0f172a';
        pdfContent.style.color = '#f8fafc';
        pdfContent.style.fontFamily = 'Arial, sans-serif';

        pdfContent.innerHTML = `
            <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="margin:0; color: #3b82f6;">Wally Admin Pro - Informe Detallado</h1>
                <p style="margin:5px 0 0 0; opacity: 0.7;">Reporte Histórico Completo • Generado el: ${new Date().toLocaleDateString()}</p>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                <div style="background: rgba(59, 130, 246, 0.1); padding: 20px; border-radius: 12px; flex: 1; border: 1px solid rgba(59, 130, 246, 0.3);">
                    <h3 style="margin:0; opacity:0.7; font-size: 0.9rem;">Patrimonio Consolidado Final</h3>
                    <h2 style="margin:10px 0 0 0; font-size: 2.2rem; color: #3b82f6;">$ ${netWorth.toLocaleString('es-AR')}</h2>
                </div>
            </div>

            <h3 style="border-left: 4px solid #3b82f6; padding-left: 10px; margin-bottom: 20px;">Historial Completo de Movimientos</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="text-align: left; opacity: 0.5; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <th style="padding: 10px;">Fecha</th>
                        <th style="padding: 10px;">Descripción</th>
                        <th style="padding: 10px;">Cuenta</th>
                        <th style="padding: 10px; text-align: right;">Monto</th>
                    </tr>
                </thead>
                <tbody>
                    ${allTx.map(t => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 10px; font-size: 0.8rem;">${t.date}</td>
                            <td style="padding: 10px; font-size: 0.85rem; font-weight: 500;">${t.desc}</td>
                            <td style="padding: 10px; font-size: 0.8rem; opacity: 0.8;">${t.account}</td>
                            <td style="padding: 10px; font-size: 0.85rem; text-align: right; font-weight: 600; color: ${t.type === 'ingreso' ? '#10b981' : '#ef4444'};">
                                ${t.type === 'ingreso' ? '+' : '-'} $${t.amount.toLocaleString('es-AR')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 50px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; opacity: 0.4; font-size: 0.7rem;">
                Este informe detallado fue generado por el ecosistema digital Baila Con Wally.
            </div>
        `;

        const opt = {
            margin: 10,
            filename: `Reporte_Wally_Detallado_${new Date().toISOString().substring(0,10)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0f172a' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(pdfContent).save();
        } catch (e) {
            console.error(e);
            alert("Error al generar PDF detallado.");
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
};

// ==========================================
// VOICE CONTROLLER
// ==========================================
const VoiceController = {
    init() {
        this.btn = document.getElementById('mic-record-btn');
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'es-AR';
            this.recognition.onstart = () => {
                this.btn.classList.add('recording');
                document.getElementById('voice-feedback').textContent = 'Escuchando...';
            };
            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.processNaturalLanguage(transcript.toLowerCase());
            };
            this.recognition.onend = () => this.btn.classList.remove('recording');
            this.btn.addEventListener('click', () => { try { this.recognition.start(); } catch(e){} });
        }
    },
    processNaturalLanguage(text) {
        let type = text.includes('cobré') || text.includes('ingresó') ? 'ingreso' : 'egreso';
        const matchNumber = text.match(/\d+/);
        const amount = matchNumber ? parseFloat(matchNumber[0]) : null;
        if (amount) {
            document.getElementById('reg-type').value = type;
            document.getElementById('reg-amount').value = amount;
            document.getElementById('reg-desc').value = `[Voz] ` + text;
            setTimeout(() => UI.switchModalMode('text'), 1000);
        }
    }
}

// Initializer
document.addEventListener('DOMContentLoaded', () => UI.init());
