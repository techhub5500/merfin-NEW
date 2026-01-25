/**
 * NOTE (memory-types.js):
 * Purpose: Define constants, types, budgets and thresholds for the memory system.
 * Controls: Memory budgets (WORKING infinite, EPISODIC 500 words, LONG_TERM 400 words),
 * impact thresholds (min 0.5 to keep, 0.7 for LTM), memory scopes and categories.
 * Integration notes: Import these constants across all memory modules for consistency.
 */

// Memory types by scope
const MEMORY_SCOPES = {
  WORKING: 'working',       // Volatile, per-session, no persistence
  EPISODIC: 'episodic',     // Persistent per chat, expires after inactivity
  LONG_TERM: 'long_term'    // Persistent cross-chat, indefinite, highly curated
};

// Word budgets for each memory type
const MEMORY_BUDGETS = {
  WORKING: 700,
  EPISODIC: 500,
  LONG_TERM: 1800,              // Total: 1800 palavras
  LONG_TERM_PER_CATEGORY: 180   // Por categoria: 180 palavras
};


// Impact score thresholds
const IMPACT_THRESHOLDS = {
  MIN_TO_KEEP: 0.5,         // Minimum score to keep in any memory
  MIN_FOR_LTM: 0.7,         // Minimum score to promote to long-term memory
  COMPRESSION_TRIGGER: 0.8  // When to trigger compression (80% of budget)
};

// Similarity thresholds for merging and deduplication
const SIMILARITY_THRESHOLDS = {
  MERGE_THRESHOLD: 0.85,    // Threshold for merging similar memories
  DUPLICATE_THRESHOLD: 0.9  // Threshold for detecting duplicates
};

LTM_CATEGORIES = {
  PERFIL_PROFISSIONAL: 'perfil_profissional',
  SITUACAO_FINANCEIRA: 'situacao_financeira',
  INVESTIMENTOS: 'investimentos',
  OBJETIVOS_METAS: 'objetivos_metas',
  COMPORTAMENTO_GASTOS: 'comportamento_gastos',
  PERFIL_RISCO: 'perfil_risco',
  CONHECIMENTO_FINANCEIRO: 'conhecimento_financeiro',
  PLANEJAMENTO_FUTURO: 'planejamento_futuro',
  FAMILIA_DEPENDENTES: 'familia_dependentes',
  RELACAO_PLATAFORMA: 'relacao_plataforma'
};

// Memory item structure for long-term
const MEMORY_ITEM_STRUCTURE = {
  content: '',              // The memory content (text)
  category: '',             // One of LTM_CATEGORIES
  impact_score: 0.0,        // Relevance score (0.0 to 1.0)
  source_chats: [],         // Array of chat IDs that contributed
  created_at: null,         // Timestamp
  last_accessed: null,      // Timestamp
  access_count: 0           // Number of times accessed
};

module.exports = {
  MEMORY_SCOPES,
  MEMORY_BUDGETS,
  IMPACT_THRESHOLDS,
  SIMILARITY_THRESHOLDS,
  LTM_CATEGORIES,
  MEMORY_ITEM_STRUCTURE
};
