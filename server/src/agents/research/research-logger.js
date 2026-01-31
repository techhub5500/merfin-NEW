/**
 * NOTE (research-logger.js):
 * Purpose: Sistema de logging inteligente com 3 níveis (CRITICAL, DECISION, VERBOSE).
 * Reduz logs de 500+ linhas para <30 linhas úteis em produção.
 * Controls: critical(), decision(), verbose() + métodos especializados.
 * Behavior: Filtra logs baseado no nível configurado via env ou construtor.
 * Integration notes: Usado em todos os componentes do Research Agent.
 */

const fs = require('fs');
const path = require('path');

/**
 * ResearchLogger - Sistema de Log Inteligente para Research Agent
 * 
 * Níveis:
 * - CRITICAL (0): Erros fatais, circuit breaker aberto, todas as fontes falharam
 * - DECISION (1): Decisões de roteamento, uso de fallback, IA acionada [PADRÃO]
 * - VERBOSE (2): Todos os detalhes (apenas em modo debug)
 * 
 * Meta: <30 linhas por requisição em nível DECISION
 */
class ResearchLogger {
	/**
	 * @param {object} options
	 * @param {string} options.logLevel - 'CRITICAL', 'DECISION', 'VERBOSE'
	 * @param {boolean} options.writeToFile - Se deve gravar em arquivo MD
	 * @param {string} options.logDir - Diretório para arquivos de log
	 */
	constructor(options = {}) {
		this.logLevel = options.logLevel || process.env.RESEARCH_LOG_LEVEL || 'DECISION';
		this.writeToFile = options.writeToFile ?? true;
		this.logDir = options.logDir || path.join(__dirname, '../../..', 'log');
		
		this.levels = {
			CRITICAL: 0,
			DECISION: 1,
			VERBOSE: 2
		};
		
		this.currentLevel = this.levels[this.logLevel] ?? 1;
		
		// Estatísticas da sessão
		this.sessionStats = {
			session_id: this._generateSessionId(),
			started_at: new Date().toISOString(),
			total_requests: 0,
			cache_hits: 0,
			cache_misses: 0,
			ai_used: 0,
			regex_used: 0,
			fallbacks_used: 0,
			errors: 0,
			circuit_breakers_open: new Set()
		};
		
		// Buffer para evitar writes excessivos
		this.buffer = [];
		this.bufferFlushInterval = 5000; // 5s
		this.maxBufferSize = 50;
		
		// Inicia flush periódico
		if (this.writeToFile) {
			this._initLogFile();
			this.flushTimer = setInterval(() => this._flushBuffer(), this.bufferFlushInterval);
		}
	}

	/**
	 * Gera ID único para sessão
	 * @private
	 */
	_generateSessionId() {
		const now = new Date();
		const date = now.toISOString().split('T')[0];
		const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
		const random = Math.random().toString(36).substring(2, 6);
		return `RS-${date}-${time}-${random}`;
	}

	/**
	 * Inicializa arquivo de log
	 * @private
	 */
	_initLogFile() {
		// Garante que diretório existe
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, { recursive: true });
		}
		
		const date = new Date().toISOString().split('T')[0];
		this.logFile = path.join(this.logDir, `research-agent-${date}.md`);
		
		// Header se arquivo não existe
		if (!fs.existsSync(this.logFile)) {
			const header = `# Research Agent Log - ${date}\n\n---\n\n`;
			fs.writeFileSync(this.logFile, header, 'utf8');
		}
		
		// Marca início de sessão
		const sessionHeader = `\n## Sessão ${this.sessionStats.session_id}\n**Início:** ${this.sessionStats.started_at}\n**Nível de Log:** ${this.logLevel}\n\n`;
		fs.appendFileSync(this.logFile, sessionHeader, 'utf8');
	}

	/**
	 * Verifica se deve logar neste nível
	 * @private
	 */
	_shouldLog(level) {
		return this.levels[level] <= this.currentLevel;
	}

	/**
	 * Log de erro crítico
	 * @param {string} message 
	 * @param {object} data 
	 */
	critical(message, data = {}) {
		if (!this._shouldLog('CRITICAL')) return;
		this._write('🔴 CRITICAL', message, data);
		this.sessionStats.errors++;
	}

	/**
	 * Log de decisão (padrão)
	 * @param {string} message 
	 * @param {object} data 
	 */
	decision(message, data = {}) {
		if (!this._shouldLog('DECISION')) return;
		this._write('⚡ DECISION', message, data);
	}

	/**
	 * Log verbose (debug)
	 * @param {string} message 
	 * @param {object} data 
	 */
	verbose(message, data = {}) {
		if (!this._shouldLog('VERBOSE')) return;
		this._write('📝 VERBOSE', message, data);
	}

	// ========== MÉTODOS ESPECIALIZADOS ==========

	/**
	 * Loga início de requisição
	 * @param {object} request - Parâmetros da requisição
	 * @param {object} analysis - Resultado da análise semântica
	 */
	logRequest(request, analysis) {
		this.sessionStats.total_requests++;
		
		const analysisType = analysis._aiUsed ? 'IA' : 'REGEX';
		if (analysis._aiUsed) {
			this.sessionStats.ai_used++;
		} else {
			this.sessionStats.regex_used++;
		}
		
		this.decision('Nova requisição', {
			objetivo: this._truncate(request.objetivo, 60),
			entidades: (analysis.entidades || []).slice(0, 5).join(', ') || 'nenhuma',
			analise: analysisType,
			...(analysis._aiUsed && { tokens_ai: analysis._aiTokens })
		});
	}

	/**
	 * Loga plano de roteamento
	 * @param {object} plan - Plano de execução
	 */
	logRouting(plan) {
		this.decision('Roteamento', {
			modo: plan.executionMode,
			fontes: plan.steps.map(s => s.fonte).join(' → '),
			steps: plan.steps.length
		});
	}

	/**
	 * Loga hit de cache
	 * @param {string} fingerprint 
	 * @param {number} ageHours 
	 */
	logCacheHit(fingerprint, ageHours) {
		this.sessionStats.cache_hits++;
		this.decision('Cache HIT', { 
			fp: fingerprint.substring(0, 8),
			idade: `${ageHours}h`
		});
	}

	/**
	 * Loga miss de cache
	 * @param {string} fingerprint 
	 */
	logCacheMiss(fingerprint) {
		this.sessionStats.cache_misses++;
		this.verbose('Cache MISS', { fp: fingerprint.substring(0, 8) });
	}

	/**
	 * Loga uso de fallback
	 * @param {string} fonte - Fonte que falhou
	 * @param {number} nivel - Nível do fallback (1-4)
	 * @param {boolean} sucesso - Se o fallback teve sucesso
	 */
	logFallback(fonte, nivel, sucesso) {
		this.sessionStats.fallbacks_used++;
		const status = sucesso ? '✓' : '✗';
		this.decision(`Fallback L${nivel} ${fonte}`, { resultado: status });
	}

	/**
	 * Loga estado do circuit breaker
	 * @param {string} api - Nome da API
	 * @param {string} state - 'OPEN', 'HALF_OPEN', 'CLOSED'
	 * @param {object} details - Detalhes adicionais
	 */
	logCircuitBreaker(api, state, details = {}) {
		if (state === 'OPEN') {
			this.sessionStats.circuit_breakers_open.add(api);
			this.critical(`Circuit Breaker OPEN: ${api}`, {
				proxima_tentativa: details.nextAttempt || 'N/A'
			});
		} else if (state === 'HALF_OPEN') {
			this.decision(`Circuit Breaker HALF_OPEN: ${api}`, {
				acao: 'Testando recuperação'
			});
		} else if (state === 'CLOSED') {
			this.sessionStats.circuit_breakers_open.delete(api);
			this.decision(`Circuit Breaker CLOSED: ${api}`, {
				status: 'Recuperado'
			});
		}
	}

	/**
	 * Loga resultado de execução de step
	 * @param {string} fonte - Fonte executada
	 * @param {boolean} sucesso - Se teve sucesso
	 * @param {number} tempoMs - Tempo em ms
	 */
	logStepResult(fonte, sucesso, tempoMs) {
		const status = sucesso ? '✓' : '✗';
		this.verbose(`Step ${fonte}`, { 
			resultado: status, 
			tempo: `${tempoMs}ms` 
		});
	}

	/**
	 * Loga erro com contexto
	 * @param {Error} error 
	 * @param {object} context 
	 */
	logError(error, context = {}) {
		this.critical('Erro', {
			mensagem: error.message,
			contexto: this._truncate(JSON.stringify(context), 100)
		});
	}

	/**
	 * Loga resposta final
	 * @param {number} tempoTotalMs - Tempo total de execução
	 * @param {number} fontesUsadas - Número de fontes usadas
	 * @param {boolean} usouFallback - Se usou fallback
	 */
	logResponse(tempoTotalMs, fontesUsadas, usouFallback) {
		this.decision('Resposta enviada', {
			tempo: `${tempoTotalMs}ms`,
			fontes: fontesUsadas,
			...(usouFallback && { fallback: true })
		});
	}

	/**
	 * Loga estatísticas da sessão
	 */
	logSessionStats() {
		const total = this.sessionStats.total_requests;
		if (total === 0) return;
		
		const cacheRate = ((this.sessionStats.cache_hits / total) * 100).toFixed(1);
		const aiRate = ((this.sessionStats.ai_used / total) * 100).toFixed(1);
		
		this.decision('📊 Stats', {
			requests: total,
			cache: `${cacheRate}%`,
			ia: `${aiRate}%`,
			fallbacks: this.sessionStats.fallbacks_used,
			erros: this.sessionStats.errors
		});
	}

	// ========== MÉTODOS INTERNOS ==========

	/**
	 * Trunca string para tamanho máximo
	 * @private
	 */
	_truncate(str, maxLen) {
		if (!str) return '';
		if (str.length <= maxLen) return str;
		return str.substring(0, maxLen - 3) + '...';
	}

	/**
	 * Formata dados para log compacto
	 * @private
	 */
	_formatData(data) {
		if (Object.keys(data).length === 0) return '';
		
		// Formato compacto: key=value, key2=value2
		return Object.entries(data)
			.map(([k, v]) => {
				const val = typeof v === 'object' ? JSON.stringify(v) : v;
				return `${k}=${val}`;
			})
			.join(', ');
	}

	/**
	 * Escreve log
	 * @private
	 */
	_write(level, message, data) {
		const time = new Date().toTimeString().split(' ')[0];
		const dataStr = this._formatData(data);
		
		const line = dataStr 
			? `[${time}] ${level} ${message} | ${dataStr}`
			: `[${time}] ${level} ${message}`;
		
		// Console
		console.log(line);
		
		// Buffer para arquivo
		if (this.writeToFile) {
			this.buffer.push(line);
			
			if (this.buffer.length >= this.maxBufferSize) {
				this._flushBuffer();
			}
		}
	}

	/**
	 * Flush buffer para arquivo
	 * @private
	 */
	_flushBuffer() {
		if (this.buffer.length === 0) return;
		
		try {
			const content = this.buffer.join('\n') + '\n';
			fs.appendFileSync(this.logFile, content, 'utf8');
			this.buffer = [];
		} catch (error) {
			console.error('[ResearchLogger] Erro ao gravar log:', error.message);
		}
	}

	/**
	 * Retorna estatísticas atuais
	 */
	getStats() {
		const total = this.sessionStats.total_requests || 1;
		return {
			session_id: this.sessionStats.session_id,
			started_at: this.sessionStats.started_at,
			total_requests: this.sessionStats.total_requests,
			cache_hit_rate: ((this.sessionStats.cache_hits / total) * 100).toFixed(1) + '%',
			ai_usage_rate: ((this.sessionStats.ai_used / total) * 100).toFixed(1) + '%',
			fallbacks_used: this.sessionStats.fallbacks_used,
			errors: this.sessionStats.errors,
			circuit_breakers_open: Array.from(this.sessionStats.circuit_breakers_open)
		};
	}

	/**
	 * Limpa recursos (chamar ao encerrar)
	 */
	destroy() {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
		}
		
		// Flush final
		this._flushBuffer();
		
		// Log de encerramento
		const endTime = new Date().toISOString();
		const footer = `\n**Fim da Sessão:** ${endTime}\n---\n`;
		
		if (this.writeToFile && this.logFile) {
			fs.appendFileSync(this.logFile, footer, 'utf8');
		}
	}
}

module.exports = ResearchLogger;
