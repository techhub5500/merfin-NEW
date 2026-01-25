// Chat history modal server helpers - DB-backed implementation
const Chat = require('../../database/schemas/chat-schema');
const chatIntegration = require('./chat-integration');

/**
 * Server-side helper for chat history modal operations.
 * Provides functions to create, list, delete, search and append messages to chats.
 */
module.exports = {
  getAvailableChats() {
    return ['Home', 'Finanças', 'Invest'];
  },

  async createChat({ userId, title = '', area = 'Home', sessionId = null }) {
    if (!userId) throw new Error('userId is required');

    const sid = sessionId || chatIntegration.generateSessionId();

    const chat = new Chat({
      userId,
      sessionId: sid,
      title,
      origin: area,
      currentArea: area,
      messages: []
    });

    await chat.save();
    return chat.toObject();
  },

  async fetchChatListFor({ userId, area = null, search = null }) {
    if (!userId) throw new Error('userId is required');

    const query = { userId };
    if (area) query.currentArea = area;

    if (search && typeof search === 'string' && search.trim().length) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: regex },
        { 'messages.content': regex }
      ];
    }

    const chats = await Chat.find(query).sort({ updatedAt: -1 }).lean();
    return chats;
  },

  async fetchChatById({ userId, chatId }) {
    if (!userId) throw new Error('userId is required');
    const chat = await Chat.findOne({ _id: chatId, userId }).lean();
    return chat;
  },

  async fetchChatBySessionId({ userId, sessionId }) {
    if (!userId) throw new Error('userId is required');
    if (!sessionId) throw new Error('sessionId is required');
    const chat = await Chat.findOne({ userId, sessionId }).lean();
    return chat;
  },

  async deleteChat({ userId, chatId }) {
    if (!userId) throw new Error('userId is required');
    const res = await Chat.deleteOne({ _id: chatId, userId });
    return res.deletedCount === 1;
  },

  async addMessageToChat({ userId, chatId, content, sender = 'user', currentPage = null }) {
    if (!userId) throw new Error('userId is required');
    if (!chatId) throw new Error('chatId is required');
    if (!content || typeof content !== 'string') throw new Error('content is required');

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) throw new Error('chat not found');

    const formatted = chatIntegration.formatMessage(content, sender === 'user' ? 'user' : 'ai');

    chat.messages.push({ id: formatted.id, type: formatted.type, content: formatted.content, timestamp: formatted.timestamp });

    if (chat.messages.length > chatIntegration.maxHistoryLength) {
      chat.messages = chat.messages.slice(-chatIntegration.maxHistoryLength);
    }

    if (sender === 'user' && currentPage && currentPage !== chat.currentArea) {
      chat.currentArea = currentPage;
    }

    if (!chat.title || chat.title.trim() === '') {
      chat.title = content.length > 80 ? content.substr(0, 77) + '...' : content;
    }

    await chat.save();
    return chat.toObject();
  }
};
