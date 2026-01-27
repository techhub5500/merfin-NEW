/**
 * Finance Dashboard - Main Application
 * @author Senior Software Engineer
 * @version 2.0.0
 * @description Refactored dashboard with SOLID principles, design patterns, and clean code practices
 * Streaming: This file includes a lightweight SSE client to subscribe to agent
 * streaming events (Server-Sent Events) for realtime progress updates.
 */

// ============================================================================
// DEBUG - Listeners para detectar erros e recarregamentos
// ============================================================================
window.addEventListener('beforeunload', (e) => {
    console.error('[DEBUG-MAIN] ⚠️ Página está sendo descarregada/recarregada!');
    console.trace('[DEBUG-MAIN] Stack trace:');
});

window.addEventListener('error', (e) => {
    console.error('[DEBUG-MAIN] 🔴 Erro global capturado:', e.message, e.filename, e.lineno);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('[DEBUG-MAIN] 🔴 Promise rejeitada não tratada:', e.reason);
});

// ============================================================================
// CONSTANTS & CONFIGURATION (Single Responsibility Principle)
// ============================================================================

const CONFIG = Object.freeze({
    ANIMATION: {
        PROGRESS_BAR_DELAY: 500,
        PROGRESS_BAR_STAGGER: 200,
        AUTO_COLLAPSE_DELAY: 15000
    },
    CALENDAR: {
        WEEKDAYS: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'],
        MONTHS: ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'],
        DAYS_PER_WEEK: 7
    },
    TEXTAREA: {
        MAX_HEIGHT: 450,
        INITIAL_HEIGHT: 105,
        HEIGHT_MULTIPLIER: 2
    },
    TRANSACTIONS: {
        TEMPLATES_COUNT: 2,
        MONTHS_COUNT: 12
    },
    SELECTORS: {
        CALENDAR_GRID: '#calendar-grid',
        CALENDAR_NAV_PREV: '#calendar-nav-prev',
        CALENDAR_NAV_NEXT: '#calendar-nav-next',
        MONTH_TOGGLE: '#month-toggle',
        MONTH_LIST: '#month-list',
        SIDEBAR_TOGGLE: '#sidebar-toggle',
        MESSAGE_INPUT: '.input-message',
        MESSAGE_FORM: '#message-form',
        SEND_BUTTON: '.send-button',
        BENTO_GRID: '.bento-grid',
        SIDEBAR: '.sidebar',
        STAT_PATRIMONIO: '.card--stat--patrimonio',
        STAT_PORTFOLIO: '.card--stat--portfolio',
        STAT_INSIGHTS: '.card--stat--insights',
        STAT_DIVIDAS: '.card--stat--dividas',
        PROGRESS_BARS: '.progress-bar__fill',
        TRANSACTION: '.transaction',
        CALENDAR_CARD: '.card--calendar'
    }
});

// ============================================================================
// UTILITY FUNCTIONS (DRY Principle)
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
 * Safely queries all elements
 * @param {string} selector - CSS selector
 * @returns {NodeList|Array}
 */
const safeQuerySelectorAll = (selector) => {
    try {
        return document.querySelectorAll(selector) || [];
    } catch (error) {
        console.error(`[DOM Query Error] Failed to find all: ${selector}`, error);
        return [];
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
};

/**
 * Debounce function for performance optimization
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function}
 */
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * NOTE (SSE client):
 * Purpose: Connect to agent streaming endpoint (`/stream/agents/:sessionId`) via
 * Server-Sent Events (SSE) and render incremental progress messages in the UI.
 * This is intentionally decoupled from the chat UI so it can be wired later.
 */
function initAgentStream(sessionId) {
    if (!sessionId) return null;

    const url = `/stream/agents/${encodeURIComponent(sessionId)}`;
    const evtSource = new EventSource(url);

    evtSource.onmessage = function (e) {
        try {
            const payload = JSON.parse(e.data);
            handleAgentEvent(payload.type, payload.payload);
        } catch (err) {
            console.error('[SSE] Malformed message:', e.data, err);
        }
    };

    evtSource.onerror = function (err) {
        console.error('[SSE] Connection error', err);
    };

    return evtSource;
}

function handleAgentEvent(type, payload) {
    const container = getOrCreateAgentStreamContainer();
    const el = document.createElement('div');
    el.className = 'agent-stream__item agent-stream--' + (type || 'unknown').replace(/[:]/g, '-');
    el.textContent = payload && payload.message ? payload.message : JSON.stringify(payload);
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
}

function getOrCreateAgentStreamContainer() {
    let c = document.getElementById('agent-stream');
    if (c) return c;
    c = document.createElement('div');
    c.id = 'agent-stream';
    c.className = 'agent-stream';
    c.style.maxHeight = '220px';
    c.style.overflowY = 'auto';
    c.style.padding = '8px';
    c.style.border = '1px solid #eee';
    c.style.background = '#fafafa';
    c.style.fontSize = '13px';
    c.style.margin = '8px 0';
    // Place near message form if available
    const messageForm = document.querySelector(CONFIG.SELECTORS.MESSAGE_FORM);
    if (messageForm && messageForm.parentNode) {
        messageForm.parentNode.insertBefore(c, messageForm.nextSibling);
    } else {
        document.body.appendChild(c);
    }
    return c;
}

/**
 * Starts a demo stream: creates a unique sessionId, subscribes via SSE
 * and triggers server-side demo emission so frontend can be tested now.
 */
function startAgentStreamDemo() {
    const sessionId = `demo_${Date.now()}`;
    initAgentStream(sessionId);
    fetch('/api/agents/stream-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
    }).catch(err => console.error('[SSE Demo] failed to start demo', err));
    return sessionId;
}

// Expose demo starter for quick testing from console
window.startAgentStreamDemo = startAgentStreamDemo;

// ============================================================================
// CALENDAR MODULE (Single Responsibility)
// ============================================================================

class CalendarManager {
    constructor(gridSelector, navPrevSelector, navNextSelector) {
        this.gridElement = safeQuerySelector(gridSelector);
        this.navPrevButton = safeQuerySelector(navPrevSelector);
        this.navNextButton = safeQuerySelector(navNextSelector);
        this.startDate = this.getStartOfWeek(new Date());
    }

    /**
     * Initializes calendar functionality
     */
    init() {
        if (!this.gridElement) {
            console.warn('[Calendar] Grid element not found');
            return;
        }

        this.render();
        this.attachEventListeners();
    }

    /**
     * Renders calendar grid with weekdays and dates
     */
    render() {
        if (!this.gridElement) return;

        this.gridElement.innerHTML = '';

        // Render weekday headers
        CONFIG.CALENDAR.WEEKDAYS.forEach(weekday => {
            const headerElement = document.createElement('div');
            headerElement.className = 'calendar-weekday-header';
            headerElement.textContent = weekday;
            headerElement.setAttribute('role', 'columnheader');
            this.gridElement.appendChild(headerElement);
        });

        // Render days
        for (let i = 0; i < CONFIG.CALENDAR.DAYS_PER_WEEK; i++) {
            const day = new Date(this.startDate);
            day.setDate(this.startDate.getDate() + i);

            const dayCell = this.createDayCell(day);
            this.gridElement.appendChild(dayCell);
        }
    }

    /**
     * Creates a day cell element
     * @param {Date} day - Date object
     * @returns {HTMLElement}
     */
    createDayCell(day) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar__day';
        dayCell.setAttribute('role', 'gridcell');
        dayCell.setAttribute('aria-label', day.toLocaleDateString('pt-BR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }));

        const dayNumberElement = document.createElement('span');
        dayNumberElement.textContent = day.getDate();

        // If this cell corresponds to today's date, add the subtle highlight class
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const cellDate = new Date(day);
            cellDate.setHours(0, 0, 0, 0);

            if (cellDate.getTime() === today.getTime()) {
                dayCell.classList.add('is-today');
                dayCell.setAttribute('aria-current', 'date');
            }
        } catch (err) {
            // defensive: do not break rendering on date errors
            console.error('[Calendar] Error evaluating today:', err);
        }

        dayCell.appendChild(dayNumberElement);
        return dayCell;
    }

    /**
     * Gets the start of week (Sunday) for given date
     * @param {Date} date - Input date
     * @returns {Date}
     */
    getStartOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        d.setDate(d.getDate() - day);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Navigates to previous day
     */
    navigatePrevious() {
        this.startDate.setDate(this.startDate.getDate() - 1);
        this.render();
        this.notifyMonthChange();
    }

    /**
     * Navigates to next day
     */
    navigateNext() {
        this.startDate.setDate(this.startDate.getDate() + 1);
        this.render();
        this.notifyMonthChange();
    }

    /**
     * Notifies other components of month change
     */
    notifyMonthChange() {
        const event = new CustomEvent('calendarMonthChanged', {
            detail: { month: this.startDate.getMonth() }
        });
        document.dispatchEvent(event);
    }

    /**
     * Attaches event listeners to navigation buttons
     */
    attachEventListeners() {
        if (this.navPrevButton) {
            this.navPrevButton.addEventListener('click', () => this.navigatePrevious());
        }

        if (this.navNextButton) {
            this.navNextButton.addEventListener('click', () => this.navigateNext());
        }
    }

    /**
     * Cleanup method for removing event listeners
     */
    destroy() {
        // Clean up event listeners if needed
        if (this.navPrevButton) {
            this.navPrevButton.replaceWith(this.navPrevButton.cloneNode(true));
        }
        if (this.navNextButton) {
            this.navNextButton.replaceWith(this.navNextButton.cloneNode(true));
        }
    }
}

// ============================================================================
// MONTH SELECTOR MODULE
// ============================================================================

class MonthSelectorManager {
    constructor(toggleSelector, listSelector) {
        this.toggleButton = safeQuerySelector(toggleSelector);
        this.monthList = safeQuerySelector(listSelector);
        this.monthItems = this.monthList ? Array.from(this.monthList.querySelectorAll('li')) : [];
        this.selectedMonth = new Date().getMonth();
    }

    /**
     * Initializes month selector
     */
    init() {
        if (!this.toggleButton || !this.monthList) {
            console.warn('[MonthSelector] Required elements not found');
            return;
        }

        this.updateToggleText();
        this.attachEventListeners();
        this.listenToCalendarChanges();
    }

    /**
     * Updates toggle button text with current month
     */
    updateToggleText() {
        if (!this.toggleButton) return;

        this.toggleButton.textContent = CONFIG.CALENDAR.MONTHS[this.selectedMonth];
        this.toggleButton.setAttribute('aria-expanded', 'false');
        initializeLucideIcons();
    }

    /**
     * Toggles dropdown visibility
     */
    toggleDropdown() {
        if (!this.monthList) return;

        const isHidden = this.monthList.hasAttribute('hidden');
        
        if (isHidden) {
            this.monthList.removeAttribute('hidden');
            this.toggleButton.setAttribute('aria-expanded', 'true');
        } else {
            this.closeDropdown();
        }
    }

    /**
     * Closes dropdown
     */
    closeDropdown() {
        if (!this.monthList || !this.toggleButton) return;

        this.monthList.setAttribute('hidden', '');
        this.toggleButton.setAttribute('aria-expanded', 'false');
    }

    /**
     * Selects a month
     * @param {number} monthIndex - Month index (0-11)
     */
    selectMonth(monthIndex) {
        this.selectedMonth = monthIndex;
        this.closeDropdown();
        this.updateToggleText();
        this.notifyMonthSelection();
    }

    /**
     * Notifies other components of month selection
     */
    notifyMonthSelection() {
        const event = new CustomEvent('monthSelected', {
            detail: { month: this.selectedMonth }
        });
        document.dispatchEvent(event);
    }

    /**
     * Listens to calendar month changes
     */
    listenToCalendarChanges() {
        document.addEventListener('calendarMonthChanged', (e) => {
            this.selectedMonth = e.detail.month;
            this.updateToggleText();
            this.notifyMonthSelection();
        });
    }

    /**
     * Attaches event listeners
     */
    attachEventListeners() {
        // Toggle dropdown
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        // Prevent dropdown close on inside click
        if (this.monthList) {
            this.monthList.addEventListener('click', (e) => e.stopPropagation());
        }

        // Month item selection
        this.monthItems.forEach(item => {
            item.addEventListener('click', () => {
                const monthIndex = parseInt(item.getAttribute('data-month'), 10);
                if (!isNaN(monthIndex)) {
                    this.selectMonth(monthIndex);
                }
            });

            // Keyboard support
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const monthIndex = parseInt(item.getAttribute('data-month'), 10);
                    if (!isNaN(monthIndex)) {
                        this.selectMonth(monthIndex);
                    }
                }
            });
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.toggleButton?.contains(e.target) && !this.monthList?.contains(e.target)) {
                this.closeDropdown();
            }
        });
    }
}

// ============================================================================
// TRANSACTION MANAGER MODULE
// ============================================================================

class TransactionManager {
    constructor(transactionSelector, calendarCardSelector) {
        this.transactions = Array.from(safeQuerySelectorAll(transactionSelector));
        this.calendarCard = safeQuerySelector(calendarCardSelector);
        this.selectedMonth = new Date().getMonth();
    }

    /**
     * Initializes transaction management
     */
    init() {
        this.generateMonthlyTransactions();
        this.filterByMonth(this.selectedMonth);
        this.listenToMonthChanges();
    }

    /**
     * Generates transactions for all months
     */
    generateMonthlyTransactions() {
        if (!this.calendarCard || this.transactions.length === 0) return;

        const templates = this.transactions.slice(0, CONFIG.TRANSACTIONS.TEMPLATES_COUNT);
        
        // Remove existing transactions
        this.calendarCard.querySelectorAll(CONFIG.SELECTORS.TRANSACTION).forEach(el => el.remove());

        const generated = [];
        for (let m = 0; m < CONFIG.TRANSACTIONS.MONTHS_COUNT; m++) {
            templates.forEach(template => {
                const clone = template.cloneNode(true);
                clone.setAttribute('data-month', String(m));
                generated.push(clone);
                this.calendarCard.appendChild(clone);
            });
        }

        this.transactions = generated;
        initializeLucideIcons();
    }

    /**
     * Filters transactions by month
     * @param {number} month - Month index (0-11)
     */
    filterByMonth(month) {
        this.selectedMonth = month;
        
        this.transactions.forEach(el => {
            const transactionMonth = parseInt(el.getAttribute('data-month') || '-1', 10);
            el.style.display = (transactionMonth === month) ? '' : 'none';
        });
    }

    /**
     * Listens to month selection changes
     */
    listenToMonthChanges() {
        document.addEventListener('monthSelected', (e) => {
            this.filterByMonth(e.detail.month);
        });
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
            console.warn('[Sidebar] Required elements not found');
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
                if (this.toggleButton) {
                    this.toggleButton.setAttribute('aria-expanded', 'false');
                }
            }
            this.autoCollapseTimer = null;
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
        // Mouse enter/leave for auto-collapse pause
        if (this.sidebar) {
            this.sidebar.addEventListener('mouseenter', () => {
                this.isPointerOverSidebar = true;
                this.clearAutoCollapseTimer();
            });

            this.sidebar.addEventListener('mouseleave', () => {
                this.isPointerOverSidebar = false;
                if (!document.body.classList.contains('sidebar-collapsed')) {
                    this.startAutoCollapseTimer();
                }
            });
        }

        // Toggle button click
        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleCollapse();
            });
        }

        // Logout button (placed at the end of the sidebar)
        const logoutBtn = safeQuerySelector('#sidebar-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.authSystem && typeof window.authSystem.logout === 'function') {
                    window.authSystem.logout();
                } else {
                    // Fallback: clear token and reload
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userName');
                    window.location.reload();
                }
            });
        }
    }

    /**
     * Cleanup method
     */
    destroy() {
        this.clearAutoCollapseTimer();
    }
}

// ============================================================================
// CHAT/MESSAGE MANAGER MODULE
// ============================================================================

class MessageManager {
    constructor(inputSelector, formSelector, sendButtonSelector, bentoGridSelector) {
        this.messageInput = safeQuerySelector(inputSelector);
        this.messageForm = safeQuerySelector(formSelector);
        this.sendButton = safeQuerySelector(sendButtonSelector);
        this.bentoGrid = safeQuerySelector(bentoGridSelector);
        // New stat cards (left / right) shown only while typing and hidden when top cards return
        this.patrimonioCard = safeQuerySelector(CONFIG.SELECTORS.STAT_PATRIMONIO);
        this.portfolioCard = safeQuerySelector(CONFIG.SELECTORS.STAT_PORTFOLIO);
        this.insightsCard = safeQuerySelector(CONFIG.SELECTORS.STAT_INSIGHTS);
        this.dividasCard = safeQuerySelector(CONFIG.SELECTORS.STAT_DIVIDAS);
        this.inChatMode = false;
        this.originalBentoHTML = this.bentoGrid ? this.bentoGrid.innerHTML : '';
        const measuredHeight = this.messageInput ? this.messageInput.clientHeight : 0;
        this.initialInputHeight = Math.max(measuredHeight || 0, CONFIG.TEXTAREA.INITIAL_HEIGHT);
        this.maxInputHeight = Math.min(this.initialInputHeight * CONFIG.TEXTAREA.HEIGHT_MULTIPLIER, CONFIG.TEXTAREA.MAX_HEIGHT);

        // Chat state (sessionId e chatId serão inicializados quando necessário)
        this.sessionId = null;
        this.currentChatId = null;

        // Insights rotation state
        this.insightsElement = this.insightsCard ? this.insightsCard.querySelector('.insights-text') : null;
        this.insightsMessages = [
            'Reduza seus gastos em 20%',
            'Diminua dívidas em 30%',
            'Investimentos +12% mês',
            'Revise assinaturas e economize'
        ];
        this.insightsIndex = 0;
        this.insightsTimer = null;
    }

    /**
     * Initializes message functionality
     */
    init() {
        if (!this.messageInput || !this.bentoGrid) {
            console.warn('[Message] Required elements not found');
            return;
        }
        // Start typewriter effect for placeholder on init
        this.startTypewriter();

        this.syncCardsVisibility();
        this.autoResizeTextarea();
        this.attachEventListeners();

        // Ensure stat cards are hidden initially
        this.hideStatCards();
    }

    /**
     * Starts a typewriter animation on the textarea placeholder.
     * Respects `prefers-reduced-motion` and stops when the user focuses or types.
     */
    startTypewriter() {
        if (!this.messageInput) return;

        // Respect reduced motion preference
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.placeholderText = this.messageInput.getAttribute('placeholder') || 'Pergunte sobre suas finanças';

        if (reduce) {
            this.messageInput.setAttribute('placeholder', this.placeholderText);
            return;
        }

        this.messageInput.setAttribute('placeholder', '');
        let idx = 0;
        const speed = 45; // ms per character

        this.clearTypewriterTimer();
        this.typewriterTimer = setInterval(() => {
            idx += 1;
            this.messageInput.setAttribute('placeholder', this.placeholderText.slice(0, idx));
            if (idx >= this.placeholderText.length) {
                this.clearTypewriterTimer();
            }
        }, speed);

        // stop typewriter if user interacts
        const stopOnInteract = () => {
            this.stopTypewriter();
        };

        this._typewriterStopHandlers = { stopOnInteract };
        this.messageInput.addEventListener('focus', stopOnInteract, { once: true });
        this.messageInput.addEventListener('input', stopOnInteract, { once: true });
    }

    clearTypewriterTimer() {
        if (this.typewriterTimer) {
            clearInterval(this.typewriterTimer);
            this.typewriterTimer = null;
        }
    }

    /**
     * Immediately completes and clears the typewriter animation.
     */
    stopTypewriter() {
        this.clearTypewriterTimer();
        if (this.messageInput && this.placeholderText) {
            this.messageInput.setAttribute('placeholder', this.placeholderText);
        }
    }

    /**
     * Enters chat mode
     */
    enterChatMode() {
        if (this.inChatMode || !this.bentoGrid) return;
        
        this.inChatMode = true;
        this.bentoGrid.innerHTML = '';
        this.bentoGrid.classList.add('chat-mode');
        
        const shell = this.createChatShell();
        this.bentoGrid.appendChild(shell);
    }

    /**
     * Exits chat mode
     */
    exitChatMode() {
        if (!this.inChatMode || !this.bentoGrid) return;
        
        this.inChatMode = false;
        this.bentoGrid.classList.remove('chat-mode');
        this.bentoGrid.innerHTML = this.originalBentoHTML;
        initializeLucideIcons();
        // When the top cards return, hide the temporary stat cards
        this.hideStatCards();
    }

    /**
     * Creates chat shell structure
     * @returns {HTMLElement}
     */
    createChatShell() {
        const chatShell = document.createElement('div');
        chatShell.className = 'chat-shell';

        const chatLog = document.createElement('div');
        chatLog.className = 'chat-log';
        chatLog.setAttribute('role', 'log');
        chatLog.setAttribute('aria-live', 'polite');
        chatLog.setAttribute('aria-label', 'Histórico de mensagens');
        
        chatShell.appendChild(chatLog);
        return chatShell;
    }

    /**
     * Starts the periodic rotation of insights messages.
     */
    startInsightsRotation() {
        if (!this.insightsElement || !this.insightsMessages || this.insightsMessages.length === 0) return;
        // Immediately show current
        try {
            this.insightsElement.classList.remove('hidden');
            this.insightsElement.textContent = this.insightsMessages[this.insightsIndex] || '';
        } catch (err) {}

        // Clear any existing timer
        if (this.insightsTimer) clearInterval(this.insightsTimer);

        this.insightsTimer = setInterval(() => {
            this.rotateInsightsOnce();
        }, 8000);
    }

    /**
     * Stops the insights rotation and clears state.
     */
    stopInsightsRotation() {
        if (this.insightsTimer) {
            clearInterval(this.insightsTimer);
            this.insightsTimer = null;
        }
        if (this.insightsElement) {
            try {
                this.insightsElement.classList.add('hidden');
            } catch (err) {}
        }
    }

    /**
     * Rotates to the next insights message with a smooth fade.
     */
    rotateInsightsOnce() {
        if (!this.insightsElement || !this.insightsMessages || this.insightsMessages.length === 0) return;
        try {
            // fade out
            this.insightsElement.classList.add('hidden');
            setTimeout(() => {
                this.insightsIndex = (this.insightsIndex + 1) % this.insightsMessages.length;
                this.insightsElement.textContent = this.insightsMessages[this.insightsIndex];
                // fade in
                requestAnimationFrame(() => this.insightsElement.classList.remove('hidden'));
            }, 600);
        } catch (err) {
            // noop
        }
    }

    /**
     * Shows the left/right stat cards (Patrimônio / Dívidas).
     */
    showStatCards() {
        try {
            if (this.portfolioCard) this.portfolioCard.removeAttribute('hidden');
            if (this.patrimonioCard) this.patrimonioCard.removeAttribute('hidden');
            if (this.dividasCard) this.dividasCard.removeAttribute('hidden');
            if (this.insightsCard) this.insightsCard.removeAttribute('hidden');
            initializeLucideIcons();

            // start rotating insights when visible
            this.startInsightsRotation();
        } catch (err) {
            // noop
        }
    }

    /**
     * Hides the left/right stat cards.
     */
    hideStatCards() {
        try {
            if (this.portfolioCard) this.portfolioCard.setAttribute('hidden', '');
            if (this.patrimonioCard) this.patrimonioCard.setAttribute('hidden', '');
            if (this.dividasCard) this.dividasCard.setAttribute('hidden', '');
            if (this.insightsCard) this.insightsCard.setAttribute('hidden', '');

            // stop rotating insights when hidden
            this.stopInsightsRotation();
        } catch (err) {
            // noop
        }
    }

    /**
     * Syncs cards visibility based on input state
     */
    syncCardsVisibility() {
        if (!this.messageInput || !this.bentoGrid) return;

        const hasText = this.messageInput.value.trim().length > 0;
        const chatLog = this.bentoGrid.querySelector('.chat-log');
        const hasChatMessages = chatLog && chatLog.querySelectorAll('.chat-message').length > 0;

        if (hasText || hasChatMessages) {
            this.enterChatMode();
        } else {
            this.exitChatMode();
        }

        // Show stat cards only when the user is actively typing (hasText true).
        // Hide them only when the top 3 cards return (handled in exitChatMode).
        if (hasText) {
            this.showStatCards();
        }
    }

    /**
     * Recomputes max height for textarea
     */
    recomputeMaxHeight() {
        if (!this.bentoGrid) return;

        if (this.bentoGrid.classList.contains('chat-mode')) {
            const rect = this.bentoGrid.getBoundingClientRect();
            if (rect && rect.height) {
                this.maxInputHeight = Math.min(Math.round(rect.height * CONFIG.TEXTAREA.HEIGHT_MULTIPLIER), CONFIG.TEXTAREA.MAX_HEIGHT);
                return;
            }

            const computedStyle = window.getComputedStyle(this.bentoGrid);
            const parsed = parseFloat(computedStyle.height);
            if (!isNaN(parsed) && parsed > 0) {
                this.maxInputHeight = Math.min(Math.round(parsed * CONFIG.TEXTAREA.HEIGHT_MULTIPLIER), CONFIG.TEXTAREA.MAX_HEIGHT);
                return;
            }
        }

        this.maxInputHeight = Math.min(this.initialInputHeight * CONFIG.TEXTAREA.HEIGHT_MULTIPLIER, CONFIG.TEXTAREA.MAX_HEIGHT);
    }

    /**
     * Auto-resizes textarea based on content
     */
    autoResizeTextarea() {
        if (!this.messageInput) return;

        this.recomputeMaxHeight();
        this.messageInput.style.height = 'auto';
        const needed = this.messageInput.scrollHeight;

        if (needed > this.maxInputHeight) {
            this.messageInput.style.height = `${this.maxInputHeight}px`;
            this.messageInput.style.overflowY = 'auto';
        } else {
            this.messageInput.style.height = `${needed || this.initialInputHeight}px`;
            this.messageInput.style.overflowY = 'hidden';
        }
    }

    /**
     * Appends message to chat log
     * @param {string} text - Message text
     */
    appendMessage(text) {
        if (!text || !this.bentoGrid) return;

        if (!this.inChatMode) this.enterChatMode();
        
        const chatLog = this.bentoGrid.querySelector('.chat-log');
        if (!chatLog) return;

        const msg = document.createElement('article');
        msg.className = 'chat-message chat-message--outgoing';
        msg.setAttribute('role', 'article');

        const content = document.createElement('div');
        content.className = 'chat-message__content';
        content.textContent = text;

        msg.appendChild(content);
        chatLog.appendChild(msg);

        // Scroll to bottom
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    /**
     * Appends assistant message to chat log
     * @param {string} text - Assistant message text
     */
    appendAssistantMessage(text) {
        if (!text || !this.bentoGrid) return;

        if (!this.inChatMode) this.enterChatMode();
        
        const chatLog = this.bentoGrid.querySelector('.chat-log');
        if (!chatLog) return;

        const msg = document.createElement('article');
        msg.className = 'chat-message chat-message--incoming';
        msg.setAttribute('role', 'article');

        const content = document.createElement('div');
        content.className = 'chat-message__content';
        content.textContent = text;

        msg.appendChild(content);
        chatLog.appendChild(msg);

        // Scroll to bottom
        chatLog.scrollTop = chatLog.scrollHeight;
    }

    /**
     * Starts a new chat (clears current chat state)
     */
    startNewChat() {
        console.log('[MessageManager] 🆕 Iniciando novo chat...');
        
        // Reset chat state
        this.sessionId = null;
        this.currentChatId = null;
        
        // Clear chat log if in chat mode
        if (this.inChatMode && this.bentoGrid) {
            const chatLog = this.bentoGrid.querySelector('.chat-log');
            if (chatLog) {
                chatLog.innerHTML = '';
            }
        }
        
        // Exit chat mode to return to bento grid
        this.exitChatMode();
        
        // Clear input
        if (this.messageInput) {
            this.messageInput.value = '';
            this.syncCardsVisibility();
            this.autoResizeTextarea();
        }
        
        console.log('[MessageManager] ✅ Novo chat iniciado');
    }

    /**
     * Sends message
     */
    async sendMessage() {
        if (!this.messageInput) return;

        const text = this.messageInput.value.trim();
        if (!text) return;

        // Adicionar mensagem do usuário ao chat
        this.appendMessage(text);
        this.messageInput.value = '';
        this.syncCardsVisibility();
        
        requestAnimationFrame(() => {
            this.autoResizeTextarea();
            if (this.messageInput) {
                this.messageInput.focus();
            }
        });

        // Enviar para o JuniorAgent
        try {
            // Importar chatIntegration dinamicamente
            const { default: chatIntegration } = await import('../js/chat-integration.js');
            
            // Preparar histórico (simplificado por enquanto)
            const history = [];
            
            // Gerar sessionId se não existir
            if (!this.sessionId) {
                this.sessionId = chatIntegration.generateSessionId();
            }

            // Obter userId
            const userId = typeof getUserId === 'function' ? getUserId() : null;
            console.log('[MessageManager] 🔍 getUserId() retornou:', userId);
            console.log('[MessageManager] 🔍 getUserId function exists:', typeof getUserId === 'function');
            
            // Validar userId
            if (!userId) {
                console.error('[MessageManager] ❌ Erro: usuário não autenticado');
                this.appendAssistantMessage('Por favor, faça login para usar o chat.');
                return;
            }

            // Gerar chatId se não existir
            if (!this.currentChatId) {
                this.currentChatId = `chat_${userId}_${Date.now()}`;
                console.log('[MessageManager] 🆕 Novo chatId gerado:', this.currentChatId);
            } else {
                console.log('[MessageManager] ♻️ Usando chatId existente:', this.currentChatId);
            }

                // Persistir/garantir existência do chat no servidor principal (associa ao user)
                try {
                    const area = document.documentElement.dataset.page || 'Home';
                    const created = await chatIntegration.createChatOnMain(userId, this.sessionId, area, '');
                    if (created && created.success && created.chat && created.chat._id) {
                        this.currentChatId = created.chat._id;
                        // record user message immediately
                        await chatIntegration.addMessageToChatOnMain(this.currentChatId, userId, text, 'user', area);
                    }
                } catch (err) {
                    console.warn('Falha ao registrar chat no servidor principal:', err);
                }

                // Enviar para API do agente (AGORA COM userId E chatId)
                console.log('[MessageManager] 📤 Chamando sendToChatAPI com:', {
                    message: text.substring(0, 50),
                    sessionId: this.sessionId,
                    historyLength: history.length,
                    userId: userId,
                    chatId: this.currentChatId
                });
                
                const response = await chatIntegration.sendToChatAPI(text, this.sessionId, history, userId, this.currentChatId);
            
            console.log('[MessageManager] ✅ Resposta recebida:', response);
            
                // Adicionar resposta do assistente ao chat
            // O serverAgent retorna: { status: 'success', response: '...', sessionId: '...', timestamp: '...' }
                if (response && response.status === 'success' && response.response) {
                    console.log('[DEBUG-MAIN] 📝 Chamando appendAssistantMessage...');
                    this.appendAssistantMessage(response.response);
                    console.log('[DEBUG-MAIN] ✅ appendAssistantMessage executado');
                    // persist assistant reply
                    try {
                        console.log('[DEBUG-MAIN] 💾 Persistindo resposta do assistente...');
                        const userId = getUserId();
                        const area = document.documentElement.dataset.page || 'Home';
                        if (userId && this.currentChatId) {
                            await chatIntegration.addMessageToChatOnMain(this.currentChatId, userId, response.response, 'ai', area);
                            console.log('[DEBUG-MAIN] ✅ Resposta persistida com sucesso');
                        }
                    } catch (err) {
                        console.warn('[DEBUG-MAIN] ⚠️ Falha ao persistir resposta do assistente:', err);
                    }
                    console.log('[DEBUG-MAIN] 🏁 sendMessage FINALIZADO COM SUCESSO');
                } else {
                    console.error('Resposta em formato inesperado:', response);
                    this.appendAssistantMessage('Desculpe, recebi uma resposta em formato inesperado. Tente novamente.');
                }
            
        } catch (error) {
            console.error('[DEBUG-MAIN] ❌ Erro ao enviar mensagem:', error);
            // Mostrar mensagem de erro no chat
            this.appendAssistantMessage('Desculpe, houve um erro ao processar sua mensagem. Tente novamente.');
        }
    }

    /**
     * Attaches event listeners
     */
    attachEventListeners() {
        if (!this.messageInput) return;

        // Input event for auto-resize and visibility sync
        this._inputHandler = () => {
            this.syncCardsVisibility();
            requestAnimationFrame(() => this.autoResizeTextarea());
        };
        this.messageInput.addEventListener('input', this._inputHandler);

        // Form submit
        if (this.messageForm) {
            this._submitHandler = (e) => {
                e.preventDefault();
                this.sendMessage();
            };
            this.messageForm.addEventListener('submit', this._submitHandler);
        }

        // Send button click (backup)
        if (this.sendButton) {
            this._sendClickHandler = (e) => {
                e.preventDefault();
                this.sendMessage();
            };
            this.sendButton.addEventListener('click', this._sendClickHandler);
        }

        // Keyboard shortcuts
        this._keydownHandler = (e) => {
            const isEnter = e.key === 'Enter';
            const isCtrlEnter = (e.ctrlKey || e.metaKey) && isEnter;
            const isShiftEnter = e.shiftKey && isEnter;

            if (isCtrlEnter || (isEnter && !isShiftEnter)) {
                e.preventDefault();
                this.sendMessage();
            }
        };
        this.messageInput.addEventListener('keydown', this._keydownHandler);

        // Window resize
        this._resizeHandler = debounce(() => {
            requestAnimationFrame(() => this.recomputeMaxHeight());
        }, 250);
        window.addEventListener('resize', this._resizeHandler);
    }

    /**
     * Cleanup method to prevent memory leaks
     */
    destroy() {
        this.stopTypewriter();
        this.stopInsightsRotation();

        if (this.messageInput && this._inputHandler) {
            this.messageInput.removeEventListener('input', this._inputHandler);
        }

        if (this.messageForm && this._submitHandler) {
            this.messageForm.removeEventListener('submit', this._submitHandler);
        }

        if (this.sendButton && this._sendClickHandler) {
            this.sendButton.removeEventListener('click', this._sendClickHandler);
        }

        if (this.messageInput && this._keydownHandler) {
            this.messageInput.removeEventListener('keydown', this._keydownHandler);
        }

        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }

        // Remove typewriter stop handlers
        if (this._typewriterStopHandlers && this.messageInput) {
            const { stopOnInteract } = this._typewriterStopHandlers;
            if (stopOnInteract) {
                this.messageInput.removeEventListener('focus', stopOnInteract);
                this.messageInput.removeEventListener('input', stopOnInteract);
            }
        }
    }
}

// ============================================================================
// PROGRESS BAR ANIMATION
// ============================================================================

class ProgressBarAnimator {
    constructor(selector) {
        this.progressBars = Array.from(safeQuerySelectorAll(selector));
    }

    /**
     * Animates all progress bars
     */
    animate() {
        this.progressBars.forEach((bar, index) => {
            const targetWidth = bar.style.width;
            bar.style.width = '0%';
            
            setTimeout(() => {
                bar.style.width = targetWidth;
            }, CONFIG.ANIMATION.PROGRESS_BAR_DELAY + index * CONFIG.ANIMATION.PROGRESS_BAR_STAGGER);
        });
    }
}

// ============================================================================
// APPLICATION INITIALIZER (Facade Pattern)
// ============================================================================

class FinanceDashboardApp {
    constructor() {
        this.calendar = null;
        this.monthSelector = null;
        this.transactionManager = null;
        this.sidebarManager = null;
        this.messageManager = null;
        this.progressBarAnimator = null;
    }

    /**
     * Initializes the entire application
     */
    init() {
        try {
            // Initialize Lucide icons
            initializeLucideIcons();

            // Initialize progress bar animations
            this.progressBarAnimator = new ProgressBarAnimator(CONFIG.SELECTORS.PROGRESS_BARS);
            this.progressBarAnimator.animate();

            // Initialize calendar
            this.calendar = new CalendarManager(
                CONFIG.SELECTORS.CALENDAR_GRID,
                CONFIG.SELECTORS.CALENDAR_NAV_PREV,
                CONFIG.SELECTORS.CALENDAR_NAV_NEXT
            );
            this.calendar.init();

            // Initialize month selector
            this.monthSelector = new MonthSelectorManager(
                CONFIG.SELECTORS.MONTH_TOGGLE,
                CONFIG.SELECTORS.MONTH_LIST
            );
            this.monthSelector.init();

            // Initialize transaction manager
            this.transactionManager = new TransactionManager(
                CONFIG.SELECTORS.TRANSACTION,
                CONFIG.SELECTORS.CALENDAR_CARD
            );
            this.transactionManager.init();

            // Initialize sidebar
            this.sidebarManager = new SidebarManager(
                CONFIG.SELECTORS.SIDEBAR,
                CONFIG.SELECTORS.SIDEBAR_TOGGLE
            );
            this.sidebarManager.init();

            // Initialize message manager
            this.messageManager = new MessageManager(
                CONFIG.SELECTORS.MESSAGE_INPUT,
                CONFIG.SELECTORS.MESSAGE_FORM,
                CONFIG.SELECTORS.SEND_BUTTON,
                CONFIG.SELECTORS.BENTO_GRID
            );
            this.messageManager.init();

            // Attach new chat button handler
            this.initNewChatButton();

            console.info('[Finance Dashboard] Application initialized successfully');
        } catch (error) {
            console.error('[Finance Dashboard] Initialization error:', error);
        }
    }

    /**
     * Initializes new chat button
     */
    initNewChatButton() {
        const newChatButtons = safeQuerySelectorAll('.chat-quick-btn--new');
        
        newChatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                
                if (this.messageManager && typeof this.messageManager.startNewChat === 'function') {
                    this.messageManager.startNewChat();
                    console.log('[Finance Dashboard] Novo chat iniciado via botão');
                }
            });
        });
        
        console.log(`[Finance Dashboard] ${newChatButtons.length} botões de novo chat inicializados`);
    }

    /**
     * Cleanup method for destroying all managers
     */
    destroy() {
        try {
            if (this.calendar) this.calendar.destroy();
            if (this.sidebarManager) this.sidebarManager.destroy();
            if (this.messageManager) this.messageManager.destroy();
            console.info('[Finance Dashboard] Application destroyed');
        } catch (error) {
            console.error('[Finance Dashboard] Destruction error:', error);
        }
    }
}

// ============================================================================
// APPLICATION BOOTSTRAP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const app = new FinanceDashboardApp();
    app.init();

    // Make app instance globally accessible for debugging
    if (typeof window !== 'undefined') {
        window.FinanceDashboard = app;
    }
});

// ============================================================================
// CHAT HISTORY MODAL - Import shared logic
// ============================================================================

import { initChatHistoryModal } from './chat-history-modal.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChatHistoryModal);
} else {
    initChatHistoryModal();
}
