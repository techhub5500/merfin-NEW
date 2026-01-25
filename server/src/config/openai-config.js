/**
 * NOTE (openai-config.js):
 * Purpose: Configure OpenAI GPT-4.1 nano for all AI-driven memory operations.
 * Controls: API key, model version, endpoints, and request parameters.
 * Integration notes: Used by memory curator, impact scorer, and all AI reasoning operations.
 * Why GPT-4.1 nano: Fast, cost-effective, and excellent for memory curation tasks.
 */

const OpenAI = require('openai');

const OPENAI_CONFIG = {
  // API configuration
  API_KEY: process.env.OPENAI_API_KEY || '',
  MODEL: 'gpt-4.1-nano', // GPT-4.1 nano model
  
  // Request parameters for memory operations
  DEFAULT_PARAMS: {
    temperature: 0.3,      // Low temperature for consistent reasoning
    max_tokens: 1000,      // Sufficient for memory analysis
    top_p: 0.95,
    frequency_penalty: 0.0,
    presence_penalty: 0.0
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
 * Call OpenAI chat API
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @param {Object} options - Optional parameters (temperature, max_tokens, etc.)
 * @returns {Promise<string>} - AI response
 */
async function callOpenAI(systemPrompt, userPrompt, options = {}) {
  const client = getClient();
  
  const params = {
    model: OPENAI_CONFIG.MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    ...OPENAI_CONFIG.DEFAULT_PARAMS,
    ...options
  };
  
  let lastError;
  for (let attempt = 1; attempt <= OPENAI_CONFIG.MAX_RETRIES; attempt++) {
    try {
      console.log(`[OpenAI] Attempt ${attempt}/${OPENAI_CONFIG.MAX_RETRIES} - Calling ${OPENAI_CONFIG.MODEL}...`);
      
      const response = await client.chat.completions.create(params);
      
      const content = response.choices[0].message.content.trim();
      console.log(`[OpenAI] ✅ Success - ${content.length} chars`);
      
      return content;
      
    } catch (error) {
      lastError = error;
      console.warn(`[OpenAI] ❌ Attempt ${attempt}/${OPENAI_CONFIG.MAX_RETRIES} failed:`, error.message);
      
      if (attempt < OPENAI_CONFIG.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, OPENAI_CONFIG.RETRY_DELAY * attempt));
      }
    }
  }
  
  throw new Error(`OpenAI API failed after ${OPENAI_CONFIG.MAX_RETRIES} attempts: ${lastError.message}`);
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
      { max_tokens: 10 }
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
