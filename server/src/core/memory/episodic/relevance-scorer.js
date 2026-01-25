/**
 * NOTE (relevance-scorer.js):
 * Purpose: Score relevance of information in episodic memory using OpenAI GPT-4.1 nano.
 * Controls: AI-driven scoring to evaluate importance and relevance of memory fragments.
 * Integration notes: Used by compression-engine to prioritize important information.
 * Uses OpenAI GPT-4.1 nano for cost-effective reasoning.
 */

const { callOpenAIJSON } = require('../../../config/openai-config');

/**
 * Score relevance of a memory fragment using OpenAI GPT-4.1 nano
 * @param {string} fragment - Text fragment to score
 * @param {object} context - Scoring context
 * @param {string[]} context.keywords - Important keywords
 * @param {number} context.recency - Recency weight (0-1)
 * @param {string} context.chatContext - Optional chat context
 * @returns {Promise<number>} - Relevance score (0-1)
 */
async function scoreFragment(fragment, context = {}) {
  const { keywords = [], recency = 0.5, chatContext = '' } = context;
  
  const systemPrompt = `You are a memory relevance analyzer for a financial investment system.
Evaluate how relevant and important a memory fragment is for future reference.

Consider:
1. Strategic value - Does it contain investment strategies, patterns, or decisions?
2. Specificity - Is it concrete and actionable vs generic?
3. Uniqueness - Is this unique user behavior or common information?
4. Future utility - Will this be useful in future conversations?
5. Recency context - Recent information has weight of ${recency}`;

  const userPrompt = `Score this memory fragment's relevance (0.0 to 1.0):

Fragment: "${fragment}"

Keywords to consider: ${keywords.join(', ') || 'none'}
Chat context: ${chatContext || 'none'}

Return JSON with:
{
  "score": <number 0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;

  try {
    const result = await callOpenAIJSON(systemPrompt, userPrompt, { max_tokens: 200 });
    
    // Validate score
    const score = Math.max(0, Math.min(1, result.score || 0));
    console.log(`[RelevanceScorer] Fragment score: ${score} - ${result.reasoning}`);
    
    return score;
    
  } catch (error) {
    console.error('[RelevanceScorer] AI scoring failed, using fallback:', error.message);
    
    // Fallback: simple keyword matching
    let score = 0.3;
    if (keywords.length > 0) {
      const lowerFragment = fragment.toLowerCase();
      const matchCount = keywords.filter(kw => lowerFragment.includes(kw.toLowerCase())).length;
      score += (matchCount / keywords.length) * 0.4;
    }
    score += recency * 0.3;
    return Math.min(1.0, score);
  }
}

/**
 * Prioritize information in memory for compression using AI
 * @param {object} memory - Memory object with multiple fields
 * @param {number} targetCount - Target number of items to keep
 * @param {string} chatContext - Chat context for prioritization
 * @returns {Promise<object>} - Prioritized memory
 */
async function prioritizeInformation(memory, targetCount, chatContext = '') {
  if (!memory || typeof memory !== 'object') return memory;
  
  const systemPrompt = `You are a memory prioritization system for financial investments.
Given a memory object, identify which pieces of information are most valuable to keep.

Prioritize:
- Investment strategies and patterns
- User preferences and risk tolerance
- Important financial decisions
- Unique behavioral patterns`;

  const userPrompt = `Prioritize this memory data. Keep only the ${targetCount} most important items.

Memory data: ${JSON.stringify(memory, null, 2)}
Context: ${chatContext}

Return JSON with:
{
  "prioritized": { <same structure with only important items> },
  "reasoning": "<brief explanation of what was kept>"
}`;

  try {
    const result = await callOpenAIJSON(systemPrompt, userPrompt, { max_tokens: 500 });
    console.log(`[RelevanceScorer] Prioritization: ${result.reasoning}`);
    return result.prioritized || memory;
    
  } catch (error) {
    console.error('[RelevanceScorer] AI prioritization failed, using fallback:', error.message);
    return memory; // Fallback: keep everything
  }
}

module.exports = {
  scoreFragment,
  prioritizeInformation
};
