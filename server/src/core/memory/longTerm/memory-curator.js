/**
 * NOTE (memory-curator.js):
 * Purpose: Hybrid curation system (rules + OpenAI GPT-4.1 nano) to validate and refine memories for LTM storage.
 * Controls: Impact score >0.7 required, forbidden content blocked, category validation, content refinement.
 * Behavior: curate() → hard rules check → AI scoring → compress if needed → return curation result.
 * Integration notes: Uses hard-rules.js, memory-compressor.js, relevance-calculator.js, and OpenAI GPT-4.1 nano.
 */

const { getCategoryDefinition } = require('./category-definitions');

const hardRules = require('../shared/hard-rules');
const memoryCompressor = require('../shared/memory-compressor');
const relevanceCalculator = require('./relevance-calculator');
const { IMPACT_THRESHOLDS, LTM_CATEGORIES } = require('../shared/memory-types');
const { callOpenAI, callOpenAIJSON } = require('../../../config/openai-config');

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
  if (wordCount > 60) {
    try {
      refinedContent = await memoryCompressor.compress(refinedContent, { targetWords: 40 });
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
- Identify event date from context (or use today's date if unclear)
- Memory MUST start with "Em DD/MM/YYYY, " prefix
- Maximum 60 words (including date prefix)`;

    const userPrompt = `Refine this memory for long-term storage:

Category: ${category}
Impact Score: ${impactScore.toFixed(2)}
Original: ${content}

MANDATORY FORMAT:
- Start with "Em DD/MM/YYYY, " where date is the event date (extract from context or use today)
- Follow with refined content
- Total max 60 words

Return refined version:`;

    const refined = await callOpenAI(systemPrompt, userPrompt, {
      max_tokens: 200,
      temperature: 0.3 // Low temperature for consistency
    });

    console.log(`[Curator] Content refined from ${content.length} to ${refined.length} chars`);
    return refined;

  } catch (error) {
    console.error('[Curator] OpenAI refinement failed:', error.message);
    return content; // Fallback to original
  }
}

/**
 * Extract high-impact information from episodic memory using AI
 * @param {object} episodicData - Episodic memory data
 * @returns {Promise<Array>} - Candidate memories
 */
async function extractHighImpact(episodicData) {
  const { getCategoryDefinition, getAllCategories } = require('./category-definitions');
  const userName = episodicData.userName || 'Usuário';
  try {
     const systemPrompt = `Você é um extrator de memórias de longo prazo para sistema financeiro.
Analise a memória episódica e extraia informações de ALTO IMPACTO para armazenamento permanente.

IMPORTANTE: Use sempre o NOME DO USUÁRIO ao formular memórias.
NOME DO USUÁRIO: ${userName}

Ao formular memórias, sempre use "${userName}" ao invés de "o usuário" ou "ele/ela".

CATEGORIAS DISPONÍVEIS:
${getAllCategories().map(cat => {
  const def = getCategoryDefinition(cat);
  return `- ${cat}: ${def.description}`;
}).join('\n')}

Para cada informação valiosa encontrada:
1. Identifique a categoria mais apropriada
2. Formule a memória usando o NOME do usuário (${userName})
3. Seja específico com valores e datas
4. Avalie o impact score (0.0-1.0)

Extraia apenas informações que:
- Sejam duradouras e relevantes
- Tenham impacto em decisões futuras
- Sejam específicas e acionáveis
- Mereçam armazenamento permanente (score >= 0.7)`;

    const userPrompt = `Extract high-impact information from this episodic memory:

${JSON.stringify(episodicData, null, 2)}

Return JSON array of candidates com o nome "${userName}":
[
  {
    "content": "<extracted information usando '${userName}'>",
    "category": "<uma das categorias listadas acima>",
    "reasoning": "<why this is high-impact>"
  }
]`;

    const result = await callOpenAIJSON(systemPrompt, userPrompt, {
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
    // Map common episodic keys to the canonical LTM categories defined
    // in `shared/memory-types.js` / `category-definitions.js`.
    preferences: LTM_CATEGORIES.RELACAO_PLATAFORMA,
    goals: LTM_CATEGORIES.OBJETIVOS_METAS,
    patterns: LTM_CATEGORIES.COMPORTAMENTO_GASTOS,
    decisions: LTM_CATEGORIES.PLANEJAMENTO_FUTURO,
    learnings: LTM_CATEGORIES.CONHECIMENTO_FINANCEIRO
  };

  // Default to a safe, broad category for generic preferences
  return mapping[key] || LTM_CATEGORIES.RELACAO_PLATAFORMA;
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
