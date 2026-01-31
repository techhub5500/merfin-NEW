/**
 * NOTE (request-validator.js):
 * Purpose: Validação centralizada de requisições ao FinanceDataBridge.
 * Garante que todas as requisições tenham estrutura válida antes de processar.
 * Controls: userId obrigatório, actions válidas, limites de paginação.
 * Design: Fail-fast com mensagens de erro claras para debugging.
 */

const mongoose = require('mongoose');

/**
 * Constantes de validação
 */
const VALIDATION = {
	ACTIONS: ['summary', 'list', 'ranking', 'detail'],
	DOMAINS: ['transactions', 'debts', 'credit_cards', 'scheduled', 'assets'],
	SECTIONS: ['statement', 'scheduled', 'credit_card', 'debt', 'asset'],
	TYPES: ['income', 'expense', 'transfer', 'investment', 'fee', 'refund'],
	STATUSES: ['pending', 'confirmed', 'cancelled', 'failed'],
	SORT_FIELDS: ['date', 'amount', 'category', 'description'],
	SORT_ORDERS: ['asc', 'desc'],
	DATE_RANGES: ['7d', '7dias', '30d', '1m', '3m', '6m', '12m', '1a', 'mesAtual', 'mesAnterior', 'anoAtual', 'custom'],
	LIMITS: {
		DEFAULT: 10,
		MAX: 150,
		RANKING_MAX: 50
	}
};

/**
 * Classe RequestValidator
 * Valida e normaliza requisições antes do processamento
 */
class RequestValidator {
	constructor() {
		this.errors = [];
	}

	/**
	 * Valida uma requisição completa
	 * @param {object} request - Requisição a validar
	 * @returns {object} - { valid: boolean, request: normalizedRequest, errors: [] }
	 */
	validate(request) {
		this.errors = [];
		
		if (!request || typeof request !== 'object') {
			return this._fail('Request must be a valid object');
		}

		// Validações obrigatórias
		this._validateUserId(request);
		this._validateAction(request);
		
		// Validações opcionais
		if (request.domain) this._validateDomain(request);
		if (request.filters) this._validateFilters(request.filters);
		if (request.options) this._validateOptions(request.options, request.action);

		if (this.errors.length > 0) {
			return {
				valid: false,
				errors: this.errors,
				request: null
			};
		}

		// Normaliza a requisição
		const normalized = this._normalize(request);

		return {
			valid: true,
			errors: [],
			request: normalized
		};
	}

	/**
	 * Valida userId
	 */
	_validateUserId(request) {
		if (!request.userId) {
			this.errors.push('userId is required');
			return;
		}

		// Aceita string ou ObjectId
		const userId = request.userId.toString();
		
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			this.errors.push(`Invalid userId format: ${userId}`);
		}
	}

	/**
	 * Valida action
	 */
	_validateAction(request) {
		if (!request.action) {
			this.errors.push('action is required');
			return;
		}

		if (!VALIDATION.ACTIONS.includes(request.action)) {
			this.errors.push(`Invalid action: ${request.action}. Valid: ${VALIDATION.ACTIONS.join(', ')}`);
		}
	}

	/**
	 * Valida domain
	 */
	_validateDomain(request) {
		if (!VALIDATION.DOMAINS.includes(request.domain)) {
			this.errors.push(`Invalid domain: ${request.domain}. Valid: ${VALIDATION.DOMAINS.join(', ')}`);
		}
	}

	/**
	 * Valida filters
	 */
	_validateFilters(filters) {
		if (typeof filters !== 'object') {
			this.errors.push('filters must be an object');
			return;
		}

		// Section
		if (filters.section && !VALIDATION.SECTIONS.includes(filters.section)) {
			this.errors.push(`Invalid section: ${filters.section}`);
		}

		// Type
		if (filters.type && !VALIDATION.TYPES.includes(filters.type)) {
			this.errors.push(`Invalid type: ${filters.type}`);
		}

		// Status
		if (filters.status && !VALIDATION.STATUSES.includes(filters.status)) {
			this.errors.push(`Invalid status: ${filters.status}`);
		}

		// DateRange
		if (filters.dateRange && !VALIDATION.DATE_RANGES.includes(filters.dateRange)) {
			this.errors.push(`Invalid dateRange: ${filters.dateRange}`);
		}

		// Custom dates
		if (filters.dateRange === 'custom') {
			if (!filters.startDate || !filters.endDate) {
				this.errors.push('Custom dateRange requires startDate and endDate');
			} else {
				const start = new Date(filters.startDate);
				const end = new Date(filters.endDate);
				
				if (isNaN(start.getTime())) {
					this.errors.push('Invalid startDate format');
				}
				if (isNaN(end.getTime())) {
					this.errors.push('Invalid endDate format');
				}
				if (start > end) {
					this.errors.push('startDate must be before endDate');
				}
			}
		}

		// Value range
		if (filters.minValue !== undefined && typeof filters.minValue !== 'number') {
			this.errors.push('minValue must be a number');
		}
		if (filters.maxValue !== undefined && typeof filters.maxValue !== 'number') {
			this.errors.push('maxValue must be a number');
		}
		if (filters.minValue !== undefined && filters.maxValue !== undefined) {
			if (filters.minValue > filters.maxValue) {
				this.errors.push('minValue must be less than maxValue');
			}
		}
	}

	/**
	 * Valida options
	 */
	_validateOptions(options, action) {
		if (typeof options !== 'object') {
			this.errors.push('options must be an object');
			return;
		}

		// Limit
		if (options.limit !== undefined) {
			if (typeof options.limit !== 'number' || options.limit < 1) {
				this.errors.push('limit must be a positive number');
			}
		}

		// Page
		if (options.page !== undefined) {
			if (typeof options.page !== 'number' || options.page < 1) {
				this.errors.push('page must be a positive number starting from 1');
			}
		}

		// Sort
		if (options.sortBy && !VALIDATION.SORT_FIELDS.includes(options.sortBy)) {
			this.errors.push(`Invalid sortBy: ${options.sortBy}. Valid: ${VALIDATION.SORT_FIELDS.join(', ')}`);
		}
		if (options.sortOrder && !VALIDATION.SORT_ORDERS.includes(options.sortOrder)) {
			this.errors.push(`Invalid sortOrder: ${options.sortOrder}. Valid: asc, desc`);
		}
	}

	/**
	 * Normaliza a requisição com defaults
	 */
	_normalize(request) {
		const normalized = {
			userId: new mongoose.Types.ObjectId(request.userId.toString()),
			action: request.action,
			domain: request.domain || 'transactions',
			filters: this._normalizeFilters(request.filters || {}),
			options: this._normalizeOptions(request.options || {}, request.action)
		};

		return normalized;
	}

	/**
	 * Normaliza filters
	 */
	_normalizeFilters(filters) {
		return {
			section: filters.section || null,
			type: filters.type || null,
			category: filters.category || null,
			status: filters.status || null,
			dateRange: filters.dateRange || '30d',
			startDate: filters.startDate || null,
			endDate: filters.endDate || null,
			minValue: filters.minValue ?? null,
			maxValue: filters.maxValue ?? null
		};
	}

	/**
	 * Normaliza options
	 */
	_normalizeOptions(options, action) {
		const maxLimit = action === 'ranking' 
			? VALIDATION.LIMITS.RANKING_MAX 
			: VALIDATION.LIMITS.MAX;

		let limit = options.limit || VALIDATION.LIMITS.DEFAULT;
		limit = Math.min(limit, maxLimit);

		return {
			limit,
			page: options.page || 1,
			sortBy: options.sortBy || 'date',
			sortOrder: options.sortOrder || 'desc'
		};
	}

	/**
	 * Retorna falha rápida
	 */
	_fail(message) {
		return {
			valid: false,
			errors: [message],
			request: null
		};
	}
}

module.exports = {
	RequestValidator,
	VALIDATION
};
