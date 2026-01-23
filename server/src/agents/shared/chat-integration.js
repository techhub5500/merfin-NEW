/**
 * Chat Integration - Interface Compartilhada para Integração de Chats
 *
 * Este módulo define a interface comum e lógica compartilhada para todos os chats
 * da plataforma. Ele garante que todos os chats sigam a mesma estrutura e comportamento,
 * independentemente da página (index, dash, invest).
 *
 * Responsabilidades:
 * - Definir contrato padrão para chats
 * - Gerenciar estado comum dos chats (histórico, sessão)
 * - Fornecer métodos utilitários para formatação de mensagens
 * - Centralizar configuração de chats (limites, validações)
 *
 * Não contém lógica específica de agentes - apenas a integração comum.
 */

class ChatIntegration {
  constructor() {
    this.maxMessageLength = 2000;
    this.maxHistoryLength = 50; // Máximo de mensagens no histórico
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutos
  }

  /**
   * Valida uma mensagem de chat
   * @param {string} message - Mensagem a validar
   * @returns {Object} { valid: boolean, error?: string }
   */
  validateMessage(message) {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Mensagem inválida' };
    }

    const trimmed = message.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: 'Mensagem vazia' };
    }

    if (trimmed.length > this.maxMessageLength) {
      return { valid: false, error: `Mensagem muito longa (máximo ${this.maxMessageLength} caracteres)` };
    }

    return { valid: true };
  }

  /**
   * Formata uma mensagem para exibição no chat
   * @param {string} content - Conteúdo da mensagem
   * @param {string} type - Tipo: 'user' ou 'ai'
   * @param {string} timestamp - Timestamp opcional
   * @returns {Object} Mensagem formatada
   */
  formatMessage(content, type, timestamp = new Date().toISOString()) {
    return {
      content: content.trim(),
      type, // 'user' ou 'ai'
      timestamp,
      id: this.generateMessageId()
    };
  }

  /**
   * Adiciona mensagem ao histórico, mantendo limite
   * @param {Array} history - Histórico atual
   * @param {Object} message - Nova mensagem
   * @returns {Array} Histórico atualizado
   */
  addToHistory(history, message) {
    const newHistory = [...history, message];

    // Mantém apenas as últimas mensagens
    if (newHistory.length > this.maxHistoryLength) {
      return newHistory.slice(-this.maxHistoryLength);
    }

    return newHistory;
  }

  /**
   * Gera ID único para mensagem
   * @returns {string} ID único
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verifica se uma sessão é válida
   * @param {string} sessionId - ID da sessão
   * @param {number} lastActivity - Timestamp da última atividade
   * @returns {boolean} Sessão válida
   */
  isValidSession(sessionId, lastActivity) {
    if (!sessionId) return false;

    const now = Date.now();
    return (now - lastActivity) < this.sessionTimeout;
  }

  /**
   * Cria nova sessão de chat
   * @param {string} userId - ID do usuário (opcional)
   * @returns {Object} Dados da sessão
   */
  createSession(userId = null) {
    return {
      sessionId: this.generateSessionId(),
      userId,
      createdAt: new Date().toISOString(),
      lastActivity: Date.now(),
      history: []
    };
  }

  /**
   * Gera ID único para sessão
   * @returns {string} ID da sessão
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Converte histórico para formato compatível com agentes
   * @param {Array} history - Histórico interno
   * @returns {Array} Histórico no formato {role, content}
   */
  convertHistoryForAgent(history) {
    return history.map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }

  /**
   * Faz chamada HTTP para o endpoint de chat
   * @param {string} message - Mensagem do usuário
   * @param {string} sessionId - ID da sessão
   * @param {Array} history - Histórico de mensagens
   * @returns {Promise<Object>} Resposta do servidor
   */
  async sendToChatAPI(message, sessionId = null, history = []) {
    try {
      const response = await fetch('/api/chat/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId,
          history
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro na chamada para API de chat:', error);
      throw error;
    }
  }
}

// Exportar instância singleton
module.exports = new ChatIntegration();