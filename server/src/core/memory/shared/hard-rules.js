/**
 * NOTE (hard-rules.js):
 * Purpose: Define non-negotiable rules for memory validation and safety.
 * Controls: Forbidden content patterns (passwords, tokens, sensitive data),
 * compression triggers, and security constraints.
 * Integration notes: Memory validator uses these rules to reject unsafe memories.
 */

// Forbidden patterns that must NEVER be stored in any memory
const FORBIDDEN_PATTERNS = [
  // Authentication and credentials
  /password/i,
  /senha/i,
  /token/i,
  /auth.*key/i,
  /api.*key/i,
  /secret/i,
  /bearer/i,
  
  // Personal identification
  /cpf/i,
  /cnpj/i,
  /rg\s*:/i,
  /carteira.*identidade/i,
  /passaporte/i,
  
  // Financial sensitive data
  /cart[ãa]o.*cr[ée]dito/i,
  /cvv/i,
  /c[óo]digo.*seguran[çc]a/i,
  /n[úu]mero.*cart[ãa]o/i,
  /ag[êe]ncia/i,
  /conta.*corrente/i,
  
  // System internals
  /mongodb.*uri/i,
  /connection.*string/i,
  /private.*key/i,
  /jwt/i
];

// Forbidden keywords (simple string matching, case insensitive)
const FORBIDDEN_KEYWORDS = [
  'password',
  'senha',
  'token',
  'api_key',
  'secret_key',
  'bearer',
  'authorization',
  'cpf',
  'cnpj',
  'cvv',
  'credit_card',
  'cartao_credito',
  'numero_cartao',
  'mongodb_uri',
  'connection_string'
];

// Content that should NEVER be in long-term memory (too ephemeral)
const LTM_FORBIDDEN_CONTENT = [
  'temporary values',
  'intermediate calculations',
  'unconfirmed hypotheses',
  'agent internal reasoning',
  'debug information',
  'error stack traces'
];

// Compression triggers (word count thresholds)
const COMPRESSION_TRIGGERS = {
  EPISODIC: 400,   // Compress episodic memory when approaching 400 words (80% of 500)
  LONG_TERM: 320   // Compress long-term when approaching 320 words (80% of 400)
};

// Auto-cleanup rules
const CLEANUP_RULES = {
  WORKING_SESSION_TIMEOUT: 40 * 60 * 1000,  // 40 minutos de inatividade
  EPISODIC_INACTIVITY_DAYS: 30,             // Delete after 30 days of inactivity
  EPISODIC_MAX_AGE_DAYS: 90                 // Hard delete after 90 days
};

/**
 * Check if content contains forbidden patterns
 * @param {string} content - Text to validate
 * @returns {object} - {found: boolean, type: string}
 */
function containsForbiddenContent(content) {
  if (!content || typeof content !== 'string') {
    return { found: false, type: null };
  }
  
  const lowerContent = content.toLowerCase();
  
  // Check keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return { found: true, type: `keyword: ${keyword}` };
    }
  }
  
  // Check patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      return { found: true, type: `pattern: ${pattern.toString()}` };
    }
  }
  
  return { found: false, type: null };
}

/**
 * Check if content is suitable for long-term memory
 * @param {string} content - Text to validate
 * @returns {boolean} - True if appropriate for LTM
 */
function isSuitableForLTM(content) {
  if (!content || typeof content !== 'string') return false;
  
  const lowerContent = content.toLowerCase();
  
  for (const forbiddenType of LTM_FORBIDDEN_CONTENT) {
    if (lowerContent.includes(forbiddenType.toLowerCase())) {
      return false;
    }
  }
  
  return true;
}

module.exports = {
  FORBIDDEN_PATTERNS,
  FORBIDDEN_KEYWORDS,
  LTM_FORBIDDEN_CONTENT,
  COMPRESSION_TRIGGERS,
  CLEANUP_RULES,
  containsForbiddenContent,
  isSuitableForLTM
};
