/**
 * NOTE (openai-config.js):
 * Purpose: Configure OpenAI GPT-5 nano for all AI-driven memory operations.
 * Controls: API key, model version, endpoints, and request parameters.
 * Integration notes: Used by memory curator, impact scorer, and all AI reasoning operations.
 * Why GPT-5 nano: Fast, cost-effective, and excellent for memory curation tasks.
 * API: Uses new responses.create() API (Jan 2026+)
 */

const OpenAI = require('openai');

const OPENAI_CONFIG = {
  // API configuration
  API_KEY: process.env.OPENAI_API_KEY || '',
  MODEL: 'gpt-5-nano', // GPT-5 nano model (2026)
  
  // Request parameters for memory operations
  DEFAULT_PARAMS: {
    max_output_tokens: 1000,      // Sufficient for memory analysis
  },
  
  // Timeout configurations
  TIMEOUT: 30000, // 30 seconds
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 second
};

// Initialize OpenAI client
let openaiClient = null;

function getClient() {
  if (!openaiClient) {
    if (!OPENAI_CONFIG.API_KEY) {
      throw new Error('OPENAI_API_KEY not configured in .env');
    }
    openaiClient = new OpenAI({
      apiKey: OPENAI_CONFIG.API_KEY,
      timeout: OPENAI_CONFIG.TIMEOUT
    });
  }
  return openaiClient;
}

/**
 * Call OpenAI responses API (new 2026 API)
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @param {Object} options - Optional parameters (max_output_tokens, etc.)
 * @returns {Promise<string>} - AI response
 */
async function callOpenAI(systemPrompt, userPrompt, options = {}) {
  const client = getClient();
  
  // Combina system + user prompt para a nova API
  const combinedInput = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  
  let lastError;
  for (let attempt = 1; attempt <= OPENAI_CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`[OpenAI] 🤖 Chamando ${OPENAI_CONFIG.MODEL} (tentativa ${attempt}/${OPENAI_CONFIG.MAX_RETRIES})`);
      console.log(`[OpenAI] 📝 Input: ${combinedInput.substring(0, 150)}...`);
      
      // Nova API: responses.create()
      const response = await client.responses.create({
        model: OPENAI_CONFIG.MODEL,
        input: combinedInput,
        ...OPENAI_CONFIG.DEFAULT_PARAMS,
        ...options
      });
      
      const content = response.output_text.trim();
      console.log(`[OpenAI] ✅ Resposta recebida: ${content.length} chars`);
      console.log(`[OpenAI] 📄 Conteúdo: ${content.substring(0, 100)}...`);
      
      return content;
      
    } catch (error) {
      lastError = error;
      console.warn(`[OpenAI] ❌ Tentativa ${attempt}/${OPENAI_CONFIG.MAX_RETRIES} falhou:`, error.message);
      
      if (attempt < OPENAI_CONFIG.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, OPENAI_CONFIG.RETRY_DELAY * attempt));
      }
    }
  }
  
  throw new Error(`OpenAI API falhou após ${OPENAI_CONFIG.MAX_RETRIES} tentativas: ${lastError.message}`);
}

/**
 * Call OpenAI with structured JSON response
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function callOpenAIJSON(systemPrompt, userPrompt, options = {}) {
  const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, just the JSON object.`;
  
  const response = await callOpenAI(enhancedSystemPrompt, userPrompt, options);
  
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[OpenAI] Failed to parse JSON response:', response);
    throw new Error(`OpenAI returned invalid JSON: ${error.message}`);
  }
}

/**
 * Test OpenAI connection
 * @returns {Promise<boolean>} - True if connection successful
 */
async function testConnection() {
  try {
    const response = await callOpenAI(
      'You are a helpful assistant.',
      'Reply with a single word: OK',
      { max_output_tokens: 10 }
    );
    
    return response.toLowerCase().includes('ok');
  } catch (error) {
    console.error('[OpenAI] Connection test failed:', error.message);
    return false;
  }
}

module.exports = {
  OPENAI_CONFIG,
  callOpenAI,
  callOpenAIJSON,
  testConnection,
  // Export with old names for backward compatibility
  callDeepSeek: callOpenAI,
  callDeepSeekJSON: callOpenAIJSON,
  DEEPSEEK_API_KEY: OPENAI_CONFIG.API_KEY,
  DEEPSEEK_API_URL: 'https://api.openai.com/v1',
  DEEPSEEK_MODEL: OPENAI_CONFIG.MODEL
};
