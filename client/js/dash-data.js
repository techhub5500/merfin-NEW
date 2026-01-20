/**
 * ============================================================================
 * DASH-DATA.JS
 * ============================================================================
 * 
 * PROPÓSITO:
 * Este arquivo gerencia todos os dados, estruturas e lógica de renderização
 * do dashboard financeiro. Contém:
 * 
 * - Dados de exemplo (transações, dívidas)
 * - Funções auxiliares de formatação e cálculo
 * - Funções de renderização de cartões e listas
 * - Lógica de negócio para manipulação de dados financeiros
 * 
 * DEPENDÊNCIAS:
 * - Nenhuma (arquivo standalone)
 * 
 * USADO POR:
 * - dash.js (módulo principal de interações)
 * 
 * ============================================================================
 */

'use strict';

// ============================================================================
// DADOS DINÂMICOS (substituído os mocks por dados reais da API)
// ============================================================================

// As transações agora vêm da API - removidos os dados mockados
let sampleTx = [];

let debtsData = [
  {
    id: 1,
    description: 'Financiamento Veículo',
    institution: 'Banco do Brasil',
    startDate: '2024-06-01',
    totalValue: 18000.00,
    installments: 24,
    firstPayment: '2024-07-05',
    paidInstallments: [1, 2, 3, 4, 5, 6]
  },
  {
    id: 2,
    description: 'Empréstimo Pessoal',
    institution: 'Itaú',
    startDate: '2025-05-01',
    totalValue: 4200.00,
    installments: 12,
    firstPayment: '2025-06-10',
    paidInstallments: [1, 2, 3, 4]
  },
  {
    id: 3,
    description: 'Cartão de Crédito (anterior)',
    institution: 'Nubank',
    startDate: '2025-08-01',
    totalValue: 1800.00,
    installments: 10,
    firstPayment: '2025-09-15',
    paidInstallments: [1, 2, 3, 4]
  }
];

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function formatAmount(v){
  return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

function formatDate(dateStr){
  const d = new Date(dateStr);
  try{
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
  }catch(e){
    return dateStr;
  }
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function parseCurrencyBR(value){
  if(typeof value === 'number') return value;
  if(value == null) return 0;
  const s = String(value).trim();
  const digits = s.replace(/[^0-9,.-]/g, '');
  const norm = digits.replace(/\./g,'').replace(/,/g,'.');
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : 0;
}

function getMonthKey(dateStr){
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ============================================================================
// FUNÇÕES DE CÁLCULO DE DÍVIDAS
// ============================================================================

function calculateDebtRemaining(debt) {
  const totalPaid = debt.paidInstallments.length;
  return debt.installments - totalPaid;
}

function calculateDebtPaidPercent(debt) {
  return Math.round((debt.paidInstallments.length / debt.installments) * 100);
}

function calculateDebtRemainingValue(debt) {
  const installmentValue = debt.totalValue / debt.installments;
  const remaining = calculateDebtRemaining(debt);
  return installmentValue * remaining;
}

function calculateInstallmentDate(firstPaymentStr, monthsToAdd) {
  const date = new Date(firstPaymentStr + 'T00:00:00');
  date.setMonth(date.getMonth() + monthsToAdd);
  return date;
}

// ============================================================================
// FUNÇÕES DE RENDERIZAÇÃO COM API
// ============================================================================

/**
 * Renderiza lista de receitas (Extrato - aba Receitas)
 * Agora busca dados reais da API
 * @param {string} monthKey - Mês no formato 'YYYY-MM'
 */
async function renderIncomesFromAPI(monthKey) {
  const incomeListElem = document.getElementById('incomeList');
  if (!incomeListElem) return;

  try {
    // Mostra loading
    incomeListElem.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted);">Carregando...</li>';

    // Busca receitas da API
    const incomes = await DataService.fetchIncomes(monthKey);

    if (incomes.length === 0) {
      incomeListElem.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma receita neste período</li>';
      return;
    }

    incomeListElem.innerHTML = '';
    
    // Ordena por data (mais recentes primeiro)
    incomes.sort((a, b) => new Date(b.date) - new Date(a.date));

    incomes.forEach(tx => {
      const li = document.createElement('li');
      li.className = 'income-item';
      
      const leftDiv = document.createElement('div');
      
      const descDiv = document.createElement('div');
      descDiv.className = 'tx-desc';
      descDiv.textContent = tx.description || 'Receita';
      
      const metaDiv = document.createElement('div');
      metaDiv.className = 'tx-meta';
      metaDiv.textContent = formatDate(tx.date);
      
      leftDiv.appendChild(descDiv);
      leftDiv.appendChild(metaDiv);
      
      const amountDiv = document.createElement('div');
      amountDiv.className = 'tx-amount income';
      amountDiv.textContent = formatAmount(tx.amount);
      
      li.appendChild(leftDiv);
      li.appendChild(amountDiv);
      incomeListElem.appendChild(li);
    });

  } catch (error) {
    console.error('[renderIncomesFromAPI] Erro:', error);
    incomeListElem.innerHTML = '<li style="padding: 20px; text-align: center; color: #e74c3c;">Erro ao carregar receitas. Tente novamente.</li>';
  }
}

/**
 * Renderiza lista de despesas (Extrato - aba Despesas)
 * Agora busca dados reais da API
 * @param {string} monthKey - Mês no formato 'YYYY-MM'
 */
async function renderExpensesFromAPI(monthKey) {
  const expenseListEl = document.getElementById('expenseList');
  if (!expenseListEl) return;

  try {
    // Mostra loading
    expenseListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted);">Carregando...</li>';

    // Busca despesas da API
    const expenses = await DataService.fetchExpenses(monthKey);

    if (expenses.length === 0) {
      expenseListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma despesa neste período</li>';
      return;
    }

    expenseListEl.innerHTML = '';
    
    // Ordena por data (mais recentes primeiro)
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    expenses.forEach(tx => {
      const li = document.createElement('li');
      li.className = 'expense-item';
      li.innerHTML = `<div><div class="tx-desc">${escapeHtml(tx.description || 'Despesa')}</div><div class="tx-meta">${formatDate(tx.date)}</div></div><div class="tx-amount outcome">${formatAmount(tx.amount)}</div>`;
      expenseListEl.appendChild(li);
    });

  } catch (error) {
    console.error('[renderExpensesFromAPI] Erro:', error);
    expenseListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: #e74c3c;">Erro ao carregar despesas. Tente novamente.</li>';
  }
}

/**
 * Atualiza cards do topo com sumário de transações
 * Agora busca dados reais da API
 * @param {string} monthKey - Mês no formato 'YYYY-MM'
 */
async function updateStatsFromAPI(monthKey) {
  const receitasValue = document.querySelector('.stat.receitas .value');
  const despesasValue = document.querySelector('.stat.despesas .value');
  const saldoValue = document.querySelector('.stat.saldo .value');
  
  if (!receitasValue || !despesasValue || !saldoValue) return;

  try {
    // Mostra loading (opcional)
    receitasValue.textContent = '...';
    despesasValue.textContent = '...';
    saldoValue.textContent = '...';

    // Busca sumário da API
    const summary = await DataService.fetchTransactionsSummary(monthKey);

    receitasValue.textContent = formatAmount(summary.receitas);
    despesasValue.textContent = formatAmount(summary.despesas);
    saldoValue.textContent = formatAmount(summary.saldo);

  } catch (error) {
    console.error('[updateStatsFromAPI] Erro:', error);
    receitasValue.textContent = 'R$ 0,00';
    despesasValue.textContent = 'R$ 0,00';
    saldoValue.textContent = 'R$ 0,00';
  }
}

// ============================================================================
// FUNÇÕES DE RENDERIZAÇÃO (VERSÃO ANTIGA - mantida para outros cards)
// ============================================================================

function renderTransactions(list){
  const txListElem = document.getElementById('txList');
  if(!txListElem) return;
  txListElem.innerHTML = '';
  const latest = list.slice().reverse().slice(0,5);
  latest.forEach(tx=>{
    const li = document.createElement('li');
    li.className = tx.type === 'income' ? 'income-item' : 'expense-item';
    
    const leftDiv = document.createElement('div');
    
    const descDiv = document.createElement('div');
    descDiv.className = 'tx-desc';
    descDiv.textContent = tx.desc;
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'tx-meta';
    metaDiv.textContent = formatDate(tx.date);
    
    leftDiv.appendChild(descDiv);
    leftDiv.appendChild(metaDiv);
    
    const amountDiv = document.createElement('div');
    amountDiv.className = `tx-amount ${tx.type==='income'?'income':'outcome'}`;
    amountDiv.textContent = formatAmount(tx.amount);
    
    li.appendChild(leftDiv);
    li.appendChild(amountDiv);
    txListElem.appendChild(li);
  });
}

function renderIncomes(list){
  // Esta função agora é substituída por renderIncomesFromAPI
  // Mantida apenas para compatibilidade com outras partes do código
  // Use renderIncomesFromAPI(monthKey) ao invés
  console.warn('[renderIncomes] Função depreciada. Use renderIncomesFromAPI(monthKey)');
}

function renderExpensesList(monthKey){
  // Agora usa a versão assíncrona da API
  renderExpensesFromAPI(monthKey);
}

function updateStats(list){
  // Esta função agora é substituída por updateStatsFromAPI
  // Mantida apenas para compatibilidade com outras partes do código
  // Use updateStatsFromAPI(monthKey) ao invés
  console.warn('[updateStats] Função depreciada. Use updateStatsFromAPI(monthKey)');
}

function renderCreditCard(monthKey){
  const creditUsedEl = document.querySelector('.credit-used');
  const creditAvailableEl = document.querySelector('.credit-available');
  const creditBillEl = document.querySelector('.credit-bill');
  const creditDueEl = document.querySelector('.credit-due');
  const creditBarFill = document.querySelector('.credit-bar-fill');
  const creditPercentageEl = document.querySelector('.credit-percentage');

  const txForMonth = sampleTx.filter(t => getMonthKey(t.date) === monthKey);
  const creditUsed = txForMonth.reduce((s, t) => t.type === 'outcome' ? s + t.amount : s, 0);
  const defaultAvailable = 7150;
  const creditAvailable = Math.max(0, defaultAvailable);
  const creditBill = creditUsed;
  const pct = (creditUsed + creditAvailable) > 0 ? (creditUsed / (creditUsed + creditAvailable)) * 100 : 0;

  if(creditUsedEl) creditUsedEl.textContent = formatAmount(creditUsed);
  if(creditAvailableEl) creditAvailableEl.textContent = formatAmount(creditAvailable);
  if(creditBillEl) creditBillEl.textContent = formatAmount(creditBill);
  if(creditDueEl) creditDueEl.textContent = '-';
  if(creditBarFill) creditBarFill.style.width = pct.toFixed(1) + '%';
  if(creditPercentageEl) creditPercentageEl.textContent = pct.toFixed(1) + '% utilizado';
}

function renderDebtsCard(monthKey){
  const debtTotalEl = document.querySelector('.debt-total');
  const debtListEl = document.querySelector('.debt-list');
  
  console.log('[renderDebtsCard] monthKey:', monthKey);
  console.log('[renderDebtsCard] debtsData:', debtsData);
  
  if(!debtListEl) {
    console.log('[renderDebtsCard] ERROR: debtListEl not found');
    return;
  }
  
  const visibleDebts = debtsData.filter(d => d.paidInstallments.length < d.installments);
  console.log('[renderDebtsCard] visibleDebts (not fully paid):', visibleDebts);

  if(visibleDebts.length === 0){
    if(debtTotalEl) debtTotalEl.textContent = 'R$ 0,00';
    debtListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma dívida neste período</li>';
    return;
  }

  const totalPending = visibleDebts.reduce((sum, debt) => {
    return sum + calculateDebtRemainingValue(debt);
  }, 0);
  if(debtTotalEl) debtTotalEl.textContent = formatAmount(totalPending);

  debtListEl.innerHTML = '';
  visibleDebts.forEach(debt => {
    const remaining = calculateDebtRemaining(debt);
    const paidPercent = calculateDebtPaidPercent(debt);

    const li = document.createElement('li');
    li.className = 'debt-item';
    li.setAttribute('data-debt-id', debt.id);
    li.style.cursor = 'pointer';

    const metaText = `${debt.installments} - ${debt.paidInstallments.length} parcelas`;

    li.innerHTML = `
      <div>
        <div class="debt-name">${escapeHtml(debt.description)}</div>
        <div class="debt-meta">${metaText}</div>
      </div>
      <div class="debt-amount">${paidPercent}%</div>
    `;

    li.addEventListener('click', () => {
      if(typeof openDebtDetailsModal === 'function') {
        openDebtDetailsModal(debt.id);
      }
    });

    debtListEl.appendChild(li);
  });
}

function renderPatrimonyCard(monthKey){
  const patrimonyTotalEl = document.querySelector('.patrimony-total');
  const patrimonyBreakdownEl = document.querySelector('.patrimony-breakdown');
  
  if(!patrimonyBreakdownEl) return;
  
  if(monthKey === '2026-01'){
    if(patrimonyTotalEl) patrimonyTotalEl.textContent = 'R$ 45.320,00';
    patrimonyBreakdownEl.innerHTML = `
      <div class="patrimony-item">
        <div class="patrimony-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
        </div>
        <div class="patrimony-info">
          <div class="patrimony-label">Saldo em contas</div>
          <div class="patrimony-value">R$ 6.329,50</div>
        </div>
      </div>
      <div class="patrimony-item">
        <div class="patrimony-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        </div>
        <div class="patrimony-info">
          <div class="patrimony-label">Investimentos</div>
          <div class="patrimony-value">R$ 28.500,00</div>
        </div>
      </div>
      <div class="patrimony-item">
        <div class="patrimony-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          </svg>
        </div>
        <div class="patrimony-info">
          <div class="patrimony-label">Bens</div>
          <div class="patrimony-value">R$ 10.490,50</div>
        </div>
      </div>
    `;
  } else {
    if(patrimonyTotalEl) patrimonyTotalEl.textContent = 'R$ 0,00';
    patrimonyBreakdownEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Sem dados para este período</div>';
  }
}

function renderAccountsCard(monthKey){
  const receivableListEl = document.getElementById('receivableList');
  const payableListEl = document.getElementById('payableList');
  
  if(!receivableListEl || !payableListEl) return;
  const txForMonth = sampleTx.filter(t => getMonthKey(t.date) === monthKey);
  const incomes = txForMonth.filter(t => t.type === 'income');
  const outcomes = txForMonth.filter(t => t.type === 'outcome');

  if(incomes.length === 0){
    receivableListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma conta a receber</li>';
  } else {
    receivableListEl.innerHTML = '';
    incomes.forEach(tx => {
      const li = document.createElement('li');
      li.className = 'receivable-item';
      li.innerHTML = `<div><div class="tx-desc">${escapeHtml(tx.desc)}</div><div class="tx-meta">${formatDate(tx.date)}</div></div><div class="tx-amount income">${formatAmount(tx.amount)}</div>`;
      receivableListEl.appendChild(li);
    });
  }

  if(outcomes.length === 0){
    payableListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma conta a pagar</li>';
  } else {
    payableListEl.innerHTML = '';
    outcomes.forEach(tx => {
      const li = document.createElement('li');
      li.className = 'payable-item';
      li.innerHTML = `<div><div class="tx-desc">${escapeHtml(tx.desc)}</div><div class="tx-meta">${formatDate(tx.date)}</div></div><div class="tx-amount outcome">${formatAmount(tx.amount)}</div>`;
      payableListEl.appendChild(li);
    });
  }
}

function renderPendingInstallments(debt) {
  const list = document.getElementById('pendingInstallments');
  if(!list) return;

  list.innerHTML = '';
  const today = new Date();
  const installmentValue = debt.totalValue / debt.installments;

  for(let i = 1; i <= debt.installments; i++) {
    if(debt.paidInstallments.includes(i)) continue;

    const paymentDate = calculateInstallmentDate(debt.firstPayment, i - 1);
    const isOverdue = paymentDate < today;

    const li = document.createElement('li');
    li.className = 'installment-item' + (isOverdue ? ' overdue' : '');

    const infoDiv = document.createElement('div');
    infoDiv.className = 'installment-info';

    const numberSpan = document.createElement('div');
    numberSpan.className = 'installment-number';
    numberSpan.textContent = `Parcela ${i}/${debt.installments}`;

    const dateSpan = document.createElement('div');
    dateSpan.className = 'installment-date';
    dateSpan.textContent = formatDate(paymentDate.toISOString().split('T')[0]) + (isOverdue ? ' (Vencida)' : '');

    infoDiv.appendChild(numberSpan);
    infoDiv.appendChild(dateSpan);

    const valueSpan = document.createElement('div');
    valueSpan.className = 'installment-value';
    valueSpan.textContent = formatAmount(installmentValue);

    const payBtn = document.createElement('button');
    payBtn.className = 'btn-pay';
    payBtn.textContent = 'Pagar';
    payBtn.addEventListener('click', function() {
      if(typeof markInstallmentAsPaid === 'function') {
        markInstallmentAsPaid(debt.id, i);
      }
    });

    li.appendChild(infoDiv);
    li.appendChild(valueSpan);
    li.appendChild(payBtn);

    list.appendChild(li);
  }
}

function renderPaidInstallments(debt) {
  const list = document.getElementById('paidInstallments');
  if(!list) return;

  list.innerHTML = '';
  const installmentValue = debt.totalValue / debt.installments;

  const sortedPaid = [...debt.paidInstallments].sort((a, b) => a - b);

  sortedPaid.forEach(i => {
    const paymentDate = calculateInstallmentDate(debt.firstPayment, i - 1);

    const li = document.createElement('li');
    li.className = 'installment-item paid';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'installment-info';

    const numberSpan = document.createElement('div');
    numberSpan.className = 'installment-number';
    numberSpan.textContent = `Parcela ${i}/${debt.installments}`;

    const dateSpan = document.createElement('div');
    dateSpan.className = 'installment-date';
    dateSpan.textContent = `Paga em ${formatDate(paymentDate.toISOString().split('T')[0])}`;

    infoDiv.appendChild(numberSpan);
    infoDiv.appendChild(dateSpan);

    const valueSpan = document.createElement('div');
    valueSpan.className = 'installment-value';
    valueSpan.textContent = formatAmount(installmentValue);

    li.appendChild(infoDiv);
    li.appendChild(valueSpan);

    list.appendChild(li);
  });
}
