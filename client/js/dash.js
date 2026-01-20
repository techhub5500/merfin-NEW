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

'use strict';

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
  // Atualizar cards usando dados da API (assíncrono)
  updateStatsFromAPI(monthKey);
  renderIncomesFromAPI(monthKey);
  renderExpensesFromAPI(monthKey);
  
  // Outros cards do carrossel (ainda usando dados locais - serão atualizados depois)
  renderCreditCard(monthKey);
  renderDebtsCard(monthKey);
  renderPatrimonyCard(monthKey);
  renderAccountsCard(monthKey);
  
  // Renderizar transações (ainda não convertido - próxima etapa)
  let filtered = sampleTx.slice();
  if(monthKey && monthKey !== 'all'){
    filtered = sampleTx.filter(t=>getMonthKey(t.date) === monthKey);
  }
  renderTransactions(filtered);
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
    const used = parseCurrencyBR(creditUsedEl.textContent);
    const avail = parseCurrencyBR(creditAvailableEl.textContent);
    const total = used + avail;
    nameInput.value = 'Cartão de Crédito';
    setLimitInputValue(limitInput, total || 0);
    
    const prevRenew = limitInput.getAttribute('data-renewal');
    const prevDue = limitInput.getAttribute('data-due');
    if(prevRenew) document.getElementById('renewalDayInput').value = prevRenew;
    if(prevDue) document.getElementById('dueDayInput').value = prevDue;
    
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

  editForm.addEventListener('submit', function(e){
    e.preventDefault();
    const limitVal = getLimitInputNumber(limitInput);
    if(!Number.isFinite(limitVal) || limitVal < 0){ limitInput.focus(); return; }

    const renewalDay = parseInt(document.getElementById('renewalDayInput').value, 10);
    const dueDay = parseInt(document.getElementById('dueDayInput').value, 10);
    if(Number.isFinite(renewalDay)) limitInput.setAttribute('data-renewal', String(renewalDay));
    if(Number.isFinite(dueDay)) limitInput.setAttribute('data-due', String(dueDay));

    const used = parseCurrencyBR(creditUsedEl.textContent);
    const available = Math.max(0, limitVal - used);

    creditAvailableEl.textContent = formatAmount(available);

    let pct = 0;
    if(limitVal > 0) pct = Math.min(100, (used / limitVal) * 100);
    if(creditBarFill) creditBarFill.style.width = pct + '%';
    if(creditPercentageEl) creditPercentageEl.textContent = pct.toFixed(1) + '% utilizado';

    if(Number.isFinite(renewalDay) && renewalDay >= 1 && renewalDay <= 31 && Array.isArray(sampleTx)){
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const cutoffDay = renewalDay - 1;
      const billAmount = sampleTx.reduce((acc, tx)=>{
        try{
          const d = new Date(tx.date);
          if(d.getFullYear() === year && d.getMonth() === month){
            const day = d.getDate();
            if(day <= cutoffDay && tx.type === 'outcome') acc += tx.amount;
          }
        }catch(e){}
        return acc;
      }, 0);
      if(creditBillEl) creditBillEl.textContent = formatAmount(billAmount);
    }

    if(Number.isFinite(dueDay) && creditDueEl){
      const today = new Date();
      let year = today.getFullYear();
      let month = today.getMonth();
      if(dueDay < today.getDate()){
        month += 1;
        if(month > 11){ month = 0; year += 1; }
      }
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const day = Math.min(Math.max(1, dueDay), daysInMonth);
      const dueDate = new Date(year, month, day);
      const display = `${dueDate.getDate()}/${dueDate.getMonth()+1}/${dueDate.getFullYear()}`;
      creditDueEl.textContent = display;
    }

    closeModal();
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

  addForm.addEventListener('submit', function(e){
    e.preventDefault();
    
    const description = document.getElementById('debtDescInput').value.trim();
    const institution = document.getElementById('debtInstInput').value.trim();
    const startDate = document.getElementById('debtDateInput').value;
    const totalValue = parseCurrencyBR(document.getElementById('debtValueInput').value);
    const installments = parseInt(document.getElementById('debtInstallmentsInput').value, 10);
    const firstPayment = document.getElementById('debtFirstPaymentInput').value;

    if(!description || !institution || !startDate || totalValue <= 0 || !installments || !firstPayment) {
      alert('Por favor, preencha todos os campos corretamente.');
      return;
    }

    const newId = debtsData.length > 0 ? Math.max(...debtsData.map(d => d.id)) + 1 : 1;

    debtsData.push({
      id: newId,
      description,
      institution,
      startDate,
      totalValue,
      installments,
      firstPayment,
      paidInstallments: []
    });
    
    console.log('[addDebtForm] New debt added:', debtsData[debtsData.length - 1]);
    
    if(document.activeElement && modal.contains(document.activeElement)){
      if(addBtn) addBtn.focus();
    }
    
    closeModal();
    
    setTimeout(() => {
      renderDebtsCard(currentMonthKey);
    }, 50);
  });
}

// ============================================================================
// MODAL: DETALHES DA DÍVIDA
// ============================================================================

function openDebtDetailsModal(debtId) {
  const debt = debtsData.find(d => d.id === debtId);
  if(!debt) return;

  const modal = document.getElementById('debtDetailsModal');
  if(!modal) return;

  const title = document.getElementById('debtDetailsTitle');
  if(title) title.textContent = `${debt.description} - ${debt.institution}`;

  const installmentValue = debt.totalValue / debt.installments;

  const today = new Date();
  let nextPaymentDate = null;
  let nextPaymentNumber = null;
  
  for(let i = 1; i <= debt.installments; i++) {
    if(!debt.paidInstallments.includes(i)) {
      const paymentDate = calculateInstallmentDate(debt.firstPayment, i - 1);
      nextPaymentDate = paymentDate;
      nextPaymentNumber = i;
      break;
    }
  }

  const paidAmount = debt.paidInstallments.length * installmentValue;
  const paidPercent = calculateDebtPaidPercent(debt);

  const endDate = calculateInstallmentDate(debt.firstPayment, debt.installments - 1);

  document.getElementById('debtNextPayment').textContent = nextPaymentDate 
    ? `Parcela ${nextPaymentNumber} - ${formatDate(nextPaymentDate.toISOString().split('T')[0])}`
    : 'Todas pagas';
  document.getElementById('debtPaidAmount').textContent = formatAmount(paidAmount);
  document.getElementById('debtPaidPercent').textContent = `${paidPercent}%`;
  document.getElementById('debtEndDate').textContent = formatDate(endDate.toISOString().split('T')[0]);

  renderPendingInstallments(debt);
  renderPaidInstallments(debt);

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function markInstallmentAsPaid(debtId, installmentNumber) {
  const debt = debtsData.find(d => d.id === debtId);
  if(!debt) return;

  if(!debt.paidInstallments.includes(installmentNumber)) {
    debt.paidInstallments.push(installmentNumber);
    debt.paidInstallments.sort((a, b) => a - b);
  }

  if(debt.paidInstallments.length >= debt.installments) {
    const modal = document.getElementById('debtDetailsModal');
    if(modal) {
      if(document.activeElement && modal.contains(document.activeElement)){
        document.activeElement.blur();
      }
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    renderDebtsCard(currentMonthKey);
  } else {
    openDebtDetailsModal(debtId);
    renderDebtsCard(currentMonthKey);
  }
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
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
