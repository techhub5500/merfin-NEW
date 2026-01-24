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

            // Enviar para API
            const response = await chatIntegration.sendToChatAPI(message, this.sessionId, history);

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

        console.log('[Investment Dashboard] Application initialized successfully');
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

