/**
 * NOTE (content-validator.js):
 * Purpose: Validação de conteúdo usando regex patterns (substitui chamadas de IA para validação)
 * Controls: Padrões de dados sensíveis (CPF, cartão, senhas, etc)
 * Behavior: Valida e sanitiza conteúdo sem usar IA, economizando tokens
 * Integration notes: Substitui _curateValue e _curateContent com chamadas de IA
 */

/**
 * Padrões de conteúdo proibido/sensível
 */
const FORBIDDEN_PATTERNS = {
  // CPF formatado: XXX.XXX.XXX-XX
  cpf_formatted: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
  
  // CPF não formatado: 11 dígitos seguidos
  cpf_raw: /\b\d{11}\b/g,
  
  // Cartão de crédito: 16 dígitos (com ou sem espaços/traços)
  credit_card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  
  // CVV: 3 ou 4 dígitos após palavra-chave
  cvv: /\b(cvv|cvc|código de segurança)[\s:]*\d{3,4}\b/gi,
  
  // Senhas (palavras-chave)
  password: /\b(senha|password|pwd|pass)[\s:]+[^\s]+/gi,
  
  // API Keys (padrão comum)
  api_key: /\b(api[_-]?key|token)[\s:]+[a-zA-Z0-9_-]{20,}\b/gi,
  
  // RG: X.XXX.XXX ou XXXXXXXX
  rg: /\b\d{1,2}\.\d{3}\.\d{3}(-\d{1})?\b/g,
  
  // CNH: 11 dígitos
  cnh: /\bcnh[\s:]*\d{11}\b/gi,
  
  // Passaporte: padrão brasileiro (2 letras + 6 dígitos)
  passport: /\b[A-Z]{2}\d{6}\b/g
};

/**
 * Padrões que são PERMITIDOS (não devem ser bloqueados)
 */
const ALLOWED_PATTERNS = {
  // Salário/renda (números com R$)
  salary: /\bR?\$\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/gi,
  
  // Valores monetários em geral
  money: /\b\d+(?:[.,]\d+)?\s*(reais|dólares|mil|milhão|milhões)\b/gi,
  
  // Nomes próprios comuns
  first_names: [
    'joão', 'maria', 'josé', 'ana', 'pedro', 'lucas', 'juliana',
    'carlos', 'fernanda', 'rafael', 'patricia', 'edmar', 'paulo',
    'marcia', 'roberto', 'amanda', 'bruno', 'camila', 'diego'
  ]
};

/**
 * Valida conteúdo para Working Memory
 * @param {string} key - Chave sendo armazenada
 * @param {*} value - Valor sendo armazenado
 * @returns {object} - {allowed: boolean, reason: string, sanitizedValue: *}
 */
function validateWorkingMemory(key, value) {
  console.log('[ContentValidator] 🔍 Validando Working Memory:', { key, valueLength: String(value).length });
  
  const valueStr = String(value);
  
  // Verifica padrões proibidos
  const forbidden = checkForbiddenContent(valueStr);
  console.log('[ContentValidator] 🛡️ Verificação de conteúdo proibido:', forbidden.found ? `❌ BLOQUEADO (${forbidden.type})` : '✅ OK');
  if (forbidden.found) {
    return {
      allowed: false,
      reason: `Conteúdo sensível detectado: ${forbidden.type}`,
      sanitizedValue: null
    };
  }
  
  // Verifica se é nome próprio (permitido)
  if (isFirstName(valueStr)) {
    return {
      allowed: true,
      reason: 'Nome próprio identificado (OK para personalização)',
      sanitizedValue: value
    };
  }
  
  // Verifica se é valor monetário (permitido)
  if (ALLOWED_PATTERNS.salary.test(valueStr) || ALLOWED_PATTERNS.money.test(valueStr)) {
    return {
      allowed: true,
      reason: 'Valor financeiro (OK para análise)',
      sanitizedValue: value
    };
  }
  
  // Verifica se é spam/ruído (passa key como contexto)
  if (isNoise(valueStr, key)) {
    return {
      allowed: false,
      reason: 'Conteúdo irrelevante ou spam',
      sanitizedValue: null
    };
  }
  
  // Default: permitir
  return {
    allowed: true,
    reason: 'Conteúdo validado por padrões',
    sanitizedValue: value
  };
}

/**
 * Valida conteúdo para Episodic Memory
 * @param {object} content - Conteúdo episódico
 * @param {string} chatId - ID do chat
 * @returns {object} - {allowed: boolean, reason: string, sanitizedContent: object}
 */
function validateEpisodicMemory(content, chatId) {
  console.log('[ContentValidator] 🔍 Validando Episodic Memory:', { chatId, contentSize: JSON.stringify(content).length });
  
  const contentStr = JSON.stringify(content);
  
  // Verifica padrões proibidos
  const forbidden = checkForbiddenContent(contentStr);
  console.log('[ContentValidator] 🛡️ Verificação de conteúdo proibido:', forbidden.found ? `⚠️ ENCONTRADO (${forbidden.type})` : '✅ OK');
  if (forbidden.found) {
    // Tenta sanitizar removendo apenas o conteúdo sensível
    const sanitized = sanitizeContent(content, forbidden.patterns);
    
    if (sanitized.hasContent) {
      return {
        allowed: true,
        reason: `Conteúdo sensível removido, restante aprovado`,
        sanitizedContent: sanitized.content
      };
    } else {
      return {
        allowed: false,
        reason: `Todo conteúdo era sensível: ${forbidden.type}`,
        sanitizedContent: null
      };
    }
  }
  
  // Verifica se há algum conteúdo útil
  if (!hasUsefulContent(content)) {
    return {
      allowed: false,
      reason: 'Conteúdo vazio ou sem informação útil',
      sanitizedContent: null
    };
  }
  
  return {
    allowed: true,
    reason: 'Conteúdo episódico validado',
    sanitizedContent: content
  };
}

/**
 * Verifica se contém conteúdo proibido
 * @param {string} text - Texto a verificar
 * @returns {object} - {found: boolean, type: string, patterns: array}
 */
function checkForbiddenContent(text) {
  const foundPatterns = [];
  
  for (const [type, pattern] of Object.entries(FORBIDDEN_PATTERNS)) {
    if (pattern.test(text)) {
      foundPatterns.push(type);
    }
  }
  
  if (foundPatterns.length > 0) {
    return {
      found: true,
      type: foundPatterns.join(', '),
      patterns: foundPatterns
    };
  }
  
  return { found: false, type: null, patterns: [] };
}

/**
 * Verifica se é um nome próprio comum
 */
function isFirstName(text) {
  const lower = text.toLowerCase().trim();
  
  // Verifica se está na lista de nomes comuns
  if (ALLOWED_PATTERNS.first_names.includes(lower)) {
    return true;
  }
  
  // Verifica padrão de nome (primeira letra maiúscula, sem espaços, 2-15 caracteres)
  if (/^[A-Z][a-z]{1,14}$/.test(text.trim())) {
    return true;
  }
  
  return false;
}

/**
 * Verifica se é ruído/spam
 */
function isNoise(text, key = '') {
  const lower = text.toLowerCase().trim();
  
  // Texto muito curto (< 2 caracteres)
  if (lower.length < 2) {
    return true;
  }
  
  // ✅ ALLOWLIST: Números no contexto de cálculos/valores NÃO são spam
  // Se a chave indica contexto matemático/financeiro, aceita números puros
  const numericalContextKeys = [
    'valor', 'calculo', 'resultado', 'percentual', 'taxa', 
    'porcentagem', 'quantidade', 'numero', 'montante'
  ];
  
  if (/^\d+(\.\d+)?$/.test(lower)) {
    // É um número puro - verifica contexto pela chave
    const keyLower = key.toLowerCase();
    for (const contextKey of numericalContextKeys) {
      if (keyLower.includes(contextKey)) {
        console.log(`[ContentValidator] ✅ Número ${text} aceito (contexto: ${key})`);
        return false; // NÃO é ruído
      }
    }
    
    // Se número muito curto sem contexto, ainda é suspeito
    if (lower.length < 4) {
      return true;
    }
  }
  
  // Spam patterns
  const spamPatterns = [
    /click here/i,
    /buy now/i,
    /free money/i,
    /urgent/i,
    /congratulations/i
  ];
  
  for (const pattern of spamPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Verifica se há conteúdo útil
 */
function hasUsefulContent(obj) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  // Verifica se há pelo menos um campo com texto não vazio
  for (const value of Object.values(obj)) {
    if (typeof value === 'string' && value.trim().length > 5) {
      return true;
    }
    if (typeof value === 'object' && hasUsefulContent(value)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Sanitiza conteúdo removendo dados sensíveis
 */
function sanitizeContent(content, forbiddenTypes) {
  if (typeof content === 'string') {
    let sanitized = content;
    
    // Remove cada tipo de conteúdo proibido
    for (const type of forbiddenTypes) {
      const pattern = FORBIDDEN_PATTERNS[type];
      if (pattern) {
        sanitized = sanitized.replace(pattern, '[REMOVIDO]');
      }
    }
    
    // Verifica se sobrou conteúdo útil
    const hasContent = sanitized.replace(/\[REMOVIDO\]/g, '').trim().length > 10;
    
    return {
      content: sanitized,
      hasContent
    };
  }
  
  if (typeof content === 'object' && content !== null) {
    const sanitized = {};
    let hasAnyContent = false;
    
    for (const [key, value] of Object.entries(content)) {
      const result = sanitizeContent(value, forbiddenTypes);
      sanitized[key] = result.content;
      if (result.hasContent) {
        hasAnyContent = true;
      }
    }
    
    return {
      content: sanitized,
      hasContent: hasAnyContent
    };
  }
  
  return {
    content: content,
    hasContent: true
  };
}

/**
 * Testa os padrões contra exemplos conhecidos (para debugging)
 */
function runTests() {
  const tests = [
    { input: '123.456.789-10', shouldBlock: true, type: 'CPF' },
    { input: '12345678910', shouldBlock: true, type: 'CPF raw' },
    { input: '1234 5678 9012 3456', shouldBlock: true, type: 'Cartão' },
    { input: 'senha: abc123', shouldBlock: true, type: 'Senha' },
    { input: 'Edmar', shouldBlock: false, type: 'Nome' },
    { input: 'R$ 5000', shouldBlock: false, type: 'Salário' },
    { input: 'ganho R$ 5.000 por mês', shouldBlock: false, type: 'Renda' }
  ];
  
  console.log('[ContentValidator] Running tests...');
  for (const test of tests) {
    const result = checkForbiddenContent(test.input);
    const passed = result.found === test.shouldBlock;
    console.log(`  ${passed ? '✓' : '✗'} ${test.type}: "${test.input}" - ${result.found ? 'BLOCKED' : 'ALLOWED'}`);
  }
}

module.exports = {
  validateWorkingMemory,
  validateEpisodicMemory,
  checkForbiddenContent,
  isFirstName,
  runTests
};
