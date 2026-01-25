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
  console.log('[Curator] 🚀 INÍCIO - Curadoria de memória');
  console.log('[Curator] 📋 Entrada:', {
    category,
    contentLength: content?.length || 0,
    content: content?.substring(0, 100) + '...',
    context
  });
  
  // Step 1: Hard rules validation
  console.log('[Curator] 🔒 Step 1 - Validando conteúdo proibido...');
  const forbidden = hardRules.containsForbiddenContent(content);
  if (forbidden.found) {
    console.log('[Curator] ❌ REJEITADO - Conteúdo proibido detectado:', forbidden.type);
    return {
      accepted: false,
      reason: `Forbidden content detected: ${forbidden.type}`,
      content: null,
      impactScore: 0
    };
  }
  console.log('[Curator] ✅ Step 1 - Nenhum conteúdo proibido');

  // Step 2: Category validation
  console.log('[Curator] 📊 Step 2 - Validando categoria:', category);
  if (!Object.values(LTM_CATEGORIES).includes(category)) {
    console.log('[Curator] ❌ REJEITADO - Categoria inválida:', category);
    return {
      accepted: false,
      reason: `Invalid category: ${category}`,
      content: null,
      impactScore: 0
    };
  }
  console.log('[Curator] ✅ Step 2 - Categoria válida');

  // Step 3: Suitability check
  console.log('[Curator] ✅ Step 3 - Verificando adequação para LTM...');
  if (!hardRules.isSuitableForLTM(content)) {
    console.log('[Curator] ❌ REJEITADO - Conteúdo não adequado para LTM');
    return {
      accepted: false,
      reason: 'Content not suitable for long-term memory',
      content: null,
      impactScore: 0
    };
  }
  console.log('[Curator] ✅ Step 3 - Conteúdo adequado para LTM');

  // Step 4: Calculate impact score
  console.log('[Curator] 🎯 Step 4 - Calculando impact score...');
  const impactScore = await relevanceCalculator.calculate(content, {
    category,
    ...context
  });
  console.log('[Curator] 📊 Impact Score calculado:', impactScore.toFixed(2));

  if (impactScore < IMPACT_THRESHOLDS.MIN_FOR_LTM) {
    console.log('[Curator] ❌ REJEITADO - Impact score muito baixo:', {
      score: impactScore.toFixed(2),
      min: IMPACT_THRESHOLDS.MIN_FOR_LTM
    });
    return {
      accepted: false,
      reason: `Impact score too low: ${impactScore.toFixed(2)} < ${IMPACT_THRESHOLDS.MIN_FOR_LTM}`,
      content: null,
      impactScore
    };
  }
  console.log('[Curator] ✅ Step 4 - Impact score aceitável');

  // Step 5: Refine content (RULE-BASED, sem AI)
  console.log('[Curator] 🔧 Step 5 - Refinando conteúdo com regras...');
  let refinedContent = refineWithRules(content, category, impactScore);
  console.log('[Curator] ✅ Step 5 - Conteúdo refinado');
  console.log('[Curator] 📝 Antes:', content.substring(0, 100) + '...');
  console.log('[Curator] 📝 Depois:', refinedContent.substring(0, 100) + '...');

  // Step 6: Compress if too verbose
  const wordCount = refinedContent.split(/\s+/).length;
  console.log('[Curator] 📊 Step 6 - Verificando tamanho:', wordCount, 'palavras');
  if (wordCount > 60) {
    console.log('[Curator] ✏️ Step 6 - Comprimindo conteúdo (>60 palavras)...');
    try {
      refinedContent = await memoryCompressor.compress(refinedContent, { targetWords: 40 });
      console.log('[Curator] ✅ Conteúdo comprimido:', refinedContent.split(/\s+/).length, 'palavras');
    } catch (error) {
      console.warn('[Curator] ⚠️ Compressão falhou:', error.message);
    }
  } else {
    console.log('[Curator] ✅ Step 6 - Tamanho adequado, não precisa comprimir');
  }

  console.log('[Curator] ✅ FIM - Memória ACEITA');
  console.log('[Curator] 📊 Resultado final:', {
    accepted: true,
    impactScore: impactScore.toFixed(2),
    wordCount: refinedContent.split(/\s+/).length,
    content: refinedContent
  });

  return {
    accepted: true,
    reason: 'Memory accepted for LTM',
    content: refinedContent,
    impactScore
  };
}

/**
 * Refine content using RULE-BASED logic (substitui AI, zero custo)
 * @param {string} content - Original content
 * @param {string} category - Memory category
 * @param {number} impactScore - Impact score
 * @returns {string} - Refined content
 */
function refineWithRules(content, category, impactScore) {
  console.log('[Curator.Rules] 🔧 Refinando com lógica baseada em regras...');
  
  let refined = content;

  // 1. Remove ruído e redundâncias
  refined = refined
    .replace(/\b(muito|bastante|bem|super|mega)\s+/gi, '') // intensificadores desnecessários
    .replace(/\b(tipo|assim|né|sabe)\b/gi, '') // gírias
    .replace(/\s{2,}/g, ' ') // espaços duplos
    .trim();

  // 2. Padroniza valores monetários
  refined = refined.replace(/R\$\s*(\d+)[.,](\d+)/g, 'R$ $1.$2');
  refined = refined.replace(/reais/gi, 'R$');

  // 3. Remove timestamps se presentes (já temos metadata)
  refined = refined.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '');
  refined = refined.replace(/\d{2}\/\d{2}\/\d{4}/g, '');

  // 4. Extrai informação estrutural chave por categoria
  if (category === LTM_CATEGORIES.SITUACAO_FINANCEIRA) {
    // Mantém apenas: nome + valor + periodicidade
    const match = refined.match(/(\w+).*?(R\$\s*[\d.,]+).*?(mensal|anual|por mês|ao ano)?/i);
    if (match) {
      const name = match[1];
      const value = match[2];
      const period = match[3] || 'mensal';
      refined = `${name} possui renda de ${value} ${period}`;
    }
  }

  if (category === LTM_CATEGORIES.OBJETIVOS_METAS) {
    // Mantém: nome + objetivo + prazo
    const match = refined.match(/(\w+).*?(comprar|adquirir|juntar|economizar|investir).*?(\d+\s*(anos?|meses?))?/i);
    if (match) {
      const name = match[1];
      const goal = match[2];
      const timeframe = match[3] || 'futuro';
      refined = `${name} deseja ${goal} em ${timeframe}`;
    }
  }

  if (category === LTM_CATEGORIES.PERFIL_RISCO) {
    // Mantém: nome + perfil
    const match = refined.match(/(\w+).*?(conservador|moderado|arrojado|agressivo)/i);
    if (match) {
      refined = `${match[1]} possui perfil ${match[2].toLowerCase()}`;
    }
  }

  if (category === LTM_CATEGORIES.INVESTIMENTOS) {
    // Mantém: nome + tipo + valor
    const typeMatch = refined.match(/(CDB|tesouro|ações|fundos|LCI|LCA|poupança)/i);
    const valueMatch = refined.match(/R\$\s*[\d.,]+/);
    if (typeMatch) {
      const investment = typeMatch[0];
      const value = valueMatch ? valueMatch[0] : '';
      const nameMatch = refined.match(/^(\w+)/);
      const name = nameMatch ? nameMatch[1] : 'Usuário';
      refined = value 
        ? `${name} possui ${value} em ${investment}`
        : `${name} investe em ${investment}`;
    }
  }

  // 5. Capitaliza primeira letra
  refined = refined.charAt(0).toUpperCase() + refined.slice(1);

  // 6. Garante ponto final
  if (!/[.!?]$/.test(refined)) {
    refined += '.';
  }

  console.log('[Curator.Rules] ✅ Refinamento concluído');
  console.log('[Curator.Rules] 📊 Redução:', {
    antes: content.length,
    depois: refined.length,
    economia: `${(((content.length - refined.length) / content.length) * 100).toFixed(1)}%`
  });

  return refined;
}

/**
 * DEPRECATED: Refine content with AI (substituído por regras)
 * Mantido para rollback se necessário
 * @param {string} content - Original content
 * @param {string} category - Memory category
 * @param {number} impactScore - Impact score
 * @returns {Promise<string>} - Refined content
 */
async function refineWithLLM_DEPRECATED(content, category, impactScore) {
  console.log('[Curator.LLM] 🤖 Chamando OpenAI para refinamento...');
  console.log('[Curator.LLM] 📊 Parâmetros:', { category, impactScore: impactScore.toFixed(2) });
  
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

    console.log('[Curator.LLM] 📤 Enviando para OpenAI...');
    const refined = await callOpenAI(systemPrompt, userPrompt, {
      max_tokens: 200,
      temperature: 0.3 // Low temperature for consistency
    });

    console.log('[Curator.LLM] ✅ Resposta recebida da OpenAI');
    console.log('[Curator.LLM] 📊 Mudança de tamanho:', content.length, '→', refined.length, 'chars');
    console.log('[Curator.LLM] 📝 Conteúdo refinado:', refined);
    return refined;

  } catch (error) {
    console.error('[Curator.LLM] ❌ OpenAI refinement failed:', error.message);
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
