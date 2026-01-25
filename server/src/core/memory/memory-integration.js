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

    // Get relevant long-term memories (top 5 by impact)
    let ltmContext = [];
    let categoryDescriptions = {};
    try {
      const LongTermMemoryModel = require('../../database/schemas/long-term-memory-schema');
      const ltm = await LongTermMemoryModel.findOne({ userId });
      
      if (ltm) {
        // Get top memories
        const ltmData = await longTermMemory.retrieve(userId, '', {
          limit: 5,
          useVectorSearch: false
        });
        ltmContext = ltmData.map(item => ({
          content: item.content,
          category: item.category,
          impactScore: item.impactScore
        }));
        
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
 * Format context for AI prompt (VERSÃO COMPACTA COM RESUMO NARRATIVO)
 * @param {object} context - Context from buildAgentContext
 * @returns {string} - Formatted context string for prompt
 */
function formatContextForPrompt(context) {
  let formatted = '';

  // Working Memory (compacto)
  if (context.workingMemory && Object.keys(context.workingMemory).length > 0) {
    formatted += '### Sessão:\n';
    for (const [key, value] of Object.entries(context.workingMemory)) {
      formatted += `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
    }
    formatted += '\n';
  }

  // Episodic Memory - NOVO: Usa resumo narrativo ao invés de JSON completo
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

  // Long-Term Memory (compacto - máximo 3 memórias)
  if (context.longTermMemory && context.longTermMemory.length > 0) {
    formatted += '### Info Importante:\n';
    const topMemories = context.longTermMemory.slice(0, 3);
    for (const memory of topMemories) {
      formatted += `• ${memory.content}\n`;
    }
    formatted += '\n';
  }

  return formatted;
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
