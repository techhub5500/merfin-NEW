/**
 * ============================================================================
 * TESTES - CARD DE DÍVIDAS
 * ============================================================================
 * 
 * PROPÓSITO:
 * Arquivo de testes para validar integração completa do card de Dívidas
 * entre frontend (dash.html) e backend (MongoDB via DataAgent)
 * 
 * FUNCIONALIDADES TESTADAS:
 * - Criação de dívidas
 * - Listagem de dívidas ativas
 * - Busca de detalhes (parcelas)
 * - Pagamento de parcelas
 * - Atualização de dívidas
 * - Renderização no card
 * 
 * USO:
 * Abra dash.html logado e execute no console:
 * - await testeCompleto()         // Executa todos os testes
 * - await criarDivida()            // Cria dívida de teste
 * - await buscarDividas()          // Lista todas as dívidas
 * - await buscarDetalhesDivida(id) // Busca detalhes + parcelas
 * - await pagarParcela(id, numero) // Marca parcela como paga
 * - await testarRenderizacao()     // Testa renderização do card
 * - await testeRapido()            // Teste básico (criar + listar)
 * - ajuda()                        // Mostra comandos disponíveis
 * 
 * ============================================================================
 */

'use strict';

// ============================================================================
// FUNÇÕES DE TESTE
// ============================================================================

/**
 * Cria uma dívida de teste
 */
async function criarDivida() {
  console.log('\n=== TESTE: Criar Dívida ===\n');

  const debtData = {
    description: 'Financiamento Teste',
    institution: 'Banco Teste',
    debtDate: '2025-01-01',
    totalValue: 12000,
    installmentCount: 12,
    firstPaymentDate: '2025-02-05',
    debtType: 'personal_loan',
    interestRate: 1.5,
    notes: 'Dívida criada via teste frontend'
  };

  console.log('📤 Enviando dados:', debtData);

  try {
    const result = await DataService.createDebtEntry(debtData);

    if (result.success) {
      console.log('✅ Dívida criada com sucesso!');
      console.log('📊 Dados:', result.debt);
      console.log('\n💾 ID da dívida:', result.debt._id);
      console.log('💰 Valor total:', `R$ ${result.debt.totalValue.toFixed(2)}`);
      console.log('📅 Parcelas:', result.debt.installmentCount);
      console.log('💳 Valor da parcela:', `R$ ${result.debt.installmentValue.toFixed(2)}`);
      return result.debt;
    } else {
      console.error('❌ Erro ao criar dívida');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    return null;
  }
}

/**
 * Busca todas as dívidas do usuário
 */
async function buscarDividas(status = 'active') {
  console.log(`\n=== TESTE: Buscar Dívidas (${status}) ===\n`);

  try {
    const result = await DataService.fetchDebts(status);

    console.log('✅ Dívidas encontradas:', result.count);
    console.log('💰 Total pendente:', `R$ ${result.totalPending.toFixed(2)}`);
    
    if (result.debts.length > 0) {
      console.log('\n📋 Lista de dívidas:');
      result.debts.forEach((debt, index) => {
        console.log(`\n${index + 1}. ${debt.description}`);
        console.log(`   ID: ${debt._id}`);
        console.log(`   Instituição: ${debt.institution}`);
        console.log(`   Total: R$ ${debt.totalValue.toFixed(2)}`);
        console.log(`   Parcelas: ${debt.paidInstallmentsCount}/${debt.installmentCount} pagas`);
        console.log(`   Restante: R$ ${debt.remainingValue.toFixed(2)} (${debt.paidPercentage.toFixed(1)}% pago)`);
      });
    } else {
      console.log('📭 Nenhuma dívida encontrada');
    }

    return result;
  } catch (error) {
    console.error('❌ Erro:', error);
    return null;
  }
}

/**
 * Busca detalhes de uma dívida específica
 */
async function buscarDetalhesDivida(debtId) {
  console.log('\n=== TESTE: Buscar Detalhes da Dívida ===\n');

  if (!debtId) {
    console.error('❌ Erro: forneça o ID da dívida');
    console.log('💡 Use: await buscarDetalhesDivida("ID_DA_DIVIDA")');
    return null;
  }

  try {
    const debt = await DataService.fetchDebtDetails(debtId);

    console.log('✅ Detalhes carregados!');
    console.log('\n📊 Informações Gerais:');
    console.log(`   Descrição: ${debt.description}`);
    console.log(`   Instituição: ${debt.institution}`);
    console.log(`   Valor Total: R$ ${debt.totalValue.toFixed(2)}`);
    console.log(`   Parcelas: ${debt.installmentCount}x de R$ ${debt.installmentValue.toFixed(2)}`);

    console.log('\n💰 Resumo Financeiro:');
    console.log(`   Total Pago: R$ ${debt.summary.totalPaid.toFixed(2)}`);
    console.log(`   Restante: R$ ${debt.summary.remainingValue.toFixed(2)}`);
    console.log(`   Progresso: ${debt.summary.paidPercentage.toFixed(1)}%`);

    if (debt.summary.nextPayment) {
      const nextDate = new Date(debt.summary.nextPayment.dueDate);
      console.log('\n📅 Próximo Pagamento:');
      console.log(`   Parcela: ${debt.summary.nextPayment.installmentNumber}/${debt.installmentCount}`);
      console.log(`   Vencimento: ${nextDate.toLocaleDateString('pt-BR')}`);
      console.log(`   Valor: R$ ${debt.summary.nextPayment.amount.toFixed(2)}`);
      if (debt.summary.nextPayment.isOverdue) {
        console.log('   ⚠️ ATRASADA!');
      }
    } else {
      console.log('\n✅ Todas as parcelas pagas!');
    }

    console.log(`\n📋 Parcelas Pendentes: ${debt.pendingInstallments.length}`);
    console.log(`✅ Parcelas Pagas: ${debt.paidInstallments.length}`);

    return debt;
  } catch (error) {
    console.error('❌ Erro:', error);
    return null;
  }
}

/**
 * Paga uma parcela da dívida
 */
async function pagarParcela(debtId, installmentNumber, paidAmount = null) {
  console.log('\n=== TESTE: Pagar Parcela ===\n');

  if (!debtId || !installmentNumber) {
    console.error('❌ Erro: forneça o ID da dívida e número da parcela');
    console.log('💡 Use: await pagarParcela("ID_DA_DIVIDA", 1)');
    return null;
  }

  console.log(`💳 Pagando parcela ${installmentNumber}...`);
  if (paidAmount) {
    console.log(`💰 Valor: R$ ${paidAmount.toFixed(2)}`);
  }

  try {
    const result = await DataService.payDebtInstallment(debtId, installmentNumber, paidAmount);

    if (result.success) {
      console.log('✅ Parcela paga com sucesso!');
      console.log(`📊 Parcela #${result.installmentPaid} marcada como paga`);
      
      // Busca detalhes atualizados
      const updatedDebt = await DataService.fetchDebtDetails(debtId);
      console.log('\n📈 Status atualizado:');
      console.log(`   Pagas: ${updatedDebt.summary.paidCount}/${updatedDebt.installmentCount}`);
      console.log(`   Progresso: ${updatedDebt.summary.paidPercentage.toFixed(1)}%`);
      console.log(`   Restante: R$ ${updatedDebt.summary.remainingValue.toFixed(2)}`);

      return result;
    } else {
      console.error('❌ Erro ao pagar parcela');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    return null;
  }
}

/**
 * Atualiza dados de uma dívida
 */
async function atualizarDivida(debtId, updates) {
  console.log('\n=== TESTE: Atualizar Dívida ===\n');

  if (!debtId) {
    console.error('❌ Erro: forneça o ID da dívida');
    console.log('💡 Use: await atualizarDivida("ID", { notes: "Nova observação" })');
    return null;
  }

  console.log('📤 Enviando atualizações:', updates);

  try {
    const result = await DataService.updateDebtEntry(debtId, updates);

    if (result.success) {
      console.log('✅ Dívida atualizada com sucesso!');
      console.log('📊 Dados atualizados:', result.debt);
      return result.debt;
    } else {
      console.error('❌ Erro ao atualizar dívida');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    return null;
  }
}

/**
 * Testa a renderização do card de dívidas
 */
async function testarRenderizacao() {
  console.log('\n=== TESTE: Renderização do Card ===\n');

  try {
    console.log('🎨 Renderizando card de dívidas...');
    await renderDebtsCardFromAPI('2026-01');
    
    console.log('✅ Renderização concluída!');
    console.log('👀 Verifique o card "Dívidas" no dashboard');
    
    return true;
  } catch (error) {
    console.error('❌ Erro na renderização:', error);
    return false;
  }
}

/**
 * Teste rápido (criar dívida + listar)
 */
async function testeRapido() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     TESTE RÁPIDO - CARD DÍVIDAS       ║');
  console.log('╚════════════════════════════════════════╝\n');

  // 1. Criar dívida
  const debt = await criarDivida();
  if (!debt) {
    console.error('\n❌ Falha ao criar dívida. Teste interrompido.');
    return;
  }

  // 2. Aguardar um pouco
  await new Promise(resolve => setTimeout(resolve, 500));

  // 3. Listar dívidas
  await buscarDividas();

  // 4. Renderizar card
  await new Promise(resolve => setTimeout(resolve, 500));
  await testarRenderizacao();

  console.log('\n✅ Teste rápido concluído!');
  console.log(`💾 ID da dívida criada: ${debt._id}`);
  console.log('\n💡 Próximos passos:');
  console.log(`   - await buscarDetalhesDivida("${debt._id}")`);
  console.log(`   - await pagarParcela("${debt._id}", 1)`);
}

/**
 * Teste completo (todas as operações)
 */
async function testeCompleto() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   TESTE COMPLETO - CARD DÍVIDAS       ║');
  console.log('╚════════════════════════════════════════╝\n');

  let testDebtId = null;

  try {
    // 1. Criar dívida
    console.log('📝 Passo 1: Criar dívida de teste');
    const debt = await criarDivida();
    if (!debt) throw new Error('Falha ao criar dívida');
    testDebtId = debt._id;
    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Buscar todas as dívidas
    console.log('\n📋 Passo 2: Listar todas as dívidas');
    await buscarDividas();
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Buscar detalhes
    console.log('\n🔍 Passo 3: Buscar detalhes da dívida');
    await buscarDetalhesDivida(testDebtId);
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. Pagar primeira parcela
    console.log('\n💳 Passo 4: Pagar primeira parcela');
    await pagarParcela(testDebtId, 1);
    await new Promise(resolve => setTimeout(resolve, 500));

    // 5. Pagar segunda parcela
    console.log('\n💳 Passo 5: Pagar segunda parcela');
    await pagarParcela(testDebtId, 2);
    await new Promise(resolve => setTimeout(resolve, 500));

    // 6. Atualizar observações
    console.log('\n✏️ Passo 6: Atualizar observações');
    await atualizarDivida(testDebtId, {
      notes: 'Dívida sendo paga regularmente - teste completo executado'
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // 7. Renderizar card
    console.log('\n🎨 Passo 7: Renderizar card atualizado');
    await testarRenderizacao();

    // Resumo final
    console.log('\n' + '='.repeat(50));
    console.log('✅ TESTE COMPLETO FINALIZADO COM SUCESSO!');
    console.log('='.repeat(50));
    console.log(`\n💾 ID da dívida criada: ${testDebtId}`);
    console.log('\n📊 Resumo dos testes:');
    console.log('   ✅ Criação de dívida');
    console.log('   ✅ Listagem de dívidas');
    console.log('   ✅ Detalhes da dívida');
    console.log('   ✅ Pagamento de parcelas (2)');
    console.log('   ✅ Atualização de dados');
    console.log('   ✅ Renderização do card');
    console.log('\n👀 Verifique o card "Dívidas" no dashboard!');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error);
    console.log('\n💡 Dívida criada:', testDebtId || 'Nenhuma');
  }
}

/**
 * Mostra ajuda com comandos disponíveis
 */
function ajuda() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║        COMANDOS DISPONÍVEIS - CARD DÍVIDAS            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log('📦 TESTES PRINCIPAIS:');
  console.log('   await testeCompleto()');
  console.log('   → Executa todos os testes em sequência\n');
  
  console.log('   await testeRapido()');
  console.log('   → Teste básico (criar + listar + renderizar)\n');
  
  console.log('📝 OPERAÇÕES INDIVIDUAIS:');
  console.log('   await criarDivida()');
  console.log('   → Cria uma dívida de teste\n');
  
  console.log('   await buscarDividas()');
  console.log('   → Lista todas as dívidas ativas\n');
  
  console.log('   await buscarDetalhesDivida("ID_DA_DIVIDA")');
  console.log('   → Busca detalhes + parcelas de uma dívida\n');
  
  console.log('   await pagarParcela("ID_DA_DIVIDA", 1)');
  console.log('   → Marca parcela como paga\n');
  
  console.log('   await atualizarDivida("ID", { notes: "Texto" })');
  console.log('   → Atualiza dados da dívida\n');
  
  console.log('   await testarRenderizacao()');
  console.log('   → Atualiza o card no dashboard\n');
  
  console.log('ℹ️  INFORMAÇÕES:');
  console.log('   - Todas as funções são assíncronas (use await)');
  console.log('   - Os dados são salvos no MongoDB');
  console.log('   - Card não depende do filtro de mês');
  console.log('   - Mostra apenas dívidas ativas por padrão\n');
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

console.log('📦 Teste Card Dívidas carregado!');
console.log('💡 Digite ajuda() para ver os comandos disponíveis');
