/**
 * NOTE (narrative-engine.js):
 * Purpose: Sistema de conversão de conversas em eventos estruturados + resumo narrativo
 * Controls: Transforma ciclos {user+AI} em eventos, mantém resumo compacto com limite de 750 palavras
 * Behavior: Extrai apenas informações essenciais, comprime automaticamente em 90%, remove redundâncias
 * Integration notes: ZERO IA, apenas lógica inteligente baseada em padrões e prioridades
 */

const { count } = require('./word-counter');

/**
 * Extrai evento estruturado de um ciclo de conversa
 * @param {string} userMessage - Mensagem do usuário
 * @param {string} aiResponse - Resposta da IA
 * @param {object} context - Contexto adicional
 * @returns {object} - Evento estruturado
 */
function extractEvent(userMessage, aiResponse, context = {}) {
  const event = {
    intencao: extractIntent(userMessage),
    acao_usuario: extractUserAction(userMessage),
    valores_mencionados: extractValues(userMessage, aiResponse),
    decisao: extractDecision(userMessage, aiResponse),
    nivel_confianca: calculateConfidence(userMessage, aiResponse),
    timestamp: new Date().toISOString(),
    categoria_detectada: context.category || 'geral'
  };

  return event;
}

/**
 * Extrai intenção do usuário
 * @param {string} text - Mensagem do usuário
 * @returns {string} - Intenção identificada
 */
function extractIntent(text) {
  const textLower = text.toLowerCase();

  // Intenções primárias (primeira pessoa, verbos de ação)
  const intentMap = {
    'investir': /\b(quero|vou|pretendo|planejo).*invest/i,
    'economizar': /\b(economizar|poupar|guardar|reservar)/i,
    'pagar_divida': /\b(pagar|quitar|liquidar).*d[ií]vida/i,
    'analisar': /\b(analisar|verificar|checar|conferir)/i,
    'consultar': /\b(quanto|qual|como).*(\?|tenho|está)/i,
    'planejar': /\b(plano|planejamento|estratégia|organizar)/i,
    'aprender': /\b(entender|aprender|explicar|ensinar)/i,
    'comparar': /\b(comparar|diferença|melhor|pior)/i,
    'decidir': /\b(decidir|escolher|optar|definir)/i,
    'informar': /\b(informo|comunicar|avisar|dizer).*que/i
  };

  for (const [intent, pattern] of Object.entries(intentMap)) {
    if (pattern.test(text)) {
      return intent;
    }
  }

  // Fallback: detecta por verbo principal
  if (/\?/.test(text)) return 'consultar';
  if (/\b(sou|tenho|ganho|meu|minha)\b/i.test(text)) return 'informar';
  
  return 'conversar';
}

/**
 * Extrai ação do usuário de forma concisa
 * @param {string} text - Mensagem do usuário
 * @returns {string} - Ação resumida
 */
function extractUserAction(text) {
  const textLower = text.toLowerCase();

  // Remove saudações e ruído social
  let cleaned = text
    .replace(/^(olá|oi|bom dia|boa tarde|boa noite)[,!.]?\s*/i, '')
    .replace(/\b(por favor|obrigado|valeu|legal|beleza)\b/gi, '')
    .trim();

  // Extrai núcleo da ação (verbo + objeto direto)
  const actionPatterns = [
    { pattern: /(quero|vou|pretendo)\s+([^,.!?]+)/i, extract: 2 },
    { pattern: /(investo|gasto|ganho|tenho)\s+([^,.!?]+)/i, extract: 0 },
    { pattern: /(como|quanto|qual)\s+([^?]+)/i, extract: 0 }
  ];

  for (const { pattern, extract } of actionPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      return match[extract].trim();
    }
  }

  // Fallback: primeiras 60 chars
  return cleaned.substring(0, 60).trim();
}

/**
 * Extrai valores mencionados (números, moedas, percentuais)
 * @param {string} userMessage - Mensagem do usuário
 * @param {string} aiResponse - Resposta da IA
 * @returns {object} - Valores estruturados
 */
function extractValues(userMessage, aiResponse) {
  const values = {};
  const combinedText = `${userMessage} ${aiResponse}`;

  // Padrões de valores
  const patterns = {
    renda: /(renda|salário|ganho).*?R?\$?\s*([\d.,]+)/i,
    investimento: /(invisto|aplicado|aplicação).*?R?\$?\s*([\d.,]+)/i,
    divida: /(d[íi]vida|devo|parcela).*?R?\$?\s*([\d.,]+)/i,
    gasto: /(gasto|pago|consumo).*?R?\$?\s*([\d.,]+)/i,
    patrimonio: /(patrimônio|capital|total).*?R?\$?\s*([\d.,]+)/i,
    percentual: /(rendimento|taxa|juros).*?([\d.,]+)%/i
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = combinedText.match(pattern);
    if (match) {
      const valueStr = match[2].replace(',', '.');
      values[key] = parseFloat(valueStr) || match[2];
    }
  }

  return Object.keys(values).length > 0 ? values : null;
}

/**
 * Extrai decisão tomada na conversa
 * @param {string} userMessage - Mensagem do usuário
 * @param {string} aiResponse - Resposta da IA
 * @returns {string|null} - Decisão identificada
 */
function extractDecision(userMessage, aiResponse) {
  const combinedText = `${userMessage} ${aiResponse}`.toLowerCase();

  // Padrões de decisão
  const decisionPatterns = [
    /\b(vou|irei|decidi).*?(investir|poupar|pagar|comprar)\b/i,
    /\b(escolhi|optei|prefiro).*?\b/i,
    /\b(sim|confirmo|aceito|concordo)\b.*?(investir|pagar|fazer)/i
  ];

  for (const pattern of decisionPatterns) {
    const match = combinedText.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  // Decisões implícitas na resposta da IA
  if (/vou (sugerir|recomendar|criar|montar)/i.test(aiResponse)) {
    return 'decisão pendente - aguardando confirmação';
  }

  return null;
}

/**
 * Calcula nível de confiança do evento
 * @param {string} userMessage - Mensagem do usuário
 * @param {string} aiResponse - Resposta da IA
 * @returns {string} - 'alto', 'medio', 'baixo'
 */
function calculateConfidence(userMessage, aiResponse) {
  let score = 0;

  // Indicadores de alta confiança
  if (/\d+/.test(userMessage)) score += 2; // contém números
  if (/(meu|minha|tenho|sou)/i.test(userMessage)) score += 2; // primeira pessoa
  if (/R\$/.test(userMessage)) score += 2; // moeda explícita
  if (/\b(sim|confirmo|certeza|exato)\b/i.test(userMessage)) score += 3; // confirmação
  
  // Indicadores de baixa confiança
  if (/\b(talvez|acho|parece|pode ser)\b/i.test(userMessage)) score -= 2; // incerteza
  if (userMessage.length < 20) score -= 1; // mensagem muito curta
  if (/\?/.test(userMessage)) score -= 1; // é uma pergunta

  if (score >= 4) return 'alto';
  if (score >= 2) return 'medio';
  return 'baixo';
}

/**
 * Converte eventos em resumo narrativo compacto
 * @param {Array} events - Lista de eventos estruturados
 * @param {number} maxWords - Limite de palavras (padrão: 750)
 * @returns {string} - Resumo narrativo
 */
function eventsToNarrative(events, maxWords = 750) {
  if (!events || events.length === 0) {
    return 'Nenhuma interação registrada.';
  }

  const narratives = [];
  const seenIntents = new Set();

  for (const event of events) {
    // Evita redundância de intenções repetidas
    const intentKey = `${event.intencao}_${event.categoria_detectada}`;
    if (seenIntents.has(intentKey)) continue;
    seenIntents.add(intentKey);

    // Constrói narrativa compacta
    let line = `- ${capitalize(event.intencao)}`;
    
    if (event.acao_usuario) {
      line += `: ${event.acao_usuario}`;
    }

    if (event.valores_mencionados) {
      const valStr = formatValues(event.valores_mencionados);
      if (valStr) line += ` (${valStr})`;
    }

    if (event.decisao) {
      line += `. Decisão: ${event.decisao}`;
    }

    narratives.push(line);
  }

  let narrative = narratives.join('\n');

  // Compressão se exceder limite
  const wordCount = count(narrative);
  if (wordCount > maxWords) {
    narrative = compressNarrative(narratives, maxWords);
  }

  return narrative;
}

/**
 * Comprime narrativa mantendo informações essenciais
 * @param {Array} narratives - Lista de linhas narrativas
 * @param {number} maxWords - Limite de palavras
 * @returns {string} - Narrativa comprimida
 */
function compressNarrative(narratives, maxWords) {
  // Prioriza por tipo (decisões > informações > consultas)
  const prioritized = narratives
    .map(n => ({
      text: n,
      priority: calculateNarrativePriority(n),
      words: count(n)
    }))
    .sort((a, b) => b.priority - a.priority);

  const compressed = [];
  let totalWords = 0;

  for (const item of prioritized) {
    if (totalWords + item.words <= maxWords) {
      compressed.push(item.text);
      totalWords += item.words;
    } else {
      break;
    }
  }

  return compressed.join('\n');
}

/**
 * Calcula prioridade de uma linha narrativa
 * @param {string} narrative - Linha narrativa
 * @returns {number} - Score de prioridade
 */
function calculateNarrativePriority(narrative) {
  let priority = 0;

  // Alta prioridade
  if (/decisão:/i.test(narrative)) priority += 10;
  if (/investir|pagar|comprar/i.test(narrative)) priority += 8;
  if (/R\$\s*\d+/i.test(narrative)) priority += 7;
  if (/perfil|objetivo|meta/i.test(narrative)) priority += 6;

  // Média prioridade
  if (/informar|consultar/i.test(narrative)) priority += 4;

  // Baixa prioridade
  if (/conversar|aprender/i.test(narrative)) priority += 2;

  return priority;
}

/**
 * Formata valores para exibição compacta
 * @param {object} values - Objeto com valores
 * @returns {string} - String formatada
 */
function formatValues(values) {
  const parts = [];
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'number') {
      parts.push(`${key}: R$ ${value.toFixed(2)}`);
    } else {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.join(', ');
}

/**
 * Capitaliza primeira letra
 * @param {string} str - String
 * @returns {string} - String capitalizada
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Gerenciador de histórico narrativo com compressão automática
 */
class NarrativeHistoryManager {
  constructor(maxWords = 750) {
    this.maxWords = maxWords;
    this.events = [];
    this.narrative = '';
    this.compressedCount = 0;
  }

  /**
   * Adiciona novo evento ao histórico
   * @param {string} userMessage - Mensagem do usuário
   * @param {string} aiResponse - Resposta da IA
   * @param {object} context - Contexto adicional
   */
  addInteraction(userMessage, aiResponse, context = {}) {
    const event = extractEvent(userMessage, aiResponse, context);
    this.events.push(event);

    // Reconstrói narrativa
    this.narrative = eventsToNarrative(this.events, this.maxWords);

    // Verifica necessidade de compressão agressiva (90% do limite)
    const currentWords = count(this.narrative);
    if (currentWords >= this.maxWords * 0.9) {
      this._compressHistory();
    }
  }

  /**
   * Compressão agressiva quando atinge 90% do limite
   * @private
   */
  _compressHistory() {
    console.log('[NarrativeEngine] 🗜️ Compressão ativada - 90% do limite atingido');

    // Prioriza eventos por importância
    const prioritized = this.events
      .map(e => ({
        event: e,
        priority: this._calculateEventPriority(e)
      }))
      .sort((a, b) => b.priority - a.priority);

    // Remove eventos de baixa prioridade (bottom 20%)
    const keepCount = Math.ceil(this.events.length * 0.8);
    this.events = prioritized.slice(0, keepCount).map(p => p.event);

    // Reconstrói narrativa
    this.narrative = eventsToNarrative(this.events, this.maxWords);
    this.compressedCount++;

    console.log('[NarrativeEngine] ✅ Compressão concluída:', {
      eventos_mantidos: this.events.length,
      palavras_atuais: count(this.narrative),
      limite: this.maxWords,
      vezes_comprimido: this.compressedCount
    });
  }

  /**
   * Calcula prioridade de um evento (nunca remove decisões/perfil/restrições)
   * @param {object} event - Evento
   * @returns {number} - Prioridade
   * @private
   */
  _calculateEventPriority(event) {
    let priority = 0;

    // NUNCA REMOVE (prioridade máxima)
    if (event.decisao) priority += 1000; // decisões
    if (event.categoria_detectada === 'perfil_risco') priority += 900; // perfil
    if (event.categoria_detectada === 'restricoes_limitacoes') priority += 900; // restrições
    if (event.categoria_detectada === 'objetivos_metas') priority += 850; // objetivos

    // Alta prioridade
    if (event.intencao === 'investir') priority += 80;
    if (event.intencao === 'pagar_divida') priority += 75;
    if (event.intencao === 'planejar') priority += 70;
    if (event.valores_mencionados) priority += 60;
    if (event.nivel_confianca === 'alto') priority += 50;

    // Média prioridade
    if (event.intencao === 'informar') priority += 40;
    if (event.intencao === 'analisar') priority += 35;
    if (event.nivel_confianca === 'medio') priority += 30;

    // Baixa prioridade (candidatos à remoção)
    if (event.intencao === 'conversar') priority += 10;
    if (event.intencao === 'aprender') priority += 15;
    if (event.nivel_confianca === 'baixo') priority += 5;

    // Penalidade por idade (eventos antigos perdem peso)
    const age = Date.now() - new Date(event.timestamp).getTime();
    const daysSinceEvent = age / (1000 * 60 * 60 * 24);
    priority -= daysSinceEvent * 2; // -2 pontos por dia

    return priority;
  }

  /**
   * Obtém resumo narrativo atual
   * @returns {string} - Narrativa compacta
   */
  getNarrative() {
    return this.narrative;
  }

  /**
   * Obtém estatísticas
   * @returns {object} - Estatísticas do histórico
   */
  getStats() {
    return {
      total_events: this.events.length,
      current_words: count(this.narrative),
      max_words: this.maxWords,
      usage_percent: ((count(this.narrative) / this.maxWords) * 100).toFixed(1),
      compressed_times: this.compressedCount
    };
  }
}

module.exports = {
  extractEvent,
  eventsToNarrative,
  NarrativeHistoryManager,
  extractIntent,
  extractUserAction,
  extractValues,
  extractDecision
};
