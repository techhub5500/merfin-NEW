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
   * @param {string} userId - ID do usuário (obrigatório para sistema de memória)
   * @param {string} chatId - ID do chat
   * @returns {Promise<Object>} Resposta do servidor
   */
  async sendToChatAPI(message, sessionId = null, history = [], userId = null, chatId = null) {
    try {
      // URL do servidor do agente (porta 5000)
      const baseUrl = 'http://localhost:5000';
      
      console.log('[ChatIntegration] ✅ Enviando mensagem para API:', { 
        message: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        sessionId, 
        userId, 
        chatId,
        historyLength: history.length 
      });
      
      const requestBody = {
        message,
        sessionId,
        history,
        userId,
        chatId
      };
      
      console.log('[ChatIntegration] 📦 Request Body completo:', requestBody);
      
      const response = await fetch(`${baseUrl}/api/chat/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
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
   * Create a chat record on main server
   * @param {string} userId
   * @param {string} sessionId
   * @param {string} area
   * @param {string} title
   */
  async createChatOnMain(userId, sessionId, area = 'Home', title = '') {
    try {
      const base = 'http://localhost:3000';
      let uid = userId;
      if (!uid) {
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          uid = stored.id || stored._id || null;
        } catch (e) {
          uid = null;
        }
      }

      const res = await fetch(`${base}/api/chat/history/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, sessionId, area, title })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('createChatOnMain failed', err);
      throw err;
    }
  }

  /**
   * Append a message to a chat on main server
   * @param {string} chatId
   * @param {string} userId
   * @param {string} content
   * @param {string} sender - 'user'|'ai'
   * @param {string} currentPage
   */
  async addMessageToChatOnMain(chatId, userId, content, sender = 'user', currentPage = null) {
    try {
      const base = 'http://localhost:3000';
      let uid = userId;
      if (!uid) {
        try {
          const stored = JSON.parse(localStorage.getItem('user') || '{}');
          uid = stored.id || stored._id || null;
        } catch (e) { uid = null; }
      }
      const res = await fetch(`${base}/api/chat/history/${encodeURIComponent(chatId)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, content, sender, currentPage })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('addMessageToChatOnMain failed', err);
      throw err;
    }
  }

  /**
   * Fetch list of chats for a user (optionally filtered by area/search)
   */
  async fetchChatsOnMain(userId, area = null, search = null) {
    try {
      const base = 'http://localhost:3000';
      const params = new URLSearchParams();
      let uid = userId;
      if (!uid) {
        try { const stored = JSON.parse(localStorage.getItem('user') || '{}'); uid = stored.id || stored._id || null; } catch (e) { uid = null; }
      }
      if (uid) params.append('userId', uid);
      if (area) params.append('area', area);
      if (search) params.append('search', search);
      const res = await fetch(`${base}/api/chat/history?${params.toString()}`, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('fetchChatsOnMain failed', err);
      throw err;
    }
  }

  async fetchChatByIdOnMain(chatId, userId) {
    try {
      const base = 'http://localhost:3000';
      const url = new URL(`${base}/api/chat/history/${encodeURIComponent(chatId)}`);
      let uid = userId;
      if (!uid) {
        try { const stored = JSON.parse(localStorage.getItem('user') || '{}'); uid = stored.id || stored._id || null; } catch (e) { uid = null; }
      }
      if (uid) url.searchParams.append('userId', uid);
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('fetchChatByIdOnMain failed', err);
      throw err;
    }
  }

  async deleteChatOnMain(chatId, userId) {
    try {
      const base = 'http://localhost:3000';
      let uid = userId;
      if (!uid) {
        try { const stored = JSON.parse(localStorage.getItem('user') || '{}'); uid = stored.id || stored._id || null; } catch (e) { uid = null; }
      }
      const res = await fetch(`${base}/api/chat/history/${encodeURIComponent(chatId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('deleteChatOnMain failed', err);
      throw err;
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