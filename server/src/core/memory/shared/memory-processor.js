/**
 * NOTE (memory-processor.js):
 * Purpose: Processa memórias em background após resposta da IA.
 * Controls: Classificação paralela entre working, episódica e long-term.
 * Behavior: Executado após resposta ao usuário, não bloqueia interação.
 * Integration notes: Chamado por serverAgent após JuniorAgent responder.
 */

const workingMemory = require('../working/working-memory');
const episodicMemory = require('../episodic/episodic-memory');
const longTermMemory = require('../longTerm/long-term-memory');
const { callOpenAIJSON } = require('../../../config/openai-config');
const { LTM_CATEGORIES } = require('./memory-types');
const patternClassifier = require('./pattern-classifier');
const narrativeEngine = require('./narrative-engine');

/**
 * Processar memórias após interação
 * @param {object} context - Contexto da interação
 * @param {string} context.sessionId - ID da sessão
 * @param {string} context.userId - ID do usuário
 * @param {string} context.chatId - ID do chat
 * @param {string} context.userMessage - Mensagem do usuário
 * @param {string} context.aiResponse - Resposta da IA
 * @param {array} context.history - Histórico do chat
 * @param {string} context.userName - Nome do usuário (para LTM personalizada)
 * @returns {Promise<object>} - Resultado do processamento
 */
async function processMemories(context) {
  const { sessionId, userId, chatId, userMessage, aiResponse, history, userName } = context;
  
  console.log('[MemoryProcessor] ═══════════════════════════════════════════════════════════════');
  console.log('[MemoryProcessor] 🚀 INÍCIO - Processamento de memórias');
  console.log('[MemoryProcessor] ═══════════════════════════════════════════════════════════════');
  console.log('[MemoryProcessor] 📊 Contexto recebido:', {
    sessionId,
    chatId,
    userId,
    userName: userName || 'não fornecido',
    userMessageLength: userMessage?.length || 0,
    aiResponseLength: aiResponse?.length || 0,
    historyLength: history?.length || 0
  });
  console.log('[MemoryProcessor] 💬 Mensagem do usuário:', userMessage);
  console.log('[MemoryProcessor] 🤖 Resposta da IA (primeiros 300 chars):', aiResponse.substring(0, 300) + '...');
  
  try {
    // Classificar interação usando PADRÕES + IA HÍBRIDA
    console.log('[MemoryProcessor] ───────────────────────────────────────────────────────────────');
    console.log('[MemoryProcessor] 🧠 ETAPA 1: Classificação (Pattern + IA Híbrida)');
    console.log('[MemoryProcessor] ───────────────────────────────────────────────────────────────');
    const classification = await patternClassifier.classifyInteraction({
      userMessage,
      aiResponse,
      history,
      userName: userName || 'o usuário'
    });
    
    console.log('[MemoryProcessor] ✅ Classificação concluída');
    console.log('[MemoryProcessor] ───────────────────────────────────────────────────────────────');
    console.log('[MemoryProcessor] 📋 RESULTADO DA CLASSIFICAÇÃO:');
    console.log('[MemoryProcessor] ───────────────────────────────────────────────────────────────');
    console.log('[MemoryProcessor] 📝 Working Memory items:', classification.working.length);
    if (classification.working.length > 0) {
      classification.working.forEach((w, i) => {
        console.log(`[MemoryProcessor]   ${i+1}. [${w.key}] = ${w.value} (${w.category || w.reason})`);
      });
    }
    console.log('[MemoryProcessor] 📖 Episodic Memory:', JSON.stringify(classification.episodic, null, 2));
    console.log('[MemoryProcessor] 💾 Long-term candidates:', classification.longTerm.length);
    if (classification.longTerm.length > 0) {
      classification.longTerm.forEach((lt, i) => {
        console.log(`[MemoryProcessor]   ${i+1}. [${lt.category}] ${lt.content.substring(0, 80)}...`);
      });
    }
    
    // Processar em paralelo (mais rápido)
    console.log('[MemoryProcessor] ───────────────────────────────────────────────────────────────');
    console.log('[MemoryProcessor] 🔄 ETAPA 2: Processamento das memórias');
    console.log('[MemoryProcessor] ───────────────────────────────────────────────────────────────');
    const promises = [];
    
    // Working Memory - sempre processa se houver dados relevantes
    if (classification.working && classification.working.length > 0) {
      console.log('[MemoryProcessor] 🔧 Adicionando Working Memory ao processamento:', classification.working.length, 'items');
      promises.push(
        processWorkingMemory(sessionId, userId, classification.working)
      );
    } else {
      console.log('[MemoryProcessor] ⏭️ Nenhum item para Working Memory');
    }
    
    // Episodic Memory - armazena contexto da conversa com eventos estruturados
    if (classification.episodic) {
      console.log('[MemoryProcessor] 📖 Adicionando Episodic Memory ao processamento');
      promises.push(
        processEpisodicMemory(chatId, userId, classification.episodic, {
          userMessage,
          aiResponse,
          history
        })
      );
    } else {
      console.log('[MemoryProcessor] ⏭️ Nenhum dado para Episodic Memory');
    }
    
    // Long-Term Memory - promove informações de alto impacto
    if (classification.longTerm && classification.longTerm.length > 0) {
      console.log('[MemoryProcessor] 💾 Adicionando Long-Term Memory ao processamento:', classification.longTerm.length, 'candidates');
      promises.push(
        processLongTermMemory(userId, chatId, classification.longTerm)
      );
    } else {
      console.log('[MemoryProcessor] ⏭️ Nenhum candidate para Long-Term Memory');
    }
    
    console.log('[MemoryProcessor] ⏳ Aguardando processamento paralelo...');
    const results = await Promise.allSettled(promises);
    
    // Log resultados
    console.log('[MemoryProcessor] ───────────────────────────────────────────────────────────────');
    console.log('[MemoryProcessor] 📊 ETAPA 3: Resultados do processamento');
    console.log('[MemoryProcessor] ───────────────────────────────────────────────────────────────');
    
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const r = result.value;
        console.log(`[MemoryProcessor] ✅ Processamento ${idx + 1}: ${r.type || 'unknown'}`);
        if (r.results) {
          r.results.forEach(item => {
            console.log(`[MemoryProcessor]    - ${item.key || item.category}: ${item.status}`);
          });
        }
      } else {
        console.error(`[MemoryProcessor] ❌ Processamento ${idx + 1} FALHOU:`, result.reason);
      }
    });
    
    const finalResult = {
      success: true,
      classification,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message })
    };

    console.log('[MemoryProcessor] ═══════════════════════════════════════════════════════════════');
    console.log('[MemoryProcessor] ✅ FIM - Processamento de memórias concluído');
    console.log('[MemoryProcessor] ═══════════════════════════════════════════════════════════════');
    
    const workingProcessed = classification.working?.length || 0;
    const longTermProcessed = classification.longTerm?.length || 0;
    
    console.log('[MemoryProcessor] 📊 RESUMO FINAL:');
    console.log(`[MemoryProcessor]   📝 Working Memory: ${workingProcessed} itens`);
    console.log(`[MemoryProcessor]   📖 Episodic Memory: ${classification.episodic ? 'processado' : 'não'}`);
    console.log(`[MemoryProcessor]   💾 Long-term Memory: ${longTermProcessed} candidatos`);
    console.log(`[MemoryProcessor]   ✅ Sucesso: ${results.filter(r => r.status === 'fulfilled').length}`);
    console.log(`[MemoryProcessor]   ❌ Falhas: ${results.filter(r => r.status === 'rejected').length}`);
    console.log('[MemoryProcessor] ═══════════════════════════════════════════════════════════════');

    return finalResult;
    
  } catch (error) {
    console.error('[MemoryProcessor] ═══════════════════════════════════════════════════════════════');
    console.error('[MemoryProcessor] ❌ ERRO CRÍTICO no processamento:', error);
    console.error('[MemoryProcessor] ═══════════════════════════════════════════════════════════════');
    throw error;
  }
}

// (AI-based classification removed - deprecated implementation deleted)

/**
 * Processar Working Memory com filtro anti-duplicação
 * Filtra valores que já existem na LTM para evitar redundância
 */
async function processWorkingMemory(sessionId, userId, workingData) {
  console.log('[Working] ═══════════════════════════════════════════════════════════════');
  console.log('[Working] 🚀 INÍCIO - Processando Working Memory');
  console.log('[Working] ═══════════════════════════════════════════════════════════════');
  console.log('[Working] 📊 SessionId:', sessionId);
  console.log('[Working] 👤 UserId:', userId);
  console.log('[Working] 📦 Total de itens a processar:', workingData.length);
  if (workingData.length > 0) {
    console.log('[Working] 📋 Itens recebidos:');
    workingData.forEach((item, i) => {
      console.log(`[Working]   ${i+1}. [${item.key}] = ${item.value} (${item.category || item.reason})`);
    });
  }
  
  // Carregar LTM do usuário para verificar duplicações
  console.log('[Working] ───────────────────────────────────────────────────────────────');
  console.log('[Working] 🔍 Verificando duplicatas na LTM...');
  let ltmValues = [];
  try {
    // CORREÇÃO: caminho correto do schema (shared → memory → core → src → database)
    const LongTermMemoryModel = require('../../../database/schemas/long-term-memory-schema');
    const ltm = await LongTermMemoryModel.findOne({ userId });
    
    if (ltm && ltm.memoryItems) {
      console.log('[Working] 📂 LTM encontrada com', ltm.memoryItems.length, 'items');
      
      // Extrair todos os valores monetários da LTM
      ltmValues = ltm.memoryItems
        .map(item => item.content)
        .join(' ')
        .match(/R\$?\s*\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi) || [];
      
      // Normalizar valores para comparação (remover espaços, R$, etc)
      ltmValues = ltmValues.map(v => 
        v.replace(/[R$\s]/gi, '').trim()
      );
      
      console.log('[Working] 💰 Valores monetários encontrados na LTM:', ltmValues.length);
      if (ltmValues.length > 0) {
        console.log('[Working] 📋 Exemplos de valores na LTM:', ltmValues.slice(0, 5));
      }
    } else {
      console.log('[Working] 📭 LTM vazia ou não encontrada para este usuário');
    }
  } catch (error) {
    console.warn('[Working] ⚠️ Erro ao carregar LTM para verificação:', error.message);
    // Continua sem filtro se houver erro
  }
  
  console.log('[Working] ───────────────────────────────────────────────────────────────');
  console.log('[Working] 💾 Salvando itens no Working Memory...');
  
  const results = [];
  for (const item of workingData) {
    try {
      console.log(`[Working] 🔄 Processando: [${item.key}] = ${item.value}`);
      
      // Normalizar valor do item para comparação
      const normalizedValue = item.value
        .replace(/[R$\s]/gi, '')
        .trim();
      
      console.log(`[Working]   📐 Valor normalizado: "${normalizedValue}"`);
      
      // Verificar se valor já existe na LTM
      const isDuplicate = ltmValues.some(ltmValue => {
        // Comparação flexível: aceita pequenas diferenças de formatação
        return ltmValue === normalizedValue || 
               ltmValue.replace(/[.,]/g, '') === normalizedValue.replace(/[.,]/g, '');
      });
      
      if (isDuplicate) {
        console.log(`[Working]   ⏭️ IGNORADO - Valor já existe na LTM: ${item.value}`);
        results.push({ 
          key: item.key, 
          status: 'skipped', 
          reason: 'Valor já existe na Long-Term Memory' 
        });
        continue;
      }
      
      console.log(`[Working]   💾 Salvando no banco: key=${item.key}, value=${item.value}`);
      await workingMemory.set(sessionId, item.key, item.value, false, userId);
      console.log(`[Working]   ✅ SALVO COM SUCESSO: [${item.key}]`);
      results.push({ key: item.key, status: 'stored' });
    } catch (error) {
      console.error(`[Working]   ❌ ERRO ao armazenar [${item.key}]:`, error.message);
      results.push({ key: item.key, status: 'error', error: error.message });
    }
  }
  
  console.log('[Working] ═══════════════════════════════════════════════════════════════');
  console.log('[Working] ✅ FIM - Working Memory processada');
  console.log('[Working] 📊 Resumo:');
  const stored = results.filter(r => r.status === 'stored').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const errors = results.filter(r => r.status === 'error').length;
  console.log(`[Working]   ✅ Salvos: ${stored}`);
  console.log(`[Working]   ⏭️ Ignorados (duplicatas): ${skipped}`);
  console.log(`[Working]   ❌ Erros: ${errors}`);
  console.log('[Working] ═══════════════════════════════════════════════════════════════');
  
  return { type: 'working', results };
}

/**
 * Processar Episodic Memory com eventos estruturados e resumo narrativo
 */
async function processEpisodicMemory(chatId, userId, episodicData, rawInteraction) {
  console.log('[Episodic] ═══════════════════════════════════════════════════════════════');
  console.log('[Episodic] 🚀 INÍCIO - Processando Episodic Memory');
  console.log('[Episodic] ═══════════════════════════════════════════════════════════════');
  console.log('[Episodic] 📊 Chat ID:', chatId);
  console.log('[Episodic] 👤 User ID:', userId);
  console.log('[Episodic] 📋 Dados episódicos recebidos:', JSON.stringify(episodicData, null, 2));
  
  try {
    // Verifica se chat já tem memória
    console.log('[Episodic] 🔍 Verificando se chat já possui memória...');
    const existing = await episodicMemory.get(chatId);
    
    // Extrai evento estruturado da interação atual
    console.log('[Episodic] 🎯 Extraindo evento estruturado...');
    const event = narrativeEngine.extractEvent(
      rawInteraction.userMessage,
      rawInteraction.aiResponse,
      { category: episodicData.categoria_principal || 'geral' }
    );
    
    console.log('[Episodic] 📝 Evento extraído:', JSON.stringify(event, null, 2));
    
    let narrative = '';
    let events = [event];
    
    if (existing) {
      console.log('[Episodic] ───────────────────────────────────────────────────────────────');
      console.log('[Episodic] ✏️ Chat possui memória existente, ATUALIZANDO...');
      
      // Recupera eventos anteriores (se estiverem armazenados)
      if (existing.episodicMemory.events) {
        events = [...existing.episodicMemory.events, event];
        console.log('[Episodic] 📚 Eventos anteriores:', existing.episodicMemory.events.length);
      }
      
      // Reconstrói narrativa completa com limite de 750 palavras
      narrative = narrativeEngine.eventsToNarrative(events, 750);
      
      console.log('[Episodic] 📝 Narrativa atualizada:', {
        total_events: events.length,
        palavras: narrative.split(' ').length
      });
      
      // Atualiza memória com evento + narrativa compacta
      const updatedData = {
        ...episodicData,
        narrative_summary: narrative,
        events: events.slice(-20), // mantém últimos 20 eventos estruturados
        last_interaction: new Date().toISOString()
      };
      
      await episodicMemory.update(chatId, updatedData, {
        merge: true,
        autoCompress: true
      });
      
      console.log('[Episodic] ✅ Memória ATUALIZADA com sucesso');
      console.log('[Episodic] ═══════════════════════════════════════════════════════════════');
      return { type: 'episodic', status: 'updated', chatId, events_count: events.length };
      
    } else {
      console.log('[Episodic] ───────────────────────────────────────────────────────────────');
      console.log('[Episodic] 🆕 Chat sem memória, CRIANDO NOVA...');
      
      // Cria narrativa inicial
      narrative = narrativeEngine.eventsToNarrative([event], 750);
      
      // Cria nova memória com evento + narrativa
      const initialData = {
        ...episodicData,
        narrative_summary: narrative,
        events: [event],
        created_at: new Date().toISOString(),
        last_interaction: new Date().toISOString()
      };
      
      await episodicMemory.create(chatId, userId, initialData);
      
      console.log('[Episodic] ✅ Nova memória CRIADA com sucesso');
      console.log('[Episodic] ═══════════════════════════════════════════════════════════════');
      return { type: 'episodic', status: 'created', chatId, events_count: 1 };
    }
    
  } catch (error) {
    console.error('[Episodic] ❌ Erro no processamento:', error.message);
    console.log('[Episodic] ═══════════════════════════════════════════════════════════════');
    return { type: 'episodic', status: 'error', error: error.message };
  }
}

/**
 * Processar Long-Term Memory
 */
async function processLongTermMemory(userId, chatId, longTermData) {
  console.log('[LongTerm] ═══════════════════════════════════════════════════════════════');
  console.log('[LongTerm] 🚀 INÍCIO - Processando Long-Term Memory');
  console.log('[LongTerm] ═══════════════════════════════════════════════════════════════');
  console.log('[LongTerm] 👤 User ID:', userId);
  console.log('[LongTerm] 💬 Chat ID:', chatId);
  console.log('[LongTerm] 📦 Total de candidatos:', longTermData.length);
  if (longTermData.length > 0) {
    console.log('[LongTerm] 📋 Candidatos recebidos:');
    longTermData.forEach((item, i) => {
      console.log(`[LongTerm]   ${i+1}. [${item.category}] ${item.content.substring(0, 80)}...`);
      console.log(`[LongTerm]      Score: ${item.score || 'N/A'} | Razão: ${item.reason}`);
    });
  }
  
  console.log('[LongTerm] ───────────────────────────────────────────────────────────────');
  console.log('[LongTerm] 🔄 Propondo candidatos para curadoria...');
  
  const results = [];
  for (const item of longTermData) {
    console.log('[LongTerm] ───────────────────────────────────────────────────────────────');
    console.log(`[LongTerm] 🎯 Propondo: [${item.category}]`);
    console.log(`[LongTerm]    Conteúdo: ${item.content.substring(0, 100)}...`);
    
    try {
      const stored = await longTermMemory.propose(
        userId,
        item.content,
        item.category,
        [chatId]
      );
      
      if (stored) {
        console.log(`[LongTerm]    ✅ ACEITA - Impact Score: ${stored.impactScore}`);
        results.push({ 
          category: item.category, 
          status: 'accepted',
          impactScore: stored.impactScore 
        });
      } else {
        console.log('[LongTerm]    ❌ REJEITADA - Não passou na curadoria');
        results.push({ 
          category: item.category, 
          status: 'rejected',
          reason: 'Não passou na curadoria'
        });
      }
      
    } catch (error) {
      console.error(`[LongTerm]    ❌ ERRO: ${error.message}`);
      results.push({ 
        category: item.category, 
        status: 'error', 
        error: error.message 
      });
    }
  }
  
  console.log('[LongTerm] ═══════════════════════════════════════════════════════════════');
  console.log('[LongTerm] ✅ FIM - Long-Term Memory processada');
  console.log('[LongTerm] 📊 Resumo:');
  const accepted = results.filter(r => r.status === 'accepted').length;
  const rejected = results.filter(r => r.status === 'rejected').length;
  const errors = results.filter(r => r.status === 'error').length;
  console.log(`[LongTerm]   ✅ Aceitas: ${accepted}`);
  console.log(`[LongTerm]   ❌ Rejeitadas: ${rejected}`);
  console.log(`[LongTerm]   ⚠️ Erros: ${errors}`);
  console.log('[LongTerm] ═══════════════════════════════════════════════════════════════');
  
  return { type: 'longTerm', results };
}

module.exports = {
  processMemories,
  classifyInteraction: patternClassifier.classifyInteraction
};