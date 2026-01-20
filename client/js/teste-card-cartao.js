/**
 * ==============================================================================
 * TESTE - CARD CARTÃO DE CRÉDITO
 * ==============================================================================
 * 
 * PROPÓSITO:
 * Script de testes para validar a integração do card "Cartão de Crédito" do
 * dashboard com o backend MongoDB via DataAgent.
 * 
 * FUNCIONALIDADES TESTADAS:
 * - Criação de cartão de crédito
 * - Busca de cartões
 * - Atualização de cartão
 * - Cálculo de utilização (fatura)
 * - Renderização dinâmica do card
 * 
 * COMO USAR:
 * 1. Certifique-se de estar logado no sistema
 * 2. Abra o Console do navegador (F12)
 * 3. Execute: await testeCompleto()
 * 
 * DEPENDÊNCIAS:
 * - DataService.js (executeAgent, fetchCreditCards, createCreditCard, etc)
 * - dash-data.js (renderCreditCardFromAPI)
 * - Backend rodando (serverAgent.js na porta 5000)
 * - MongoDB conectado
 * 
 * ==============================================================================
 */

'use strict';

// ============================================================================
// UTILITÁRIOS
// ============================================================================

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
 * Teste 1: Criar um cartão de crédito
 */
async function criarCartao() {
  console.log('\n💳 Teste 1: Criar Cartão de Crédito');
  console.log('─'.repeat(50));

  try {
    const cardData = {
      cardName: 'Nubank Ultravioleta',
      creditLimit: 10000.00,
      billingCycleRenewalDay: 15,
      billingDueDay: 25,
      brand: 'mastercard'
    };

    console.log('📝 Dados do cartão:', cardData);

    const resultado = await DataService.createCreditCard(cardData);

    if (resultado.success) {
      console.log('✅ Cartão criado com sucesso!');
      formatarResultado('Cartão Criado', resultado.card);
      return resultado.card;
    } else {
      console.error('❌ Falha ao criar cartão');
      console.error('Resposta:', resultado);
      return null;
    }

  } catch (error) {
    console.error('❌ Erro ao criar cartão:', error);
    return null;
  }
}

/**
 * Teste 2: Buscar cartões do usuário
 */
async function buscarCartoes() {
  console.log('\n🔍 Teste 2: Buscar Cartões');
  console.log('─'.repeat(50));

  try {
    const cartoes = await DataService.fetchCreditCards();

    console.log(`✅ Encontrados ${cartoes.length} cartões`);
    
    if (cartoes.length > 0) {
      formatarResultado('Cartões Encontrados', cartoes);
    } else {
      console.log('ℹ️  Nenhum cartão encontrado');
    }

    return cartoes;

  } catch (error) {
    console.error('❌ Erro ao buscar cartões:', error);
    return [];
  }
}

/**
 * Teste 3: Buscar utilização do cartão
 */
async function buscarUtilizacao(cardId) {
  console.log('\n📊 Teste 3: Buscar Utilização do Cartão');
  console.log('─'.repeat(50));

  try {
    if (!cardId) {
      const cartoes = await DataService.fetchCreditCards();
      if (cartoes.length === 0) {
        console.log('⚠️  Nenhum cartão disponível para buscar utilização');
        return null;
      }
      cardId = cartoes[0]._id;
    }

    console.log(`📅 Buscando utilização do cartão: ${cardId}`);

    const utilization = await DataService.fetchCreditCardUtilization(cardId);

    console.log('✅ Utilização obtida com sucesso');
    formatarResultado('Utilização do Cartão', utilization);

    return utilization;

  } catch (error) {
    console.error('❌ Erro ao buscar utilização:', error);
    return null;
  }
}

/**
 * Teste 4: Atualizar cartão
 */
async function atualizarCartao(cardId, updates) {
  console.log('\n✏️  Teste 4: Atualizar Cartão');
  console.log('─'.repeat(50));

  try {
    if (!cardId) {
      const cartoes = await DataService.fetchCreditCards();
      if (cartoes.length === 0) {
        console.log('⚠️  Nenhum cartão disponível para atualizar');
        return null;
      }
      cardId = cartoes[0]._id;
    }

    if (!updates) {
      updates = {
        creditLimit: 15000.00,
        billingCycleRenewalDay: 20,
        billingDueDay: 30
      };
    }

    console.log(`📝 Atualizando cartão ${cardId}`);
    console.log('Alterações:', updates);

    const resultado = await DataService.updateCreditCard(cardId, updates);

    if (resultado.success) {
      console.log('✅ Cartão atualizado com sucesso!');
      formatarResultado('Cartão Atualizado', resultado.card);
      return resultado.card;
    } else {
      console.error('❌ Falha ao atualizar cartão');
      console.error('Resposta:', resultado);
      return null;
    }

  } catch (error) {
    console.error('❌ Erro ao atualizar cartão:', error);
    return null;
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
    
    console.log('🖼️  Renderizando card de cartão de crédito...');
    await renderCreditCardFromAPI(mesAtual);
    
    console.log('✅ Renderização concluída!');
    console.log('👀 Verifique o card "Cartão de Crédito" no dashboard');

  } catch (error) {
    console.error('❌ Erro ao renderizar:', error);
  }
}

/**
 * Teste 6: Criar transação de cartão de crédito
 */
async function criarTransacaoCartao(cardId) {
  console.log('\n🛒 Teste 6: Criar Transação no Cartão');
  console.log('─'.repeat(50));

  try {
    if (!cardId) {
      const cartoes = await DataService.fetchCreditCards();
      if (cartoes.length === 0) {
        console.log('⚠️  Nenhum cartão disponível');
        return null;
      }
      cardId = cartoes[0]._id;
    }

    const transactionData = {
      userId: DataService.getUserId(),
      section: 'credit_card',
      type: 'expense',
      amount: 250.00,
      description: 'Compra Online - Teste',
      date: new Date().toISOString(),
      category: 'Shopping',
      status: 'confirmed',
      creditCard: {
        cardId: cardId.toString()
      }
    };

    console.log('📝 Dados da transação:', transactionData);

    const response = await DataService.executeAgent('DataAgent', 'createTransaction', transactionData);

    if (response.status === 'success') {
      console.log('✅ Transação criada com sucesso!');
      formatarResultado('Transação Criada', response.data.transaction);
      return response.data.transaction;
    } else {
      console.error('❌ Falha ao criar transação');
      console.error('Resposta:', response);
      return null;
    }

  } catch (error) {
    console.error('❌ Erro ao criar transação:', error);
    return null;
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
  console.log('║   TESTE COMPLETO - CARD CARTÃO CRÉDITO   ║');
  console.log('╚═══════════════════════════════════════════╝');

  // 1. Verificar autenticação
  console.log('1️⃣ Verificando autenticação...');
  const userId = DataService.getUserId();
  if (!userId) {
    console.error('❌ Usuário não autenticado! Faça login primeiro.');
    return;
  }
  console.log(`✅ Usuário autenticado: ${userId}\n`);

  // 2. Buscar cartões existentes
  console.log('2️⃣ Buscando cartões existentes...');
  let cartoes = await buscarCartoes();
  
  let cardId = null;
  if (cartoes.length > 0) {
    cardId = cartoes[0]._id;
    console.log(`✅ Usando cartão existente: ${cardId}\n`);
  }

  // 3. Se não houver cartão, criar um
  if (!cardId) {
    console.log('3️⃣ Criando novo cartão...');
    const novoCartao = await criarCartao();
    if (novoCartao) {
      cardId = novoCartao._id;
    } else {
      console.error('⚠️  Falha ao criar cartão, mas continuando testes...\n');
    }
  } else {
    console.log('3️⃣ Saltando criação (cartão já existe)');
  }

  // 4. Buscar utilização
  if (cardId) {
    console.log('4️⃣ Buscando utilização do cartão...');
    await buscarUtilizacao(cardId);
  }

  // 5. Criar transação de teste
  if (cardId) {
    console.log('5️⃣ Criando transação de teste...');
    await criarTransacaoCartao(cardId);
    
    // Aguardar para garantir persistência
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Buscar utilização novamente para ver a diferença
    console.log('6️⃣ Buscando utilização atualizada...');
    await buscarUtilizacao(cardId);
  }

  // 7. Testar renderização
  console.log('7️⃣ Testando renderização...');
  await testarRenderizacao();

  // Resumo final
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║            RESUMO DOS TESTES             ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`✅ Cartões encontrados: ${cartoes.length}`);
  console.log(`✅ Cartão testado: ${cardId || 'N/A'}`);
  console.log('\n🎉 Testes concluídos!\n');
}

// ============================================================================
// TESTES RÁPIDOS (ATALHOS)
// ============================================================================

/**
 * Teste rápido: criar cartão e visualizar
 */
async function testeRapido() {
  console.log('🚀 TESTE RÁPIDO: Criar e Visualizar Cartão\n');
  
  const userId = DataService.getUserId();
  if (!userId) {
    console.error('❌ Usuário não autenticado!');
    return;
  }

  const cartao = await criarCartao();
  if (!cartao) {
    console.error('❌ Falha ao criar cartão');
    return;
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  await buscarUtilizacao(cartao._id);
  await testarRenderizacao();
  
  console.log('\n✅ Teste rápido concluído!');
}

/**
 * Teste: atualizar limite do cartão
 */
async function testeAtualizarLimite(novoLimite) {
  console.log('🚀 TESTE: Atualizar Limite do Cartão\n');
  
  const userId = DataService.getUserId();
  if (!userId) {
    console.error('❌ Usuário não autenticado!');
    return;
  }

  const cartoes = await buscarCartoes();
  if (cartoes.length === 0) {
    console.error('❌ Nenhum cartão encontrado');
    return;
  }

  const limite = novoLimite || 20000.00;
  await atualizarCartao(cartoes[0]._id, { creditLimit: limite });
  await new Promise(resolve => setTimeout(resolve, 1000));
  await testarRenderizacao();
  
  console.log('\n✅ Teste concluído!');
}

// ============================================================================
// INFORMAÇÕES E AJUDA
// ============================================================================

function ajuda() {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║              TESTES - CARD CARTÃO DE CRÉDITO                      ║
╚════════════════════════════════════════════════════════════════════╝

📋 FUNÇÕES DISPONÍVEIS:

  TESTES COMPLETOS:
  ─────────────────────────────────────────────────────────────────
  await testeCompleto()          → Executa todos os testes em sequência
  
  TESTES INDIVIDUAIS:
  ─────────────────────────────────────────────────────────────────
  await criarCartao()            → Cria um cartão de crédito
  await buscarCartoes()          → Lista todos os cartões
  await buscarUtilizacao(cardId) → Busca utilização/fatura
  await atualizarCartao(cardId)  → Atualiza dados do cartão
  await criarTransacaoCartao(id) → Cria transação no cartão
  await testarRenderizacao()     → Atualiza o card no dashboard
  
  TESTES RÁPIDOS:
  ─────────────────────────────────────────────────────────────────
  await testeRapido()            → Cria cartão e visualiza
  await testeAtualizarLimite(valor) → Atualiza limite do cartão
  
  AJUDA:
  ─────────────────────────────────────────────────────────────────
  ajuda()                        → Mostra esta mensagem

╔════════════════════════════════════════════════════════════════════╗
║  💡 DICA: Comece com 'await testeCompleto()' para testar tudo!   ║
╚════════════════════════════════════════════════════════════════════╝
  `);
}

// Mostrar ajuda ao carregar
console.log('📦 Teste Card Cartão de Crédito carregado!');
console.log('💡 Digite ajuda() para ver os comandos disponíveis');
