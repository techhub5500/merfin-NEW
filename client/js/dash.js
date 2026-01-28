/**
 * ============================================================================
 * DASH.JS - Módulo de Interações do Dashboard
 * ============================================================================
 * 
 * PROPÓSITO:
 * Este arquivo gerencia todas as interações e inicializações de UI do 
 * dashboard financeiro. Responsável por:
 * 
 * - Sistema de chat (envio e exibição de mensagens)
 * - Carrossel de cartões (navegação, indicadores, swipe)
 * - Seletor de mês e filtros
 * - Inicialização de modais (editar cartão, adicionar dívida, detalhes)
 * - Toggles de visualização (receitas/despesas, a receber/a pagar)
 * - Event listeners e interações do usuário
 * - Coordenação entre componentes
 * 
 * DEPENDÊNCIAS:
 * - dash-data.js (dados e funções de renderização)
 * - lucide (ícones)
 * - main.js (funcionalidades compartilhadas)
 * - chat-history-modal.js (modal de histórico de chats)
 * 
 * ESTRUTURA:
 * 1. Chat
 * 2. Carrossel
 * 3. Filtro de mês
 * 4. Toggles
 * 5. Modais
 * 
 * ============================================================================
 */

// ============================================================================
// IMPORTS
// ============================================================================
import { initChatHistoryModal } from './chat-history-modal.js';

'use strict';

// ============================================================================
// DEBUG - Listener para detectar quando a página tenta recarregar
// ============================================================================
window.addEventListener('beforeunload', (e) => {
  console.error('[DEBUG-UNLOAD] ⚠️ Página está sendo descarregada/recarregada!');
  console.trace('[DEBUG-UNLOAD] Stack trace:');
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get user ID from localStorage
 * @returns {string|null}
 */
function getUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.id || user._id || null;
  } catch (error) {
    console.error('[getUserId] Failed to parse user from localStorage:', error);
    return null;
  }
}

// ============================================================================
// VARIÁVEL GLOBAL: MÊS ATUAL SELECIONADO
// ============================================================================

let currentMonthKey = null;

// ============================================================================
// CHAT - Sistema de mensagens
// ============================================================================

function initChat(){
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  
  if(!chatForm || !chatInput || !chatMessages) return;
  
  // Auto-resize textarea
  function autosizeInput(){
    chatInput.style.height = 'auto';
    chatInput.style.height = chatInput.scrollHeight + 'px';
  }

  chatInput.addEventListener('input', autosizeInput);
  autosizeInput();
  
  function sendMessage(){
    const text = chatInput.value.trim();
    if(!text) return;
    
    const msg = document.createElement('div');
    msg.className = 'message sent';
    const now = new Date();
    const time = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    msg.innerHTML = `<span class="meta">Você • ${time}</span><p>${escapeHtml(text)}</p>`;
    
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.value = '';
    chatInput.dispatchEvent(new Event('input', {bubbles: true}));
    chatInput.focus();

    // Enviar para o JuniorAgent
    sendToJuniorAgent(text);
  }

  async function sendToJuniorAgent(message) {
    console.log('[DEBUG-1] sendToJuniorAgent INICIADO com:', message);
    try {
      // Importar chatIntegration
      console.log('[DEBUG-2] Importando chatIntegration...');
      const { default: chatIntegration } = await import('./chat-integration.js');
      console.log('[DEBUG-3] chatIntegration importado com sucesso');

      // Gerar sessionId se não existir
      if (!window.dashSessionId) {
        window.dashSessionId = chatIntegration.generateSessionId();
        console.log('[DEBUG-4] Novo sessionId gerado:', window.dashSessionId);
      }

      // Preparar histórico (simplificado)
      const history = [];

      // Persistir/garantir existência do chat no servidor principal
      console.log('[DEBUG-5] Tentando persistir no servidor principal...');
      try {
        const userId = getUserId();
        const area = document.documentElement.dataset.page || 'Finanças';
        console.log('[DEBUG-5a] userId:', userId, 'area:', area);
        if (userId) {
          const created = await chatIntegration.createChatOnMain(userId, window.dashSessionId, area, '');
          console.log('[DEBUG-5b] createChatOnMain resultado:', created);
          if (created && created.success && created.chat && created.chat._id) {
            window.dashChatId = created.chat._id;
            console.log('[DEBUG-5c] Adicionando mensagem do usuário ao chat...');
            await chatIntegration.addMessageToChatOnMain(window.dashChatId, userId, message, 'user', area);
            console.log('[DEBUG-5d] Mensagem do usuário adicionada');
          }
        }
      } catch (err) {
        console.warn('[DEBUG-5e] Falha ao registrar chat no servidor principal:', err);
      }

      // Enviar para API (IMPORTANTE: passar userId e chatId como no main.js)
      console.log('[DEBUG-6] Enviando para API do JuniorAgent...');
      const userId = getUserId();
      const response = await chatIntegration.sendToChatAPI(message, window.dashSessionId, history, userId, window.dashChatId);

      console.log('[DEBUG-7] Resposta recebida do servidor:', response);

      // Adicionar resposta do assistente
      // O serverAgent retorna: { status: 'success', response: '...', sessionId: '...', timestamp: '...' }
      if (response && response.status === 'success' && response.response) {
        console.log('[DEBUG-8] Chamando appendAssistantMessage...');
        appendAssistantMessage(response.response);
        console.log('[DEBUG-9] appendAssistantMessage executado com sucesso');
        try {
          const userId = getUserId();
          const area = document.documentElement.dataset.page || 'Finanças';
          if (userId && window.dashChatId) {
            console.log('[DEBUG-10] Persistindo resposta do assistente...');
            await chatIntegration.addMessageToChatOnMain(window.dashChatId, userId, response.response, 'ai', area);
            console.log('[DEBUG-11] Resposta do assistente persistida');
          }
        } catch (err) {
          console.warn('[DEBUG-10e] Falha ao persistir resposta do assistente:', err);
        }
      } else {
        console.error('[DEBUG-ERR] Resposta em formato inesperado:', response);
        appendAssistantMessage('Desculpe, recebi uma resposta em formato inesperado. Tente novamente.');
      }

      console.log('[DEBUG-12] sendToJuniorAgent FINALIZADO com sucesso');

    } catch (error) {
      console.error('[DEBUG-CATCH] Erro ao enviar mensagem:', error);
      appendAssistantMessage('Desculpe, houve um erro ao processar sua mensagem. Tente novamente.');
    }
  }

  function appendAssistantMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message received';
    const now = new Date();
    const time = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    msg.innerHTML = `<span class="meta">Sistema • ${time}</span><p>${escapeHtml(text)}</p>`;

    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatForm.addEventListener('submit', function(e){
    e.preventDefault();
    sendMessage();
  });

  // Enter envia, Shift+Enter quebra linha
  chatInput.addEventListener('keydown', function(e){
    if(e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      sendMessage();
    }
  });
}

// ============================================================================
// CARROSSEL - Sistema de navegação entre cartões
// ============================================================================

function initCarousel(){
  const carousel = document.getElementById('cardsCarousel');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  const indicatorsContainer = document.getElementById('carouselIndicators');
  
  if(!carousel || !prevBtn || !nextBtn || !indicatorsContainer) return;
  
  const cards = carousel.querySelectorAll('.carousel-card');
  const totalCards = cards.length;
  const cardsPerView = 2;
  const maxIndex = Math.max(0, totalCards - cardsPerView);
  let currentIndex = 0;

  // Criar indicadores
  for(let i = 0; i <= maxIndex; i++) {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Ir para posição ${i + 1}`);
    dot.setAttribute('type', 'button');
    if(i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goToSlide(i));
    indicatorsContainer.appendChild(dot);
  }

  function updateCarousel() {
    const cardWidth = cards[0].offsetWidth;
    const gap = 18;
    const offset = currentIndex * (cardWidth + gap);
    carousel.style.transform = `translateX(-${offset}px)`;

    const dots = indicatorsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === maxIndex;
    
    // Controla visibilidade dos FABs baseado nos cards visíveis
    updateFabVisibility();
  }
  
  function updateFabVisibility() {
    const editCardBtn = document.getElementById('editCardBtn');
    const addDebtBtn = document.getElementById('addDebtBtn');
    
    if (!editCardBtn && !addDebtBtn) {
      console.warn('FAB buttons not found');
      return;
    }
    
    // Verifica quais cards estão visíveis na viewport
    const visibleCards = [];
    for (let i = currentIndex; i < Math.min(currentIndex + cardsPerView, totalCards); i++) {
      visibleCards.push(cards[i]);
    }
    
    // Debug
    console.log('Current index:', currentIndex);
    console.log('Visible cards:', visibleCards.map(c => c.className));
    
    // Mostra botão de editar cartão se o card credit-card estiver visível
    const creditCardVisible = visibleCards.some(card => card.classList.contains('credit-card'));
    console.log('Credit card visible:', creditCardVisible);
    
    if (editCardBtn) {
      editCardBtn.style.display = creditCardVisible ? 'flex' : 'none';
      console.log('Edit button display:', editCardBtn.style.display);
    }
    
    // Mostra botão de adicionar dívida se o card debts estiver visível
    const debtsCardVisible = visibleCards.some(card => card.classList.contains('debts'));
    if (addDebtBtn) {
      addDebtBtn.style.display = debtsCardVisible ? 'flex' : 'none';
    }
  }

  function goToSlide(index) {
    currentIndex = Math.max(0, Math.min(index, maxIndex));
    updateCarousel();
  }

  function nextSlide() {
    if(currentIndex < maxIndex) {
      currentIndex++;
      updateCarousel();
    }
  }

  function prevSlide() {
    if(currentIndex > 0) {
      currentIndex--;
      updateCarousel();
    }
  }

  prevBtn.addEventListener('click', prevSlide);
  nextBtn.addEventListener('click', nextSlide);

  // Navegação por teclado
  document.addEventListener('keydown', function(e) {
    if(e.key === 'ArrowLeft') prevSlide();
    if(e.key === 'ArrowRight') nextSlide();
  });

  // Suporte a swipe touch
  let touchStartX = 0;
  let touchEndX = 0;

  carousel.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
  }, {passive: true});

  carousel.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, {passive: true});

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if(Math.abs(diff) > swipeThreshold) {
      if(diff > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  }

  // Recalcular em resize (debounced)
  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      updateCarousel();
    }, 250);
  });

  updateCarousel();
}

// ============================================================================
// FILTRO DE MÊS - Seletor e aplicação de filtros
// ============================================================================

function initMonthPicker(){
  const monthPickerBtn = document.getElementById('monthPickerBtn');
  const monthGrid = document.getElementById('monthGrid');
  
  if(!monthPickerBtn || !monthGrid) return;
  
  function populateMonthGrid(){
    monthGrid.innerHTML = '';
    
    const year = 2026;
    const months = Array.from({length:12}, (_,i)=>{
      const d = new Date(year, i, 1);
      const label = d.toLocaleDateString('pt-BR',{month:'short'});
      const key = `${year}-${String(i+1).padStart(2,'0')}`;
      const display = `${label.charAt(0).toUpperCase()+label.slice(1)}/${year}`;
      return {label: display, key, index: i};
    });

    months.forEach(m=>{
      const b = document.createElement('button');
      b.textContent = m.label;
      b.setAttribute('data-month', m.key);
      b.setAttribute('type', 'button');
      b.addEventListener('click', ()=>{
        currentMonthKey = m.key;
        applyFilter(m.key);
        monthPickerBtn.textContent = m.label;
        closeMonthGrid();
      });
      monthGrid.appendChild(b);
    });
    
    // Define mês inicial (Janeiro 2026)
    const now = new Date();
    const currentMonthIndex = (now.getFullYear() === 2026) ? now.getMonth() : 0;
    const initMonth = months[currentMonthIndex];
    monthPickerBtn.textContent = initMonth.label;
    
    currentMonthKey = initMonth.key;
    applyFilter(initMonth.key);
  }

  function openMonthGrid(){
    monthGrid.classList.add('open');
    monthPickerBtn.classList.add('open');
    monthGrid.setAttribute('aria-hidden','false');
    monthPickerBtn.setAttribute('aria-expanded','true');

    monthGrid.classList.add('floating');
    monthGrid.style.left = '';
    monthGrid.style.top = '';
    monthGrid.style.width = '';

    const rect = monthPickerBtn.getBoundingClientRect();
    const width = Math.max(rect.width, 220);
    monthGrid.style.width = width + 'px';

    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(monthGrid.scrollHeight || 240, window.innerHeight * 0.6);
    
    if(spaceBelow >= estimatedHeight + 16) {
      monthGrid.style.top = (rect.bottom + 8) + 'px';
    } else {
      monthGrid.style.top = (rect.top - estimatedHeight - 8) + 'px';
    }
    
    let left = rect.left;
    if(left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    if(left < 8) left = 8;
    monthGrid.style.left = left + 'px';
  }

  function closeMonthGrid(){
    monthGrid.classList.remove('open');
    monthPickerBtn.classList.remove('open');
    monthGrid.setAttribute('aria-hidden','true');
    monthPickerBtn.setAttribute('aria-expanded','false');
    
    monthGrid.classList.remove('floating');
    monthGrid.style.left = '';
    monthGrid.style.top = '';
    monthGrid.style.width = '';
  }

  populateMonthGrid();
  
  monthPickerBtn.addEventListener('click', function(e){
    e.stopPropagation();
    const open = monthGrid.classList.contains('open');
    if(open) {
      closeMonthGrid();
    } else {
      openMonthGrid();
    }
  });
  
  document.addEventListener('click', function(e){
    if(monthGrid.classList.contains('open') && 
       !monthGrid.contains(e.target) && 
       e.target !== monthPickerBtn){
      closeMonthGrid();
    }
  });
}

function applyFilter(monthKey){
  // Atualizar cards do topo com sumário - via API
  updateStatsFromAPI(monthKey);
  
  // Card Extrato (Receitas e Despesas) - via API
  renderIncomesFromAPI(monthKey);
  renderExpensesFromAPI(monthKey);
  
  // Card Últimas Transações - via API
  renderLatestTransactionsFromAPI(monthKey);
  
  // Card Contas Futuras (A receber / A pagar) - via API
  renderReceivablesFromAPI(monthKey);
  renderPayablesFromAPI(monthKey);
  
  // Card Cartão de Crédito - via API
  renderCreditCardFromAPI(monthKey);
  
  // Card Dívidas - via API (não depende do mês)
  renderDebtsCardFromAPI(monthKey);
  
  // Outros cards do carrossel (ainda usando dados locais - serão atualizados depois)
  renderPatrimonyCard(monthKey);
}

// ============================================================================
// TOGGLES - Alternância entre visualizações
// ============================================================================

function setupToggle(options){
  const card = document.getElementById(options.cardId);
  const btnA = document.getElementById(options.btnAId);
  const btnB = document.getElementById(options.btnBId);
  const listA = document.getElementById(options.listAId);
  const listB = document.getElementById(options.listBId);
  const toggleClass = options.toggleClass;

  if(!card || !btnA || !btnB) return;

  function showB(show){
    card.classList.toggle(toggleClass, show);
    btnA.setAttribute('aria-pressed', String(!show));
    btnB.setAttribute('aria-pressed', String(show));
    if(show){
      btnA.classList.remove('active');
      btnB.classList.add('active');
      listA && listA.setAttribute('aria-hidden','true');
      listB && listB.setAttribute('aria-hidden','false');
    } else {
      btnA.classList.add('active');
      btnB.classList.remove('active');
      listA && listA.setAttribute('aria-hidden','false');
      listB && listB.setAttribute('aria-hidden','true');
    }
  }

  btnA.addEventListener('click', ()=> showB(false));
  btnB.addEventListener('click', ()=> showB(true));
}

function initToggles(){
  setupToggle({
    cardId: 'incomesCard',
    btnAId: 'toggleIncomes',
    btnBId: 'toggleExpenses',
    listAId: 'incomeList',
    listBId: 'expenseList',
    toggleClass: 'show-expenses'
  });

  setupToggle({
    cardId: 'contasCard',
    btnAId: 'toggleRecv',
    btnBId: 'togglePay',
    listAId: 'receivableList',
    listBId: 'payableList',
    toggleClass: 'show-payables'
  });
}

// ============================================================================
// MODAL: EDITAR CARTÃO DE CRÉDITO
// ============================================================================

function initEditModal(){
  const editBtn = document.getElementById('editCardBtn');
  const modal = document.getElementById('editModal');
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');
  const editForm = document.getElementById('editCardForm');
  const nameInput = document.getElementById('cardNameInput');
  const limitInput = document.getElementById('cardLimitInput');

  const creditUsedEl = document.querySelector('.credit-used');
  const creditAvailableEl = document.querySelector('.credit-available');
  const creditBarFill = document.querySelector('.credit-bar-fill');
  const creditPercentageEl = document.querySelector('.credit-percentage');
  const creditBillEl = document.querySelector('.credit-bill');
  const creditDueEl = document.querySelector('.credit-due');

  if(!editBtn || !modal || !editForm || !creditUsedEl || !creditAvailableEl) return;

  function formatInputDisplay(n){
    return formatAmount(n);
  }

  function setLimitInputValue(input, n){
    input.dataset.value = Number.isFinite(n) ? String(n) : '0';
    input.value = formatInputDisplay(n || 0);
  }

  function getLimitInputNumber(input){
    return parseCurrencyBR(input.value);
  }

  function openModal(){
    // Carrega dados do cartão armazenado
    const card = window.currentCreditCard;
    
    if (card) {
      // Preenche com dados existentes
      nameInput.value = card.cardName || 'Cartão de Crédito';
      setLimitInputValue(limitInput, card.creditLimit || 0);
      document.getElementById('renewalDayInput').value = card.billingCycleRenewalDay || '';
      document.getElementById('dueDayInput').value = card.billingDueDay || '';
    } else {
      // Valores padrão para novo cartão
      nameInput.value = 'Meu Cartão';
      setLimitInputValue(limitInput, 0);
      document.getElementById('renewalDayInput').value = '';
      document.getElementById('dueDayInput').value = '';
    }
    
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    setTimeout(()=> nameInput.focus(), 120);
  }

  function closeModal(){
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }

  modal.addEventListener('click', function(e){ if(e.target === modal) closeModal(); });
  modalClose && modalClose.addEventListener('click', closeModal);
  modalCancel && modalCancel.addEventListener('click', closeModal);

  editBtn.addEventListener('click', function(){ openModal(); });

  // Spinner buttons
  const spinnerGroup = editForm.querySelector('.spinner-group');
  const spinnerUpBtn = spinnerGroup && spinnerGroup.querySelector('.spinner-up');
  const spinnerDownBtn = spinnerGroup && spinnerGroup.querySelector('.spinner-down');

  function changeLimitBy(step){
    const cur = getLimitInputNumber(limitInput) || 0;
    const next = Math.max(0, cur + step);
    setLimitInputValue(limitInput, next);
  }

  spinnerUpBtn && spinnerUpBtn.addEventListener('click', ()=> changeLimitBy(50));
  spinnerDownBtn && spinnerDownBtn.addEventListener('click', ()=> changeLimitBy(-50));

  limitInput.addEventListener('blur', function(){
    const v = getLimitInputNumber(limitInput) || 0;
    setLimitInputValue(limitInput, v);
  });

  limitInput.addEventListener('focus', function(){
    const v = getLimitInputNumber(limitInput) || 0;
    limitInput.value = v ? String(v.toFixed(2)) : '';
  });

  editForm.addEventListener('submit', async function(e){
    e.preventDefault();
    
    const cardName = nameInput.value.trim();
    const limitVal = getLimitInputNumber(limitInput);
    if(!Number.isFinite(limitVal) || limitVal < 0){ limitInput.focus(); return; }

    const renewalDay = parseInt(document.getElementById('renewalDayInput').value, 10);
    const dueDay = parseInt(document.getElementById('dueDayInput').value, 10);
    
    if (!cardName) {
      alert('Por favor, insira o nome do cartão');
      nameInput.focus();
      return;
    }
    
    if (!Number.isFinite(renewalDay) || renewalDay < 1 || renewalDay > 31) {
      alert('Dia de renovação deve estar entre 1 e 31');
      return;
    }
    
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      alert('Dia de vencimento deve estar entre 1 e 31');
      return;
    }

    try {
      // Verifica se já existe um cartão (para update ou create)
      const existingCard = window.currentCreditCard;
      
      if (existingCard && existingCard._id) {
        // Atualizar cartão existente
        const updates = {
          cardName,
          creditLimit: limitVal,
          billingCycleRenewalDay: renewalDay,
          billingDueDay: dueDay
        };
        
        const result = await DataService.updateCreditCard(existingCard._id, updates);
        
        if (result.success) {
          console.log('✅ Cartão atualizado com sucesso!');
        } else {
          throw new Error('Falha ao atualizar cartão');
        }
      } else {
        // Criar novo cartão
        const cardData = {
          cardName,
          creditLimit: limitVal,
          billingCycleRenewalDay: renewalDay,
          billingDueDay: dueDay
        };
        
        const result = await DataService.createCreditCard(cardData);
        
        if (result.success) {
          console.log('✅ Cartão criado com sucesso!');
          window.currentCreditCard = result.card;
        } else {
          throw new Error('Falha ao criar cartão');
        }
      }
      
      // Atualiza a visualização do card
      const currentMonthKey = document.getElementById('monthPickerBtn')?.textContent?.trim() || '';
      await renderCreditCardFromAPI(currentMonthKey);
      
      closeModal();
      
    } catch (error) {
      console.error('❌ Erro ao salvar cartão:', error);
      alert('Erro ao salvar cartão. Verifique o console para mais detalhes.');
    }
  });
}

// ============================================================================
// MODAL: ADICIONAR DÍVIDA
// ============================================================================

function initAddDebtModal() {
  const addBtn = document.getElementById('addDebtBtn');
  const modal = document.getElementById('addDebtModal');
  const modalClose = document.getElementById('addDebtModalClose');
  const modalCancel = document.getElementById('addDebtCancel');
  const addForm = document.getElementById('addDebtForm');
  
  if(!addBtn || !modal || !addForm) return;

  function openModal(){
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    addForm.reset();
    setTimeout(() => {
      const firstInput = document.getElementById('debtDescInput');
      if(firstInput) firstInput.focus();
    }, 100);
  }

  function closeModal(){
    if(document.activeElement && modal.contains(document.activeElement)){
      if(addBtn) addBtn.focus();
    }
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  }

  addBtn.addEventListener('click', openModal);
  modalClose && modalClose.addEventListener('click', closeModal);
  modalCancel && modalCancel.addEventListener('click', closeModal);
  
  modal.addEventListener('click', function(e){
    if(e.target === modal) closeModal();
  });

  // Formatar input de valor
  const valueInput = document.getElementById('debtValueInput');
  if(valueInput) {
    valueInput.addEventListener('blur', function(){
      const v = parseCurrencyBR(valueInput.value);
      valueInput.value = formatAmount(v);
    });
    
    valueInput.addEventListener('focus', function(){
      const v = parseCurrencyBR(valueInput.value);
      valueInput.value = v ? String(v.toFixed(2)) : '';
    });
  }

  addForm.addEventListener('submit', async function(e){
    e.preventDefault();
    
    const description = document.getElementById('debtDescInput').value.trim();
    const institution = document.getElementById('debtInstInput').value.trim();
    const debtDate = document.getElementById('debtDateInput').value;
    const totalValue = parseCurrencyBR(document.getElementById('debtValueInput').value);
    const installmentCount = parseInt(document.getElementById('debtInstallmentsInput').value, 10);
    const firstPaymentDate = document.getElementById('debtFirstPaymentInput').value;

    if(!description || !institution || !debtDate || totalValue <= 0 || !installmentCount || !firstPaymentDate) {
      alert('Por favor, preencha todos os campos corretamente.');
      return;
    }

    try {
      // Salva no backend
      const result = await DataService.createDebtEntry({
        description,
        institution,
        debtDate,
        totalValue,
        installmentCount,
        firstPaymentDate,
        debtType: 'other',
        notes: ''
      });

      if (result.success) {
        console.log('[addDebtForm] Dívida criada:', result.debt);
        
        closeModal();
        
        // Atualiza card
        setTimeout(async () => {
          await renderDebtsCardFromAPI(currentMonthKey);
        }, 100);
      } else {
        alert('Erro ao criar dívida. Tente novamente.');
      }
    } catch (error) {
      console.error('[addDebtForm] Erro:', error);
      alert('Erro ao criar dívida. Tente novamente.');
    }
  });
}

// ============================================================================
// MODAL: DETALHES DA DÍVIDA
// ============================================================================

async function openDebtDetailsModal(debtId) {
  const modal = document.getElementById('debtDetailsModal');
  if (!modal) return;

  try {
    // Busca detalhes da API
    const debt = await DataService.fetchDebtDetails(debtId);

    const title = document.getElementById('debtDetailsTitle');
    if (title) title.textContent = `${debt.description} - ${debt.institution}`;

    // Atualiza resumo
    const nextPaymentEl = document.getElementById('debtNextPayment');
    const paidAmountEl = document.getElementById('debtPaidAmount');
    const paidPercentEl = document.getElementById('debtPaidPercent');
    const endDateEl = document.getElementById('debtEndDate');

    if (debt.summary.nextPayment) {
      const nextDate = new Date(debt.summary.nextPayment.dueDate);
      nextPaymentEl.textContent = `Parcela ${debt.summary.nextPayment.installmentNumber} - ${formatDate(nextDate.toISOString().split('T')[0])}`;
    } else {
      nextPaymentEl.textContent = 'Todas pagas';
    }

    paidAmountEl.textContent = formatAmount(debt.summary.totalPaid);
    paidPercentEl.textContent = `${debt.summary.paidPercentage.toFixed(1)}%`;

    if (debt.summary.endDate) {
      const endDate = new Date(debt.summary.endDate);
      endDateEl.textContent = formatDate(endDate.toISOString().split('T')[0]);
    }

    // Renderiza listas de parcelas
    renderPendingInstallmentsFromAPI(debt);
    renderPaidInstallmentsFromAPI(debt);

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  } catch (error) {
    console.error('[openDebtDetailsModal] Erro:', error);
    alert('Erro ao carregar detalhes da dívida');
  }
}

async function markInstallmentAsPaid(debtId, installmentNumber) {
  try {
    // Marca parcela como paga via API
    const result = await DataService.payDebtInstallment(debtId, installmentNumber);

    if (result.success) {
      // Verifica se todas as parcelas foram pagas
      const debt = await DataService.fetchDebtDetails(debtId);
      
      if (debt.summary.paidCount >= debt.installmentCount) {
        // Todas pagas - fecha modal
        const modal = document.getElementById('debtDetailsModal');
        if (modal) {
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden', 'true');
        }
      } else {
        // Ainda há parcelas - atualiza modal
        await openDebtDetailsModal(debtId);
      }

      // Atualiza card de dívidas
      await renderDebtsCardFromAPI(currentMonthKey);
    }
  } catch (error) {
    console.error('[markInstallmentAsPaid] Erro:', error);
    alert('Erro ao pagar parcela. Tente novamente.');
  }
}

/**
 * Renderiza parcelas pendentes no modal (versão API)
 */
function renderPendingInstallmentsFromAPI(debt) {
  const list = document.getElementById('pendingInstallments');
  if (!list) return;

  list.innerHTML = '';
  
  if (!debt.pendingInstallments || debt.pendingInstallments.length === 0) {
    list.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted);">Todas as parcelas foram pagas</li>';
    return;
  }

  debt.pendingInstallments.forEach(inst => {
    const dueDate = new Date(inst.dueDate);
    const isOverdue = inst.isOverdue || false;

    const li = document.createElement('li');
    li.className = 'installment-item';
    if (isOverdue) li.classList.add('overdue');

    li.innerHTML = `
      <div class="installment-info">
        <div class="installment-number">Parcela ${inst.installmentNumber}/${debt.installmentCount}</div>
        <div class="installment-date">${formatDate(dueDate.toISOString().split('T')[0])}${isOverdue ? ' - ATRASADA' : ''}</div>
      </div>
      <div class="installment-actions">
        <span class="installment-amount">${formatAmount(inst.amount)}</span>
        <button class="btn-pay" data-debt-id="${debt._id}" data-installment="${inst.installmentNumber}">Pagar</button>
      </div>
    `;

    const payBtn = li.querySelector('.btn-pay');
    payBtn.addEventListener('click', function() {
      const debtId = this.getAttribute('data-debt-id');
      const installmentNum = parseInt(this.getAttribute('data-installment'));
      markInstallmentAsPaid(debtId, installmentNum);
    });

    list.appendChild(li);
  });
}

/**
 * Renderiza parcelas pagas no modal (versão API)
 */
function renderPaidInstallmentsFromAPI(debt) {
  const list = document.getElementById('paidInstallments');
  if (!list) return;

  list.innerHTML = '';

  if (!debt.paidInstallments || debt.paidInstallments.length === 0) {
    list.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted);">Nenhuma parcela paga ainda</li>';
    return;
  }

  debt.paidInstallments.forEach(inst => {
    const dueDate = new Date(inst.dueDate);
    const paidDate = inst.paidAt ? new Date(inst.paidAt) : null;

    const li = document.createElement('li');
    li.className = 'installment-item paid';

    const paidInfo = paidDate 
      ? `Pago em ${formatDate(paidDate.toISOString().split('T')[0])}`
      : 'Pago';

    li.innerHTML = `
      <div class="installment-info">
        <div class="installment-number">Parcela ${inst.installmentNumber}/${debt.installmentCount}</div>
        <div class="installment-date">${paidInfo}</div>
      </div>
      <div class="installment-actions">
        <span class="installment-amount paid">${formatAmount(inst.paidAmount || inst.amount)}</span>
        <span class="installment-status">✓ Paga</span>
      </div>
    `;

    list.appendChild(li);
  });
}

function initDebtDetailsModal() {
  const modal = document.getElementById('debtDetailsModal');
  const closeBtn = document.getElementById('debtDetailsClose');

  if(!modal) return;

  function closeModal() {
    if(document.activeElement && modal.contains(document.activeElement)){
      const addBtn = document.getElementById('addDebtBtn');
      if(addBtn) addBtn.focus();
    }
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  closeBtn && closeBtn.addEventListener('click', closeModal);
  
  modal.addEventListener('click', function(e){
    if(e.target === modal) closeModal();
  });

  // Alternância de abas
  const tabPending = document.getElementById('tabPending');
  const tabPaid = document.getElementById('tabPaid');
  const pendingContent = document.getElementById('pendingContent');
  const paidContent = document.getElementById('paidContent');

  if(tabPending && tabPaid && pendingContent && paidContent) {
    tabPending.addEventListener('click', function() {
      tabPending.classList.add('active');
      tabPaid.classList.remove('active');
      pendingContent.classList.add('active');
      paidContent.classList.remove('active');
    });

    tabPaid.addEventListener('click', function() {
      tabPaid.classList.add('active');
      tabPending.classList.remove('active');
      paidContent.classList.add('active');
      pendingContent.classList.remove('active');
    });
  }
}

// ============================================================================
// NEW CHAT - Função para iniciar um novo chat
// ============================================================================

function startNewChat() {
  const chatMessages = document.getElementById('chatMessages');
  
  if (!chatMessages) {
    console.warn('[startNewChat] chatMessages element not found');
    return;
  }
  
  // Limpar histórico de mensagens
  chatMessages.innerHTML = '';
  
  // Resetar sessionId e chatId
  if (window.dashSessionId) {
    delete window.dashSessionId;
  }
  if (window.dashChatId) {
    delete window.dashChatId;
  }
  
  console.log('[Dash] 🆕 Novo chat iniciado - histórico limpo');
}

// ============================================================================
// NEW CHAT BUTTON - Inicializa botão de novo chat
// ============================================================================

function initNewChatButton() {
  const newChatButtons = document.querySelectorAll('.chat-quick-btn--new');
  
  newChatButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      startNewChat();
    });
  });
  
  console.log(`[Dash] ${newChatButtons.length} botões de novo chat inicializados`);
}

// ============================================================================
// INICIALIZAÇÃO PRINCIPAL
// ============================================================================

function initDashboard(){
  initChat();
  initCarousel();
  initMonthPicker();
  initToggles();
  initEditModal();
  initAddDebtModal();
  initDebtDetailsModal();
  initNewChatButton();
  
  // Inicializar ícones Lucide
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { 
      lucide.createIcons(); 
    } catch(e) { 
      console.error('[Lucide] Icon creation failed:', e); 
    }
  }
}

// Executar quando DOM estiver pronto
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initChatHistoryModal();
  });
} else {
  initDashboard();
  initChatHistoryModal();
}

