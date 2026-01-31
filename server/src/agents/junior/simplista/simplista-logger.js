/**
 * NOTE (simplista-logger.js):
 * Purpose: Sistema de log focado para o Agente Simplista.
 * Design: Registra apenas decisões, erros e métricas essenciais.
 * 
 * PRINCÍPIOS:
 * - Máximo 15-20 linhas por request
 * - Formato compacto: [time] [level] action | {data}
 * - 3 níveis: DECISION (default), ERROR, METRIC
 */

const fs = require('fs');
const path = require('path');

/**
 * Níveis de log suportados
 */
const LOG_LEVELS = {
	ERROR: 'ERROR',
	DECISION: 'DECISION',
	METRIC: 'METRIC'
};

/**
 * SimplistaLogger - Logger focado para o agente Simplista
 */
class SimplistaLogger {
	constructor(options = {}) {
		this.enabled = options.enabled !== false;
		this.level = options.level || 'DECISION';
		this.maxEntries = options.maxEntries || 100;
		this.writeToFile = options.writeToFile || process.env.NODE_ENV === 'production';
		
		// Buffer em memória
		this._buffer = [];
		
		// Métricas da sessão
		this._metrics = {
			totalRequests: 0,
			bridgeQueries: 0,
			serperQueries: 0,
			dialoguesStarted: 0,
			transitionsToComplex: 0,
			errors: 0,
			avgResponseTime: 0,
			_responseTimes: []
		};
		
		// Caminho do arquivo de log
		this._logPath = path.join(__dirname, '../../../../logs/simplista');
	}

	/**
	 * Formata timestamp compacto
	 * @private
	 */
	_timestamp() {
		const now = new Date();
		return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
	}

	/**
	 * Formata entrada de log
	 * @private
	 */
	_format(level, action, data = null) {
		const ts = this._timestamp();
		let line = `[${ts}] [${level}] ${action}`;
		
		if (data) {
			// Compacta data para uma linha
			const compact = typeof data === 'string' 
				? data 
				: JSON.stringify(data).replace(/"/g, '');
			line += ` | ${compact}`;
		}
		
		return line;
	}

	/**
	 * Adiciona entrada ao buffer
	 * @private
	 */
	_log(level, action, data) {
		if (!this.enabled) return;
		
		const entry = {
			timestamp: new Date().toISOString(),
			level,
			action,
			data
		};
		
		this._buffer.push(entry);
		
		// Limita tamanho do buffer
		if (this._buffer.length > this.maxEntries) {
			this._buffer.shift();
		}
		
		// Console output
		const formatted = this._format(level, action, data);
		
		if (level === LOG_LEVELS.ERROR) {
			console.error(`[Simplista] ${formatted}`);
		} else {
			console.log(`[Simplista] ${formatted}`);
		}
		
		// Escrita em arquivo (apenas produção)
		if (this.writeToFile) {
			this._writeToFile(formatted);
		}
	}

	/**
	 * Escreve em arquivo
	 * @private
	 */
	_writeToFile(line) {
		try {
			if (!fs.existsSync(this._logPath)) {
				fs.mkdirSync(this._logPath, { recursive: true });
			}
			
			const date = new Date().toISOString().split('T')[0];
			const filePath = path.join(this._logPath, `simplista_${date}.log`);
			
			fs.appendFileSync(filePath, line + '\n');
		} catch (error) {
			// Silently fail - não quebrar por causa de log
		}
	}

	// ========== MÉTODOS PÚBLICOS ==========

	/**
	 * Log de início de execução
	 * @param {string} userId - ID do usuário
	 * @param {string} query - Query original
	 * @returns {number} - Timestamp de início
	 */
	startExecution(userId, query) {
		this._metrics.totalRequests++;
		const preview = query.length > 50 ? query.substring(0, 50) + '...' : query;
		this._log(LOG_LEVELS.DECISION, 'START', { userId: userId.slice(-6), query: preview });
		return Date.now();
	}

	/**
	 * Log de decisão de classificação
	 * @param {object} classification - Resultado da classificação
	 */
	classification(classification) {
		const { needsFinance, needsExternal, isAmbiguous, isTransition } = classification;
		const flags = [];
		if (needsFinance) flags.push('BRIDGE');
		if (needsExternal) flags.push('SERPER');
		if (isAmbiguous) flags.push('AMBIG');
		if (isTransition) flags.push('TRANS');
		
		this._log(LOG_LEVELS.DECISION, 'CLASSIFY', flags.length ? flags.join(',') : 'DIRECT');
	}

	/**
	 * Log de consulta ao FinanceBridge
	 * @param {object} request - Requisição ao bridge
	 * @param {boolean} success - Se teve sucesso
	 */
	bridgeQuery(request, success) {
		this._metrics.bridgeQueries++;
		this._log(LOG_LEVELS.DECISION, 'BRIDGE', {
			action: request.action,
			domain: request.domain,
			success
		});
	}

	/**
	 * Log de consulta ao Serper
	 * @param {string} queryType - Tipo da query
	 * @param {boolean} fromCache - Se veio do cache
	 * @param {boolean} success - Se teve sucesso
	 */
	serperQuery(queryType, fromCache, success) {
		this._metrics.serperQueries++;
		this._log(LOG_LEVELS.DECISION, 'SERPER', {
			type: queryType,
			cache: fromCache,
			success
		});
	}

	/**
	 * Log de início de diálogo
	 * @param {string} ambiguityType - Tipo de ambiguidade
	 */
	dialogueStarted(ambiguityType) {
		this._metrics.dialoguesStarted++;
		this._log(LOG_LEVELS.DECISION, 'DIALOGUE', { type: ambiguityType });
	}

	/**
	 * Log de continuação de diálogo
	 * @param {number} attempt - Número da tentativa ou tipo de resolução
	 */
	dialogueContinued(attempt) {
		this._log(LOG_LEVELS.DECISION, 'DIALOGUE_CONT', { attempt });
	}

	/**
	 * Log de resposta construída
	 * @param {string} type - Tipo da resposta
	 * @param {boolean} hasDeepening - Se ofereceu aprofundamento
	 */
	responseBuilt(type, hasDeepening) {
		this._log(LOG_LEVELS.METRIC, 'RESPONSE', { type, deepening: hasDeepening });
	}

	/**
	 * Log de transição para complexo
	 * @param {string} suggestedDomain - Domínio sugerido
	 */
	transitionToComplex(suggestedDomain) {
		this._metrics.transitionsToComplex++;
		this._log(LOG_LEVELS.DECISION, 'TRANSITION', { domain: suggestedDomain });
	}

	/**
	 * Log de fim de execução
	 * @param {number} startTime - Timestamp de início
	 * @param {object} result - Resultado da execução
	 */
	endExecution(startTime, result) {
		const elapsed = Date.now() - startTime;
		
		// Atualiza métricas
		this._metrics._responseTimes.push(elapsed);
		if (this._metrics._responseTimes.length > 100) {
			this._metrics._responseTimes.shift();
		}
		this._metrics.avgResponseTime = Math.round(
			this._metrics._responseTimes.reduce((a, b) => a + b, 0) / 
			this._metrics._responseTimes.length
		);
		
		const sources = result.metadata?.fontesConsultadas || [];
		this._log(LOG_LEVELS.METRIC, 'END', {
			ms: elapsed,
			sources: sources.join(',') || 'none',
			deepening: result.metadata?.ofereceuAprofundamento || false
		});
	}

	/**
	 * Log de erro
	 * @param {string} action - Ação que falhou
	 * @param {Error} error - Erro ocorrido
	 * @param {object} context - Contexto adicional
	 */
	error(action, error, context = {}) {
		this._metrics.errors++;
		this._log(LOG_LEVELS.ERROR, action, {
			msg: error.message,
			...context
		});
	}

	/**
	 * Log de fallback
	 * @param {string} reason - Motivo do fallback
	 * @param {string} fallbackType - Tipo de fallback usado
	 */
	fallback(reason, fallbackType) {
		this._log(LOG_LEVELS.DECISION, 'FALLBACK', { reason, type: fallbackType });
	}

	// ========== MÉTRICAS ==========

	/**
	 * Retorna métricas da sessão
	 * @returns {object} - Métricas acumuladas
	 */
	getMetrics() {
		return {
			totalRequests: this._metrics.totalRequests,
			bridgeQueries: this._metrics.bridgeQueries,
			serperQueries: this._metrics.serperQueries,
			dialoguesStarted: this._metrics.dialoguesStarted,
			transitionsToComplex: this._metrics.transitionsToComplex,
			errors: this._metrics.errors,
			avgResponseTime: this._metrics.avgResponseTime,
			bridgeUsageRate: this._metrics.totalRequests > 0 
				? Math.round((this._metrics.bridgeQueries / this._metrics.totalRequests) * 100) 
				: 0,
			serperUsageRate: this._metrics.totalRequests > 0 
				? Math.round((this._metrics.serperQueries / this._metrics.totalRequests) * 100) 
				: 0
		};
	}

	/**
	 * Retorna resumo da sessão
	 * @returns {string} - Resumo formatado
	 */
	getSessionSummary() {
		const m = this.getMetrics();
		return [
			`📊 SIMPLISTA SESSION SUMMARY`,
			`   Requests: ${m.totalRequests}`,
			`   Bridge: ${m.bridgeQueries} (${m.bridgeUsageRate}%)`,
			`   Serper: ${m.serperQueries} (${m.serperUsageRate}%)`,
			`   Dialogues: ${m.dialoguesStarted}`,
			`   Transitions: ${m.transitionsToComplex}`,
			`   Errors: ${m.errors}`,
			`   Avg Time: ${m.avgResponseTime}ms`
		].join('\n');
	}

	/**
	 * Retorna buffer de logs recentes
	 * @param {number} count - Quantidade de entradas
	 * @returns {array} - Entradas recentes
	 */
	getRecentLogs(count = 20) {
		return this._buffer.slice(-count);
	}

	/**
	 * Limpa buffer
	 */
	clear() {
		this._buffer = [];
	}

	/**
	 * Reseta métricas
	 */
	resetMetrics() {
		this._metrics = {
			totalRequests: 0,
			bridgeQueries: 0,
			serperQueries: 0,
			dialoguesStarted: 0,
			transitionsToComplex: 0,
			errors: 0,
			avgResponseTime: 0,
			_responseTimes: []
		};
	}
}

// Instância singleton
const logger = new SimplistaLogger();

module.exports = {
	SimplistaLogger,
	logger,
	LOG_LEVELS
};
