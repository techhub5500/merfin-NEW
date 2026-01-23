// Shared server-side module for Chat History Modal logic
// This file is a lightweight stub that centralizes modal-related logic
// such as available chat names per page, retrieval stubs for history and memories.

const AVAILABLE_CHATS = {
  Home: 'Home',
  Financas: 'Finanças',
  Finanças: 'Finanças',
  Invest: 'Invest'
};

module.exports = {
  getAvailableChats() {
    // Returns canonical chat options (keys used by client)
    return ['Home', 'Finanças', 'Invest'];
  },

  // Placeholder: would fetch chat session list for a given chat area
  async fetchChatListFor(area /* string */) {
    // In a real implementation, this would query a DB or cache
    // Here we return a static placeholder structure
    return [
      { id: 'c1', title: `${area} — Conversa 1`, updatedAt: new Date().toISOString() },
      { id: 'c2', title: `${area} — Conversa 2`, updatedAt: new Date().toISOString() }
    ];
  },

  // Placeholder: fetch memories for current user
  async fetchMemoriesForUser(userId) {
    // Would normally fetch persistent memories associated with user
    return [];
  }
};
