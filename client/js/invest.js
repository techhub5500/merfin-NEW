/**
 * Investment Dashboard - Main Application
 * @author Senior Software Engineer
 * @version 1.0.0
 * @description JavaScript for invest.html with sidebar functionality
 */

// ============================================================================
// IMPORTS
// ============================================================================
import { initChatHistoryModal } from './chat-history-modal.js';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = Object.freeze({
    ANIMATION: {
        AUTO_COLLAPSE_DELAY: 15000
    },
    SELECTORS: {
        SIDEBAR_TOGGLE: '#sidebar-toggle',
        SIDEBAR: '.sidebar'
    }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safely queries the DOM and returns element or null
 * @param {string} selector - CSS selector
 * @returns {HTMLElement|null}
 */
const safeQuerySelector = (selector) => {
    try {
        return document.querySelector(selector);
    } catch (error) {
        console.error(`[DOM Query Error] Failed to find: ${selector}`, error);
        return null;
    }
};

/**
 * Creates Lucide icons if library is available
 */
const initializeLucideIcons = () => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        try {
            window.lucide.createIcons();
        } catch (error) {
            console.error('[Lucide Error] Failed to create icons:', error);
        }
    }
};

/**
 * Get user ID from localStorage
 * @returns {string|null}
 */
const getUserId = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.id || user._id || null;
    } catch (error) {
        console.error('[getUserId] Failed to parse user from localStorage:', error);
        return null;
    }
}


// ============================================================================
// SIDEBAR MANAGER MODULE
// ============================================================================

class SidebarManager {
    constructor(sidebarSelector, toggleSelector) {
        this.sidebar = safeQuerySelector(sidebarSelector);
        this.toggleButton = safeQuerySelector(toggleSelector);
        this.autoCollapseTimer = null;
        this.isPointerOverSidebar = false;
    }

    /**
     * Initializes sidebar functionality
     */
    init() {
        if (!this.sidebar || !this.toggleButton) {
            console.warn('[Sidebar] Elements not found. Skipping initialization.');
            return;
        }

        this.attachEventListeners();
        
        // Start auto-collapse if sidebar is expanded
        if (!document.body.classList.contains('sidebar-collapsed')) {
            this.startAutoCollapseTimer();
        }
    }

    /**
     * Toggles sidebar collapse state
     */
    toggleCollapse() {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        this.toggleButton.setAttribute('aria-expanded', String(!isCollapsed));

        if (!isCollapsed) {
            this.startAutoCollapseTimer();
        } else {
            this.clearAutoCollapseTimer();
        }
    }

    /**
     * Starts auto-collapse timer
     */
    startAutoCollapseTimer() {
        this.clearAutoCollapseTimer();
        
        this.autoCollapseTimer = setTimeout(() => {
            if (!this.isPointerOverSidebar && !document.body.classList.contains('sidebar-collapsed')) {
                document.body.classList.add('sidebar-collapsed');
                this.toggleButton.setAttribute('aria-expanded', 'false');
            }
        }, CONFIG.ANIMATION.AUTO_COLLAPSE_DELAY);
    }

    /**
     * Clears auto-collapse timer
     */
    clearAutoCollapseTimer() {
        if (this.autoCollapseTimer) {
            clearTimeout(this.autoCollapseTimer);
            this.autoCollapseTimer = null;
        }
    }

    /**
     * Attaches event listeners
     */
    attachEventListeners() {
        // Toggle button click
        this.toggleButton.addEventListener('click', () => {
            this.toggleCollapse();
        });

        // Track pointer over sidebar
        this.sidebar.addEventListener('pointerenter', () => {
            this.isPointerOverSidebar = true;
            this.clearAutoCollapseTimer();
        });

        this.sidebar.addEventListener('pointerleave', () => {
            this.isPointerOverSidebar = false;
            if (!document.body.classList.contains('sidebar-collapsed')) {
                this.startAutoCollapseTimer();
            }
        });

        // Expand on hover when collapsed
        this.sidebar.addEventListener('mouseenter', () => {
            if (document.body.classList.contains('sidebar-collapsed')) {
                document.body.classList.remove('sidebar-collapsed');
                this.toggleButton.setAttribute('aria-expanded', 'true');
                this.startAutoCollapseTimer();
            }
        });
    }

    /**
     * Cleanup method
     */
    destroy() {
        this.clearAutoCollapseTimer();
    }
}

// ============================================================================
// CALENDAR MANAGER MODULE
// ============================================================================

class CalendarManager {
    constructor(options = {}) {
        this.grid = document.querySelector(options.gridSelector || '#calendar-grid');
        this.prevBtn = document.querySelector(options.prevSelector || '#prev-week');
        this.nextBtn = document.querySelector(options.nextSelector || '#next-week');
        this.titleEl = document.querySelector(options.titleSelector || '#calendar-title');
        this.detailsDate = document.querySelector(options.detailsDateSelector || '#calendar-details-date');
        this.detailsEvents = document.querySelector(options.detailsEventsSelector || '#calendar-details-events');

        this.startOfWeek = this.getStartOfWeek(new Date());
        this.selectedDate = new Date();
    }

    init() {
        if (!this.grid) return;
        this.attachListeners();
        this.renderWeek();
    }

    attachListeners() {
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => { this.changeWeek(-7); });
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => { this.changeWeek(7); });
        }
        this.grid.addEventListener('click', (e) => {
            const cell = e.target.closest('.cal-day');
            if (!cell) return;
            const dateStr = cell.getAttribute('data-date');
            if (!dateStr) return;
            this.selectDate(new Date(dateStr));
        });
    }

    changeWeek(days) {
        this.startOfWeek = this.addDays(this.startOfWeek, days);
        this.renderWeek();
    }

    renderWeek() {
        this.grid.innerHTML = '';

        const weekdays = ['D','S','T','Q','Q','S','S'];
        for (let i = 0; i < 7; i++) {
            const d = this.addDays(this.startOfWeek, i);
            const cell = document.createElement('div');
            cell.className = 'cal-day';
            const ymd = d.toISOString().slice(0,10);
            cell.setAttribute('data-date', ymd);

            const wk = document.createElement('div');
            wk.className = 'weekday';
            wk.textContent = weekdays[d.getDay()];

            const dn = document.createElement('div');
            dn.className = 'daynum';
            dn.textContent = d.getDate();

            cell.appendChild(wk);
            cell.appendChild(dn);

            if (this.isSameDay(d, this.selectedDate)) {
                cell.classList.add('cal-active');
            }

            this.grid.appendChild(cell);
        }

        this.updateTitle();
        this.updateDetails(this.selectedDate);
    }

    updateTitle() {
        const start = this.startOfWeek;
        const end = this.addDays(start, 6);
        const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        if (this.titleEl) this.titleEl.textContent = `${fmt(start)} — ${fmt(end)}`;
    }

    selectDate(date) {
        this.selectedDate = new Date(date);
        this.renderWeek();
    }

    updateDetails(date) {
        if (!this.detailsDate || !this.detailsEvents) return;
        const detailsContainer = document.getElementById('calendar-details');

        const events = [];

        if (!events || events.length === 0) {
            if (detailsContainer) detailsContainer.classList.add('hidden');
            return;
        }

        if (detailsContainer) detailsContainer.classList.remove('hidden');
        const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.detailsDate.textContent = date.toLocaleDateString(undefined, opts);
        this.detailsEvents.innerHTML = events.map(ev => `<div>${ev}</div>`).join('');
    }

    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = (day + 6) % 7;
        return this.addDays(d, -diff);
    }

    addDays(date, days) {
        const nd = new Date(date);
        nd.setDate(nd.getDate() + days);
        nd.setHours(0,0,0,0);
        return nd;
    }

    isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    destroy() {
        // Cleanup if needed
    }
}

// ============================================================================
// CHAT MANAGER MODULE
// ============================================================================

class ChatManager {
    constructor({messagesSelector = '.chat-messages', inputSelector = '#chat-input', sendBtnSelector = '#chat-send'} = {}){
        this.messages = document.querySelector(messagesSelector);
        this.input = document.querySelector(inputSelector);
        this.sendBtn = document.querySelector(sendBtnSelector);
        this.sessionId = null;
    }

    init(){
        if (!this.messages || !this.input) return;

        const cs = window.getComputedStyle(this.input);
        this.maxHeight = parseFloat(cs.maxHeight) || 160;
        this.minHeight = parseFloat(cs.minHeight) || 40;

        this.autoResize();

        this.input.addEventListener('input', () => this.autoResize());

        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.send());
        }

        this.input.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.send();
            }
        });
    }

    /**
     * Start a new chat (clear current chat state)
     */
    startNewChat() {
        console.log('[ChatManager] 🆕 Iniciando novo chat...');
        
        // Clear chat messages
        if (this.messages) {
            this.messages.innerHTML = '';
        }
        
        // Reset sessionId and chatId
        this.sessionId = null;
        this.chatId = null;
        
        // Clear input
        if (this.input) {
            this.input.value = '';
            this.autoResize();
        }
        
        console.log('[ChatManager] ✅ Novo chat iniciado');
    }

    send(){
        const text = this.input.value.trim();
        if (!text) return;
        const bubble = document.createElement('div');
        bubble.className = 'bubble user';
        bubble.textContent = text;
        this.messages.appendChild(bubble);
        this.messages.scrollTop = this.messages.scrollHeight;
        this.input.value = '';
        this.autoResize();
        this.input.focus();

        // Enviar para o JuniorAgent
        this.sendToJuniorAgent(text);
    }

    async sendToJuniorAgent(message) {
        try {
            // Importar chatIntegration
            const { default: chatIntegration } = await import('./chat-integration.js');

            // Gerar sessionId se não existir
            if (!this.sessionId) {
                this.sessionId = chatIntegration.generateSessionId();
            }

            // Preparar histórico (simplificado)
            const history = [];

            // Persistir/garantir existência do chat no servidor principal
            try {
                const userId = getUserId();
                const area = document.documentElement.dataset.page || 'Invest';
                if (userId) {
                    const created = await chatIntegration.createChatOnMain(userId, this.sessionId, area, '');
                    if (created && created.success && created.chat && created.chat._id) {
                        this.chatId = created.chat._id;
                        await chatIntegration.addMessageToChatOnMain(this.chatId, userId, message, 'user', area);
                    }
                }
            } catch (err) {
                console.warn('Falha ao registrar chat no servidor principal:', err);
            }

            // Enviar para API (IMPORTANTE: passar userId e chatId como no main.js)
            const userId = getUserId();
            const response = await chatIntegration.sendToChatAPI(message, this.sessionId, history, userId, this.chatId);

            console.log('Resposta recebida no invest.html:', response);

            // Adicionar resposta do assistente
            // O serverAgent retorna: { status: 'success', response: '...', sessionId: '...', timestamp: '...' }
            if (response && response.status === 'success' && response.response) {
                this.appendAssistantMessage(response.response);
                try {
                    const userId = getUserId();
                    const area = document.documentElement.dataset.page || 'Invest';
                    if (userId && this.chatId) {
                        await chatIntegration.addMessageToChatOnMain(this.chatId, userId, response.response, 'ai', area);
                    }
                } catch (err) {
                    console.warn('Falha ao persistir resposta do assistente:', err);
                }
            } else {
                console.error('Resposta em formato inesperado:', response);
                this.appendAssistantMessage('Desculpe, recebi uma resposta em formato inesperado. Tente novamente.');
            }

        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            this.appendAssistantMessage('Desculpe, houve um erro ao processar sua mensagem. Tente novamente.');
        }
    }

    appendAssistantMessage(text) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble ai';
        bubble.textContent = text;
        this.messages.appendChild(bubble);
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    autoResize(){
        this.input.style.height = 'auto';
        const scroll = this.input.scrollHeight;
        const height = Math.min(scroll, this.maxHeight);
        this.input.style.height = height + 'px';
        this.input.style.overflowY = (scroll > this.maxHeight) ? 'auto' : 'hidden';
    }

    destroy() {
        // Cleanup if needed
    }
}

// ============================================================================
// APPLICATION INITIALIZER
// ============================================================================

class InvestmentDashboardApp {
    constructor() {
        this.sidebarManager = null;
        this.calendarManager = null;
        this.chatManager = null;
    }

    /**
     * Initializes the entire application
     */
    init() {
        // Initialize Lucide icons
        initializeLucideIcons();

        // Initialize Sidebar
        this.sidebarManager = new SidebarManager(
            CONFIG.SELECTORS.SIDEBAR,
            CONFIG.SELECTORS.SIDEBAR_TOGGLE
        );
        this.sidebarManager.init();

        // Initialize Calendar
        this.calendarManager = new CalendarManager({
            gridSelector: '#calendar-grid',
            prevSelector: '#prev-week',
            nextSelector: '#next-week',
            titleSelector: '#calendar-title',
            detailsDateSelector: '#calendar-details-date',
            detailsEventsSelector: '#calendar-details-events'
        });
        this.calendarManager.init();

        // Initialize Chat
        this.chatManager = new ChatManager({
            messagesSelector: '.chat-messages',
            inputSelector: '#chat-input',
            sendBtnSelector: '#chat-send'
        });
        this.chatManager.init();

        // Initialize New Chat Button
        this.initNewChatButton();

        // Initialize Invest Card Tabs
        this.initInvestCardTabs();

        // Initialize Rotating Header (Arrows & Drag)
        this.initRotatingHeader();

        // Initialize Custom Selectors
        this.initSelectors();

        // Initialize Sidebar Subpages
        this.initSidebarSubpages();

        // Initialize Alocação Drill-Down
        this.initDrillDown();

        // Initialize Metas Financeiras
        this.initMetas();

        // Initialize Consultoria IA
        this.initConsultoriaIA();

        // Expose test functions
        this.exposeTestFunctions();

        // Listen for hash changes to simulate subpages
        window.addEventListener('hashchange', () => this.handleHashChange());
        this.handleHashChange(); // Run on initial load

        console.log('[Investment Dashboard] Application initialized successfully');
    }

    /**
     * Handle hash changes to update the dashboard view
     * Answers the user's doubt: subpages can be independent!
     */
    handleHashChange() {
        const hash = window.location.hash || '#dashboard';
        const subpage = hash.replace('#', '');
        
        console.log(`[Subpage] Navigating to: ${subpage}`);
        
        // Example logic: auto-select a tab based on subpage
        // This makes "independent" pages possible within the same file
        if (subpage === 'carteira') {
            this.activateTab('carteira');
        } else if (subpage === 'fiscal') {
            this.activateTab('dividendos'); // Example mapping
        } else {
            this.activateTab('patrimonio');
        }
    }

    /**
     * Helper to activate a specific tab programmatically
     */
    activateTab(tabId) {
        const tab = document.querySelector(`.invest-tab[data-tab="${tabId}"]`);
        if (tab) tab.click();
    }

    /**
     * Initialize rotating header with dragging and arrows
     */
    initRotatingHeader() {
        const container = document.querySelector('#invest-main-tabs');
        const btnPrev = document.querySelector('#tab-prev');
        const btnNext = document.querySelector('#tab-next');

        if (!container) return;

        // Scroll with buttons
        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                container.scrollBy({ left: -200, behavior: 'smooth' });
            });
        }

        if (btnNext) {
            btnNext.addEventListener('click', () => {
                container.scrollBy({ left: 200, behavior: 'smooth' });
            });
        }

        // Drag to scroll logic
        let isDown = false;
        let startX;
        let scrollLeft;

        container.addEventListener('mousedown', (e) => {
            isDown = true;
            container.classList.add('active');
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
        });

        container.addEventListener('mouseleave', () => {
            isDown = false;
        });

        container.addEventListener('mouseup', () => {
            isDown = false;
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 2; // Scroll speed
            container.scrollLeft = scrollLeft - walk;
        });
    }

    /**
     * Initialize custom dropdown selectors
     */
    initSelectors() {
        const selectors = document.querySelectorAll('.custom-selector');

        selectors.forEach(sel => {
            const header = sel.querySelector('.selector-header');
            const dropdown = sel.querySelector('.selector-dropdown');
            const options = sel.querySelectorAll('.selector-option');

            if (!header || !dropdown) return;

            header.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Close other selectors
                document.querySelectorAll('.selector-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.add('hidden');
                });

                dropdown.classList.toggle('hidden');
            });

            options.forEach(opt => {
                opt.addEventListener('click', () => {
                    const value = opt.dataset.value;
                    const selectorId = sel.id;

                    // Update header text
                    header.querySelector('span').textContent = opt.textContent;
                    
                    // Update active state
                    options.forEach(o => o.classList.remove('active'));
                    opt.classList.add('active');
                    
                    dropdown.classList.add('hidden');
                    console.log(`[Selector] ${opt.textContent} selecionado (value: ${value})`);

                    // Integration with Invest Data Manager
                    if (window.investData) {
                        if (selectorId.includes('time-selector')) {
                            window.investData.setFilter('time', value);
                        } else if (selectorId.includes('view-selector')) {
                            window.investData.setFilter('view', value);
                        } else if (selectorId.includes('index-selector')) {
                            window.investData.setFilter('index', value);
                        } else if (selectorId.includes('news-filter-scope')) {
                            window.investData.setFilter('scope', value);
                        } else if (selectorId.includes('news-filter-sentiment')) {
                            window.investData.setFilter('sentiment', value);
                        }
                    }
                });
            });
        });

        // Close dropdowns on document click
        document.addEventListener('click', () => {
            document.querySelectorAll('.selector-dropdown').forEach(d => {
                d.classList.add('hidden');
            });
        });
    }

    /**
     * Initialize invest card tabs functionality
     */
    initInvestCardTabs() {
        const tabContainers = document.querySelectorAll('.invest-card__tabs');
        
        tabContainers.forEach(container => {
            const tabs = container.querySelectorAll('.invest-tab');
            const card = container.closest('.invest-card');
            const panels = card ? card.querySelectorAll('.invest-tab-panel') : [];
            const selectorGroups = card ? card.querySelectorAll('.selector-group') : [];
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    // Remove active from all tabs
                    tabs.forEach(t => {
                        t.classList.remove('active');
                        t.setAttribute('aria-selected', 'false');
                    });
                    
                    // Add active to clicked tab
                    tab.classList.add('active');
                    tab.setAttribute('aria-selected', 'true');
                    
                    // Center the active tab in the scrolling view
                    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    
                    // Show corresponding panel
                    const targetPanel = tab.dataset.tab;
                    panels.forEach(panel => {
                        if (panel.dataset.panel === targetPanel) {
                            panel.classList.remove('hidden');
                        } else {
                            panel.classList.add('hidden');
                        }
                    });

                    // Show corresponding selector group
                    selectorGroups.forEach(group => {
                        if (group.id === `selectors-${targetPanel}`) {
                            group.classList.remove('hidden');
                        } else {
                            group.classList.add('hidden');
                        }
                    });

                    // Update Invest Data Manager state
                    if (window.investData) {
                        window.investData.setActiveTab(targetPanel);
                    }
                });
            });
        });
    }

    /**
     * Initialize drill-down functionality for Alocação
     */
    initDrillDown() {
        const btnBack = document.querySelector('#btn-back-alocacao');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                const mainView = document.querySelector('#alocacao-main-view');
                const detailsView = document.querySelector('#alocacao-details-view');
                
                if (mainView && detailsView) {
                    detailsView.classList.add('hidden');
                    mainView.classList.remove('hidden');
                }
            });
        }
    }

    /**
     * Initialize Metas Financeiras (Modal and Form)
     */
    initMetas() {
        const btnOpen = document.getElementById('open-meta-modal');
        const btnClose = document.getElementById('close-meta-modal');
        const modal = document.getElementById('meta-modal');
        const form = document.getElementById('meta-form');
        const errorEl = document.getElementById('form-error');

        if (!btnOpen || !modal) return;

        // Open Modal
        btnOpen.addEventListener('click', () => {
            modal.classList.remove('hidden');
            if (form) form.reset();
            if (errorEl) errorEl.classList.add('hidden');
        });

        // Close Modal
        btnClose.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        // Form Submit
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                const newMeta = {
                    title: formData.get('title'),
                    description: formData.get('description'),
                    target: formData.get('target'),
                    deadline: formData.get('deadline'),
                    allocation: formData.get('allocation'),
                    priority: formData.get('priority')
                };

                // Simple validation
                if (!newMeta.title || !newMeta.target || !newMeta.allocation) {
                    if (errorEl) {
                        errorEl.textContent = 'Preencha os campos obrigatórios.';
                        errorEl.classList.remove('hidden');
                    }
                    return;
                }

                if (window.investData) {
                    const result = window.investData.addMeta(newMeta);
                    if (result.success) {
                        modal.classList.add('hidden');
                        form.reset();
                    } else {
                        if (errorEl) {
                            errorEl.textContent = result.message;
                            errorEl.classList.remove('hidden');
                        }
                    }
                }
            });
        }
    }

    initConsultoriaIA() {
        const btnSend = document.getElementById('btn-ai-query-send');
        const input = document.getElementById('ai-query-input');
        const container = document.querySelector('.ai-query-results');
        const chips = document.querySelectorAll('.suggestion-chip');

        if (!btnSend || !input) return;

        const handleSend = () => {
            const query = input.value.trim();
            if (!query) return;

            // Show loading state
            btnSend.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btnSend.disabled = true;

            // Mock AI response
            setTimeout(() => {
                btnSend.innerHTML = '<i class="fas fa-paper-plane"></i>';
                btnSend.disabled = false;
                
                if (container) {
                    container.innerHTML = `
                        <div class="ai-response fade-in" style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 15px; border-left: 3px solid #facc15; margin-top: 15px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: #facc15;">
                                <i class="fas fa-robot"></i>
                                <strong style="font-size: 13px;">Análise IA</strong>
                            </div>
                            <p style="font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.5; margin: 0;">
                                Analisando sua solicitação sobre "<strong>${query}</strong>"... 
                                <br><br>
                                Com base nos seus dividendos recentes e na alocação atual de PETR4 e IVVB11, recomendo focar no aporte de ativos de infraestrutura (como KLBN11) para atingir sua meta de Aposentadoria 15% mais rápido. 
                                <br><br>
                                <span style="color: #4ade80;">✔ Gráfico gerado e enviado para sua área de relatórios.</span>
                            </p>
                        </div>
                    `;
                }
                input.value = '';
                
                // Initialize icons if any were added
                if (window.lucide && typeof window.lucide.createIcons === 'function') {
                    window.lucide.createIcons();
                }
            }, 1500);
        };

        btnSend.addEventListener('click', handleSend);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Chip interaction
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                input.value = chip.textContent;
                input.focus();
            });
        });
    }

    /**
     * Define global test functions
     */
    exposeTestFunctions() {
        window.populaDadosInvest = (config) => {
            if (window.investData) {
                window.investData.populateData(config);
                console.log('%c[Test] Dados de investimento populados via console', 'color: #ffcc00; font-weight: bold;');
            } else {
                console.error('[Test] InvestDataManager não encontrado');
            }
        };
    }

    /**
     * Initialize sidebar subpages functionality
     */
    initSidebarSubpages() {
        const sublinks = document.querySelectorAll('.sidebar__sublink');
        const hash = window.location.hash;
        
        // Set active subpage based on URL hash
        sublinks.forEach(link => {
            link.classList.remove('sidebar__sublink--active');
            
            const subpage = link.dataset.subpage;
            if ((hash === '' || hash === '#') && subpage === 'dashboard') {
                link.classList.add('sidebar__sublink--active');
            } else if (hash === '#carteira' && subpage === 'carteira') {
                link.classList.add('sidebar__sublink--active');
            } else if (hash === '#fiscal' && subpage === 'fiscal') {
                link.classList.add('sidebar__sublink--active');
            }
        });
        
        // Handle subpage clicks
        sublinks.forEach(link => {
            link.addEventListener('click', (e) => {
                sublinks.forEach(l => l.classList.remove('sidebar__sublink--active'));
                link.classList.add('sidebar__sublink--active');
            });
        });
    }

    /**
     * Initialize new chat button
     */
    initNewChatButton() {
        const newChatButtons = document.querySelectorAll('.chat-quick-btn--new');
        
        newChatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (this.chatManager && typeof this.chatManager.startNewChat === 'function') {
                    this.chatManager.startNewChat();
                    console.log('[Investment Dashboard] Novo chat iniciado via botão');
                }
            });
        });
        
        console.log(`[Investment Dashboard] ${newChatButtons.length} botões de novo chat inicializados`);
    }

    /**
     * Cleanup method for destroying all managers
     */
    destroy() {
        if (this.sidebarManager) {
            this.sidebarManager.destroy();
        }
        if (this.calendarManager) {
            this.calendarManager.destroy();
        }
        if (this.chatManager) {
            this.chatManager.destroy();
        }
    }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new InvestmentDashboardApp();
    app.init();

    // Make app instance and chat manager globally accessible
    if (typeof window !== 'undefined') {
        window.investApp = app;
        // Expose InvestmentDashboard with chatManager for cross-module access
        window.InvestmentDashboard = {
            chatManager: app.chatManager
        };
    }
    
    // Initialize chat history modal
    initChatHistoryModal();
});

