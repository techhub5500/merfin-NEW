/**
 * NOTE (relevance-calculator.js):
 * Purpose: Calculate impact scores (0-1) for memories using DeepSeek AI reasoning.
 * Controls: AI-driven evaluation of recurrence, structurality, durability, specificity, actionability.
 * Behavior: calculate() → AI analyzes content → returns weighted impact score → normalize to 0-1.
 * Integration notes: Used by memory-curator.js for LTM admission decisions (threshold >0.7).
 * Uses DeepSeek v3 for cost-effective reasoning.
 */

const { callDeepSeekJSON } = require('../../../config/deepseek-config');

/**
 * Calculate impact score for memory content using DeepSeek AI
 * @param {string} content - Memory content
 * @param {object} context - Context data (accessCount, sourceChats, mentionCount, etc.)
 * @returns {Promise<number>} - Impact score (0-1)
 */
async function calculate(content, context = {}) {
  const { 
    accessCount = 0, 
    sourceChats = [], 
    mentionCount = 1,
    category = '',
    timestamp = Date.now()
  } = context;

  const systemPrompt = `You are a memory impact evaluator for a financial investment system.
Analyze memory content and calculate an impact score (0.0 to 1.0) based on these factors:

1. RECURRENCE (25%): How often is this mentioned or accessed? Is it a recurring theme?
2. STRUCTURALITY (30%): Does it impact finances, decisions, or strategies significantly?
3. DURABILITY (20%): Is this long-term relevant or temporary/ephemeral?
4. SPECIFICITY (15%): Is it concrete and specific vs vague and generic?
5. ACTIONABILITY (10%): Can this information lead to concrete actions?

Higher scores (>0.7) indicate memories worthy of permanent long-term storage.
Lower scores (<0.5) indicate disposable or low-value information.`;

  const userPrompt = `Evaluate this memory for long-term storage:

Content: "${content}"

Context:
- Access count: ${accessCount}
- Mentioned in ${sourceChats.length} different chats
- Total mentions: ${mentionCount}
- Category: ${category || 'general'}
- Age: ${Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))} days old

Analyze each factor and return JSON:
{
  "factors": {
    "recurrence": <0.0-1.0>,
    "structurality": <0.0-1.0>,
    "durability": <0.0-1.0>,
    "specificity": <0.0-1.0>,
    "actionability": <0.0-1.0>
  },
  "overallScore": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;

  try {
    const result = await callDeepSeekJSON(systemPrompt, userPrompt, { max_tokens: 400 });
    
    // Validate and calculate weighted score
    const factors = result.factors || {};
    const weights = {
      recurrence: 0.25,
      structurality: 0.30,
      durability: 0.20,
      specificity: 0.15,
      actionability: 0.10
    };

    let calculatedScore = 0;
    for (const [factor, weight] of Object.entries(weights)) {
      const value = Math.max(0, Math.min(1, factors[factor] || 0));
      calculatedScore += value * weight;
    }

    // Normalize
    const finalScore = Math.max(0, Math.min(1, calculatedScore));
    
    console.log(`[RelevanceCalculator] Impact score: ${finalScore.toFixed(3)} - ${result.reasoning}`);
    console.log(`[RelevanceCalculator] Factors:`, factors);
    
    return finalScore;
    
  } catch (error) {
    console.error('[RelevanceCalculator] AI scoring failed, using fallback:', error.message);
    
    // Fallback: simple algorithmic scoring
    return calculateFallback(content, context);
  }
}

/**
 * Fallback algorithmic scoring when AI is unavailable
 * @param {string} content - Memory content
 * @param {object} context - Context data
 * @returns {number} - Impact score (0-1)
 */
function calculateFallback(content, context) {
  const { accessCount = 0, sourceChats = [], mentionCount = 1 } = context;
  const lowerContent = content.toLowerCase();

  // Simple keyword-based scoring
  const highImpactKeywords = [
    'objetivo', 'meta', 'estratégia', 'investimento', 'dívida', 'receita',
    'goal', 'strategy', 'investment', 'debt', 'income', 'preferência', 'preference'
  ];

  const durableKeywords = ['sempre', 'nunca', 'prefiro', 'always', 'never', 'prefer', 'longo prazo'];

  let keywordScore = 0;
  for (const keyword of highImpactKeywords) {
    if (lowerContent.includes(keyword)) keywordScore += 0.15;
  }
  for (const keyword of durableKeywords) {
    if (lowerContent.includes(keyword)) keywordScore += 0.1;
  }

  const accessScore = Math.min(0.3, accessCount / 10 * 0.3);
  const chatScore = Math.min(0.2, sourceChats.length / 5 * 0.2);
  const mentionScore = Math.min(0.1, mentionCount / 3 * 0.1);

  return Math.min(1, Math.max(0, keywordScore + accessScore + chatScore + mentionScore + 0.2));
}

module.exports = {
  calculate,
  calculateFallback
};

/**
 * Calculate recurrence factor
 * @param {string} content - Memory content
 * @param {object} context - Context data
 * @returns {number} - Score (0-1)
 */
function calculateRecurrence(content, context) {
  const { accessCount = 0, sourceChats = [], mentionCount = 1 } = context;

  // More access = higher recurrence
  const accessScore = Math.min(1, accessCount / 10);
  
  // More source chats = mentioned across conversations
  const chatScore = Math.min(1, sourceChats.length / 5);
  
  // Explicit mention count
  const mentionScore = Math.min(1, mentionCount / 3);

  return (accessScore + chatScore + mentionScore) / 3;
}

/**
 * Calculate structurality factor (impact on finances/decisions)
 * @param {string} content - Memory content
 * @param {object} context - Context data
 * @returns {number} - Score (0-1)
 */
function calculateStructurality(content, context) {
  const lowerContent = content.toLowerCase();

  // Keywords indicating high structural impact
  const highImpactKeywords = [
    'objetivo', 'meta', 'estratégia', 'plano', 'investimento', 'dívida',
    'receita', 'despesa', 'ativo', 'patrimônio', 'orçamento', 'poupança',
    'goal', 'strategy', 'plan', 'investment', 'debt', 'income', 'expense',
    'asset', 'budget', 'savings', 'decisão', 'decision', 'preferência', 'preference'
  ];

  // Keywords indicating financial amounts (high impact)
  const financialKeywords = ['R$', '$', 'reais', 'dólares', 'mil', 'milhão'];

  let keywordCount = 0;
  for (const keyword of highImpactKeywords) {
    if (lowerContent.includes(keyword)) {
      keywordCount++;
    }
  }

  let financialCount = 0;
  for (const keyword of financialKeywords) {
    if (lowerContent.includes(keyword)) {
      financialCount++;
    }
  }

  // Score based on keyword density
  const keywordScore = Math.min(1, keywordCount / 3);
  const financialScore = Math.min(1, financialCount / 2);

  return (keywordScore * 0.6) + (financialScore * 0.4);
}

/**
 * Calculate durability factor (long-term relevance)
 * @param {string} content - Memory content
 * @param {object} context - Context data
 * @returns {number} - Score (0-1)
 */
function calculateDurability(content, context) {
  const lowerContent = content.toLowerCase();

  // Durable patterns (persistent preferences/behaviors)
  const durableKeywords = [
    'sempre', 'nunca', 'prefiro', 'evito', 'costumo', 'hábito', 'rotina',
    'always', 'never', 'prefer', 'avoid', 'usually', 'habit', 'routine',
    'longo prazo', 'long term', 'permanente', 'permanent', 'valores', 'values'
  ];

  // Temporary/ephemeral indicators (low durability)
  const temporaryKeywords = [
    'hoje', 'agora', 'momento', 'temporário', 'provisório',
    'today', 'now', 'moment', 'temporary', 'provisional'
  ];

  let durableCount = 0;
  for (const keyword of durableKeywords) {
    if (lowerContent.includes(keyword)) {
      durableCount++;
    }
  }

  let temporaryCount = 0;
  for (const keyword of temporaryKeywords) {
    if (lowerContent.includes(keyword)) {
      temporaryCount++;
    }
  }

  const durableScore = Math.min(1, durableCount / 2);
  const temporaryPenalty = Math.min(0.5, temporaryCount / 2);

  return Math.max(0, durableScore - temporaryPenalty + 0.3); // Base 0.3 for neutral
}

/**
 * Calculate specificity factor (concrete vs vague)
 * @param {string} content - Memory content
 * @param {object} context - Context data
 * @returns {number} - Score (0-1)
 */
function calculateSpecificity(content, context) {
  // Check for concrete details
  const hasNumbers = /\d+/.test(content);
  const hasPercentage = /%/.test(content);
  const hasCurrency = /R\$|\$/.test(content);
  const hasDate = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/.test(content);
  
  // Vague words reduce specificity
  const vagueWords = ['talvez', 'provavelmente', 'mais ou menos', 'algum', 'maybe', 'probably', 'some'];
  const lowerContent = content.toLowerCase();
  let vagueCount = 0;
  for (const word of vagueWords) {
    if (lowerContent.includes(word)) {
      vagueCount++;
    }
  }

  let score = 0.3; // Base score
  if (hasNumbers) score += 0.2;
  if (hasPercentage) score += 0.15;
  if (hasCurrency) score += 0.2;
  if (hasDate) score += 0.15;
  
  const vaguePenalty = Math.min(0.3, vagueCount * 0.1);
  
  return Math.max(0, Math.min(1, score - vaguePenalty));
}

/**
 * Calculate actionability factor (can be acted upon)
 * @param {string} content - Memory content
 * @param {object} context - Context data
 * @returns {number} - Score (0-1)
 */
function calculateActionability(content, context) {
  const lowerContent = content.toLowerCase();

  // Action verbs
  const actionVerbs = [
    'fazer', 'criar', 'investir', 'poupar', 'pagar', 'comprar', 'vender',
    'do', 'make', 'create', 'invest', 'save', 'pay', 'buy', 'sell',
    'evitar', 'avoid', 'começar', 'start', 'parar', 'stop'
  ];

  // Conditional/planning words
  const planningWords = [
    'quando', 'se', 'caso', 'plano', 'estratégia', 'objetivo',
    'when', 'if', 'in case', 'plan', 'strategy', 'goal'
  ];

  let actionCount = 0;
  for (const verb of actionVerbs) {
    if (lowerContent.includes(verb)) {
      actionCount++;
    }
  }

  let planningCount = 0;
  for (const word of planningWords) {
    if (lowerContent.includes(word)) {
      planningCount++;
    }
  }

  const actionScore = Math.min(0.7, actionCount / 2 * 0.7);
  const planningScore = Math.min(0.3, planningCount / 2 * 0.3);

  return actionScore + planningScore;
}

/**
 * Get detailed impact breakdown
 * @param {string} content - Memory content
 * @param {object} context - Context data
 * @returns {Promise<object>} - Score with breakdown
 */
async function calculateDetailed(content, context = {}) {
  const factors = {
    recurrence: calculateRecurrence(content, context),
    structurality: calculateStructurality(content, context),
    durability: calculateDurability(content, context),
    specificity: calculateSpecificity(content, context),
    actionability: calculateActionability(content, context)
  };

  const weights = {
    recurrence: 0.25,
    structurality: 0.30,
    durability: 0.20,
    specificity: 0.15,
    actionability: 0.10
  };

  let total = 0;
  const weighted = {};
  for (const [factor, value] of Object.entries(factors)) {
    const contribution = value * weights[factor];
    weighted[factor] = contribution;
    total += contribution;
  }

  return {
    total: Math.max(0, Math.min(1, total)),
    factors,
    weights,
    weighted
  };
}

module.exports = {
  calculate,
  calculateDetailed
};
