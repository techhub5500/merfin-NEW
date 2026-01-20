/**
 * NOTE (memory-compressor.js):
 * Purpose: Compress verbose memories to fit within word budgets while preserving essence.
 * Controls: Two compression modes - LLM-based (intelligent, expensive) and rule-based (fast, simple).
 * Integration notes: Called automatically when memory approaches budget limit (80% threshold).
 */

const { count } = require('./word-counter');

/**
 * Compress memory using LLM (intelligent compression)
 * @param {*} memory - Memory content to compress
 * @param {number} targetWords - Target word count
 * @param {Function} llmFunction - LLM function to call (should accept prompt and return compressed text)
 * @returns {Promise<string>} - Compressed memory
 */
async function compressWithLLM(memory, targetWords, llmFunction) {
  if (!llmFunction || typeof llmFunction !== 'function') {
    throw new Error('LLM function is required for intelligent compression');
  }
  
  const contentStr = typeof memory === 'string' ? memory : JSON.stringify(memory, null, 2);
  const currentWords = count(contentStr);
  
  if (currentWords <= targetWords) {
    return contentStr; // Already within budget
  }
  
  const prompt = `Você é um assistente especializado em comprimir memórias mantendo a essência.

TAREFA: Comprimir a seguinte memória de ${currentWords} palavras para aproximadamente ${targetWords} palavras, preservando:
- Informações factuais críticas
- Padrões comportamentais identificados
- Decisões e preferências do usuário
- Contexto relevante para decisões futuras

REGRAS:
- Remover detalhes redundantes e exemplos desnecessários
- Manter números e valores específicos quando relevantes
- Usar linguagem concisa e direta
- NÃO inventar informações

MEMÓRIA ORIGINAL:
${contentStr}

MEMÓRIA COMPRIMIDA (máximo ${targetWords} palavras):`;

  try {
    const compressed = await llmFunction(prompt);
    
    // Validate compression
    const compressedWords = count(compressed);
    if (compressedWords > targetWords * 1.2) {
      console.warn(`Compression exceeded target: ${compressedWords} words (target: ${targetWords})`);
    }
    
    return compressed;
  } catch (err) {
    console.error('LLM compression failed:', err);
    // Fallback to rule-based compression
    return compressRuleBased(memory, targetWords);
  }
}

/**
 * Compress memory using simple rules (faster, less intelligent)
 * @param {*} memory - Memory content to compress
 * @param {number} targetWords - Target word count (optional)
 * @returns {string} - Compressed memory
 */
function compressRuleBased(memory, targetWords = null) {
  const contentStr = typeof memory === 'string' ? memory : JSON.stringify(memory);
  
  let compressed = contentStr;
  
  // Rule 1: Remove extra whitespace
  compressed = compressed.replace(/\s+/g, ' ').trim();
  
  // Rule 2: Remove common filler words (Portuguese)
  const fillers = ['muito', 'realmente', 'basicamente', 'essencialmente', 'praticamente', 'simplesmente'];
  for (const filler of fillers) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    compressed = compressed.replace(regex, '');
  }
  
  // Rule 3: Simplify redundant phrases
  compressed = compressed.replace(/no momento atual/gi, 'atualmente');
  compressed = compressed.replace(/com o objetivo de/gi, 'para');
  compressed = compressed.replace(/tendo em vista que/gi, 'pois');
  compressed = compressed.replace(/é importante ressaltar que/gi, '');
  
  // Rule 4: Remove duplicate sentences
  const sentences = compressed.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  const uniqueSentences = [...new Set(sentences)];
  compressed = uniqueSentences.join('. ') + '.';
  
  // Rule 5: If still over budget, truncate by sentences
  if (targetWords) {
    const words = compressed.split(/\s+/);
    if (words.length > targetWords) {
      // Keep first N words that form complete sentences
      const truncated = words.slice(0, targetWords).join(' ');
      const lastPeriod = truncated.lastIndexOf('.');
      compressed = lastPeriod > 0 ? truncated.substring(0, lastPeriod + 1) : truncated + '...';
    }
  }
  
  // Clean up extra spaces again
  compressed = compressed.replace(/\s+/g, ' ').trim();
  
  return compressed;
}

/**
 * Compress memory (auto-selects method based on availability)
 * @param {*} memory - Memory content
 * @param {number} targetWords - Target word count
 * @param {object} options - Compression options
 * @param {Function} options.llmFunction - Optional LLM function for intelligent compression
 * @param {boolean} options.preferRuleBased - Force rule-based compression
 * @returns {Promise<string>} - Compressed memory
 */
async function compress(memory, targetWords, options = {}) {
  const { llmFunction, preferRuleBased = false } = options;
  
  const currentWords = count(memory);
  
  if (currentWords <= targetWords) {
    return typeof memory === 'string' ? memory : JSON.stringify(memory);
  }
  
  // Use rule-based if preferred or LLM not available
  if (preferRuleBased || !llmFunction) {
    return compressRuleBased(memory, targetWords);
  }
  
  // Use LLM compression
  return compressWithLLM(memory, targetWords, llmFunction);
}

module.exports = {
  compress,
  compressWithLLM,
  compressRuleBased
};
