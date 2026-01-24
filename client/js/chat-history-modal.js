/**
 * ============================================================================
 * CHAT HISTORY MODAL - Módulo Compartilhado
 * ============================================================================
 *
 * PROPÓSITO:
 * Este arquivo implementa a lógica completa do modal de histórico de chats,
 * funcionando de forma adaptativa em todas as páginas do sistema (index.html,
 * dash.html e invest.html). Substitui implementações específicas de cada página
 * por uma solução unificada e reutilizável.
 *
 * FUNCIONALIDADES PRINCIPAIS:
 * - ✅ Modal de histórico com abas por página (Home/Finanças/Invest)
 * - ✅ Busca em tempo real por conteúdo/título dos chats
 * - ✅ Criação automática de chats ao enviar primeira mensagem
 * - ✅ Persistência completa no MongoDB via API REST
 * - ✅ Migração automática entre páginas (atualiza currentArea)
 * - ✅ Exclusão com confirmação
 * - ✅ Abertura adaptativa de chats em diferentes estruturas de página
 *
 * ESTRUTURA DE DETECÇÃO ADAPTATIVA:
 * 1. dash.html: Detecta #chatMessages + verifica ausência de bentoGrid
 * 2. index.html: Usa window.FinanceDashboard.messageManager com bentoGrid
 * 3. invest.html: Usa window.InvestmentDashboard.chatManager
 *
 * DEPENDÊNCIAS:
 * - chat-integration.js (APIs para servidor)
 * - Modal HTML presente em todas as páginas
 * - localStorage com dados do usuário
 *
 * USO:
 * import { initChatHistoryModal } from './chat-history-modal.js';
 * initChatHistoryModal(); // Inicializa em qualquer página
 *
 * ============================================================================
 */

'use strict';

/**
 * Get user ID from localStorage
 * @returns {string|null}
 */
function getUserIdForModal() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.id || user._id || null;
    } catch (error) {
        console.error('[getUserIdForModal] Failed to parse user from localStorage:', error);
        return null;
    }
}

/**
 * Initialize chat history modal for any page
 */
export function initChatHistoryModal() {
    const historyButtons = document.querySelectorAll('.chat-quick-btn--history');
    const modal = document.getElementById('chat-history-modal');

    if (!modal) return; // modal not present on this page

    const overlayCloseEls = modal.querySelectorAll('[data-action="close"]');
    const closeBtn = modal.querySelector('.chat-history-close');
    const tabs = Array.from(modal.querySelectorAll('.chat-tab'));
    const contentSection = modal.querySelector('.chat-history-content');
    const memoriesSection = modal.querySelector('.chat-memories');
    const btnMemories = modal.querySelector('.btn-memories');
    const btnExitMemories = modal.querySelector('.btn-exit-memories');
    const searchInput = modal.querySelector('.chat-history-search');

    const openModal = (pageName) => {
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('open');
        const target = tabs.find(t => t.dataset.chat === pageName) || tabs[0];
        selectTab(target);
    };

    const closeModal = () => {
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('open');
        if (memoriesSection) memoriesSection.hidden = true;
        if (contentSection) contentSection.hidden = false;
    };

    const selectTab = (tabEl) => {
        if (!tabEl) return;
        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tabEl.classList.add('active');
        tabEl.setAttribute('aria-selected', 'true');
        const list = modal.querySelector('.chat-history-list');
        const area = tabEl.dataset.chat;
        if (!list) return;
        list.innerHTML = `<p class="muted">Carregando conversas de <strong>${area}</strong>...</p>`;

        (async () => {
            try {
                const { default: chatIntegration } = await import('./chat-integration.js');
                const userId = getUserIdForModal();
                const resp = await chatIntegration.fetchChatsOnMain(userId, area, searchInput ? searchInput.value : null);
                const chats = (resp && resp.chats) ? resp.chats : [];
                if (!chats.length) {
                    list.innerHTML = `<p class="muted">Nenhuma conversa encontrada para <strong>${area}</strong>.</p>`;
                    return;
                }

                list.innerHTML = '';
                chats.forEach((c) => {
                    const item = document.createElement('div');
                    item.className = 'chat-history-item';
                    item.dataset.chatId = c._id || c.id || '';
                    const when = new Date(c.updatedAt || c.createdAt || Date.now()).toLocaleString();
                    item.innerHTML = `
                        <div class="chat-history-item__meta">
                          <strong class="chat-history-title">${(c.title && c.title.length) ? c.title : 'Sem título'}</strong>
                          <span class="chat-history-time">${when}</span>
                        </div>
                        <div class="chat-history-actions">
                          <button class="btn-open" type="button">Abrir</button>
                          <button class="btn-delete" type="button">Apagar</button>
                        </div>
                    `;

                    const btnOpen = item.querySelector('.btn-open');
                    const btnDelete = item.querySelector('.btn-delete');

                    btnOpen.addEventListener('click', async () => {
                        try {
                            const details = await chatIntegration.fetchChatByIdOnMain(item.dataset.chatId, userId);
                            closeModal();
                            const chatObj = details && details.chat ? details.chat : details;
                            
                            // Abrir chat na página atual - tentar múltiplos métodos
                            openChatInCurrentPage(chatObj, item.dataset.chatId);
                        } catch (err) {
                            console.error('Erro ao abrir conversa:', err);
                            alert('Erro ao abrir conversa. Tente novamente.');
                        }
                    });

                    btnDelete.addEventListener('click', () => {
                        const confirm = document.getElementById('chat-delete-confirm');
                        if (!confirm) return;
                        confirm.dataset.chatId = item.dataset.chatId;
                        confirm.querySelector('.confirm-text').textContent = `Deseja realmente apagar a conversa "${(c.title && c.title.length) ? c.title : 'Sem título'}"?`;
                        confirm.classList.add('open');
                    });

                    list.appendChild(item);
                });

            } catch (err) {
                console.error('Erro ao carregar conversas:', err);
                list.innerHTML = `<p class="muted">Erro ao carregar conversas.</p>`;
            }
        })();
    };

    tabs.forEach(t => t.addEventListener('click', () => selectTab(t)));

    historyButtons.forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        const pageName = document.documentElement.dataset.page || 'Home';
        openModal(pageName);
    }));

    overlayCloseEls.forEach(el => el.addEventListener('click', closeModal));
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    if (btnMemories) {
        btnMemories.addEventListener('click', () => {
            if (contentSection) contentSection.hidden = true;
            if (memoriesSection) memoriesSection.hidden = false;
        });
    }
    if (btnExitMemories) {
        btnExitMemories.addEventListener('click', () => {
            if (memoriesSection) memoriesSection.hidden = true;
            if (contentSection) contentSection.hidden = false;
        });
    }

    if (searchInput) {
        let debounce = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const activeTab = tabs.find(t => t.classList.contains('active')) || tabs[0];
                if (activeTab) selectTab(activeTab);
            }, 350);
        });
    }

    // Confirmation modal handlers (delete chat)
    const confirmModal = document.getElementById('chat-delete-confirm');
    if (confirmModal) {
        const overlay = confirmModal.querySelector('.confirm-modal__overlay');
        const btnCancel = confirmModal.querySelector('.confirm-cancel');
        const btnOk = confirmModal.querySelector('.confirm-ok');

        const closeConfirm = () => {
            confirmModal.classList.remove('open');
            confirmModal.dataset.chatId = '';
        };

        if (overlay) overlay.addEventListener('click', closeConfirm);
        if (btnCancel) btnCancel.addEventListener('click', closeConfirm);

        if (btnOk) btnOk.addEventListener('click', async () => {
            const chatId = confirmModal.dataset.chatId;
            if (!chatId) return closeConfirm();
            try {
                const { default: chatIntegration } = await import('./chat-integration.js');
                const userId = getUserIdForModal();
                await chatIntegration.deleteChatOnMain(chatId, userId);
                // Refresh active tab
                const activeTab = tabs.find(t => t.classList.contains('active')) || tabs[0];
                if (activeTab) selectTab(activeTab);
            } catch (err) {
                console.error('Erro ao apagar conversa:', err);
            } finally {
                closeConfirm();
            }
        });
    }
}

/**
 * Open chat in current page - adapts to different page structures
 * Tests most specific methods FIRST to avoid false positives
 */
function openChatInCurrentPage(chatObj, chatId) {
    // Método 1 (PRIORITÁRIO): dash.html - detectar elemento #chatMessages diretamente
    // Este teste é mais específico e evita conflitos com globals definidos por main.js
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages && !window.FinanceDashboard?.messageManager?.bentoGrid) {
        // Verifica se NÃO é o chat do index.html (que tem bentoGrid)
        chatMessages.innerHTML = '';
        if (chatObj && Array.isArray(chatObj.messages)) {
            chatObj.messages.forEach(m => {
                const msg = document.createElement('div');
                msg.className = m.type === 'user' ? 'message sent' : 'message received';
                const time = new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
                const label = m.type === 'user' ? 'Você' : 'Sistema';
                msg.innerHTML = `<span class="meta">${label} • ${time}</span><p>${escapeHtml(m.content)}</p>`;
                chatMessages.appendChild(msg);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        window.dashChatId = chatId;
        console.log('[Chat History] Opened in dash.html via #chatMessages');
        return;
    }

    // Método 2: FinanceDashboard global com bentoGrid (index.html)
    if (window.FinanceDashboard && window.FinanceDashboard.messageManager && window.FinanceDashboard.messageManager.bentoGrid) {
        const mgr = window.FinanceDashboard.messageManager;
        mgr.enterChatMode();
        const chatLog = mgr.bentoGrid.querySelector('.chat-log');
        if (chatLog) chatLog.innerHTML = '';
        if (chatObj && Array.isArray(chatObj.messages)) {
            chatObj.messages.forEach(m => {
                if (m.type === 'user') mgr.appendMessage(m.content);
                else mgr.appendAssistantMessage(m.content);
            });
        }
        mgr.currentChatId = chatId;
        console.log('[Chat History] Opened in index.html via FinanceDashboard');
        return;
    }

    // Método 3: invest.html - usar chat manager
    if (window.InvestmentDashboard && window.InvestmentDashboard.chatManager) {
        const chatMgr = window.InvestmentDashboard.chatManager;
        if (chatMgr.messages) {
            chatMgr.messages.innerHTML = '';
            if (chatObj && Array.isArray(chatObj.messages)) {
                chatObj.messages.forEach(m => {
                    const bubble = document.createElement('div');
                    bubble.className = m.type === 'user' ? 'bubble user' : 'bubble ai';
                    bubble.textContent = m.content;
                    chatMgr.messages.appendChild(bubble);
                });
                chatMgr.messages.scrollTop = chatMgr.messages.scrollHeight;
            }
            chatMgr.chatId = chatId;
            console.log('[Chat History] Opened in invest.html via InvestmentDashboard');
            return;
        }
    }

    console.warn('[Chat History] Não foi possível abrir o chat - estrutura da página não reconhecida');
    alert('Esta funcionalidade ainda não está disponível nesta página.');
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
