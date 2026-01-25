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
  
  console.log('[MemoryProcessor] 🚀 INÍCIO - Processamento de memórias iniciado', {
    sessionId,
    chatId,
    userId,
    userName: userName || 'não fornecido',
    userMessageLength: userMessage?.length || 0,
    aiResponseLength: aiResponse?.length || 0,
    historyLength: history?.length || 0
  });
  
  try {
    // Classificar interação
    const classification = await classifyInteraction({
      userMessage,
      aiResponse,
      history,
      userName: userName || 'o usuário'
    });
    
    console.log('[MemoryProcessor] Classificação:', classification);
    
    // Processar em paralelo (mais rápido)
    const promises = [];
    
    // Working Memory - sempre processa se houver dados relevantes
    if (classification.working && classification.working.length > 0) {
      promises.push(
        processWorkingMemory(sessionId, userId, classification.working)
      );
    }
    
    // Episodic Memory - armazena contexto da conversa
    if (classification.episodic) {
      promises.push(
        processEpisodicMemory(chatId, userId, classification.episodic)
      );
    }
    
    // Long-Term Memory - promove informações de alto impacto
    if (classification.longTerm && classification.longTerm.length > 0) {
      promises.push(
        processLongTermMemory(userId, chatId, classification.longTerm)
      );
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

    console.log('[MemoryProcessor] ✅ FIM - Processamento concluído', {
      success: true,
      workingItemsProcessed: classification.working?.length || 0,
      episodicProcessed: classification.episodic ? 'sim' : 'não',
      longTermCandidates: classification.longTerm?.length || 0,
      resultsCount: results.length,
      successfulResults: results.filter(r => r.status === 'fulfilled').length,
      failedResults: results.filter(r => r.status === 'rejected').length
    });

    return finalResult;
    
  } catch (error) {
    console.error('[MemoryProcessor] ❌ Erro no processamento:', error);
    throw error;
  }
}

/**
 * Classificar interação usando IA
 * @param {object} interaction - Dados da interação
 * @param {string} interaction.userName - Nome do usuário
 * @returns {Promise<object>} - Classificação { working: [], episodic: {}, longTerm: [] }
 */
async function classifyInteraction({ userMessage, aiResponse, history, userName = 'o usuário' }) {
  const systemPrompt = `Você é um classificador de memórias para sistema financeiro.
Analise a interação usuário-IA e classifique informações para armazenamento.

TIPOS DE MEMÓRIA:

1. WORKING MEMORY (temporária, sessão atual):
   - Cálculos intermediários
   - Parâmetros de ação atual
   - Contexto imediato de raciocínio
   - Dados que só importam AGORA

2. EPISODIC MEMORY (contexto do chat):
   - Preferências mencionadas na conversa
   - Decisões tomadas neste chat
   - Contexto específico desta interação
   - Informações que podem ser úteis nas próximas mensagens DESTE chat

3. LONG-TERM MEMORY (perfil permanente):
   - Informações duradouras sobre o usuário
   - Padrões comportamentais identificados
   - Decisões estratégicas importantes
   - Dados que devem ser lembrados SEMPRE
   - SEMPRE use o nome do usuário (${userName}) ao formular memórias long-term

CATEGORIAS LONG-TERM (use exatamente estes nomes):
${Object.values(LTM_CATEGORIES).map(cat => `- ${cat}`).join('\n')}

REGRAS:
- Mesma informação pode ir para múltiplas memórias
- Working: apenas se cálculo/raciocínio precisa ser continuado
- Episodic: sempre que houver contexto relevante para o chat
- Long-term: apenas informações de ALTO IMPACTO e duradouras
- Long-term: SEMPRE use "${userName}" ao invés de "o usuário"`;

  const userPrompt = `Classifique esta interação:

MENSAGEM DO USUÁRIO:
${userMessage}

RESPOSTA DA IA:
${aiResponse}

HISTÓRICO (últimas 3 mensagens):
${JSON.stringify(history?.slice(-3) || [], null, 2)}

Retorne JSON:
{
  "working": [
    { "key": "nome_variavel", "value": "valor", "reason": "por que é working" }
  ],
  "episodic": {
    "contexto_conversa": "resumo do que aconteceu",
    "preferencias_mencionadas": "preferências citadas",
    "decisoes_tomadas": "decisões do usuário"
  },
  "longTerm": [
    {
      "content": "informação usando o nome ${userName}",
      "category": "uma das categorias válidas",
      "reason": "por que é long-term"
    }
  ]
}

Se não houver dados para algum tipo, retorne array/objeto vazio.`;

  try {
    const result = await callOpenAIJSON(systemPrompt, userPrompt, {
      max_tokens: 1000,
      temperature: 0.3
    });
    
    return {
      working: result.working || [],
      episodic: result.episodic || {},
      longTerm: result.longTerm || []
    };
    
  } catch (error) {
    console.error('[MemoryProcessor] Erro na classificação:', error);
    // Fallback: classificação vazia
    return { working: [], episodic: {}, longTerm: [] };
  }
}

/**
 * Processar Working Memory
 */
async function processWorkingMemory(sessionId, userId, workingData) {
  console.log(`[Working] Processando ${workingData.length} itens`);
  
  const results = [];
  for (const item of workingData) {
    try {
      await workingMemory.set(sessionId, item.key, item.value, false, userId);
      results.push({ key: item.key, status: 'stored' });
    } catch (error) {
      console.error(`[Working] Erro ao armazenar ${item.key}:`, error.message);
      results.push({ key: item.key, status: 'error', error: error.message });
    }
  }
  
  return { type: 'working', results };
}

/**
 * Processar Episodic Memory
 */
async function processEpisodicMemory(chatId, userId, episodicData) {
  console.log(`[Episodic] Processando para chat ${chatId}`);
  
  try {
    // Verifica se chat já tem memória
    const existing = await episodicMemory.get(chatId);
    
    if (existing) {
      // Atualiza memória existente
      await episodicMemory.update(chatId, episodicData, {
        merge: true,
        autoCompress: true
      });
      return { type: 'episodic', status: 'updated', chatId };
    } else {
      // Cria nova memória para o chat
      await episodicMemory.create(chatId, userId, episodicData);
      return { type: 'episodic', status: 'created', chatId };
    }
    
  } catch (error) {
    console.error('[Episodic] Erro no processamento:', error.message);
    return { type: 'episodic', status: 'error', error: error.message };
  }
}

/**
 * Processar Long-Term Memory
 */
async function processLongTermMemory(userId, chatId, longTermData) {
  console.log(`[LongTerm] Processando ${longTermData.length} candidatos`);
  
  const results = [];
  for (const item of longTermData) {
    try {
      const stored = await longTermMemory.propose(
        userId,
        item.content,
        item.category,
        [chatId]
      );
      
      if (stored) {
        results.push({ 
          category: item.category, 
          status: 'accepted',
          impactScore: stored.impactScore 
        });
      } else {
        results.push({ 
          category: item.category, 
          status: 'rejected',
          reason: 'Não passou na curadoria'
        });
      }
      
    } catch (error) {
      console.error(`[LongTerm] Erro ao propor memória:`, error.message);
      results.push({ 
        category: item.category, 
        status: 'error', 
        error: error.message 
      });
    }
  }
  
  return { type: 'longTerm', results };
}

module.exports = {
  processMemories,
  classifyInteraction
};