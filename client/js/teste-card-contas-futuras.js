/**
 * ==============================================================================
 * TESTE - CARD CONTAS FUTURAS (A RECEBER / A PAGAR)
 * ==============================================================================
 * 
 * PROPÓSITO:
 * Script de testes para validar a integração do card "Contas Futuras" do
 * dashboard com o backend MongoDB via DataAgent.
 * 
 * FUNCIONALIDADES TESTADAS:
 * - Busca de contas a receber (receivables)
 * - Busca de contas a pagar (payables)
 * - Criação de novas contas futuras
 * - Renderização dinâmica das listas
 * 
 * COMO USAR:
 * 1. Certifique-se de estar logado no sistema
 * 2. Abra o Console do navegador (F12)
 * 3. Execute: await testeCompleto()
 * 
 * DEPENDÊNCIAS:
 * - DataService.js (executeAgent, fetchReceivables, fetchPayables, createFutureAccount)
 * - dash-data.js (renderReceivablesFromAPI, renderPayablesFromAPI)
 * - Backend rodando (serverAgent.js na porta 5000)
 * - MongoDB conectado
 * 
 * ==============================================================================
 */

'use strict';

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function gerarDataFutura(diasAFrente = 15) {
  const data = new Date();
  data.setDate(data.getDate() + diasAFrente);
  return data.toISOString().split('T')[0];
}

function getMesAtual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatarResultado(titulo, dados) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${titulo}`);
  console.log('='.repeat(50));
  console.log(JSON.stringify(dados, null, 2));
  console.log('='.repeat(50) + '\n');
}

// ============================================================================
// TESTES INDIVIDUAIS
// ============================================================================

/**
 * Teste 1: Criar uma conta a receber
 */
async function criarContaReceber() {
  console.log('\n📥 Teste 1: Criar Conta a Receber');
  console.log('─'.repeat(50));

  try {
    const contaData = {
      type: 'income',
      amount: 1500.00,
      description: 'Pagamento Cliente X',
      date: gerarDataFutura(10),
      dueDate: gerarDataFutura(10),
      scheduledType: 'receivable',
      category: 'Serviços',
      frequency: 'once'
    };

    console.log('📝 Dados da conta:', contaData);

    const resultado = await DataService.createFutureAccount(contaData);

    if (resultado.success) {
      console.log('✅ Conta a receber criada com sucesso!');
      formatarResultado('Conta Criada', resultado.transaction);
      return resultado.transaction;
    } else {
      console.error('❌ Falha ao criar conta a receber');
      console.error('Resposta:', resultado);
      return null;
    }

  } catch (error) {
    console.error('❌ Erro ao criar conta a receber:', error);
    return null;
  }
}

/**
 * Teste 2: Criar uma conta a pagar
 */
async function criarContaPagar() {
  console.log('\n📤 Teste 2: Criar Conta a Pagar');
  console.log('─'.repeat(50));

  try {
    const contaData = {
      type: 'expense',
      amount: 850.00,
      description: 'Fornecedor Y - Material',
      date: gerarDataFutura(20),
      dueDate: gerarDataFutura(20),
      scheduledType: 'payable',
      category: 'Fornecedores',
      frequency: 'once'
    };

    console.log('📝 Dados da conta:', contaData);

    const resultado = await DataService.createFutureAccount(contaData);

    if (resultado.success) {
      console.log('✅ Conta a pagar criada com sucesso!');
      formatarResultado('Conta Criada', resultado.transaction);
      return resultado.transaction;
    } else {
      console.error('❌ Falha ao criar conta a pagar');
      console.error('Resposta:', resultado);
      return null;
    }

  } catch (error) {
    console.error('❌ Erro ao criar conta a pagar:', error);
    return null;
  }
}

/**
 * Teste 3: Buscar contas a receber
 */
async function buscarContasReceber() {
  console.log('\n🔍 Teste 3: Buscar Contas a Receber');
  console.log('─'.repeat(50));

  try {
    const mesAtual = getMesAtual();
    console.log(`📅 Buscando contas do mês: ${mesAtual}`);

    const contas = await DataService.fetchReceivables(mesAtual);

    console.log(`✅ Encontradas ${contas.length} contas a receber`);
    
    if (contas.length > 0) {
      formatarResultado('Contas a Receber', contas);
    } else {
      console.log('ℹ️  Nenhuma conta a receber encontrada para este mês');
    }

    return contas;

  } catch (error) {
    console.error('❌ Erro ao buscar contas a receber:', error);
    return [];
  }
}

/**
 * Teste 4: Buscar contas a pagar
 */
async function buscarContasPagar() {
  console.log('\n🔍 Teste 4: Buscar Contas a Pagar');
  console.log('─'.repeat(50));

  try {
    const mesAtual = getMesAtual();
    console.log(`📅 Buscando contas do mês: ${mesAtual}`);

    const contas = await DataService.fetchPayables(mesAtual);

    console.log(`✅ Encontradas ${contas.length} contas a pagar`);
    
    if (contas.length > 0) {
      formatarResultado('Contas a Pagar', contas);
    } else {
      console.log('ℹ️  Nenhuma conta a pagar encontrada para este mês');
    }

    return contas;

  } catch (error) {
    console.error('❌ Erro ao buscar contas a pagar:', error);
    return [];
  }
}

/**
 * Teste 5: Testar renderização no card
 */
async function testarRenderizacao() {
  console.log('\n🎨 Teste 5: Testar Renderização no Card');
  console.log('─'.repeat(50));

  try {
    const mesAtual = getMesAtual();
    
    console.log('🖼️  Renderizando contas a receber...');
    await renderReceivablesFromAPI(mesAtual);
    
    console.log('🖼️  Renderizando contas a pagar...');
    await renderPayablesFromAPI(mesAtual);
    
    console.log('✅ Renderização concluída!');
    console.log('👀 Verifique o card "Contas Futuras" no dashboard');

  } catch (error) {
    console.error('❌ Erro ao renderizar:', error);
  }
}

// ============================================================================
// TESTE COMPLETO
// ============================================================================

/**
 * Executa todos os testes em sequência
 */
async function testeCompleto() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   TESTE COMPLETO - CARD CONTAS FUTURAS   ║');
  console.log('╚═══════════════════════════════════════════╝');

  // 1. Verificar autenticação
  console.log('1️⃣ Verificando autenticação...');
  const userId = DataService.getUserId();
  if (!userId) {
    console.error('❌ Usuário não autenticado! Faça login primeiro.');
    return;
  }
  console.log(`✅ Usuário autenticado: ${userId}\n`);

  // 2. Criar conta a receber
  console.log('2️⃣ Criando conta a receber...');
  const contaReceber = await criarContaReceber();
  if (!contaReceber) {
    console.error('⚠️  Falha ao criar conta a receber, mas continuando testes...\n');
  }

  // 3. Criar conta a pagar
  console.log('3️⃣ Criando conta a pagar...');
  const contaPagar = await criarContaPagar();
  if (!contaPagar) {
    console.error('⚠️  Falha ao criar conta a pagar, mas continuando testes...\n');
  }

  // Aguardar um pouco para garantir que os dados foram salvos
  console.log('⏳ Aguardando 1 segundo para sincronização...\n');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 4. Buscar contas a receber
  console.log('4️⃣ Buscando contas a receber...');
  const contasReceber = await buscarContasReceber();

  // 5. Buscar contas a pagar
  console.log('5️⃣ Buscando contas a pagar...');
  const contasPagar = await buscarContasPagar();

  // 6. Testar renderização
  console.log('6️⃣ Testando renderização...');
  await testarRenderizacao();

  // Resumo final
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║            RESUMO DOS TESTES             ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`✅ Conta a receber criada: ${contaReceber ? 'SIM' : 'NÃO'}`);
  console.log(`✅ Conta a pagar criada: ${contaPagar ? 'SIM' : 'NÃO'}`);
  console.log(`📥 Contas a receber encontradas: ${contasReceber.length}`);
  console.log(`📤 Contas a pagar encontradas: ${contasPagar.length}`);
  console.log('\n🎉 Testes concluídos!\n');
}

// ============================================================================
// TESTES RÁPIDOS (ATALHOS)
// ============================================================================

/**
 * Teste rápido: criar apenas uma conta a receber
 */
async function testeReceber() {
  console.log('🚀 TESTE RÁPIDO: Criar Conta a Receber\n');
  
  const userId = DataService.getUserId();
  if (!userId) {
    console.error('❌ Usuário não autenticado!');
    return;
  }

  await criarContaReceber();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await buscarContasReceber();
  await testarRenderizacao();
  
  console.log('\n✅ Teste rápido concluído!');
}

/**
 * Teste rápido: criar apenas uma conta a pagar
 */
async function testePagar() {
  console.log('🚀 TESTE RÁPIDO: Criar Conta a Pagar\n');
  
  const userId = DataService.getUserId();
  if (!userId) {
    console.error('❌ Usuário não autenticado!');
    return;
  }

  await criarContaPagar();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await buscarContasPagar();
  await testarRenderizacao();
  
  console.log('\n✅ Teste rápido concluído!');
}

// ============================================================================
// INFORMAÇÕES E AJUDA
// ============================================================================

function ajuda() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                  TESTES - CARD CONTAS FUTURAS                     ║
╚════════════════════════════════════════════════════════════════════╝

📋 FUNÇÕES DISPONÍVEIS:

  TESTES COMPLETOS:
  ─────────────────────────────────────────────────────────────────
  await testeCompleto()      → Executa todos os testes em sequência
  
  TESTES INDIVIDUAIS:
  ─────────────────────────────────────────────────────────────────
  await criarContaReceber()  → Cria uma conta a receber
  await criarContaPagar()    → Cria uma conta a pagar
  await buscarContasReceber()→ Busca contas a receber do mês atual
  await buscarContasPagar()  → Busca contas a pagar do mês atual
  await testarRenderizacao() → Atualiza o card no dashboard
  
  TESTES RÁPIDOS:
  ─────────────────────────────────────────────────────────────────
  await testeReceber()       → Cria e exibe uma conta a receber
  await testePagar()         → Cria e exibe uma conta a pagar
  
  AJUDA:
  ─────────────────────────────────────────────────────────────────
  ajuda()                    → Mostra esta mensagem

╔════════════════════════════════════════════════════════════════════╗
║  💡 DICA: Comece com 'await testeCompleto()' para testar tudo!   ║
╚════════════════════════════════════════════════════════════════════╝
  `);
}

// Mostrar ajuda ao carregar
console.log('📦 Teste Card Contas Futuras carregado!');
console.log('💡 Digite ajuda() para ver os comandos disponíveis');
