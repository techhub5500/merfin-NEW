const express = require('express');
const router = express.Router();
const chatHistory = require('../agents/shared/chatHistoryModal');

// NOTE: In this project auth is handled elsewhere. For now expect `userId` in the body/query

// Create a chat (or return existing if sessionId already exists)
router.post('/create', async (req, res, next) => {
  try {
    const { userId, title, area, sessionId } = req.body;
    console.log('[ChatHistory] POST /create:', { userId, title, area, sessionId });
    
    // Try to find existing chat with this sessionId first
    if (sessionId) {
      const existing = await chatHistory.fetchChatBySessionId({ userId, sessionId });
      if (existing) {
        console.log('[ChatHistory] Chat já existe, retornando existente:', existing._id);
        return res.json({ success: true, chat: existing, existed: true });
      }
    }
    
    // Create new chat
    const chat = await chatHistory.createChat({ userId, title, area, sessionId });
    console.log('[ChatHistory] ✅ Chat criado:', chat._id);
    res.json({ success: true, chat });
  } catch (err) {
    console.error('[ChatHistory] ❌ Erro ao criar chat:', err.message);
    next(err);
  }
});

// List chats (optional query: area, search)
router.get('/', async (req, res, next) => {
  try {
    const { userId, area, search } = req.query;
    const chats = await chatHistory.fetchChatListFor({ userId, area, search });
    res.json({ success: true, chats });
  } catch (err) {
    next(err);
  }
});

// Get a single chat
router.get('/:chatId', async (req, res, next) => {
  try {
    const { userId } = req.query;
    const { chatId } = req.params;
    const chat = await chatHistory.fetchChatById({ userId, chatId });
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
});

// Delete chat
router.delete('/:chatId', async (req, res, next) => {
  try {
    const { userId } = req.body;
    const { chatId } = req.params;
    const ok = await chatHistory.deleteChat({ userId, chatId });
    res.json({ success: ok });
  } catch (err) {
    next(err);
  }
});

// Add message to chat
router.post('/:chatId/message', async (req, res, next) => {
  try {
    const { userId, content, sender, currentPage } = req.body;
    const { chatId } = req.params;
    const chat = await chatHistory.addMessageToChat({ userId, chatId, content, sender, currentPage });
    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
