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
    
    // Padrões de logs intermediários para IGNORAR
    this.intermediaryPatterns = [
      /iniciando|começando|starting/i,
      /verificando|checking/i,
      /preparando|preparing/i,
      /processando|processing(?! completed)/i, // exceto "completed"
      /carregando|loading(?! completed)/i,
      /etapa|step|fase/i,
      /primeiros \d+ chars/i,
      /texto de entrada/i,
      /texto com valores preservados/i,
      /buscando|searching/i,
      /match encontrado/i,
      /contexto extraído/i,
      /tentativa \d+/i,
      /═{3,}|─{3,}/  // separadores visuais
    ];
    
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
   */
  detectCategory(message) {
    const msg = String(message).toLowerCase();
    
    // BOUNDARY: entrada/saída do sistema
    if (/post \/api|mensagem do usuário|resposta (final )?da ia|enviando resposta/i.test(msg)) {
      return 'BOUNDARY';
    }
    
    // DECISION: decisões do sistema
    if (/(aceito|aceita|rejeitado|rejeitada|classificado|categoria final|impact score)/i.test(msg) &&
        !/(iniciando|verificando|buscando)/i.test(msg)) {
      return 'DECISION';
    }
    
    // STATE: mudanças de estado completo
    if (/(contexto completo|memory context loaded|processing completed|estado do sistema)/i.test(msg)) {
      return 'STATE';
    }
    
    // SUMMARY: resumos finais
    if (/(resumo|summary|resultado final|estatísticas|total de|fim -)/i.test(msg) &&
        !/(iniciando|etapa)/i.test(msg)) {
      return 'SUMMARY';
    }
    
    // COST: consumo de recursos
    if (/(tokens consumidos|custo total|consumo final)/i.test(msg)) {
      return 'COST';
    }
    
    // AI_PROMPT: prompts enviados à IA
    if (/(prompt completo|enviando para ia|contexto da ia)/i.test(msg)) {
      return 'AI_PROMPT';
    }
    
    // ERROR/WARN sempre passam
    if (/(erro|error|falhou|failed)/i.test(msg)) {
      return 'ERROR';
    }
    if (/(aviso|warning|atenção)/i.test(msg)) {
      return 'WARN';
    }
    
    // Default: DEBUG (será filtrado)
    return 'DEBUG';
  }

  /**
   * Verifica se é log intermediário (deve ser ignorado)
   */
  isIntermediaryLog(message) {
    const msg = String(message);
    
    // Testa padrões intermediários
    for (const pattern of this.intermediaryPatterns) {
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
