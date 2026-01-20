/**
 * ============================================================================
 * TESTE_CARD_EXTRATO.js - Funções de Teste para Card Extrato
 * ============================================================================
 * 
 * PROPÓSITO:
 * Fornece funções de teste via console do browser para validar a integração
 * do card "Extrato" (Receitas e Despesas) com o backend.
 * 
 * COMO USAR:
 * 1. Abra o dash.html no browser
 * 2. Abra o console (F12)
 * 3. Execute os testes abaixo
 * 
 * ============================================================================
 */

// ============================================================================
// FUNÇÕES DE TESTE - CRIAR TRANSAÇÕES
// ============================================================================

/**
 * Cria uma receita de teste
 * Exemplo de uso no console:
 * await criarReceitaTeste()
 */
async function criarReceitaTeste() {
  console.log('=== TESTE: Criar Receita ===');
  
  try {
    const receita = {
      description: 'Venda de Produto - TESTE',
      type: 'income',
      amount: 1500.00,
      date: new Date().toISOString(),
      category: 'Vendas'
    };

    console.log('Criando receita:', receita);

    const result = await DataService.createStatementTransaction(receita);

    if (result.success) {
      console.log('✅ Receita criada com sucesso!');
      console.log('Transação:', result.transaction);
      
      // Recarrega o card para mostrar a nova receita
      console.log('Recarregando card Extrato...');
      const monthKey = currentMonthKey || '2026-01';
      await renderIncomesFromAPI(monthKey);
      await updateStatsFromAPI(monthKey);
      
      console.log('✅ Card atualizado!');
    } else {
      console.error('❌ Erro ao criar receita');
    }

    return result;

  } catch (error) {
    console.error('❌ Erro ao criar receita:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cria uma despesa de teste
 * Exemplo de uso no console:
 * await criarDespesaTeste()
 */
async function criarDespesaTeste() {
  console.log('=== TESTE: Criar Despesa ===');
  
  try {
    const despesa = {
      description: 'Compra de Material - TESTE',
      type: 'expense',
      amount: 450.00,
      date: new Date().toISOString(),
      category: 'Materiais'
    };

    console.log('Criando despesa:', despesa);

    const result = await DataService.createStatementTransaction(despesa);

    if (result.success) {
      console.log('✅ Despesa criada com sucesso!');
      console.log('Transação:', result.transaction);
      
      // Recarrega o card para mostrar a nova despesa
      console.log('Recarregando card Extrato...');
      const monthKey = currentMonthKey || '2026-01';
      await renderExpensesFromAPI(monthKey);
      await updateStatsFromAPI(monthKey);
      
      console.log('✅ Card atualizado!');
    } else {
      console.error('❌ Erro ao criar despesa');
    }

    return result;

  } catch (error) {
    console.error('❌ Erro ao criar despesa:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cria múltiplas transações de teste de uma vez
 * Exemplo de uso no console:
 * await criarTransacoesTeste()
 */
async function criarTransacoesTeste() {
  console.log('=== TESTE: Criar Múltiplas Transações ===');
  
  const transacoes = [
    { description: 'Salário Janeiro', type: 'income', amount: 5000.00, category: 'Salário' },
    { description: 'Freelance Cliente A', type: 'income', amount: 1200.00, category: 'Freelance' },
    { description: 'Aluguel', type: 'expense', amount: 1500.00, category: 'Moradia' },
    { description: 'Supermercado', type: 'expense', amount: 350.00, category: 'Alimentação' },
    { description: 'Internet', type: 'expense', amount: 99.90, category: 'Contas' }
  ];

  const results = [];

  for (const tx of transacoes) {
    try {
      const result = await DataService.createStatementTransaction({
        ...tx,
        date: new Date().toISOString()
      });
      
      results.push({ ...tx, success: result.success });
      console.log(`${result.success ? '✅' : '❌'} ${tx.description}`);
      
    } catch (error) {
      console.error(`❌ Erro em ${tx.description}:`, error.message);
      results.push({ ...tx, success: false, error: error.message });
    }
  }

  console.log('\n=== Resumo ===');
  console.log(`Total: ${results.length}`);
  console.log(`Sucesso: ${results.filter(r => r.success).length}`);
  console.log(`Falhas: ${results.filter(r => !r.success).length}`);

  // Recarrega o card
  const monthKey = currentMonthKey || '2026-01';
  await renderIncomesFromAPI(monthKey);
  await renderExpensesFromAPI(monthKey);
  await updateStatsFromAPI(monthKey);
  
  console.log('✅ Cards atualizados!');

  return results;
}

// ============================================================================
// FUNÇÕES DE TESTE - BUSCAR DADOS
// ============================================================================

/**
 * Testa buscar receitas do mês atual
 * Exemplo de uso no console:
 * await testarBuscarReceitas()
 */
async function testarBuscarReceitas() {
  console.log('=== TESTE: Buscar Receitas ===');
  
  try {
    const monthKey = currentMonthKey || '2026-01';
    console.log(`Buscando receitas de ${monthKey}...`);

    const receitas = await DataService.fetchIncomes(monthKey);

    console.log(`✅ Encontradas ${receitas.length} receitas`);
    console.table(receitas.map(r => ({
      Descrição: r.description,
      Valor: `R$ ${r.amount.toFixed(2)}`,
      Data: new Date(r.date).toLocaleDateString('pt-BR'),
      Categoria: r.category || 'Sem categoria'
    })));

    return receitas;

  } catch (error) {
    console.error('❌ Erro ao buscar receitas:', error);
    return [];
  }
}

/**
 * Testa buscar despesas do mês atual
 * Exemplo de uso no console:
 * await testarBuscarDespesas()
 */
async function testarBuscarDespesas() {
  console.log('=== TESTE: Buscar Despesas ===');
  
  try {
    const monthKey = currentMonthKey || '2026-01';
    console.log(`Buscando despesas de ${monthKey}...`);

    const despesas = await DataService.fetchExpenses(monthKey);

    console.log(`✅ Encontradas ${despesas.length} despesas`);
    console.table(despesas.map(d => ({
      Descrição: d.description,
      Valor: `R$ ${d.amount.toFixed(2)}`,
      Data: new Date(d.date).toLocaleDateString('pt-BR'),
      Categoria: d.category || 'Sem categoria'
    })));

    return despesas;

  } catch (error) {
    console.error('❌ Erro ao buscar despesas:', error);
    return [];
  }
}

/**
 * Testa buscar sumário de transações
 * Exemplo de uso no console:
 * await testarSumario()
 */
async function testarSumario() {
  console.log('=== TESTE: Buscar Sumário ===');
  
  try {
    const monthKey = currentMonthKey || '2026-01';
    console.log(`Buscando sumário de ${monthKey}...`);

    const summary = await DataService.fetchTransactionsSummary(monthKey);

    console.log('✅ Sumário obtido:');
    console.table({
      Receitas: `R$ ${summary.receitas.toFixed(2)}`,
      Despesas: `R$ ${summary.despesas.toFixed(2)}`,
      Saldo: `R$ ${summary.saldo.toFixed(2)}`
    });

    return summary;

  } catch (error) {
    console.error('❌ Erro ao buscar sumário:', error);
    return { receitas: 0, despesas: 0, saldo: 0 };
  }
}

// ============================================================================
// TESTE COMPLETO
// ============================================================================

/**
 * Executa todos os testes de forma sequencial
 * Exemplo de uso no console:
 * await testeCompleto()
 */
async function testeCompleto() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   TESTE COMPLETO - CARD EXTRATO          ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  // 1. Verificar autenticação
  console.log('1️⃣ Verificando autenticação...');
  const userId = DataService.getUserId();
  if (!userId) {
    console.error('❌ Usuário não autenticado! Faça login primeiro.');
    return;
  }
  console.log(`✅ Usuário autenticado: ${userId}\n`);

  // 2. Buscar dados existentes
  console.log('2️⃣ Buscando dados existentes...');
  await testarSumario();
  console.log('');

  // 3. Criar receita de teste
  console.log('3️⃣ Criando receita de teste...');
  await criarReceitaTeste();
  console.log('');

  // 4. Criar despesa de teste
  console.log('4️⃣ Criando despesa de teste...');
  await criarDespesaTeste();
  console.log('');

  // 5. Verificar sumário atualizado
  console.log('5️⃣ Verificando sumário atualizado...');
  await testarSumario();
  console.log('');

  // 6. Listar receitas
  console.log('6️⃣ Listando receitas...');
  await testarBuscarReceitas();
  console.log('');

  // 7. Listar despesas
  console.log('7️⃣ Listando despesas...');
  await testarBuscarDespesas();
  console.log('');

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   ✅ TESTE COMPLETO FINALIZADO           ║');
  console.log('╚═══════════════════════════════════════════╝');
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Limpa todas as transações de teste criadas hoje
 * (Ainda não implementado - requer endpoint de delete)
 */
function limparTransacoesTeste() {
  console.warn('⚠️  Função ainda não implementada');
  console.log('Para limpar as transações de teste, use o MongoDB Compass ou mongo shell');
  console.log('Filtro sugerido: { description: { $regex: "TESTE" } }');
}

// ============================================================================
// EXPORTAR PARA CONSOLE
// ============================================================================

window.TestesExtrato = {
  // Criar
  criarReceitaTeste,
  criarDespesaTeste,
  criarTransacoesTeste,
  
  // Buscar
  testarBuscarReceitas,
  testarBuscarDespesas,
  testarSumario,
  
  // Completo
  testeCompleto,
  
  // Helpers
  limparTransacoesTeste
};

console.log('✅ [TestesExtrato] Módulo de testes carregado');
console.log('📖 Use: TestesExtrato.testeCompleto() para executar todos os testes');
console.log('📖 Use: await criarReceitaTeste() para criar uma receita');
console.log('📖 Use: await criarDespesaTeste() para criar uma despesa');
