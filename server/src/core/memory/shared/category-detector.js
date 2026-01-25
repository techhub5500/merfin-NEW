/**
 * NOTE (category-detector.js):
 * Purpose: Sistema inteligente de detecção de categorias usando scoring baseado em regras
 * Controls: Detectores por categoria com keywords, entidades, intenção e contexto
 * Behavior: Cada categoria recebe score; top 3 são selecionadas
 * Integration notes: Substitui IA 100%, zero custo, zero latência, alta qualidade
 */

const { LTM_CATEGORIES } = require('./memory-types');

/**
 * Detectores de categoria - cada categoria tem seu próprio detector
 * Estrutura: {
 *   keywords: palavras-chave principais
 *   weight_multipliers: { position_verb: X, position_noun: Y }
 *   entities: entidades esperadas (números, moedas, etc)
 *   intent_patterns: padrões de intenção do usuário
 * }
 */
const CATEGORY_DETECTORS = {
  
  [LTM_CATEGORIES.SITUACAO_FINANCEIRA]: {
    // Palavras principais (peso base: 1.0)
    keywords: {
      high: ['renda', 'salário', 'ganho', 'patrimônio', 'capital', 'receita'],
      medium: ['mensal', 'anual', 'liquido', 'bruto', 'income'],
      low: ['dinheiro', 'valores', 'financeiro']
    },
    // Multiplicadores de peso
    weights: {
      verb_position: 2.0,    // "ganho R$ 5000" - verbo principal
      noun_subject: 1.8,     // "minha renda é"
      numeric_present: 1.5,  // contém números/moeda
      explicit_amount: 2.5   // valor explícito de renda/patrimônio
    },
    // Entidades esperadas
    entities: ['R$', 'reais', /\d+[.,]\d+/, /\d{3,}/],
    // Padrões de intenção
    intent_patterns: [
      /(minha|meu|tenho).*(renda|salário|ganho)/i,
      /(ganho|recebo|renda).*R?\$?\s*\d+/i,
      /patrimônio.*R?\$/i
    ]
  },

  [LTM_CATEGORIES.INVESTIMENTOS]: {
    keywords: {
      high: ['investimento', 'aplicação', 'portfólio', 'carteira', 'ações', 'fundos'],
      medium: ['CDB', 'tesouro', 'LCI', 'LCA', 'renda fixa', 'variável'],
      low: ['investir', 'aplicar', 'render']
    },
    weights: {
      verb_position: 1.8,
      noun_subject: 2.0,
      numeric_present: 1.6,
      explicit_asset: 2.2  // menciona ativo específico
    },
    entities: ['R$', 'reais', '%', 'porcentagem'],
    intent_patterns: [
      /invisto.*em/i,
      /tenho.*(investimento|aplicação)/i,
      /(CDB|tesouro|ações|fundos)/i,
      /carteira.*investimento/i
    ]
  },

  [LTM_CATEGORIES.OBJETIVOS_METAS]: {
    keywords: {
      high: ['objetivo', 'meta', 'sonho', 'plano', 'quero', 'pretendo'],
      medium: ['futuro', 'longo prazo', 'curto prazo', 'anos'],
      low: ['desejo', 'gostaria']
    },
    weights: {
      verb_position: 2.2,    // "quero comprar casa"
      temporal_reference: 2.0, // "em 5 anos"
      explicit_goal: 2.5,    // "objetivo é comprar X"
      numeric_present: 1.4
    },
    entities: ['anos', 'meses', /\d+\s*(anos?|meses?)/],
    intent_patterns: [
      /(objetivo|meta).*é/i,
      /quero.*(comprar|adquirir|ter)/i,
      /pretendo.*em\s*\d+/i,
      /sonho.*é/i
    ]
  },

  [LTM_CATEGORIES.DIVIDAS_OBRIGACOES]: {
    keywords: {
      high: ['dívida', 'devo', 'parcela', 'empréstimo', 'financiamento'],
      medium: ['cartão', 'crédito', 'juros', 'pagar'],
      low: ['débito', 'conta', 'boleto']
    },
    weights: {
      verb_position: 2.0,
      negative_connotation: 1.8,  // "preciso pagar"
      numeric_present: 1.7,
      explicit_debt: 2.3
    },
    entities: ['R$', 'parcelas', /\d+x/],
    intent_patterns: [
      /(devo|dívida).*R?\$/i,
      /parcela.*\d+/i,
      /financiamento/i,
      /empréstimo/i
    ]
  },

  [LTM_CATEGORIES.PERFIL_RISCO]: {
    keywords: {
      high: ['conservador', 'moderado', 'arrojado', 'agressivo', 'perfil'],
      medium: ['risco', 'segurança', 'volatilidade'],
      low: ['preferência', 'estilo']
    },
    weights: {
      explicit_profile: 3.0,     // "sou conservador"
      preference_stated: 2.5,   // "prefiro segurança"
      risk_reference: 2.0
    },
    entities: [],
    intent_patterns: [
      /sou.*(conservador|moderado|arrojado)/i,
      /perfil.*(conservador|moderado|arrojado)/i,
      /prefiro.*(segurança|risco|volatilidade)/i,
      /evito.*risco/i
    ]
  },

  [LTM_CATEGORIES.HABITOS_GASTOS]: {
    keywords: {
      high: ['gasto', 'compro', 'consumo', 'pago'],
      medium: ['mensalmente', 'por mês', 'todo mês'],
      low: ['compras', 'despesas']
    },
    weights: {
      verb_position: 1.8,
      recurring_pattern: 2.2,    // "sempre compro", "todo mês"
      numeric_present: 1.5,
      category_specific: 1.9     // categoria específica (alimentação, transporte)
    },
    entities: ['R$', 'reais'],
    intent_patterns: [
      /gasto.*R?\$.*com/i,
      /compro.*todo/i,
      /pago.*por mês/i,
      /consumo.*em/i
    ]
  },

  [LTM_CATEGORIES.PERFIL_PROFISSIONAL]: {
    keywords: {
      high: ['profissão', 'trabalho', 'emprego', 'carreira', 'área'],
      medium: ['empresa', 'cargo', 'setor', 'indústria'],
      low: ['atuação', 'atividade']
    },
    weights: {
      explicit_profession: 3.0,  // "sou engenheiro"
      job_title: 2.5,           // profissões específicas
      company_reference: 1.5
    },
    entities: [],
    intent_patterns: [
      /sou\s+(engenheiro|médico|professor|desenvolvedor|analista|gerente)/i,
      /trabalho\s+(como|de|na área)/i,
      /minha profissão/i,
      /atuo\s+(como|na)/i
    ]
  },

  [LTM_CATEGORIES.CONTEXTO_FAMILIAR]: {
    keywords: {
      high: ['família', 'filhos', 'casado', 'solteiro', 'dependentes'],
      medium: ['esposa', 'marido', 'pai', 'mãe', 'criança'],
      low: ['relacionamento', 'casa']
    },
    weights: {
      family_structure: 2.5,     // "sou casado", "tenho 2 filhos"
      explicit_mention: 2.0,
      numeric_present: 1.6       // número de dependentes
    },
    entities: [/\d+\s*filhos?/],
    intent_patterns: [
      /(tenho|sou).*(filhos|casado|solteiro)/i,
      /família.*\d+/i,
      /dependentes/i
    ]
  },

  [LTM_CATEGORIES.PREFERENCIAS_INVESTIMENTO]: {
    keywords: {
      high: ['prefiro', 'gosto', 'evito', 'nunca', 'sempre'],
      medium: ['seguro', 'líquido', 'rentável', 'conservador'],
      low: ['opção', 'alternativa']
    },
    weights: {
      preference_explicit: 2.8,  // "prefiro X a Y"
      negative_preference: 2.5,  // "evito X"
      always_never: 2.6         // "sempre", "nunca"
    },
    entities: [],
    intent_patterns: [
      /prefiro.*(investir|aplicar)/i,
      /gosto.*de.*(CDB|tesouro|ações)/i,
      /evito.*(risco|ações)/i,
      /(sempre|nunca).*invisto/i
    ]
  },

  [LTM_CATEGORIES.RESTRICOES_LIMITACOES]: {
    keywords: {
      high: ['não posso', 'restrição', 'limitação', 'impossível'],
      medium: ['apenas', 'somente', 'máximo', 'limite'],
      low: ['difícil', 'complicado']
    },
    weights: {
      explicit_restriction: 2.8,
      negative_construction: 2.3,
      limit_mentioned: 2.0
    },
    entities: ['R$', 'máximo', 'até'],
    intent_patterns: [
      /não posso.*(investir|gastar|pagar)/i,
      /restrição/i,
      /no máximo.*R?\$/i,
      /apenas.*R?\$/i
    ]
  }
};

/**
 * Calcula score de uma categoria para determinado texto
 * @param {string} text - Texto para analisar
 * @param {string} category - Categoria para avaliar
 * @param {object} context - Contexto adicional (working memory, histórico)
 * @returns {number} - Score de 0 a 100
 */
function calculateCategoryScore(text, category, context = {}) {
  const detector = CATEGORY_DETECTORS[category];
  if (!detector) return 0;

  const textLower = text.toLowerCase();
  let score = 0;
  const matches = [];

  // 1. KEYWORD MATCHING (peso base)
  let keywordScore = 0;
  for (const [level, words] of Object.entries(detector.keywords)) {
    const weight = level === 'high' ? 10 : level === 'medium' ? 6 : 3;
    for (const keyword of words) {
      if (textLower.includes(keyword.toLowerCase())) {
        keywordScore += weight;
        matches.push({ type: 'keyword', keyword, weight, level });
      }
    }
  }
  score += Math.min(keywordScore, 30); // máximo 30 pontos em keywords

  // 2. INTENT PATTERNS (alta confiança)
  let intentScore = 0;
  for (const pattern of detector.intent_patterns) {
    if (pattern.test(text)) {
      intentScore += 20;
      matches.push({ type: 'intent', pattern: pattern.source });
      break; // primeiro match já confirma intenção
    }
  }
  score += Math.min(intentScore, 40); // máximo 40 pontos em intenção

  // 3. ENTITY DETECTION (confirma categoria)
  let entityScore = 0;
  for (const entity of detector.entities) {
    if (typeof entity === 'string' && textLower.includes(entity.toLowerCase())) {
      entityScore += 8;
      matches.push({ type: 'entity', entity });
    } else if (entity instanceof RegExp && entity.test(text)) {
      entityScore += 8;
      matches.push({ type: 'entity', entity: entity.source });
    }
  }
  score += Math.min(entityScore, 20); // máximo 20 pontos em entidades

  // 4. WEIGHT MULTIPLIERS (posição, contexto)
  const weights = detector.weights;
  
  // Verbo em posição principal
  if (weights.verb_position) {
    const verbPatterns = detector.intent_patterns.filter(p => /(ganho|tenho|invisto|quero|gosto)/i.test(p.source));
    if (verbPatterns.some(p => p.test(text))) {
      score *= weights.verb_position;
      matches.push({ type: 'weight', multiplier: 'verb_position', value: weights.verb_position });
    }
  }

  // Valor numérico presente
  if (weights.numeric_present && /\d+/.test(text)) {
    score *= weights.numeric_present;
    matches.push({ type: 'weight', multiplier: 'numeric_present', value: weights.numeric_present });
  }

  // Explicitação clara
  if (weights.explicit_profile && /(sou|perfil)/.test(textLower)) {
    score *= weights.explicit_profile;
  }
  if (weights.explicit_goal && /(objetivo|meta).*é/.test(textLower)) {
    score *= weights.explicit_goal;
  }
  if (weights.explicit_debt && /(devo|dívida)/.test(textLower)) {
    score *= weights.explicit_debt;
  }

  // 5. CONTEXT BOOST (working memory ativa)
  if (context.workingMemory && context.workingMemory[category]) {
    score *= 1.3; // boost de 30% se categoria já ativa na sessão
    matches.push({ type: 'context', boost: 'working_memory_active' });
  }

  // Normaliza score para 0-100
  score = Math.min(Math.round(score), 100);

  return score;
}

/**
 * Detecta e ranqueia categorias relevantes para o texto
 * @param {string} userMessage - Mensagem do usuário
 * @param {object} context - Contexto (working memory, histórico)
 * @returns {Array} - Top categorias ordenadas por score [ {category, score, reason} ]
 */
function detectCategories(userMessage, context = {}) {
  const scores = [];

  // Calcula score para cada categoria
  for (const category of Object.values(LTM_CATEGORIES)) {
    const score = calculateCategoryScore(userMessage, category, context);
    
    if (score > 0) {
      scores.push({
        category,
        score,
        reason: generateReason(category, score)
      });
    }
  }

  // Ordena por score (maior primeiro)
  scores.sort((a, b) => b.score - a.score);

  // Empate? Prioriza categorias já ativas na memória
  if (scores.length > 1 && scores[0].score === scores[1].score) {
    if (context.workingMemory && context.workingMemory[scores[1].category]) {
      [scores[0], scores[1]] = [scores[1], scores[0]]; // swap
    }
  }

  // Retorna top 3
  return scores.slice(0, 3);
}

/**
 * Gera razão legível para o score
 * @param {string} category - Categoria
 * @param {number} score - Score
 * @returns {string} - Razão formatada
 */
function generateReason(category, score) {
  if (score >= 80) return `Alta confiança (${score}/100) - Categoria claramente identificada`;
  if (score >= 50) return `Confiança moderada (${score}/100) - Múltiplos indicadores presentes`;
  if (score >= 30) return `Baixa confiança (${score}/100) - Alguns indicadores presentes`;
  return `Confiança mínima (${score}/100) - Poucos indicadores`;
}

/**
 * Extrai informação relevante do texto para a categoria
 * @param {string} text - Texto completo
 * @param {string} category - Categoria detectada
 * @returns {string} - Informação extraída
 */
function extractRelevantInfo(text, category) {
  const detector = CATEGORY_DETECTORS[category];
  if (!detector) return text;

  // Tenta encontrar sentença mais relevante
  for (const pattern of detector.intent_patterns) {
    const match = text.match(pattern);
    if (match) {
      // Encontra a sentença que contém o match
      const sentences = text.split(/[.!?]\s+/);
      for (const sentence of sentences) {
        if (pattern.test(sentence)) {
          return sentence.trim();
        }
      }
    }
  }

  // Fallback: busca por keywords na sentença
  const sentences = text.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    for (const keyword of detector.keywords.high) {
      if (sentenceLower.includes(keyword.toLowerCase())) {
        return sentence.trim();
      }
    }
  }

  return text; // último recurso
}

module.exports = {
  detectCategories,
  calculateCategoryScore,
  extractRelevantInfo,
  CATEGORY_DETECTORS
};
