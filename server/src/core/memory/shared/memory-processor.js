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
  
  console.log('[MemoryProcessor] 🚀 INÍCIO - Processamento de memórias iniciado');
  console.log('[MemoryProcessor] 📊 Contexto:', {
    sessionId,
    chatId,
    userId,
    userName: userName || 'não fornecido',
    userMessageLength: userMessage?.length || 0,
    aiResponseLength: aiResponse?.length || 0,
    historyLength: history?.length || 0
  });
  console.log('[MemoryProcessor] 💬 Mensagem do usuário:', userMessage);
  console.log('[MemoryProcessor] 🤖 Resposta da IA:', aiResponse.substring(0, 200) + '...');
  
  try {
    // Classificar interação usando PADRÕES INTELIGENTES (sem IA, economiza ~1800 tokens)
    console.log('[MemoryProcessor] 🧠 Usando pattern matching (sem IA)...');
    const classification = patternClassifier.classifyInteraction({
      userMessage,
      aiResponse,
      history,
      userName: userName || 'o usuário'
    });
    
    console.log('[MemoryProcessor] ✅ Classificação (via patterns) concluída');
    console.log('[MemoryProcessor] 📝 Working items:', classification.working.length);
    console.log('[MemoryProcessor] 📖 Episodic:', JSON.stringify(classification.episodic, null, 2));
    console.log('[MemoryProcessor] 💾 Long-term candidates:', classification.longTerm.length);
    console.log('[MemoryProcessor] 🔍 DETALHES DA CLASSIFICAÇÃO:', {
      working: classification.working,
      episodic: classification.episodic,
      longTerm: classification.longTerm
    });
    
    if (classification.working.length > 0) {
      console.log('[MemoryProcessor] 🔍 Working Memory detalhes:', classification.working);
    }
    if (classification.longTerm.length > 0) {
      console.log('[MemoryProcessor] 🔍 Long-term candidates detalhes:', classification.longTerm);
    }
    
    // Processar em paralelo (mais rápido)
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
    
    const results = await Promise.allSettled(promises);
    
    // Log resultados
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        console.log(`[MemoryProcessor] Processamento ${idx + 1} concluído:`, result.value);
      } else {
        console.error(`[MemoryProcessor] Processamento ${idx + 1} falhou:`, result.reason);
      }
    });
    
    const finalResult = {
      success: true,
      classification,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message })
    };

    console.log('[MemoryProcessor] ✅ FIM - Processamento concluído');
    console.log('[MemoryProcessor] 📊 Estatísticas:', {
      success: true,
      workingItemsProcessed: classification.working?.length || 0,
      episodicProcessed: classification.episodic ? 'sim' : 'não',
      longTermCandidates: classification.longTerm?.length || 0,
      resultsCount: results.length,
      successfulResults: results.filter(r => r.status === 'fulfilled').length,
      failedResults: results.filter(r => r.status === 'rejected').length
    });
    console.log('[MemoryProcessor] 📋 Resultado detalhado:', JSON.stringify(finalResult, null, 2));

    return finalResult;
    
  } catch (error) {
    console.error('[MemoryProcessor] ❌ Erro no processamento:', error);
    throw error;
  }
}

// (AI-based classification removed - deprecated implementation deleted)

/**
 * Processar Working Memory
 */
async function processWorkingMemory(sessionId, userId, workingData) {
  console.log('[Working] 🚀 INÍCIO - Processando Working Memory');
  console.log('[Working] 📊 Total de itens:', workingData.length);
  console.log('[Working] 📦 Dados:', workingData);
  
  const results = [];
  for (const item of workingData) {
    try {
      console.log('[Working] 💾 Salvando item:', { key: item.key, value: item.value, reason: item.reason });
      await workingMemory.set(sessionId, item.key, item.value, false, userId);
      console.log('[Working] ✅ Item salvo com sucesso:', item.key);
      results.push({ key: item.key, status: 'stored' });
    } catch (error) {
      console.error('[Working] ❌ Erro ao armazenar:', item.key, error.message);
      results.push({ key: item.key, status: 'error', error: error.message });
    }
  }
  
  console.log('[Working] ✅ FIM - Working Memory processada');
  console.log('[Working] 📊 Resultados:', results);
  return { type: 'working', results };
}

/**
 * Processar Episodic Memory com eventos estruturados e resumo narrativo
 */
async function processEpisodicMemory(chatId, userId, episodicData, rawInteraction) {
  console.log('[Episodic] 🚀 INÍCIO - Processando Episodic Memory');
  console.log('[Episodic] 📊 Chat ID:', chatId);
  
  try {
    // Verifica se chat já tem memória
    console.log('[Episodic] 🔍 Verificando se chat já possui memória...');
    const existing = await episodicMemory.get(chatId);
    
    // Extrai evento estruturado da interação atual
    const event = narrativeEngine.extractEvent(
      rawInteraction.userMessage,
      rawInteraction.aiResponse,
      { category: episodicData.categoria_principal || 'geral' }
    );
    
    console.log('[Episodic] 🎯 Evento extraído:', event);
    
    let narrative = '';
    let events = [event];
    
    if (existing) {
      console.log('[Episodic] ✏️ Chat possui memória existente, atualizando...');
      
      // Recupera eventos anteriores (se estiverem armazenados)
      if (existing.episodicMemory.events) {
        events = [...existing.episodicMemory.events, event];
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
      
      console.log('[Episodic] ✅ Memória atualizada com sucesso');
      return { type: 'episodic', status: 'updated', chatId, events_count: events.length };
      
    } else {
      console.log('[Episodic] 🆕 Chat sem memória, criando nova...');
      
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
      
      console.log('[Episodic] ✅ Nova memória criada com sucesso');
      return { type: 'episodic', status: 'created', chatId, events_count: 1 };
    }
    
  } catch (error) {
    console.error('[Episodic] ❌ Erro no processamento:', error.message);
    return { type: 'episodic', status: 'error', error: error.message };
  }
}

/**
 * Processar Long-Term Memory
 */
async function processLongTermMemory(userId, chatId, longTermData) {
  console.log('[LongTerm] 🚀 INÍCIO - Processando Long-Term Memory');
  console.log('[LongTerm] 📊 Total de candidatos:', longTermData.length);
  console.log('[LongTerm] 📦 Candidatos:', longTermData);
  
  const results = [];
  for (const item of longTermData) {
    console.log('[LongTerm] 🎯 Propondo memória:', {
      category: item.category,
      content: item.content.substring(0, 100) + '...',
      reason: item.reason
    });
    
    try {
      const stored = await longTermMemory.propose(
        userId,
        item.content,
        item.category,
        [chatId]
      );
      
      if (stored) {
        console.log('[LongTerm] ✅ Memória ACEITA e armazenada');
        console.log('[LongTerm] 📊 Impact Score:', stored.impactScore);
        results.push({ 
          category: item.category, 
          status: 'accepted',
          impactScore: stored.impactScore 
        });
      } else {
        console.log('[LongTerm] ❌ Memória REJEITADA pela curadoria');
        results.push({ 
          category: item.category, 
          status: 'rejected',
          reason: 'Não passou na curadoria'
        });
      }
      
    } catch (error) {
      console.error('[LongTerm] ❌ Erro ao propor memória:', error.message);
      results.push({ 
        category: item.category, 
        status: 'error', 
        error: error.message 
      });
    }
  }
  
  console.log('[LongTerm] ✅ FIM - Long-Term Memory processada');
  console.log('[LongTerm] 📊 Resultados:', results);
  return { type: 'longTerm', results };
}

module.exports = {
  processMemories,
  classifyInteraction: patternClassifier.classifyInteraction
};