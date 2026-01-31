/**
 * NOTE (circuit-breaker.js):
 * Purpose: Implementa o padrão Circuit Breaker para prevenir cascata de falhas
 * quando APIs externas estão indisponíveis.
 * Controls: execute() envolve chamadas, estados: CLOSED, OPEN, HALF_OPEN.
 * Behavior: Após N falhas consecutivas, abre circuito por X segundos.
 * Em HALF_OPEN, tenta uma requisição de teste.
 * Integration notes: Usado por todos os API clients (Brapi, Tavily, Serper).
 */

/**
 * CircuitBreaker - Previne Cascata de Falhas
 * 
 * Estados:
 * - CLOSED: Normal, requisições passam
 * - OPEN: Bloqueado, rejeita requisições imediatamente
 * - HALF_OPEN: Testando se serviço voltou
 * 
 * Transições:
 * - CLOSED → OPEN: Após failureThreshold falhas consecutivas
 * - OPEN → HALF_OPEN: Após resetTimeout
 * - HALF_OPEN → CLOSED: Se requisição de teste suceder
 * - HALF_OPEN → OPEN: Se requisição de teste falhar
 */
class CircuitBreaker {
	/**
	 * @param {string} name - Nome do serviço (ex: 'BRAPI', 'TAVILY')
	 * @param {object} options - Configurações
	 * @param {number} options.failureThreshold - Falhas para abrir (default: 3)
	 * @param {number} options.resetTimeout - Tempo em OPEN em ms (default: 120000 = 2min)
	 * @param {number} options.halfOpenRequests - Requisições de teste (default: 1)
	 */
	constructor(name, options = {}) {
		this.name = name;
		this.state = 'CLOSED';
		this.failureCount = 0;
		this.successCount = 0;
		this.lastFailureTime = null;
		this.nextAttempt = Date.now();
		
		// Configurações
		this.failureThreshold = options.failureThreshold || 3;
		this.resetTimeout = options.resetTimeout || 120000; // 2 minutos
		this.halfOpenRequests = options.halfOpenRequests || 1;
		
		// Callbacks opcionais
		this.onStateChange = options.onStateChange || null;
	}

	/**
	 * Executa função protegida pelo circuit breaker
	 * @param {Function} fn - Função assíncrona a executar
	 * @returns {Promise<any>} - Resultado da função
	 * @throws {Error} - Se circuito aberto ou função falhar
	 */
	async execute(fn) {
		// Verifica estado do circuito
		if (this.state === 'OPEN') {
			if (Date.now() < this.nextAttempt) {
				const waitTime = Math.ceil((this.nextAttempt - Date.now()) / 1000);
				throw new Error(
					`[CIRCUIT BREAKER] ${this.name} está OPEN. ` +
					`Tente novamente em ${waitTime}s`
				);
			}
			
			// Tempo de espera passou, tenta HALF_OPEN
			this._transitionTo('HALF_OPEN');
		}

		try {
			const result = await fn();
			this._onSuccess();
			return result;
		} catch (error) {
			this._onFailure(error);
			throw error;
		}
	}

	/**
	 * Chamado quando requisição sucede
	 * @private
	 */
	_onSuccess() {
		if (this.state === 'HALF_OPEN') {
			this.successCount++;
			
			if (this.successCount >= this.halfOpenRequests) {
				this._transitionTo('CLOSED');
			}
		} else if (this.state === 'CLOSED') {
			// Reset contador de falhas após sucesso
			this.failureCount = 0;
		}
	}

	/**
	 * Chamado quando requisição falha
	 * @private
	 */
	_onFailure(error) {
		this.failureCount++;
		this.lastFailureTime = Date.now();

		if (this.state === 'HALF_OPEN') {
			// Falha no teste, volta para OPEN
			this._transitionTo('OPEN');
		} else if (this.state === 'CLOSED') {
			if (this.failureCount >= this.failureThreshold) {
				this._transitionTo('OPEN');
			} else {
				console.log(
					`[CIRCUIT BREAKER] ${this.name} falha ` +
					`${this.failureCount}/${this.failureThreshold}: ${error.message}`
				);
			}
		}
	}

	/**
	 * Transiciona para novo estado
	 * @private
	 */
	_transitionTo(newState) {
		const oldState = this.state;
		this.state = newState;

		switch (newState) {
			case 'OPEN':
				this.nextAttempt = Date.now() + this.resetTimeout;
				this.successCount = 0;
				console.log(
					`[CIRCUIT BREAKER] ${this.name} ABERTO até ` +
					`${new Date(this.nextAttempt).toISOString()}`
				);
				break;

			case 'HALF_OPEN':
				this.successCount = 0;
				console.log(`[CIRCUIT BREAKER] ${this.name} HALF_OPEN - testando...`);
				break;

			case 'CLOSED':
				this.failureCount = 0;
				this.successCount = 0;
				console.log(`[CIRCUIT BREAKER] ${this.name} FECHADO - serviço recuperado`);
				break;
		}

		// Callback opcional
		if (this.onStateChange) {
			this.onStateChange(this.name, oldState, newState);
		}
	}

	/**
	 * Força abertura do circuito (manual)
	 */
	trip() {
		this._transitionTo('OPEN');
	}

	/**
	 * Força fechamento do circuito (manual)
	 */
	reset() {
		this._transitionTo('CLOSED');
	}

	/**
	 * Retorna estado atual
	 * @returns {object}
	 */
	getState() {
		return {
			name: this.name,
			state: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount,
			lastFailureTime: this.lastFailureTime 
				? new Date(this.lastFailureTime).toISOString() 
				: null,
			nextAttempt: this.state === 'OPEN' 
				? new Date(this.nextAttempt).toISOString() 
				: null,
			isOpen: this.state === 'OPEN',
			isHalfOpen: this.state === 'HALF_OPEN',
			isClosed: this.state === 'CLOSED'
		};
	}

	/**
	 * Verifica se circuito permite requisições
	 * @returns {boolean}
	 */
	isAvailable() {
		if (this.state === 'CLOSED' || this.state === 'HALF_OPEN') {
			return true;
		}
		// OPEN: verifica se já pode tentar
		return Date.now() >= this.nextAttempt;
	}
}

module.exports = CircuitBreaker;
