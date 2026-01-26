/**
 * NOTE (memory-integration-new.js):
 * Purpose: Ponto central de integração de memória simplificado.
 * 
 * NOVO SISTEMA DE MEMÓRIA CONVERSACIONAL:
 * - Baseado em ciclos (1 ciclo = 1 msg usuário + 1 resposta IA)
 * - Últimos 4 ciclos mantidos integralmente
 * - Ciclos anteriores comprimidos progressivamente (25% por camada)
 * - Limite máximo de 3.000 tokens
 * 
 * Controls: buildAgentContext, processInteractionMemories, formatContextForPrompt
 * Behavior: Simplicidade e eficiência - sem complexidade desnecessária
 * Integration notes: Usado pelo JuniorAgent para contexto de conversa
 */

const conversationalMemory = require('./conversational/conversational-memory');
const Chat = require('../../database/schemas/chat-schema');

/**
 * Constrói contexto completo para um agente
 * @param {string} sessionId - ID da sessão
 * @param {string} chatId - ID do chat (ou sessionId como fallback)
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Contexto formatado
 */
async function buildAgentContext(sessionId, chatId, userId) {
  try {
    console.log('[MemoryIntegration] 🚀 Construindo contexto do agente');
    console.log('[MemoryIntegration] 📋 Parâmetros:', { sessionId, chatId, userId });
    
    // Busca chat do banco de dados
    const chatDoc = await Chat.findOne({ 
      sessionId: chatId || sessionId 
    });
    
    if (!chatDoc || !chatDoc.messages || chatDoc.messages.length === 0) {
      console.log('[MemoryIntegration] ℹ️ Nenhum histórico encontrado, nova conversa');
      return {
        sessionId,
        chatId: chatId || sessionId,
        userId,
        conversationalContext: '',
        stats: {
          totalCycles: 0,
          fullCycles: 0,
          compressedCycles: 0,
          tokens: 0
        }
      };
    }
    
    // Constrói contexto de memória conversacional
    const { context, stats } = await conversationalMemory.buildContext(
      chatId || sessionId, 
      chatDoc.messages
    );
    
    console.log('[MemoryIntegration] ✅ Contexto construído:', stats);
    
    return {
      sessionId,
      chatId: chatId || sessionId,
      userId,
      conversationalContext: context,
      stats
    };
    
  } catch (error) {
    console.error('[MemoryIntegration] ❌ Erro ao construir contexto:', error);
    return {
      sessionId,
      chatId: chatId || sessionId,
      userId,
      conversationalContext: '',
      stats: { totalCycles: 0, fullCycles: 0, compressedCycles: 0, tokens: 0 },
      error: error.message
    };
  }
}

/**
 * Processa memórias após uma interação
 * No novo sistema simplificado, as mensagens já são salvas pelo chat-schema
 * Este método apenas limpa cache se necessário
 * @param {Object} interaction - Dados da interação
 * @returns {Promise<Object>} - Status do processamento
 */
async function processInteractionMemories(interaction) {
  const { sessionId, chatId, userId, userMessage, aiResponse } = interaction;
  
  console.log('[MemoryIntegration] 🔄 Processando interação:', {
    sessionId,
    chatId,
    userId,
    msgLength: userMessage?.length,
    respLength: aiResponse?.length
  });
  
  // Limpa cache para forçar reconstrução na próxima consulta
  conversationalMemory.clearCache(chatId || sessionId);
  
  return { 
    status: 'success', 
    message: 'Interação registrada no histórico do chat'
  };
}

/**
 * Formata contexto para prompt da IA
 * @param {Object} context - Contexto de buildAgentContext
 * @returns {string} - Contexto formatado para prompt
 */
function formatContextForPrompt(context) {
  if (!context) return '';
  
  let formatted = '';
  
  // Adiciona contexto conversacional (histórico + resumos)
  if (context.conversationalContext) {
    formatted += context.conversationalContext;
  }
  
  return formatted.trim();
}

/**
 * Inicializa sessão (compatibilidade com código existente)
 * @param {string} sessionId - ID da sessão
 * @param {string} userId - ID do usuário
 * @param {Object} metadata - Metadados opcionais
 * @returns {Object} - Objeto de sessão
 */
function initializeSession(sessionId, userId, metadata = {}) {
  console.log('[MemoryIntegration] 🆕 Sessão inicializada:', { sessionId, userId });
  return {
    sessionId,
    userId,
    startedAt: metadata.startedAt || new Date().toISOString(),
    chatId: metadata.chatId || sessionId
  };
}

/**
 * Encerra sessão (limpa cache)
 * @param {string} sessionId - ID da sessão
 */
async function endSession(sessionId) {
  conversationalMemory.clearCache(sessionId);
  console.log('[MemoryIntegration] 🔚 Sessão encerrada:', sessionId);
}

module.exports = {
  buildAgentContext,
  processInteractionMemories,
  formatContextForPrompt,
  initializeSession,
  endSession
};
