/**
 * Sistema de Logging para OBSERVABILIDADE DE DECISÕES
 * - Registra transições de estado relevantes, não debug interno
 * - Filtra logs intermediários e mantém apenas decisões finais
 * - Aplica REGRA-MÃE: só registra o que muda estado ou produz efeito observável
 * 
 * CATEGORIAS:
 * - BOUNDARY: entrada/saída do sistema (user input, AI output)
 * - DECISION: decisões do sistema (aceito/rejeitado, classificações)
 * - STATE: mudanças de estado completo/final
 * - SUMMARY: resumos finais de processamento
 * - COST: consumo de recursos (tokens)
 * - DEBUG: logs intermediários (FILTRADOS por padrão)
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.logDir = path.join(__dirname, '../../..', 'log');
    this.currentLogFile = null;
    this.writeStream = null;
    this.debugMode = options.debugMode || process.env.DEBUG_MODE === 'true' || false;
    this.cleanupInterval = null;
    this.logFileCreationTime = null;
    
    // Categorias de logs permitidos (filtro)
    this.allowedCategories = new Set([
      'BOUNDARY',    // Input/Output do sistema
      'DECISION',    // Decisões do sistema
      'STATE',       // Mudanças de estado completo
      'SUMMARY',     // Resumos finais
      'COST',        // Consumo de recursos
      'AI_PROMPT',   // Prompts completos enviados à IA
      'ERROR',       // Erros sempre são registrados
      'WARN'         // Warnings sempre são registrados
    ]);
    
    // Padrões de logs intermediários removidos - agora defini em isIntermediaryLog()
    
    // Buffer para detectar logs duplicados
    this.recentLogs = [];
    this.maxRecentLogs = 5;
    
    // Guardar referências originais do console
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console)
    };
    
    this.initialize();
  }

  /**
   * Inicializa o sistema de logging
   */
  initialize() {
    // Criar diretório de logs se não existir
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Criar novo arquivo de log
    this.createNewLogFile();

    // Interceptar console
    this.interceptConsole();

    // Iniciar sistema de auto-limpeza (verifica a cada 1 minuto)
    this.startCleanupTimer();

    // Log inicial minimalista
    this.logDirect('INFO', '📋 Sistema de logging inicializado (modo observabilidade)', {
      debugMode: this.debugMode,
      autoCleanup: '5 minutos',
      aiPromptLogging: 'ATIVO'
    });
  }

  /**
   * Cria novo arquivo de log com timestamp
   */
  createNewLogFile() {
    const now = new Date();
    const timestamp = this.formatFileTimestamp(now);
    const fileName = `log_${timestamp}.md`;
    this.currentLogFile = path.join(this.logDir, fileName);
    this.logFileCreationTime = now;

    // Fechar stream anterior se existir
    if (this.writeStream) {
      this.writeStream.end();
    }

    // Criar novo stream
    this.writeStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });

    // Cabeçalho simplificado
    const header = `# 📋 LOG DE OBSERVABILIDADE\n\n**Data/Hora:** ${now.toLocaleString('pt-BR')}  \n**Modo:** ${this.debugMode ? 'DEBUG' : 'OBSERVABILIDADE'}  \n**Filtro:** BOUNDARY | DECISION | STATE | SUMMARY | COST | AI_PROMPT\n\n---\n\n`;
    this.writeStream.write(header);
  }

  /**
   * Formata timestamp para nome de arquivo
   */
  formatFileTimestamp(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }

  /**
   * Formata timestamp para log entry
   */
  formatLogTimestamp(date) {
    return date.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }

  /**
   * Detecta categoria do log baseado no conteúdo
   * FOCO: Somente comportamentos estratégicos do sistema
   */
  detectCategory(message) {
    const msg = String(message).toLowerCase();
    
    // =========================
    // SYSTEM TRIAGE & BEHAVIOR (JuniorAgent V2)
    // =========================
    
    // Classificação primária (TRIVIAL/LANÇAMENTO/SIMPLISTA/COMPLEXA)
    if (/(🔵|🟡|🟠|🟢).*(classificação|categoria identificada|fluxo trivial|fluxo lançamento|fluxo simplista|fluxo complexa)/i.test(msg)) {
      return 'DECISION';
    }

    // Classificação bem-sucedida
    if (/classificação bem-sucedida/i.test(msg)) {
      return 'DECISION';
    }
    
    // Análise secundária (domínio + coordenador + prompts)
    if (/(análise secundária concluída|dominio:|coordenador:|prompts_orquestracao|iniciando análise secundária)/i.test(msg)) {
      return 'DECISION';
    }
    
    // Handover e roteamento para coordenadores
    if (/(montando pacote|pacote montado|roteando para|enviando para coordenador|resposta do coord_|📤|📦)/i.test(msg)) {
      return 'STATE';
    }
    
    // Memória - logs estratégicos
    if (/(💾|memória carregada|memória salva|memória preparada|read_only|read_write|write_only)/i.test(msg)) {
      return 'STATE';
    }

    // Stubs de agentes (Lançador/Simplista)
    if (/\[stub\]|modo teste/i.test(msg)) {
      return 'STATE';
    }

    // Tokens consumidos
    if (/tokens consumidos/i.test(msg)) {
      return 'COST';
    }

    // Resposta recebida (latência)
    if (/(resposta.*recebida.*em|⏱️)/i.test(msg)) {
      return 'SUMMARY';
    }
    
    // =========================
    // ORIGINAL CATEGORIES
    // =========================
    
    // BOUNDARY: entrada/saída do sistema
    if (/post \/api|📨.*processando mensagem|resposta (final )?da ia|enviando resposta/i.test(msg)) {
      return 'BOUNDARY';
    }
    
    // DECISION: decisões do sistema (mantém origináis mas filtra intermediárias)
    if (/(aceito|aceita|rejeitado|rejeitada|impact score)/i.test(msg) &&
        !/(iniciando|verificando|buscando)/i.test(msg)) {
      return 'DECISION';
    }
    
    // STATE: mudanças de estado completo
    if (/(contexto completo|memory context loaded|processing completed|estado do sistema)/i.test(msg)) {
      return 'STATE';
    }
    
    // SUMMARY: resumos finais
    if (/(resumo|summary|resultado final|estatísticas|total de|fim -|✅.*concluíd)/i.test(msg) &&
        !/(iniciando|etapa)/i.test(msg)) {
      return 'SUMMARY';
    }
    
    // COST: consumo de recursos
    if (/(tokens consumidos|custo total|consumo final|💰)/i.test(msg)) {
      return 'COST';
    }
    
    // AI_PROMPT: prompts enviados à IA
    if (/(prompt completo|enviando para ia|contexto da ia)/i.test(msg)) {
      return 'AI_PROMPT';
    }
    
    // ERROR/WARN sempre passam
    if (/(erro|error|falhou|failed|❌)/i.test(msg)) {
      return 'ERROR';
    }
    if (/(aviso|warning|atenção|⚠️)/i.test(msg)) {
      return 'WARN';
    }

    // Fallback logs - permitem fluxo informativo
    if (/🔄.*fallback/i.test(msg)) {
      return 'WARN';
    }
    
    // Default: DEBUG (será filtrado)
    return 'DEBUG';
  }

  /**
   * Verifica se é log intermediário (deve ser ignorado)
   * FOCO: Remove apenas logs REALMENTE desnecessários
   * Mantém logs estratégicos do JuniorAgent V2
   */
  isIntermediaryLog(message) {
    const msg = String(message);
    
    // NUNCA filtrar logs estratégicos do JuniorAgent
    const strategicPatterns = [
      /classificação|categoria/i,
      /fluxo (trivial|lançamento|simplista|complexa)/i,
      /análise secundária/i,
      /handover|roteando para|coordenador/i,
      /memória (carregada|salva|preparada)/i,
      /\[stub\]|modo teste/i,
      /tokens consumidos|💰/i,
      /resposta.*recebida/i,
      /fallback/i,
      /📨|📤|📦|💾|🔵|🟡|🟠|🟢|✅|❌|⚠️|🚀/
    ];
    
    for (const pattern of strategicPatterns) {
      if (pattern.test(msg)) {
        return false; // NÃO filtrar - é log estratégico
      }
    }
    
    // Padrões intermediários que NÃO agregam informação (RIGOROSO)
    const densePatterns = [
      /iniciando|começando|starting/i,           // Muito vago
      /verificando|checking/i,                   // Intermediário
      /preparando|preparing/i,                   // Intermediário
      /processando|processing(?! completed)/i,   // Exceto "processing completed"
      /carregando|loading(?! completo)/i,        // Exceto "loading completo"
      /buscando|searching/i,                     // Intermediário
      /tentativa \d+/i,                          // Retry attempts - desnecessário
      /═{3,}|─{3,}/,                             // Separadores visuais
      /etapa|phase|stage/i,                      // Muito genérico
      /primeiros \d+ chars/i,                    // Debug interno
      /texto de entrada|input text/i,            // Intermediário
      /contexto extraído|extracted context/i,    // Intermediário
      /match encontrado/i,                       // Intermediário
      /função.*chamada/i,                        // Debug de função
      /aguardando|waiting/i,                     // Intermediário
      /finalizando|finalizing/i,                 // Intermediário
      /obtendo|getting/i,                        // Muito vago
      /analisando|analyzing(?! completo)/i,      // Exceto "analyzing completo"
      /prompt construído/i,                      // Debug interno (mantido no AI_PROMPT)
      /systemlength|contextlength/i             // Debug de tamanho
    ];
    
    // Testa padrões intermediários
    for (const pattern of densePatterns) {
      if (pattern.test(msg)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Verifica se o log é duplicado (recentemente registrado)
   */
  isDuplicateLog(message) {
    const msgStr = String(message);
    
    // Remove timestamps e emojis para comparação
    const normalized = msgStr.replace(/\d{2}:\d{2}:\d{2}/g, '').replace(/[🚀🔍✅❌⏭️💾📊🎯📝]/g, '').trim();
    
    if (this.recentLogs.includes(normalized)) {
      return true;
    }
    
    this.recentLogs.push(normalized);
    if (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs.shift();
    }
    
    return false;
  }

  /**
   * Escreve no arquivo de log (com filtros)
   */
  log(level, ...args) {
    // Se não houver argumentos, ignora
    if (args.length === 0) return;
    
    const firstArg = args[0];
    
    // Detecta categoria do log
    const category = this.detectCategory(firstArg);
    
    // Se modo debug desativado, filtra DEBUG
    if (!this.debugMode && category === 'DEBUG') {
      return;
    }
    
    // Filtra logs intermediários
    if (this.isIntermediaryLog(firstArg)) {
      return;
    }
    
    // Filtra logs duplicados
    if (this.isDuplicateLog(firstArg)) {
      return;
    }
    
    // Se não é categoria permitida, ignora
    if (!this.allowedCategories.has(category)) {
      return;
    }
    
    // Escreve no arquivo
    this.logDirect(level, ...args);
  }

  /**
   * Escreve diretamente no arquivo (sem filtros)
   */
  logDirect(level, ...args) {
    const timestamp = this.formatLogTimestamp(new Date());
    
    // Formato simplificado
    const headerLine = `**${timestamp}** [${level}]`;

    const bodyParts = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          // Objetos pequenos inline, grandes em bloco
          const jsonStr = JSON.stringify(arg, null, 2);
          if (jsonStr.length < 100) {
            return '`' + JSON.stringify(arg) + '`';
          }
          return '```json\n' + jsonStr + '\n```';
        } catch (error) {
          return '`' + String(arg) + '`';
        }
      }
      return String(arg);
    });

    const logEntry = `${headerLine} ${bodyParts.join(' ')}\n\n`;

    // Escrever no arquivo
    if (this.writeStream) {
      this.writeStream.write(logEntry);
    }

    // Se modo debug, mostrar no terminal também
    if (this.debugMode) {
      const consoleMethod = level === 'ERROR' ? this.originalConsole.error :
                           level === 'WARN' ? this.originalConsole.warn :
                           this.originalConsole.log;
      consoleMethod(`[${level}]`, ...args);
    }
  }

  /**
   * Intercepta métodos do console
   */
  interceptConsole() {
    console.log = (...args) => {
      this.log('LOG', ...args);
    };

    console.error = (...args) => {
      this.log('ERROR', ...args);
    };

    console.warn = (...args) => {
      this.log('WARN', ...args);
    };

    console.info = (...args) => {
      this.log('INFO', ...args);
    };
  }

  /**
   * Restaura console original (útil para debugging)
   */
  restoreConsole() {
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
  }

  /**
   * Inicia timer de auto-limpeza
   */
  startCleanupTimer() {
    // Verificar a cada 1 minuto
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldLogs();
    }, 60 * 1000); // 60 segundos

    // Garantir que o timer não impeça o processo de encerrar
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Remove arquivos de log com mais de 5 minutos
   */
  cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const fiveMinutesInMs = 5 * 60 * 1000;

      files.forEach(file => {
        if (!file.startsWith('log_') || !file.endsWith('.md')) {
          return;
        }

        const filePath = path.join(this.logDir, file);

        // Não deletar o arquivo atual
        if (filePath === this.currentLogFile) {
          return;
        }

        const stats = fs.statSync(filePath);
        const fileAge = now - stats.birthtimeMs;

        if (fileAge > fiveMinutesInMs) {
          fs.unlinkSync(filePath);
          // Não loga a remoção (não é relevante para observabilidade)
        }
      });
    } catch (error) {
      this.logDirect('ERROR', '❌ Erro ao limpar logs antigos:', error.message);
    }
  }

  /**
   * Encerra o logger gracefully
   */
  shutdown() {
    this.logDirect('INFO', '🛑 Sistema de logging encerrado');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.writeStream) {
      this.writeStream.end();
    }

    this.restoreConsole();
  }

  /**
   * Alterna modo debug
   */
  toggleDebugMode(enabled) {
    this.debugMode = enabled;
    this.logDirect('INFO', `🔧 Modo debug ${enabled ? 'ATIVADO' : 'DESATIVADO'}`);
  }

  /**
   * Log específico para prompts enviados à IA
   * @param {string} model - Modelo da IA
   * @param {string} systemPrompt - System prompt
   * @param {string} userContext - Contexto/mensagem do usuário
   * @param {object} metadata - Metadados adicionais
   */
  logAIPrompt(model, systemPrompt, userContext, metadata = {}) {
    // Extract memory info if provided or infer from prompts
    const memoryInfo = metadata.memoryInfo || this._extractMemoryInfo(systemPrompt, userContext);
    // Copy metadata without memoryInfo to avoid duplication
    const metaCopy = { ...metadata };
    delete metaCopy.memoryInfo;

    // Truncate user context in observability logs when not in debug mode
    // CORREÇÃO: Aumentado limite de 600 para 2000 para ver histórico completo
    const userPreview = (typeof userContext === 'string')
      ? (this.debugMode ? userContext : (userContext.length > 2000 ? userContext.slice(0, 2000) + '\n\n[...TRUNCADO...]' : userContext))
      : userContext;

    this.logDirect('AI_PROMPT', '🤖 PROMPT COMPLETO ENVIADO PARA IA', {
      model,
      timestamp: new Date().toISOString(),
      memory: memoryInfo,
      ...metaCopy,
      prompt: {
        system: systemPrompt,
        user: userPreview
      }
    });
  }

  /**
   * ============================================
   * LOGS ESTRATÉGICOS DO SISTEMA DE TRIAGEM V2
   * ============================================
   */

  /**
   * Log de entrada de mensagem (início do fluxo)
   */
  logMessageReceived(userId, messagePreview) {
    const preview = messagePreview.length > 50 ? messagePreview.slice(0, 50) + '...' : messagePreview;
    this.logDirect('LOG', `📨 Nova mensagem recebida`, {
      userId,
      preview,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de classificação de query (TRIVIAL/LANÇAMENTO/SIMPLISTA/COMPLEXA)
   */
  logClassification(categoria, confidence = null) {
    const icons = {
      'trivial': '🟢',
      'lancamento': '🟡',
      'simplista': '🟡',
      'complexa': '🟠'
    };
    const icon = icons[categoria] || '🔵';
    
    this.logDirect('LOG', `${icon} Classificação: ${categoria.toUpperCase()}${confidence ? ` (confiança: ${confidence})` : ''}`);
  }

  /**
   * Log de fluxo selecionado
   */
  logFlowSelected(fluxo, memoryPolicy = null) {
    const icons = {
      'trivial': '🟢',
      'lancamento': '🟡',
      'simplista': '🟡',
      'complexa': '🟠'
    };
    const icon = icons[fluxo] || '🔵';
    
    this.logDirect('LOG', `${icon} Fluxo selecionado: ${fluxo.toUpperCase()}`, {
      memoryPolicy: memoryPolicy || 'N/A',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de análise secundária (domínio + coordenador + prompts)
   */
  logSecondaryAnalysis(analysis) {
    this.logDirect('LOG', '🟠 Análise Secundária Concluída', {
      dominio: analysis.dominio_id || analysis.dominio,
      coordenador: analysis.coordenador_selecionado || analysis.coordenador,
      prompts: analysis.prompts_orquestracao_ids || analysis.prompts,
      justificativa: analysis.justificativa_breve || 'N/A',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de handover para coordenador
   */
  logHandover(coordenador, dominio, promptsCount = 1) {
    this.logDirect('LOG', `📤 Handover → ${coordenador}`, {
      dominio,
      promptsCarregados: promptsCount,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de resposta do coordenador
   */
  logCoordinatorResponse(coordenador, elapsedMs, responseLength = 0) {
    this.logDirect('LOG', `✅ Resposta ${coordenador}`, {
      latencia: `${elapsedMs}ms`,
      caracteres: responseLength,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de roteamento para stubs (Lançador/Simplista)
   */
  logStubRoute(agente, hasContext = false) {
    this.logDirect('LOG', `🟡 [STUB] Roteando para ${agente}`, {
      contextoDisponivel: hasContext,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de fallback
   */
  logFallback(from, to, reason = '') {
    this.logDirect('WARN', `🔄 Fallback: ${from} → ${to}`, {
      motivo: reason || 'erro no processamento',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de carregamento de memória
   */
  logMemoryLoaded(memoryStatus) {
    this.logDirect('LOG', '💾 Memória Carregada', {
      hasSummary: memoryStatus.hasSummary || false,
      recentWindowSize: memoryStatus.recentWindowSize || 0,
      policy: memoryStatus.policy || 'READ_WRITE',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de salvamento de memória
   */
  logMemorySaved(action = 'SALVA', details = {}) {
    this.logDirect('LOG', `💾 Memória ${action}`, {
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de consumo de tokens
   */
  logTokenUsage(component, usage) {
    this.logDirect('LOG', `💰 Tokens (${component})`, {
      prompt: usage.prompt_tokens || 0,
      completion: usage.completion_tokens || 0,
      total: usage.total_tokens || 0
    });
  }

  /**
   * Log de erro estratégico (diferente de erro técnico)
   */
  logStrategicError(component, errorType, message) {
    this.logDirect('ERROR', `❌ ${component}: ${errorType}`, {
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de fim de processamento (resumo)
   */
  logProcessingComplete(fluxo, elapsedMs, success = true) {
    const icon = success ? '✅' : '❌';
    this.logDirect('LOG', `${icon} Processamento ${fluxo} concluído`, {
      latenciaTotal: `${elapsedMs}ms`,
      sucesso: success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Extrai informações resumidas sobre o histórico de memória presente no contexto
   * Isso fornece dados úteis para observabilidade sem persistir todo o texto
   */
  _extractMemoryInfo(systemPrompt, userContext) {
    try {
      const uc = typeof userContext === 'string' ? userContext : '';
      const hasSummary = uc.includes('[HISTÓRICO_RESUMIDO]');
      const hasWindow = uc.includes('[JANELA_ATUAL]');

      // Count U: and A: occurrences as proxy for messages in the window
      const userCount = (uc.match(/\n?U:/g) || []).length;
      const assistantCount = (uc.match(/\n?A:/g) || []).length;
      const recentWindowCount = userCount + assistantCount;

      // Extract small previews
      let summaryPreview = '';
      if (hasSummary) {
        const m = uc.match(/\[HISTÓRICO_RESUMIDO\]\n([\s\S]*?)(?:\n\n|$)/);
        if (m && m[1]) summaryPreview = m[1].trim().slice(0, 300);
      }

      let recentPreview = '';
      if (hasWindow) {
        const m2 = uc.match(/\[JANELA_ATUAL\]\n([\s\S]*?)(?:\n\n|$)/);
        if (m2 && m2[1]) recentPreview = m2[1].trim().slice(0, 300);
      }

      // Estimate tokens roughly (1 word = 0.75 tokens)
      const words = (systemPrompt + ' ' + uc).trim().split(/\s+/).filter(Boolean).length;
      const estimatedInputTokens = Math.ceil(words * 0.75);

      return {
        hasSummary,
        summaryPreview,
        recentWindowCount,
        recentPreview,
        estimatedInputTokens
      };
    } catch (err) {
      return { hasSummary: false, summaryPreview: '', recentWindowCount: 0, recentPreview: '', estimatedInputTokens: 0 };
    }
  }

  /**
   * Retorna informações sobre logs
   */
  getLogInfo() {
    const files = fs.readdirSync(this.logDir);
    const logFiles = files.filter(f => f.startsWith('log_') && f.endsWith('.md'));
    
    return {
      currentLogFile: this.currentLogFile,
      logDir: this.logDir,
      debugMode: this.debugMode,
      totalLogFiles: logFiles.length,
      logFiles: logFiles.map(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        const ageMinutes = Math.round((Date.now() - stats.birthtimeMs) / 60000);
        
        return {
          name: file,
          path: filePath,
          size: `${(stats.size / 1024).toFixed(2)} KB`,
          created: stats.birthtime.toLocaleString('pt-BR'),
          ageMinutes,
          willDeleteIn: Math.max(0, 5 - ageMinutes) + ' min'
        };
      })
    };
  }
}

// Singleton instance
let loggerInstance = null;

/**
 * Inicializa o logger (chamar no início da aplicação)
 */
function initLogger(options = {}) {
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  }
  return loggerInstance;
}

/**
 * Obtém a instância do logger
 */
function getLogger() {
  if (!loggerInstance) {
    throw new Error('Logger não foi inicializado. Chame initLogger() primeiro.');
  }
  return loggerInstance;
}

/**
 * Encerra o logger
 */
function shutdownLogger() {
  if (loggerInstance) {
    loggerInstance.shutdown();
    loggerInstance = null;
  }
}

module.exports = {
  initLogger,
  getLogger,
  shutdownLogger,
  Logger
};
