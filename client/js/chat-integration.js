/**
 * Chat Integration - Cliente Frontend
 *
 * Interface para integração dos chats do frontend com o backend JuniorAgent.
 * Fornece métodos utilitários para comunicação com a API de chat.
 */

class ChatIntegration {
  /**
   * Faz chamada HTTP para o endpoint de chat
   * @param {string} message - Mensagem do usuário
   * @param {string} sessionId - ID da sessão
   * @param {Array} history - Histórico de mensagens
   * @returns {Promise<Object>} Resposta do servidor
   */
  async sendToChatAPI(message, sessionId = null, history = []) {
    try {
      // URL do servidor do agente (porta 5000)
      const baseUrl = 'http://localhost:5000';
      
      console.log('[ChatIntegration] Enviando mensagem:', { message, sessionId, history });
      
      const response = await fetch(`${baseUrl}/api/chat/process`, {
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
      
      console.log('[ChatIntegration] Resposta recebida:', data);
      
      return data;
    } catch (error) {
      console.error('Erro na chamada para API de chat:', error);
      throw error;
    }
  }

  /**
   * Gera ID único para sessão
   * @returns {string} ID da sessão
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Exportar instância singleton
export default new ChatIntegration();