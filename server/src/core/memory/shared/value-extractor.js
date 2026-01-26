/**
 * NOTE (value-extractor.js):
 * Purpose: Sistema HÍBRIDO de extração e classificação de valores financeiros
 * Controls: Extração via REGEX robusto + Classificação semântica via IA (gpt-5-nano)
 * Behavior: Extrai valores com precisão, classifica com contexto, nomeia chaves semanticamente
 * Integration notes: Usado pelo PatternClassifier para Working Memory
 * 
 * ESTRATÉGIA:
 * - LÓGICA (Regex): Extração de valores numéricos (money, percent, period)
 * - IA (gpt-5-nano): Classificação semântica + Nomeação de chaves
 */

const { callOpenAI } = require('../../../config/openai-config');

// =============================================================================
// PADRÕES DE EXTRAÇÃO (REGEX ROBUSTO)
// =============================================================================

const EXTRACTION_PATTERNS = {
  // Valores monetários - formato brasileiro completo
  // Suporta: R$ 10.000, R$ 10.000,50, R$10000, 10.000 reais, 10k, 10 mil
  money: /(?:R\$\s*)?(\d{1,3}(?:[.]\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*(?:reais|mil|k)?/gi,
  
  // Valores monetários EXPLÍCITOS (com R$) - maior confiança
  moneyExplicit: /R\$\s*\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi,
  
  // Percentuais - suporta decimais com vírgula ou ponto
  percent: /(\d+(?:[.,]\d+)?)\s*%/gi,
  
  // Períodos de tempo
  period: /(\d+)\s*(ano|anos|mês|meses|dia|dias|semana|semanas)/gi,
  
  // Taxa de juros (contexto específico)
  interestRate: /(?:taxa|juros|rendimento)\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*%/gi,
  
  // Aporte/depósito mensal
  monthlyDeposit: /(?:aporte|depósito|depositar|colocar|investir)\s*(?:de)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?\s*(?:por|\/)\s*mês/gi,
  
  // Montante/total final
  finalAmount: /(?:montante|total|resultado|final)\s*(?:de|:)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi,
  
  // Rendimento/ganho
  earnings: /(?:rendimento|ganho|lucro|juros)\s*(?:de|:)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi,
  
  // Parcela/prestação
  installment: /(?:parcela|prestação)\s*(?:de)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi,
  
  // Renda/salário
  income: /(?:renda|salário|ganho|receita)\s*(?:de|mensal)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi,
  
  // Dívida
  debt: /(?:dívida|devo|devendo)\s*(?:de)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi,
  
  // Reserva de emergência
  emergency: /(?:reserva|emergência)\s*(?:de)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi,
  
  // Patrimônio
  patrimony: /(?:patrimônio|capital|poupança)\s*(?:de|:)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi,
  
  // Meta/objetivo
  goal: /(?:meta|objetivo)\s*(?:de)?\s*(?:R\$\s*)?\d{1,3}(?:[.]\d{3})*(?:,\d{2})?/gi
};

// Categorias válidas para classificação
const VALID_CATEGORIES = [
  'investimento_inicial',
  'aporte_mensal',
  'aporte_unico',
  'renda_mensal',
  'salario',
  'rendimento',
  'juros',
  'montante_final',
  'patrimonio',
  'reserva_emergencia',
  'divida',
  'parcela',
  'meta_financeira',
  'gasto_mensal',
  'gasto_fixo',
  'gasto_variavel',
  'aluguel',
  'financiamento',
  'emprestimo',
  'taxa_juros',
  'taxa_rendimento',
  'inflacao',
  'periodo_meses',
  'periodo_anos',
  'percentual_alocacao',
  'percentual_renda',
  'saldo_atual',
  'valor_compra',
  'valor_venda',
  'valor_resgate',
  'unknown'
];

// =============================================================================
// FUNÇÕES DE EXTRAÇÃO (LÓGICA PURA - SEM IA)
// =============================================================================

/**
 * Extrai todos os valores monetários de um texto
 * @param {string} text - Texto para extrair valores
 * @returns {Array} - Lista de {value, raw, type, position}
 */
function extractMonetaryValues(text) {
  console.log('[ValueExtractor] 🔍 extractMonetaryValues - Iniciando extração');
  console.log('[ValueExtractor] 📝 Texto de entrada (primeiros 300 chars):', text.substring(0, 300));
  
  const results = [];
  const seen = new Set();
  
  // Preservar valores monetários (10.000 -> 10_000) para evitar truncamento
  const preserved = text.replace(/(\d)\.(\d{3})/g, '$1_$2');
  console.log('[ValueExtractor] 🔄 Texto com valores preservados:', preserved.substring(0, 200));
  
  // 1. Valores explícitos com R$ (maior confiança)
  console.log('[ValueExtractor] 💰 Buscando valores monetários explícitos (R$)...');
  const explicitMatches = text.matchAll(/R\$\s*(\d{1,3}(?:[.]\d{3})*(?:,\d{2})?)/gi);
  for (const match of explicitMatches) {
    const raw = match[0].trim();
    const normalized = normalizeMonetaryValue(match[1]);
    const key = `money_${normalized}`;
    
    console.log(`[ValueExtractor] 💵 Match encontrado: "${raw}" -> normalizado: ${normalized}`);
    
    if (!seen.has(key) && isValidValue(raw)) {
      seen.add(key);
      results.push({
        value: normalized,
        raw: raw,
        type: 'money',
        confidence: 'high',
        position: match.index
      });
      console.log(`[ValueExtractor] ✅ Valor ACEITO: ${raw} (${normalized})`);
    } else if (seen.has(key)) {
      console.log(`[ValueExtractor] ⏭️ Valor IGNORADO (duplicado): ${raw}`);
    } else {
      console.log(`[ValueExtractor] ❌ Valor REJEITADO (inválido): ${raw}`);
    }
  }
  
  // 2. Percentuais
  console.log('[ValueExtractor] 📊 Buscando percentuais...');
  const percentMatches = text.matchAll(/(\d+(?:[.,]\d+)?)\s*%/gi);
  for (const match of percentMatches) {
    const raw = match[0].trim();
    const normalized = match[1].replace(',', '.');
    const key = `percent_${normalized}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        value: normalized,
        raw: raw,
        type: 'percent',
        confidence: 'high',
        position: match.index
      });
    }
  }
  
  // 3. Períodos de tempo
  const periodMatches = text.matchAll(/(\d+)\s*(ano|anos|mês|meses|dia|dias|semana|semanas)/gi);
  for (const match of periodMatches) {
    const raw = match[0].trim();
    const unit = match[2].toLowerCase().replace(/s$/, ''); // Singulariza
    const key = `period_${match[1]}_${unit}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        value: match[1],
        raw: raw,
        type: 'period',
        unit: unit,
        confidence: 'high',
        position: match.index
      });
    }
  }
  
  return results;
}

/**
 * Normaliza valor monetário para formato numérico
 * Ex: "10.000,50" -> 10000.50
 * @param {string} value - Valor bruto
 * @returns {number} - Valor numérico
 */
function normalizeMonetaryValue(value) {
  if (!value) return 0;
  
  // Remove R$ e espaços
  let cleaned = value.replace(/[R$\s]/gi, '').trim();
  
  // Formato brasileiro: 10.000,50 -> 10000.50
  // Remove pontos de milhar, substitui vírgula decimal por ponto
  cleaned = cleaned.replace(/\.(\d{3})/g, '$1'); // Remove pontos de milhar
  cleaned = cleaned.replace(',', '.'); // Vírgula decimal -> ponto
  
  return parseFloat(cleaned) || 0;
}

/**
 * Valida se um valor extraído é válido (não é lixo)
 * @param {string} value - Valor bruto extraído
 * @returns {boolean} - True se válido
 */
function isValidValue(value) {
  console.log(`[ValueExtractor] 🔎 isValidValue - Validando: "${value}"`);
  
  if (!value || typeof value !== 'string') {
    console.log('[ValueExtractor] ❌ Rejeitado: valor nulo ou não-string');
    return false;
  }
  
  const cleaned = value.trim();
  
  // Rejeita valores muito curtos (menos de 2 caracteres)
  if (cleaned.length < 2) {
    console.log('[ValueExtractor] ❌ Rejeitado: muito curto (<2 chars)');
    return false;
  }
  
  // Rejeita se não contém número
  if (!/\d/.test(cleaned)) {
    console.log('[ValueExtractor] ❌ Rejeitado: não contém número');
    return false;
  }
  
  // Rejeita se parece ser parte de nome de usuário (ex: "r5", "edmar3")
  if (/^[a-z]\d+$/i.test(cleaned) || /^[a-z]+\d+$/i.test(cleaned)) {
    console.log('[ValueExtractor] ❌ Rejeitado: parece ser parte de username');
    return false;
  }
  
  // Rejeita valores monetários sem contexto adequado
  // Deve ter R$ OU % OU contexto de período
  const hasMoneySymbol = /R\$/.test(cleaned);
  const hasPercent = /%/.test(cleaned);
  const hasPeriod = /(ano|mês|dia|semana)/i.test(cleaned);
  const hasLargeNumber = /\d{3,}/.test(cleaned.replace(/[.,]/g, ''));
  
  // Aceita se tem símbolo monetário, percentual, período ou número grande
  if (!hasMoneySymbol && !hasPercent && !hasPeriod && !hasLargeNumber) {
    // Se for só número pequeno sem contexto, rejeita
    const numValue = parseFloat(cleaned.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (numValue < 100) return false;
  }
  
  return true;
}

/**
 * Extrai contexto ao redor de um valor (para classificação)
 * @param {string} text - Texto completo
 * @param {number} position - Posição do valor
 * @param {number} windowSize - Tamanho da janela de contexto
 * @returns {string} - Contexto extraído
 */
function extractContext(text, position, windowSize = 100) {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(text.length, position + windowSize);
  return text.substring(start, end).toLowerCase();
}

// =============================================================================
// FUNÇÕES DE CLASSIFICAÇÃO (IA - gpt-5-nano)
// =============================================================================

/**
 * Classifica semanticamente um valor usando IA
 * @param {number} value - Valor numérico
 * @param {string} context - Contexto onde o valor aparece
 * @param {string} type - Tipo do valor (money, percent, period)
 * @returns {Promise<string>} - Categoria classificada
 */
async function classifyValueWithAI(value, context, type = 'money') {
  console.log('[ValueExtractor] 🧠 classifyValueWithAI - Classificando com IA (gpt-5-nano)');
  console.log(`[ValueExtractor] 📊 Valor: ${value} | Tipo: ${type}`);
  console.log(`[ValueExtractor] 📝 Contexto: "${context.substring(0, 150)}..."`);
  
  try {
    const prompt = `Classifique o valor "${value}" (tipo: ${type}) neste contexto:
"${context}"

Categorias válidas:
- investimento_inicial: valor que será investido inicialmente
- aporte_mensal: valor depositado mensalmente
- renda_mensal: salário ou renda mensal
- rendimento: ganho/lucro de investimento
- montante_final: resultado total após período
- taxa_juros: taxa de juros (%)
- periodo_meses: período em meses
- periodo_anos: período em anos
- patrimonio: valor total acumulado
- reserva_emergencia: reserva para emergências
- divida: valor de dívida
- parcela: valor de parcela
- meta_financeira: objetivo financeiro
- gasto_mensal: gasto recorrente mensal
- aluguel: valor de aluguel
- percentual_alocacao: percentual para alocação
- unknown: não identificado

Retorne APENAS a categoria (uma palavra, sem explicação).`;

    const response = await callOpenAI(
      'Você é um classificador financeiro. Retorne APENAS a categoria, sem explicação.',
      prompt
    );
    
    console.log(`[ValueExtractor] 🤖 Resposta IA bruta: "${response}"`);
    
    const category = response.trim().toLowerCase().replace(/[^a-z_]/g, '');
    
    console.log(`[ValueExtractor] 🏷️ Categoria normalizada: "${category}"`);
    
    // Valida se a categoria retornada é válida
    if (VALID_CATEGORIES.includes(category)) {
      console.log(`[ValueExtractor] ✅ Categoria ACEITA: ${category}`);
      return category;
    }
    
    console.warn('[ValueExtractor] ⚠️ Categoria inválida da IA:', response, '-> usando unknown');
    return 'unknown';
    
  } catch (error) {
    console.error('[ValueExtractor] ❌ Erro na classificação IA:', error.message);
    console.log('[ValueExtractor] 🔄 Usando fallback por padrões...');
    return classifyValueByPattern(value, context, type); // Fallback para lógica
  }
}

/**
 * Fallback: Classifica valor usando apenas padrões (sem IA)
 * @param {number} value - Valor numérico
 * @param {string} context - Contexto
 * @param {string} type - Tipo do valor
 * @returns {string} - Categoria
 */
function classifyValueByPattern(value, context, type) {
  console.log('[ValueExtractor] 📝 classifyValueByPattern - Classificando por padrões (fallback)');
  console.log(`[ValueExtractor] 📊 Valor: ${value} | Tipo: ${type}`);
  
  const ctx = context.toLowerCase();
  
  // Percentuais
  if (type === 'percent') {
    if (/juros|taxa|rendimento|cdi|selic/.test(ctx)) {
      console.log('[ValueExtractor] ✅ Classificado: taxa_juros (padrão percentual)');
      return 'taxa_juros';
    }
    if (/aloca|distribu|divis/.test(ctx)) {
      console.log('[ValueExtractor] ✅ Classificado: percentual_alocacao (padrão)');
      return 'percentual_alocacao';
    }
    if (/renda|salário/.test(ctx)) {
      console.log('[ValueExtractor] ✅ Classificado: percentual_renda (padrão)');
      return 'percentual_renda';
    }
    console.log('[ValueExtractor] ✅ Classificado: taxa_juros (default percentual)');
    return 'taxa_juros'; // Default para percentuais
  }
  
  // Períodos
  if (type === 'period') {
    if (/ano/.test(ctx)) {
      console.log('[ValueExtractor] ✅ Classificado: periodo_anos (padrão)');
      return 'periodo_anos';
    }
    if (/mês|mes/.test(ctx)) {
      console.log('[ValueExtractor] ✅ Classificado: periodo_meses (padrão)');
      return 'periodo_meses';
    }
    console.log('[ValueExtractor] ✅ Classificado: periodo_meses (default)');
    return 'periodo_meses';
  }
  
  // Valores monetários - busca por contexto
  if (/investir|aplicar|colocar/.test(ctx) && /inicial|hoje|agora/.test(ctx)) {
    return 'investimento_inicial';
  }
  if (/aporte|depósito|depositar/.test(ctx) && /mensal|mês|por mês/.test(ctx)) {
    return 'aporte_mensal';
  }
  if (/renda|salário|ganho mensal/.test(ctx)) {
    return 'renda_mensal';
  }
  if (/rendimento|ganho|lucro|juros/.test(ctx) && !/taxa/.test(ctx)) {
    return 'rendimento';
  }
  if (/montante|total|final|resultado/.test(ctx)) {
    return 'montante_final';
  }
  if (/patrimônio|capital|poupança/.test(ctx)) {
    return 'patrimonio';
  }
  if (/reserva|emergência/.test(ctx)) {
    return 'reserva_emergencia';
  }
  if (/dívida|devo|devendo/.test(ctx)) {
    return 'divida';
  }
  if (/parcela|prestação/.test(ctx)) {
    return 'parcela';
  }
  if (/meta|objetivo/.test(ctx)) {
    return 'meta_financeira';
  }
  if (/aluguel/.test(ctx)) {
    return 'aluguel';
  }
  if (/gasto|despesa/.test(ctx)) {
    return 'gasto_mensal';
  }
  
  return 'unknown';
}

// =============================================================================
// FUNÇÕES DE NOMEAÇÃO DE CHAVES (IA - gpt-4.1-nano)
// =============================================================================

/**
 * Gera nome semântico para chave usando IA
 * @param {string} description - Descrição do valor
 * @param {string} category - Categoria classificada
 * @param {number} value - Valor numérico
 * @returns {Promise<string>} - Nome da chave
 */
async function generateKeyNameWithAI(description, category, value) {
  try {
    // Se já temos categoria específica, usa ela
    if (category && category !== 'unknown') {
      // Adiciona contexto ao nome se relevante
      if (category === 'taxa_juros' && value) {
        return `taxa_${value.toString().replace('.', '_')}`;
      }
      if (category === 'percentual_alocacao' && value) {
        return `alocacao_${value}pct`;
      }
      if (category === 'periodo_anos' || category === 'periodo_meses') {
        return `${category}_${value}`;
      }
      return category;
    }
    
    // Só chama IA se categoria for unknown
    const prompt = `Gere uma chave curta e semântica para este valor financeiro:
"${description}"

Exemplos:
"valor que vou investir hoje" → investimento_inicial
"quanto vou colocar por mês" → aporte_mensal
"juros de 12% ao ano" → taxa_12_anual
"resultado após 1 ano" → montante_1_ano
"30% do salário para aluguel" → aluguel_30pct

Regras:
- Use snake_case
- Máximo 25 caracteres
- Seja específico

Retorne APENAS a chave.`;

    const response = await callOpenAI(
      'Você gera nomes de variáveis. Retorne APENAS a chave, sem explicação.',
      prompt
    );
    
    let keyName = response.trim().toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 25);
    
    return keyName || 'valor_calculado';
    
  } catch (error) {
    console.error('[ValueExtractor] Erro ao gerar nome da chave:', error.message);
    return category || 'valor_calculado';
  }
}

// =============================================================================
// FUNÇÃO PRINCIPAL DE EXTRAÇÃO
// =============================================================================

/**
 * Extrai e classifica todos os valores de uma resposta da IA
 * @param {string} aiResponse - Resposta da IA
 * @param {string} userMessage - Mensagem do usuário (contexto)
 * @param {Object} options - Opções de extração
 * @returns {Promise<Array>} - Lista de {key, value, raw, category, confidence}
 */
async function extractAndClassifyValues(aiResponse, userMessage, options = {}) {
  const { useAI = true, maxValues = 5 } = options;
  
  console.log('[ValueExtractor] ═══════════════════════════════════════════════════════');
  console.log('[ValueExtractor] 🚀 INÍCIO - extractAndClassifyValues');
  console.log('[ValueExtractor] ⚙️ Opções: useAI=' + useAI + ', maxValues=' + maxValues);
  console.log('[ValueExtractor] 📩 userMessage (primeiros 150 chars):', userMessage.substring(0, 150));
  console.log('[ValueExtractor] 🤖 aiResponse (primeiros 200 chars):', aiResponse.substring(0, 200));
  
  // 1. EXTRAÇÃO (LÓGICA PURA)
  console.log('[ValueExtractor] ───────────────────────────────────────────────────────');
  console.log('[ValueExtractor] 📍 ETAPA 1: EXTRAÇÃO (Regex)');
  const combinedText = `${userMessage} ${aiResponse}`;
  const extractedValues = extractMonetaryValues(combinedText);
  
  console.log('[ValueExtractor] 📊 Total de valores extraídos:', extractedValues.length);
  if (extractedValues.length > 0) {
    console.log('[ValueExtractor] 📋 Valores encontrados:');
    extractedValues.forEach((v, i) => {
      console.log(`[ValueExtractor]   ${i+1}. ${v.raw} (tipo: ${v.type}, confiança: ${v.confidence})`);
    });
  }
  
  if (extractedValues.length === 0) {
    console.log('[ValueExtractor] ⚠️ Nenhum valor válido encontrado');
    console.log('[ValueExtractor] ═══════════════════════════════════════════════════════');
    return [];
  }
  
  // 2. CLASSIFICAÇÃO (IA ou LÓGICA)
  console.log('[ValueExtractor] ───────────────────────────────────────────────────────');
  console.log('[ValueExtractor] 📍 ETAPA 2: CLASSIFICAÇÃO (' + (useAI ? 'IA gpt-5-nano' : 'Padrões') + ')');
  const results = [];
  const seenKeys = new Set();
  
  for (const extracted of extractedValues.slice(0, maxValues)) {
    console.log('[ValueExtractor] ───────────────────────────────────────────────────────');
    console.log(`[ValueExtractor] 🔄 Processando valor: ${extracted.raw}`);
    
    const context = extractContext(combinedText, extracted.position);
    console.log(`[ValueExtractor] 📝 Contexto extraído: "${context.substring(0, 100)}..."`);
    
    let category;
    if (useAI) {
      category = await classifyValueWithAI(extracted.value, context, extracted.type);
    } else {
      category = classifyValueByPattern(extracted.value, context, extracted.type);
    }
    
    console.log('[ValueExtractor] 🏷️ Categoria final:', category);
    
    // 3. NOMEAÇÃO DE CHAVE
    let keyName;
    if (useAI && category === 'unknown') {
      console.log('[ValueExtractor] 🔑 Gerando nome de chave via IA (categoria unknown)...');
      keyName = await generateKeyNameWithAI(context, category, extracted.value);
    } else {
      keyName = category;
    }
    
    // Evita duplicatas de chaves
    let finalKey = keyName;
    let counter = 1;
    while (seenKeys.has(finalKey)) {
      finalKey = `${keyName}_${counter}`;
      counter++;
    }
    seenKeys.add(finalKey);
    
    console.log(`[ValueExtractor] 🔑 Chave final: ${finalKey}`);
    
    results.push({
      key: finalKey,
      value: extracted.raw,
      numericValue: extracted.value,
      category: category,
      type: extracted.type,
      confidence: extracted.confidence,
      reason: `Valor ${extracted.type} classificado como ${category}`
    });
    
    console.log(`[ValueExtractor] ✅ Valor adicionado ao resultado: ${finalKey}=${extracted.raw}`);
  }
  
  console.log('[ValueExtractor] ───────────────────────────────────────────────────────');
  console.log('[ValueExtractor] 📍 ETAPA 3: RESULTADO FINAL');
  console.log('[ValueExtractor] 📊 Total de valores processados:', results.length);
  if (results.length > 0) {
    console.log('[ValueExtractor] 📋 Resumo dos valores:');
    results.forEach((r, i) => {
      console.log(`[ValueExtractor]   ${i+1}. [${r.key}] = ${r.value} (categoria: ${r.category})`);
    });
  }
  console.log('[ValueExtractor] ═══════════════════════════════════════════════════════');
  
  return results;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Funções principais
  extractAndClassifyValues,
  extractMonetaryValues,
  
  // Classificação
  classifyValueWithAI,
  classifyValueByPattern,
  
  // Nomeação
  generateKeyNameWithAI,
  
  // Utilitários
  normalizeMonetaryValue,
  isValidValue,
  extractContext,
  
  // Constantes
  EXTRACTION_PATTERNS,
  VALID_CATEGORIES
};
