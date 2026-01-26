/**
 * NOTE (memory-integration.js):
 * Purpose: Central integration point for all memory operations with agents.
 * Controls: Provides high-level API for building context, processing memories, and retrieving data.
 * Behavior: Simplifies memory management for agents by providing unified interface.
 * Integration notes: Used by JuniorAgent and future agents to interact with memory system.
 */

const workingMemory = require('./working/working-memory');
const episodicMemory = require('./episodic/episodic-memory');
const longTermMemory = require('./longTerm/long-term-memory');
const contextBuilder = require('./working/context-builder');
const sessionStore = require('./working/session-store');
const memoryProcessor = require('./shared/memory-processor');
const User = require('../../models/User');

/**
 * Initialize session for a user
 * @param {string} sessionId - Session identifier
 * @param {string} userId - User ID
 * @param {object} metadata - Optional session metadata
 * @returns {object} - Session object
 */
function initializeSession(sessionId, userId, metadata = {}) {
  return sessionStore.createSession(sessionId, userId, metadata);
}

/**
 * Build comprehensive context for an agent including all memory types
 * @param {string} sessionId - Session identifier
 * @param {string} chatId - Chat identifier
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Complete context with working, episodic, and relevant LTM
 */
async function buildAgentContext(sessionId, chatId, userId) {
  try {
    console.log('[MemoryIntegration] 🚀 INÍCIO - Construindo contexto do agente');
    console.log('[MemoryIntegration] 📋 Parâmetros:', { sessionId, chatId, userId });
    
    // Build working memory context
    const workingContext = await contextBuilder.buildContext(sessionId, {
      includeMetadata: true
    });
    
    console.log('[MemoryIntegration] 📦 Working context loaded:', {
      hasMemory: !!workingContext.memory,
      memoryKeys: Object.keys(workingContext.memory || {}),
      memoryValues: workingContext.memory
    });

    // Get episodic memory for the chat
    let episodicContext = null;
    try {
      const episodicData = await episodicMemory.get(chatId);
      episodicContext = episodicData ? episodicData.episodicMemory : null;
    } catch (error) {
      console.warn('[MemoryIntegration] Error loading episodic memory:', error.message);
    }

    // Get relevant long-term memories with category-based filtering (RAG Refinado)
    let ltmContext = [];
    let categoryDescriptions = {};
    let relevanceFilter = { categories: [], scores: [] }; // Log de filtragem
    
    try {
      const LongTermMemoryModel = require('../../database/schemas/long-term-memory-schema');
      const ltm = await LongTermMemoryModel.findOne({ userId });
      
      if (ltm) {
        // Detect relevant categories from current interaction context
        const categoryDetector = require('./shared/category-detector');
        const episodicText = episodicContext ? 
          `${episodicContext.contexto_conversa || ''} ${episodicContext.narrative_summary || ''}`.slice(0, 500) : '';
        
        const detectedCategories = categoryDetector.detectCategories(episodicText, {});
        const relevantCategories = detectedCategories
          .filter(c => c.score >= 20) // Minimum relevance threshold
          .map(c => c.category)
          .slice(0, 3); // Top 3 categories
        
        relevanceFilter.categories = relevantCategories;
        relevanceFilter.scores = detectedCategories.filter(c => c.score >= 20).map(c => c.score);
        
        console.log('[MemoryIntegration] 🎯 Categorias relevantes detectadas:', relevantCategories.join(', '), '(scores:', relevanceFilter.scores.join(', ') + ')');
        
        // Retrieve memories with category filtering (if categories detected)
        if (relevantCategories.length > 0) {
          // Filter by relevant categories + impact score
          let filteredMemories = ltm.memoryItems
            .filter(item => relevantCategories.includes(item.category))
            .filter(item => item.impactScore >= 0.5)
            .sort((a, b) => b.impactScore - a.impactScore)
            .slice(0, 5);
          
          ltmContext = filteredMemories.map(item => ({
            content: item.content,
            category: item.category,
            impactScore: item.impactScore,
            createdAt: item.createdAt,
            eventDate: item.eventDate
          }));
          
          console.log('[MemoryIntegration] 📦 Filtro categórico: mantidas', ltmContext.length, 'de', ltm.memoryItems.length, 'memórias');
        } else {
          // Fallback: top memories by impact
          const ltmData = await longTermMemory.retrieve(userId, '', {
            limit: 5,
            useVectorSearch: false
          });
          ltmContext = ltmData.map(item => ({
            content: item.content,
            category: item.category,
            impactScore: item.impactScore,
            createdAt: item.createdAt,
            eventDate: item.eventDate
          }));
          
          console.log('[MemoryIntegration] 📦 Sem filtro categórico: usando top', ltmContext.length, 'por impacto');
        }
        
        // Extract category descriptions (only non-empty ones)
        categoryDescriptions = {};
        for (const [category, data] of Object.entries(ltm.categoryDescriptions)) {
          if (data && data.description && data.description.trim()) {
            categoryDescriptions[category] = data.description;
          }
        }
      }
    } catch (error) {
      console.warn('[MemoryIntegration] Error loading long-term memory:', error.message);
    }

    const finalContext = {
      sessionId,
      chatId,
      userId,
      workingMemory: workingContext.memory || {},
      episodicMemory: episodicContext,
      longTermMemory: ltmContext,
      categoryDescriptions,  // NEW: Include category descriptions
      sessionMetadata: workingContext.sessionMetadata
    };

    console.log('[MemoryIntegration] 🎯 Contexto COMPLETO construído', {
      sessionId,
      chatId,
      userId,
      workingKeys: Object.keys(workingContext.memory || {}),
      workingMemoryValues: workingContext.memory,
      hasEpisodic: !!episodicContext,
      episodicWordCount: episodicContext?.wordCount || 0,
      episodicInteractions: episodicContext?.interactions?.length || 0,
      ltmCount: ltmContext.length,
      ltmCategories: ltmContext.map(m => m.category),
      categoryDescriptionsCount: Object.keys(categoryDescriptions).length
    });

    return finalContext;
  } catch (error) {
    console.error('[MemoryIntegration] ❌ Error building context:', error);
    return {
      sessionId,
      chatId,
      userId,
      workingMemory: {},
      episodicMemory: null,
      longTermMemory: [],
      error: error.message
    };
  }
}

/**
 * Process and store memories after an interaction
 * @param {object} interaction - Interaction data
 * @param {string} interaction.sessionId - Session ID
 * @param {string} interaction.chatId - Chat ID
 * @param {string} interaction.userId - User ID
 * @param {string} interaction.userMessage - User's message
 * @param {string} interaction.aiResponse - AI's response
 * @param {array} interaction.history - Chat history
 * @returns {Promise<object>} - Processing result
 */
async function processInteractionMemories(interaction) {
  const { sessionId, chatId, userId, userMessage, aiResponse, history } = interaction;

  console.log('[MemoryIntegration] 🎯 INÍCIO - Processamento de memórias da interação');
  console.log('[MemoryIntegration] 📊 Dados da interação:', {
    sessionId,
    chatId,
    userId,
    userMessageLength: userMessage?.length || 0,
    aiResponseLength: aiResponse?.length || 0,
    historyLength: history?.length || 0
  });

  try {
    // Get user name for personalized LTM
    let userName = 'o usuário';
    console.log('[MemoryIntegration] 👤 Buscando nome do usuário...');
    try {
      const user = await User.findById(userId);
      if (user && user.username) {
        userName = user.username;
        console.log('[MemoryIntegration] ✅ Nome do usuário encontrado:', userName);
      } else {
        console.log('[MemoryIntegration] ⚠️ Usuário sem nome, usando padrão');
      }
    } catch (error) {
      console.warn('[MemoryIntegration] ❌ Erro ao buscar nome do usuário:', error.message);
    }

    // Process memories in background (non-blocking)
    console.log('[MemoryIntegration] 🔄 Iniciando processamento em background...');
    console.log('[MemoryIntegration] 📦 Contexto enviado para processor:', {
      sessionId,
      userId,
      chatId,
      userName,
      temUserMessage: !!userMessage,
      temAiResponse: !!aiResponse,
      temHistory: !!history
    });
    
    const processingPromise = memoryProcessor.processMemories({
      sessionId,
      userId,
      chatId,
      userMessage,
      aiResponse,
      history,
      userName
    });

    // Don't await - let it process in background
    processingPromise.then(result => {
      console.log('[MemoryIntegration] Memory processing completed:', {
        sessionId,
        chatId,
        accepted: {
          working: result.results?.[0]?.results?.length || 0,
          episodic: result.results?.[1]?.status || 'none',
          longTerm: result.results?.[2]?.results?.filter(r => r.status === 'accepted').length || 0
        }
      });
    }).catch(error => {
      console.error('[MemoryIntegration] Memory processing failed:', error);
    });

    return { status: 'processing', message: 'Memories are being processed in background' };
  } catch (error) {
    console.error('[MemoryIntegration] Error initiating memory processing:', error);
    return { status: 'error', error: error.message };
  }
}

/**
 * Get or create episodic memory for a chat
 * @param {string} chatId - Chat identifier
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Episodic memory
 */
async function getOrCreateEpisodicMemory(chatId, userId) {
  try {
    let memory = await episodicMemory.get(chatId);
    
    if (!memory) {
      memory = await episodicMemory.create(chatId, userId, {
        chat_started: new Date().toISOString(),
        context: 'Nova conversa iniciada'
      });
    }
    
    return memory;
  } catch (error) {
    console.error('[MemoryIntegration] Error with episodic memory:', error);
    throw error;
  }
}

/**
 * Update working memory with new data
 * @param {string} sessionId - Session ID
 * @param {object} updates - Key-value pairs to update
 * @returns {Promise<void>}
 */
async function updateWorkingMemory(sessionId, updates) {
  return contextBuilder.updateContext(sessionId, updates);
}

/**
 * End session and cleanup
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
async function endSession(sessionId) {
  return sessionStore.endSession(sessionId);
}

/**
 * Format context for AI prompt with temporal inference and truth hierarchy
 * @param {object} context - Context from buildAgentContext
 * @returns {string} - Formatted context string for prompt
 */
function formatContextForPrompt(context) {
  let formatted = '';

  // Working Memory (prioridade MÁXIMA - dados imediatos)
  if (context.workingMemory && Object.keys(context.workingMemory).length > 0) {
    formatted += '### Sessão (Dados Imediatos):\n';
    for (const [key, value] of Object.entries(context.workingMemory)) {
      formatted += `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
    }
    formatted += '\n';
  }

  // Episodic Memory - PRIORIDADE ALTA (conversa atual)
  if (context.episodicMemory) {
    formatted += '### Resumo da Conversa:\n';
    
    // Prioriza narrative_summary se disponível (mais compacto!)
    if (context.episodicMemory.narrative_summary) {
      formatted += context.episodicMemory.narrative_summary + '\n';
    } else {
      // Fallback: formato antigo (apenas campos não vazios)
      if (context.episodicMemory.contexto_conversa && 
          context.episodicMemory.contexto_conversa !== 'Nenhum contexto disponível') {
        formatted += context.episodicMemory.contexto_conversa + '\n';
      }
      if (context.episodicMemory.preferencias_mencionadas && 
          context.episodicMemory.preferencias_mencionadas !== 'Nenhuma preferência explícita') {
        formatted += `Preferências: ${context.episodicMemory.preferencias_mencionadas}\n`;
      }
      if (context.episodicMemory.decisoes_tomadas && 
          context.episodicMemory.decisoes_tomadas !== 'Nenhuma decisão explícita') {
        formatted += `Decisões: ${context.episodicMemory.decisoes_tomadas}\n`;
      }
    }
    formatted += '\n';
  }

  // Category Descriptions (compacto - máximo 2 categorias mais relevantes)
  if (context.categoryDescriptions && Object.keys(context.categoryDescriptions).length > 0) {
    formatted += '### Perfil:\n';
    const entries = Object.entries(context.categoryDescriptions).slice(0, 2);
    for (const [category, description] of entries) {
      const label = category.replace(/_/g, ' ');
      formatted += `${label}: ${description}\n`;
    }
    formatted += '\n';
  }

  // Long-Term Memory with Temporal Inference (prioridade MÉDIA - histórico)
  if (context.longTermMemory && context.longTermMemory.length > 0) {
    formatted += '### Memórias de Longo Prazo (Histórico):\n';
    formatted += '**HIERARQUIA DE VERDADE**: Conversa Atual > Sessão > LTM. Se houver conflito, priorize dados mais recentes.\n\n';
    
    const now = new Date();
    for (let i = 0; i < Math.min(context.longTermMemory.length, 5); i++) {
      const mem = context.longTermMemory[i];
      
      // Calcular tempo decorrido
      const createdAt = mem.createdAt ? new Date(mem.createdAt) : (mem.eventDate ? new Date(mem.eventDate) : now);
      const diffMs = now - createdAt;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffMonths = Math.floor(diffDays / 30);
      
      let timeInfo = '';
      if (diffMonths > 0) {
        timeInfo = `(há ${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'})`;
      } else if (diffDays > 0) {
        timeInfo = `(há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'})`;
      } else {
        timeInfo = '(hoje)';
      }
      
      const score = mem.impactScore ? mem.impactScore.toFixed(2) : 'N/A';
      formatted += `${i + 1}. ${timeInfo} ${mem.content} [${mem.category}, score: ${score}]\n`;
    }
    formatted += '\n**INFERÊNCIA TEMPORAL**: Use o tempo decorrido para inferir mudanças. Ex: "grávida de 3 meses há 6 meses" = bebê provavelmente nasceu.\n';
  }

    return formatted.trim();
}

module.exports = {
  initializeSession,
  buildAgentContext,
  processInteractionMemories,
  getOrCreateEpisodicMemory,
  updateWorkingMemory,
  endSession,
  formatContextForPrompt
};
