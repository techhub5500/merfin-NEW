/**
 * NOTE (deepseek-config.js):
 * Purpose: Configure DeepSeek v3 chat for all AI-driven memory operations.
 * Controls: API key, model version, endpoints, and request parameters.
 * Integration notes: Used by memory curator, impact scorer, and all AI reasoning operations.
 * Why DeepSeek: Cost-effective, fast, and sufficient for memory curation tasks.
 */

const axios = require('axios');

const DEEPSEEK_CONFIG = {
  // API configuration
  API_KEY: process.env.DEEPSEEK_API_KEY || '',
  BASE_URL: 'https://api.deepseek.com/v1',
  MODEL: 'deepseek-chat', // v3 model
  
  // Request parameters for memory operations
  DEFAULT_PARAMS: {
    temperature: 0.3,      // Low temperature for consistent reasoning
    max_tokens: 1000,      // Sufficient for memory analysis
    top_p: 0.95,
    frequency_penalty: 0.0,
    presence_penalty: 0.0
  },
  
  // Timeout configurations
  TIMEOUT: 15000, // 15 seconds
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000 // 1 second
};

/**
 * Call DeepSeek chat API
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @param {Object} options - Optional parameters (temperature, max_tokens, etc.)
 * @returns {Promise<string>} - AI response
 */
async function callDeepSeek(systemPrompt, userPrompt, options = {}) {
  if (!DEEPSEEK_CONFIG.API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured in .env');
  }
  
  const params = {
    model: DEEPSEEK_CONFIG.MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    ...DEEPSEEK_CONFIG.DEFAULT_PARAMS,
    ...options
  };
  
  let lastError;
  for (let attempt = 1; attempt <= DEEPSEEK_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        `${DEEPSEEK_CONFIG.BASE_URL}/chat/completions`,
        params,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_CONFIG.API_KEY}`
          },
          timeout: DEEPSEEK_CONFIG.TIMEOUT
        }
      );
      
      return response.data.choices[0].message.content.trim();
      
    } catch (error) {
      lastError = error;
      console.warn(`[DeepSeek] Attempt ${attempt}/${DEEPSEEK_CONFIG.MAX_RETRIES} failed:`, error.message);
      
      if (attempt < DEEPSEEK_CONFIG.MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, DEEPSEEK_CONFIG.RETRY_DELAY * attempt));
      }
    }
  }
  
  throw new Error(`DeepSeek API failed after ${DEEPSEEK_CONFIG.MAX_RETRIES} attempts: ${lastError.message}`);
}

/**
 * Call DeepSeek with structured JSON response
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - User message
 * @param {Object} options - Optional parameters
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function callDeepSeekJSON(systemPrompt, userPrompt, options = {}) {
  const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, just the JSON object.`;
  
  const response = await callDeepSeek(enhancedSystemPrompt, userPrompt, options);
  
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
    console.error('[DeepSeek] Failed to parse JSON response:', response);
    throw new Error(`DeepSeek returned invalid JSON: ${error.message}`);
  }
}

/**
 * Test DeepSeek connection
 * @returns {Promise<boolean>} - True if connection successful
 */
async function testConnection() {
  try {
    const response = await callDeepSeek(
      'You are a helpful assistant.',
      'Reply with a single word: OK',
      { max_tokens: 10 }
    );
    
    return response.toLowerCase().includes('ok');
  } catch (error) {
    console.error('[DeepSeek] Connection test failed:', error.message);
    return false;
  }
}

module.exports = {
  DEEPSEEK_CONFIG,
  callDeepSeek,
  callDeepSeekJSON,
  testConnection
};
