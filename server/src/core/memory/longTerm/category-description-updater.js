/**
 * NOTE (category-description-updater.js):
 * Purpose: Updates dynamic category descriptions using OpenAI GPT-4.1 nano.
 * Controls: 25-word limit, no dates, no detailed values, considers all memories in category.
 * Behavior: Analyzes category memories → generates descriptive summary → stores in categoryDescriptions.
 * Integration notes: Called by long-term-memory.js after successful propose().
 */

const { callOpenAI } = require('../../../config/openai-config');
const { countWords, truncateToWords } = require('./memory-utils');

/**
 * Update category description using OpenAI GPT-4.1 nano
 * Generates a concise 25-word summary of the category based on all memories.
 * 
 * @param {Array<object>} categoryMemories - All memories in this category
 * @param {string} category - Category name
 * @returns {Promise<string>} - Generated description (max 25 words)
 */
async function updateCategoryDescription(categoryMemories, category) {
  if (!categoryMemories || categoryMemories.length === 0) {
    return '';
  }

  // Build prompt for OpenAI
  const memoriesText = categoryMemories
    .map((mem, idx) => `${idx + 1}. ${mem.content}`)
    .join('\n');

  const systemPrompt = 'Você é um assistente financeiro que cria descrições concisas de perfil. Siga EXATAMENTE as regras fornecidas.';

  const userPrompt = `Você é um assistente financeiro especializado em criar descrições concisas de perfil.

CATEGORIA: ${category}

MEMÓRIAS NA CATEGORIA:
${memoriesText}

TAREFA:
Crie uma descrição de NO MÁXIMO 25 PALAVRAS que resuma o perfil do usuário nesta categoria.

REGRAS OBRIGATÓRIAS:
1. Máximo 25 palavras (CRÍTICO - será truncado se exceder)
2. SEM datas específicas (nem DD/MM/YYYY, nem "em janeiro", nem "desde 2024")
3. SEM valores monetários detalhados (use "portfólio significativo" ao invés de "R$ 85k")
4. SEM nomes de ativos específicos (use "renda fixa" ao invés de "Tesouro Selic")
5. Foco em PADRÕES e CARACTERÍSTICAS gerais
6. Linguagem objetiva e profissional
7. Terceira pessoa (sem usar "o usuário")

EXEMPLOS DE BOAS DESCRIÇÕES:
- "Investidor conservador com portfólio diversificado em renda fixa, prioriza liquidez e segurança"
- "Perfil moderado, aceita volatilidade de curto prazo, busca crescimento de longo prazo"
- "Comportamento de gastos controlado, identifica e corrige excessos, planejamento mensal rigoroso"

EXEMPLOS DE MÁS DESCRIÇÕES (NÃO FAÇA ASSIM):
- "Em 15/01/2025, investiu R$ 85.000 em Tesouro Selic" (tem data, valor exato, ativo específico)
- "Gasta R$ 800 mensais com delivery desde novembro" (tem valor exato e data)
- "O usuário prefere investimentos seguros" (usa "o usuário", muito genérico)

RETORNE APENAS A DESCRIÇÃO, SEM EXPLICAÇÕES OU FORMATAÇÃO ADICIONAL.`;

  try {
    let description = await callOpenAI(systemPrompt, userPrompt, {
      temperature: 0.3, // Lower temperature for more consistent outputs
      max_tokens: 150
    });
    
    // Remove aspas se houver
    description = description.replace(/^["']|["']$/g, '');
    
    // Enforce 25-word limit (hard truncation if exceeds)
    const wordCount = countWords(description);
    if (wordCount > 25) {
      console.warn(`[CategoryDescription] Description exceeded 25 words (${wordCount}), truncating...`);
      description = truncateToWords(description, 25);
    }

    return description;

  } catch (error) {
    console.error('[CategoryDescription] Error generating description:', error.message);
    
    // Fallback: return generic description based on category
    const fallbackDescriptions = {
      'perfil_profissional': 'Perfil profissional em análise',
      'situacao_financeira': 'Situação financeira em avaliação',
      'investimentos': 'Portfólio de investimentos em construção',
      'objetivos_metas': 'Objetivos financeiros sendo definidos',
      'comportamento_gastos': 'Padrões de gastos em observação',
      'perfil_risco': 'Perfil de risco em análise',
      'conhecimento_financeiro': 'Nível de conhecimento sendo avaliado',
      'planejamento_futuro': 'Planos futuros em desenvolvimento',
      'familia_dependentes': 'Contexto familiar em análise',
      'relacao_plataforma': 'Relação com plataforma sendo estabelecida'
    };

    return fallbackDescriptions[category] || 'Categoria em análise';
  }
}

/**
 * Check if category description needs update
 * Updates if:
 * - Description is empty
 * - More than 5 new memories since last update
 * - More than 7 days since last update
 * 
 * @param {object} categoryDescriptionData - Current description data from schema
 * @param {number} memoriesCount - Current number of memories in category
 * @returns {boolean} - True if update is needed
 */
function shouldUpdateDescription(categoryDescriptionData, memoriesCount) {
  // Always update if empty
  if (!categoryDescriptionData || !categoryDescriptionData.description) {
    return true;
  }

  // Update every 5 new memories
  if (memoriesCount % 5 === 0 && memoriesCount > 0) {
    return true;
  }

  // Update if more than 7 days since last update
  if (categoryDescriptionData.lastUpdated) {
    const daysSinceUpdate = (Date.now() - categoryDescriptionData.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 7) {
      return true;
    }
  }

  return false;
}

module.exports = {
  updateCategoryDescription,
  shouldUpdateDescription
};
