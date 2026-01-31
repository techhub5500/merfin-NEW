/**
 * NOTE (bridge-logger.js):
 * Purpose: Sistema de log focado e eficiente para o FinanceDataBridge.
 * Registra apenas decisões importantes, erros e métricas de performance.
 * Design: Log estruturado com níveis (INFO, WARN, ERROR, PERF).
 * Evita logs verbosos - máximo de informações úteis em mínimo espaço.
 */

const fs = require('fs');
const path = require('path');

/**
 * Níveis de log suportados
 */
const LOG_LEVELS = {
	INFO: 'INFO',   // Decisões e ações importantes
	WARN: 'WARN',   // Situações inesperadas mas tratáveis
	ERROR: 'ERROR', // Erros que afetam a execução
	PERF: 'PERF'    // Métricas de performance
};

/**
 * Classe BridgeLogger
 * Logger especializado para o FinanceDataBridge
 */
class BridgeLogger {
	constructor(options = {}) {
		this.enabled = options.enabled !== false;
		this.logToConsole = options.console !== false;
		this.logToFile = options.file === true;
		this.logDir = options.logDir || path.join(__dirname, '../../logs/bridge');
		this.sessionId = this._generateSessionId();
		this.entries = [];
		this.maxEntries = 100; // Mantém apenas últimas 100 entradas em memória
		
		// Cria diretório de logs se necessário
		if (this.logToFile) {
			this._ensureLogDir();
		}
	}

	/**
	 * Gera ID de sessão único
	 */
	_generateSessionId() {
		return `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
	}

	/**
	 * Garante que o diretório de logs existe
	 */
	_ensureLogDir() {
		if (!fs.existsSync(this.logDir)) {
			fs.mkdirSync(this.logDir, { recursive: true });
		}
	}

	/**
	 * Formata timestamp de forma compacta
	 */
	_formatTime() {
		const now = new Date();
		return now.toISOString().replace('T', ' ').substring(0, 19);
	}

	/**
	 * Adiciona entrada de log
	 * @param {string} level - Nível do log
	 * @param {string} action - Ação sendo executada
	 * @param {object} data - Dados relevantes (mantenha mínimo)
	 */
	_log(level, action, data = {}) {
		if (!this.enabled) return;

		const entry = {
			time: this._formatTime(),
			level,
			action,
			...data
		};

		// Mantém em memória (com limite)
		this.entries.push(entry);
		if (this.entries.length > this.maxEntries) {
			this.entries.shift();
		}

		// Formata saída compacta
		const output = this._formatOutput(entry);

		if (this.logToConsole) {
			const color = this._getColor(level);
			console.log(color, output);
		}

		if (this.logToFile) {
			this._writeToFile(output);
		}
	}

	/**
	 * Formata saída de forma compacta
	 */
	_formatOutput(entry) {
		const { time, level, action, ...rest } = entry;
		const dataStr = Object.keys(rest).length > 0 
			? ` | ${JSON.stringify(rest)}` 
			: '';
		return `[${time}] [${level}] ${action}${dataStr}`;
	}

	/**
	 * Retorna cor ANSI baseada no nível
	 */
	_getColor(level) {
		const colors = {
			INFO: '\x1b[36m%s\x1b[0m',   // Cyan
			WARN: '\x1b[33m%s\x1b[0m',   // Yellow
			ERROR: '\x1b[31m%s\x1b[0m',  // Red
			PERF: '\x1b[35m%s\x1b[0m'    // Magenta
		};
		return colors[level] || '%s';
	}

	/**
	 * Escreve no arquivo de log
	 */
	_writeToFile(output) {
		try {
			const date = new Date().toISOString().split('T')[0];
			const filename = path.join(this.logDir, `bridge_${date}.log`);
			fs.appendFileSync(filename, output + '\n');
		} catch (err) {
			// Silencioso - não quebra a aplicação por falha de log
		}
	}

	// ========== MÉTODOS PÚBLICOS ==========

	/**
	 * Registra início de execução
	 */
	startExecution(request) {
		this._log(LOG_LEVELS.INFO, 'EXEC_START', {
			action: request.action,
			domain: request.domain,
			userId: request.userId?.toString().slice(-6) // Apenas últimos 6 chars
		});
		return Date.now(); // Retorna timestamp para medir duração
	}

	/**
	 * Registra fim de execução com performance
	 */
	endExecution(startTime, resultCount = 0) {
		const duration = Date.now() - startTime;
		this._log(LOG_LEVELS.PERF, 'EXEC_END', {
			durationMs: duration,
			results: resultCount
		});
	}

	/**
	 * Registra decisão tomada
	 */
	decision(action, reason) {
		this._log(LOG_LEVELS.INFO, action, { reason });
	}

	/**
	 * Registra erro
	 */
	error(action, error, context = {}) {
		this._log(LOG_LEVELS.ERROR, action, {
			error: error.message || error,
			...context
		});
	}

	/**
	 * Registra warning
	 */
	warn(action, message, context = {}) {
		this._log(LOG_LEVELS.WARN, action, {
			msg: message,
			...context
		});
	}

	/**
	 * Registra query executada (apenas info essencial)
	 */
	query(domain, filters) {
		const summary = {};
		if (filters.dateRange) summary.range = filters.dateRange;
		if (filters.type) summary.type = filters.type;
		if (filters.section) summary.section = filters.section;
		
		this._log(LOG_LEVELS.INFO, 'QUERY', {
			domain,
			...summary
		});
	}

	/**
	 * Retorna resumo da sessão
	 */
	getSessionSummary() {
		const errors = this.entries.filter(e => e.level === 'ERROR').length;
		const perfs = this.entries.filter(e => e.level === 'PERF');
		const avgDuration = perfs.length > 0
			? Math.round(perfs.reduce((sum, e) => sum + (e.durationMs || 0), 0) / perfs.length)
			: 0;

		return {
			sessionId: this.sessionId,
			totalEntries: this.entries.length,
			errors,
			avgDurationMs: avgDuration
		};
	}
}

// Instância singleton
const logger = new BridgeLogger({
	enabled: true,
	console: process.env.NODE_ENV !== 'production',
	file: process.env.NODE_ENV === 'production'
});

module.exports = {
	BridgeLogger,
	logger,
	LOG_LEVELS
};
