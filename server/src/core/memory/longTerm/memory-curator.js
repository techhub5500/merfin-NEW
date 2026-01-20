/**
 * NOTE (memory-curator.js):
 * Purpose: Hybrid curation system (rules + DeepSeek AI) to validate and refine memories for LTM storage.
 * Controls: Impact score >0.7 required, forbidden content blocked, category validation, content refinement.
 * Behavior: curate() → hard rules check → AI scoring → compress if needed → return curation result.
 * Integration notes: Uses hard-rules.js, memory-compressor.js, relevance-calculator.js, and DeepSeek v3.
 */

const hardRules = require('../shared/hard-rules');
const memoryCompressor = require('../shared/memory-compressor');
const relevanceCalculator = require('./relevance-calculator');
const { IMPACT_THRESHOLDS, LTM_CATEGORIES } = require('../shared/memory-types');
const { callDeepSeek, callDeepSeekJSON } = require('../../../config/deepseek-config');

/**
 * Curate memory for LTM storage
 * @param {string} content - Memory content
 * @param {string} category - Memory category
 * @param {object} context - Additional context
 * @returns {Promise<object>} - Curation result
 */
async function curate(content, category, context = {}) {
  // Step 1: Hard rules validation
  const forbidden = hardRules.containsForbiddenContent(content);
  if (forbidden.found) {
    return {
      accepted: false,
      reason: `Forbidden content detected: ${forbidden.type}`,
      content: null,
      impactScore: 0
    };
  }

  // Step 2: Category validation
  if (!Object.values(LTM_CATEGORIES).includes(category)) {
    return {
      accepted: false,
      reason: `Invalid category: ${category}`,
      content: null,
      impactScore: 0
    };
  }

  // Step 3: Suitability check
  if (!hardRules.isSuitableForLTM(content)) {
    return {
      accepted: false,
      reason: 'Content not suitable for long-term memory',
      content: null,
      impactScore: 0
    };
  }

  // Step 4: Calculate impact score
  const impactScore = await relevanceCalculator.calculate(content, {
    category,
    ...context
  });

  if (impactScore < IMPACT_THRESHOLDS.MIN_FOR_LTM) {
    return {
      accepted: false,
      reason: `Impact score too low: ${impactScore.toFixed(2)} < ${IMPACT_THRESHOLDS.MIN_FOR_LTM}`,
      content: null,
      impactScore
    };
  }

  // Step 5: Refine content with LLM
  let refinedContent = content;
  
  try {
    refinedContent = await refineWithLLM(content, category, impactScore);
  } catch (error) {
    console.warn('[Curator] LLM refinement failed, using original content:', error.message);
  }

  // Step 6: Compress if too verbose
  const wordCount = refinedContent.split(/\s+/).length;
  if (wordCount > 100) {
    try {
      refinedContent = await memoryCompressor.compress(refinedContent, { targetWords: 80 });
    } catch (error) {
      console.warn('[Curator] Compression failed:', error.message);
    }
  }

  return {
    accepted: true,
    reason: 'Memory accepted for LTM',
    content: refinedContent,
    impactScore
  };
}

/**
 * Refine content with DeepSeek AI
 * @param {string} content - Original content
 * @param {string} category - Memory category
 * @param {number} impactScore - Impact score
 * @returns {Promise<string>} - Refined content
 */
async function refineWithLLM(content, category, impactScore) {
  try {
    const systemPrompt = `You are a memory curator for a financial investment system.
Refine memories for long-term storage by keeping only the most essential and impactful information.

Guidelines:
- Preserve key facts, preferences, and strategic information
- Remove noise, redundancy, and temporary details
- Keep actionable insights and patterns
- Maintain clarity and specificity
- Maximum 100 words`;

    const userPrompt = `Refine this memory for long-term storage:

Category: ${category}
Impact Score: ${impactScore.toFixed(2)}
Original: ${content}

Return refined version (max 100 words):`;

    const refined = await callDeepSeek(systemPrompt, userPrompt, {
      max_tokens: 200,
      temperature: 0.3 // Low temperature for consistency
    });

    console.log(`[Curator] Content refined from ${content.length} to ${refined.length} chars`);
    return refined;

  } catch (error) {
    console.error('[Curator] DeepSeek refinement failed:', error.message);
    return content; // Fallback to original
  }
}

/**
 * Extract high-impact information from episodic memory using AI
 * @param {object} episodicData - Episodic memory data
 * @returns {Promise<Array>} - Candidate memories
 */
async function extractHighImpact(episodicData) {
  try {
    const systemPrompt = `You are a memory extraction AI for a financial investment system.
Analyze episodic memory data and extract high-impact information worthy of permanent storage.

Look for:
- User preferences and risk tolerance
- Strategic goals and financial objectives
- Recurring behavioral patterns
- Important investment decisions
- Valuable domain knowledge and insights

Return structured candidates for long-term memory.`;

    const userPrompt = `Extract high-impact information from this episodic memory:

${JSON.stringify(episodicData, null, 2)}

Return JSON array of candidates:
[
  {
    "content": "<extracted information>",
    "category": "<one of: user_preferences, strategic_goals, behavior_patterns, critical_decisions, domain_knowledge>",
    "reasoning": "<why this is high-impact>"
  }
]`;

    const result = await callDeepSeekJSON(systemPrompt, userPrompt, {
      max_tokens: 800,
      temperature: 0.4
    });

    const candidates = [];

    // Validate and score each candidate
    for (const candidate of (result || [])) {
      const { content, category, reasoning } = candidate;
      
      if (!content || !category) continue;

      const impactScore = await relevanceCalculator.calculate(content, { 
        source: 'episodic',
        category 
      });

      if (impactScore >= IMPACT_THRESHOLDS.MIN_FOR_LTM) {
        candidates.push({
          content,
          category,
          impactScore,
          reasoning
        });
        console.log(`[Curator] Extracted candidate (score ${impactScore.toFixed(2)}): ${reasoning}`);
      }
    }

    return candidates;

  } catch (error) {
    console.error('[Curator] AI extraction failed, using fallback:', error.message);
    return extractHighImpactFallback(episodicData);
  }
}

/**
 * Fallback extraction using simple heuristics
 * @param {object} episodicData - Episodic memory data
 * @returns {Promise<Array>} - Candidate memories
 */
async function extractHighImpactFallback(episodicData) {
  const candidates = [];

  if (typeof episodicData === 'object') {
    const keys = ['preferences', 'goals', 'patterns', 'decisions', 'learnings'];
    
    for (const key of keys) {
      if (episodicData[key]) {
        const content = typeof episodicData[key] === 'string' 
          ? episodicData[key] 
          : JSON.stringify(episodicData[key]);

        const impactScore = await relevanceCalculator.calculate(content, { source: 'episodic' });
        
        if (impactScore >= IMPACT_THRESHOLDS.MIN_FOR_LTM) {
          candidates.push({
            content,
            category: mapKeyToCategory(key),
            impactScore
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Map episodic key to LTM category
 * @param {string} key - Episodic key
 * @returns {string} - LTM category
 */
function mapKeyToCategory(key) {
  const mapping = {
    preferences: LTM_CATEGORIES.USER_PREFERENCES,
    goals: LTM_CATEGORIES.STRATEGIC_GOALS,
    patterns: LTM_CATEGORIES.BEHAVIOR_PATTERNS,
    decisions: LTM_CATEGORIES.CRITICAL_DECISIONS,
    learnings: LTM_CATEGORIES.DOMAIN_KNOWLEDGE
  };

  return mapping[key] || LTM_CATEGORIES.USER_PREFERENCES;
}

/**
 * Batch curate multiple memories
 * @param {Array} memories - Array of {content, category, context}
 * @returns {Promise<Array>} - Curation results
 */
async function batchCurate(memories) {
  const results = [];

  for (const memory of memories) {
    const result = await curate(memory.content, memory.category, memory.context);
    results.push({
      ...memory,
      curationResult: result
    });
  }

  return results;
}

module.exports = {
  curate,
  extractHighImpact,
  batchCurate
};
