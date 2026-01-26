/**
 * NOTE (pattern-classifier.js):
 * Purpose: Classificação inteligente de memórias usando padrões + IA híbrida
 * Controls: Sistema híbrido com extração por REGEX + classificação por IA
 * Behavior: Usa value-extractor para Working Memory, category-detector para LTM
 * Integration notes: HÍBRIDO - Regex para extração, IA (gpt-5-nano) para classificação semântica
 */

const { LTM_CATEGORIES } = require('./memory-types');
const categoryDetector = require('./category-detector');
const valueExtractor = require('./value-extractor');

/**
 * Core patterns estratégicos - SIMPLIFICADO
 * A lógica complexa de extração agora está em value-extractor.js
 */
const PATTERNS = {
  // WORKING MEMORY - temporário, cálculos imediatos
  working: {
    keywords: [
      /calcul(ar|o|ando|e)/i,
      /consider(ar|ando|e)/i,
      /\bagora\b/i,
      /\batual\b/i,
      /\btemp(orário|orariamente)\b/i,
      /\bneste momento\b/i,
      /vamos (ver|analisar|calcular)/i,
      /quanto.*render/i,
      /render.*quanto/i,
      /result(ado|ar)/i,
      /some|soma|adicione/i,
      /total|montante/i
    ]
  },

  // LONG-TERM MEMORY - padrões permanentes e informações duradouras
  longTerm: {
    // Padrões de durabilidade (alta confiança para LTM)
    durable: [
      /\b(sempre|nunca|jamais)\b/i,
      /\b(prefiro|evito|costumo|gosto de)\b/i,
      /\bmeu objetivo (é|será)/i,
      /\bquero (investir|poupar|guardar)/i,
      /\btenho.*meta/i,
      /\bsou.*conservador|moderado|arrojado/i
    ],
    
    // Informações financeiras estruturais
    financial: [
      /(renda|salário|ganho).*(mensal|por mês|mensalmente)/i,
      /invisto.*R?\$/i,
      /patrimônio.*R?\$/i,
      /dívida.*R?\$/i,
      /reserva de emergência/i,
      /portfólio|carteira de investimentos/i
    ],

    // Perfil profissional
    professional: [
      /\bsou\s+(engenheiro|médico|professor|desenvolvedor|analista|gerente)/i,
      /trabalho (como|de|na área)/i,
      /minha profissão/i,
      /atuo (como|na área)/i
    ],

    // Objetivos e metas
    goals: [
      /\bmeta.*\d+\s*(anos?|meses?)/i,
      /objetivo.*\d+/i,
      /quero (comprar|adquirir|conquistar)/i,
      /planejo.*no futuro/i,
      /aposentadoria/i
    ]
  },

  // EPISODIC MEMORY - contexto da conversa atual
  episodic: {
    conversational: [
      /você (disse|falou|mencionou)/i,
      /conforme (conversamos|discutimos)/i,
      /neste chat/i,
      /nesta conversa/i,
      /como você sugeriu/i
    ]
  }
};

/**
 * Mapeamento de keywords para categorias LTM
 */
const CATEGORY_KEYWORDS = {
  [LTM_CATEGORIES.PERFIL_PROFISSIONAL]: [
    'profissão', 'trabalho', 'emprego', 'carreira', 'empresa', 'cargo',
    'engenheiro', 'médico', 'professor', 'desenvolvedor', 'analista', 'gerente'
  ],
  
  [LTM_CATEGORIES.SITUACAO_FINANCEIRA]: [
    'renda', 'salário', 'ganho', 'receita', 'patrimônio', 'capital',
    'reserva', 'poupança', 'recursos', 'financeiramente'
  ],
  
  [LTM_CATEGORIES.INVESTIMENTOS]: [
    'invisto', 'investimento', 'aplicação', 'portfólio', 'carteira',
    'ações', 'fundos', 'renda fixa', 'tesouro', 'CDB', 'LCI'
  ],
  
  [LTM_CATEGORIES.OBJETIVOS_METAS]: [
    'objetivo', 'meta', 'planejo', 'quero', 'pretendo',
    'sonho', 'desejo', 'almejo', 'busco'
  ],
  
  [LTM_CATEGORIES.COMPORTAMENTO_GASTOS]: [
    'gasto', 'despesa', 'custo', 'pago', 'compro',
    'mensalidade', 'conta', 'fatura', 'consumo'
  ],
  
  [LTM_CATEGORIES.PERFIL_RISCO]: [
    'conservador', 'moderado', 'arrojado', 'agressivo', 'cauteloso',
    'risco', 'tolerância', 'volatilidade', 'segurança'
  ],
  
  [LTM_CATEGORIES.CONHECIMENTO_FINANCEIRO]: [
    'entendo', 'conheço', 'sei', 'aprendi', 'estudei',
    'experiência', 'conhecimento', 'iniciante', 'experiente'
  ],
  
  [LTM_CATEGORIES.PLANEJAMENTO_FUTURO]: [
    'futuro', 'longo prazo', 'aposentadoria', 'planejamento',
    'anos', 'próximos', 'daqui'
  ],
  
  [LTM_CATEGORIES.FAMILIA_DEPENDENTES]: [
    'família', 'filho', 'esposa', 'marido', 'dependente',
    'casado', 'solteiro', 'criança', 'filhos'
  ],
  
  [LTM_CATEGORIES.RELACAO_PLATAFORMA]: [
    'plataforma', 'sistema', 'aplicativo', 'app', 'funcionalidade',
    'recurso', 'ferramenta', 'uso', 'utilizo'
  ]
};

/**
 * Classifica interação usando padrões inteligentes + IA híbrida
 * @param {object} params - Parâmetros da interação
 * @param {string} params.userMessage - Mensagem do usuário
 * @param {string} params.aiResponse - Resposta da IA
 * @param {array} params.history - Histórico
 * @param {string} params.userName - Nome do usuário
 * @returns {Promise<object>} - {working: [], episodic: {}, longTerm: []}
 */
async function classifyInteraction({ userMessage, aiResponse, history = [], userName = 'o usuário' }) {
  console.log('[PatternClassifier] 🧠 INÍCIO - Classificação por padrões HÍBRIDA');
  console.log('[PatternClassifier] 📥 Input:', {
    userMessageLength: userMessage.length,
    aiResponseLength: aiResponse.length,
    historyLength: history.length,
    userName
  });
  
  const result = {
    working: [],
    episodic: {},
    longTerm: []
  };

  // CRITICAL FIX: Separa processamento por tipo de memória
  // Working Memory: texto SEM userName (evita capturar "r3" de "edmaR3")
  const cleanTextForWorking = `${userMessage} ${aiResponse}`.toLowerCase();
  
  // Long-term Memory: texto COM userName (necessário para contexto)
  const textWithUserName = `${userName} ${userMessage}`.toLowerCase();
  
  console.log('[PatternClassifier] 🔍 Texto para Working (SEM userName, primeiros 200 chars):', cleanTextForWorking.substring(0, 200));
  
  // 1. WORKING MEMORY - Usa valueExtractor HÍBRIDO (Regex + IA)
  let hasWorkingContext = false;
  for (const pattern of PATTERNS.working.keywords) {
    if (pattern.test(cleanTextForWorking)) {
      hasWorkingContext = true;
      break;
    }
  }
  
  if (hasWorkingContext) {
    // NOVA ABORDAGEM HÍBRIDA: Usa value-extractor com IA para classificação semântica
    try {
      const extractedValues = await valueExtractor.extractAndClassifyValues(aiResponse, userMessage, {
        useAI: true, // Usa IA para classificação semântica
        maxValues: 5  // Limita para economizar tokens
      });
      
      if (extractedValues.length > 0) {
        console.log('[PatternClassifier] ✅ Valores extraídos para Working Memory:', extractedValues.length);
        result.working.push(...extractedValues);
        extractedValues.forEach(v => {
          console.log(`[PatternClassifier]   - ${v.key}: ${v.value} (${v.category})`);
        });
      } else {
        console.log('[PatternClassifier] ⚠️ Contexto de Working detectado mas nenhum valor válido extraído');
      }
    } catch (error) {
      console.error('[PatternClassifier] ❌ Erro ao extrair valores:', error.message);
    }
  }

  // 2. LONG-TERM MEMORY - Usa category detector inteligente com scoring
  console.log('[PatternClassifier] 🎯 Detectando categorias relevantes...');
  
  // Detecta top 3 categorias usando scoring inteligente
  const detectedCategories = categoryDetector.detectCategories(userMessage, {
    workingMemory: result.working.length > 0 ? {} : null // passa contexto se houver
  });

  console.log('[PatternClassifier] 📊 Categorias detectadas:', detectedCategories.map(d => `${d.category} (score: ${d.score})`).join(', '));

  // Cria candidatos LTM apenas para categorias com score > 30 (confiança mínima)
  const ltmCandidates = detectedCategories
    .filter(d => d.score >= 30) // filtra scores muito baixos
    .map(d => ({
      content: categoryDetector.extractRelevantInfo(userMessage, d.category),
      category: d.category,
      reason: d.reason,
      score: d.score
    }));

  // Formata com nome do usuário
  result.longTerm = ltmCandidates.map(c => ({
    content: `${userName} ${c.content}`,
    category: c.category,
    reason: c.reason,
    score: c.score
  }));

  console.log('[PatternClassifier] 📊 Long-term candidates encontrados:', result.longTerm.length);
  if (result.longTerm.length > 0) {
    result.longTerm.forEach((ltm, idx) => {
      console.log(`[PatternClassifier]   ${idx + 1}. ${ltm.category}: ${ltm.content.substring(0, 60)}...`);
    });
  }

  // 3. EPISODIC MEMORY - Sempre captura contexto da conversa
  result.episodic = {
    contexto_conversa: summarizeConversation(userMessage, aiResponse),
    preferencias_mencionadas: extractPreferences(userMessage),
    decisoes_tomadas: extractDecisions(userMessage)
  };

  console.log('[PatternClassifier] ✅ FIM - Classificação concluída');
  console.log('[PatternClassifier] 📋 Resultado:', {
    working: result.working.length,
    episodic: 'sim',
    longTerm: result.longTerm.length
  });

  return result;
}

/**
 * Extrai sentença relevante que contém o padrão
 */
function extractRelevantSentence(text, pattern) {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s);
  
  for (const sentence of sentences) {
    if (pattern.test(sentence)) {
      return sentence.charAt(0).toLowerCase() + sentence.slice(1);
    }
  }
  
  return text.substring(0, 100); // Fallback
}

/**
 * Categoriza texto baseado em keywords
 */
function categorizeByKeywords(text) {
  const lowerText = text.toLowerCase();
  const scores = {};
  
  // Calcula score por categoria
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        scores[category]++;
      }
    }
  }
  
  // Retorna categoria com maior score
  let maxScore = 0;
  let bestCategory = LTM_CATEGORIES.RELACAO_PLATAFORMA; // default
  
  for (const [category, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }
  
  return bestCategory;
}

/**
 * Resume conversa para episodic memory
 */
function summarizeConversation(userMsg, aiMsg) {
  const userSnippet = userMsg.substring(0, 150);
  const aiSnippet = aiMsg.substring(0, 150);
  return `Usuário perguntou sobre: "${userSnippet}". Eu respondi: "${aiSnippet}".`;
}

/**
 * Extrai preferências mencionadas
 */
function extractPreferences(text) {
  // Preservar valores monetários (10.000 -> 10_000)
  const preservedText = text.replace(/(\d)\.(\d{3})/g, '$1_$2');
  
  const prefPatterns = [
    /prefiro\s+([^!?]+)/i,
    /gosto\s+de\s+([^!?]+)/i,
    /quero\s+([^!?]+)/i
  ];
  
  const prefs = [];
  for (const pattern of prefPatterns) {
    const match = preservedText.match(pattern);
    if (match) {
      // Restaurar pontos de milhar
      prefs.push(match[1].replace(/_/g, '.').trim());
    }
  }
  
  return prefs.length > 0 ? prefs.join('; ') : 'Nenhuma preferência explícita';
}

/**
 * Extrai decisões tomadas
 */
function extractDecisions(text) {
  // Preservar valores monetários (10.000 -> 10_000)
  const preservedText = text.replace(/(\d)\.(\d{3})/g, '$1_$2');
  
  const decisionPatterns = [
    /vou\s+([^!?]+)/i,
    /decidi\s+([^!?]+)/i,
    /escolhi\s+([^!?]+)/i
  ];
  
  const decisions = [];
  for (const pattern of decisionPatterns) {
    const match = preservedText.match(pattern);
    if (match) {
      // Restaurar pontos de milhar
      decisions.push(match[1].replace(/_/g, '.').trim());
    }
  }
  
  return decisions.length > 0 ? decisions.join('; ') : 'Nenhuma decisão explícita';
}

/**
 * Verifica se deve usar IA como fallback (casos complexos)
 * @param {object} classification - Resultado da classificação por padrões
 * @returns {boolean} - True se deve usar IA
 */
function shouldUseLLMFallback(classification) {
  // Usa IA apenas se:
  // 1. Nenhum long-term foi identificado E mensagem parece importante
  // 2. Múltiplos padrões conflitantes
  
  const hasLTM = classification.longTerm.length > 0;
  const hasWorking = classification.working.length > 0;
  
  // Se identificou algo, confia no pattern matching
  if (hasLTM || hasWorking) {
    return false;
  }
  
  // Caso contrário, padrões cobriram o caso
  return false;
}

module.exports = {
  classifyInteraction,
  shouldUseLLMFallback,
  PATTERNS,
  CATEGORY_KEYWORDS
};
