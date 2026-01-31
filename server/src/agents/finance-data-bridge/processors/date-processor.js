/**
 * NOTE (date-processor.js):
 * Purpose: Conversão de termos relativos de data em ranges absolutos.
 * Suporta termos em português e inglês, períodos customizados.
 * Design: Funções puras, sem efeitos colaterais, fácil de testar.
 */

/**
 * Mapeamento de termos para configuração de cálculo
 */
const DATE_TERM_CONFIG = {
	// Dias
	'7d': { unit: 'days', value: 7 },
	'7dias': { unit: 'days', value: 7 },
	'15d': { unit: 'days', value: 15 },
	'30d': { unit: 'days', value: 30 },
	
	// Meses
	'1m': { unit: 'months', value: 1 },
	'3m': { unit: 'months', value: 3 },
	'6m': { unit: 'months', value: 6 },
	'12m': { unit: 'months', value: 12 },
	'1a': { unit: 'months', value: 12 },
	
	// Períodos especiais
	'mesAtual': { special: 'currentMonth' },
	'mesAnterior': { special: 'previousMonth' },
	'anoAtual': { special: 'currentYear' }
};

/**
 * Classe DateProcessor
 * Processa e converte termos de data em ranges
 */
class DateProcessor {
	
	/**
	 * Converte um termo de data em range de datas absolutas
	 * @param {string} term - Termo de data (ex: '30d', 'mesAtual', 'custom')
	 * @param {object} options - Opções adicionais
	 * @param {string} options.startDate - Data inicial para 'custom'
	 * @param {string} options.endDate - Data final para 'custom'
	 * @param {Date} options.referenceDate - Data de referência (default: now)
	 * @returns {object} - { startDate: Date, endDate: Date }
	 */
	parseDateRange(term, options = {}) {
		const referenceDate = options.referenceDate || new Date();
		
		// Custom range
		if (term === 'custom') {
			return this._parseCustomRange(options.startDate, options.endDate);
		}

		// Termos especiais
		const config = DATE_TERM_CONFIG[term];
		if (!config) {
			// Default: últimos 30 dias
			return this._calculateRelative('days', 30, referenceDate);
		}

		// Períodos especiais
		if (config.special) {
			return this._calculateSpecialPeriod(config.special, referenceDate);
		}

		// Cálculo relativo
		return this._calculateRelative(config.unit, config.value, referenceDate);
	}

	/**
	 * Calcula período relativo (últimos N dias/meses)
	 */
	_calculateRelative(unit, value, referenceDate) {
		const endDate = new Date(referenceDate);
		endDate.setHours(23, 59, 59, 999);

		const startDate = new Date(referenceDate);
		
		if (unit === 'days') {
			startDate.setDate(startDate.getDate() - value);
		} else if (unit === 'months') {
			startDate.setMonth(startDate.getMonth() - value);
		}
		
		startDate.setHours(0, 0, 0, 0);

		return { startDate, endDate };
	}

	/**
	 * Calcula períodos especiais (mesAtual, mesAnterior, anoAtual)
	 */
	_calculateSpecialPeriod(periodType, referenceDate) {
		const year = referenceDate.getFullYear();
		const month = referenceDate.getMonth();

		switch (periodType) {
			case 'currentMonth': {
				const startDate = new Date(year, month, 1, 0, 0, 0, 0);
				const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
				return { startDate, endDate };
			}
			
			case 'previousMonth': {
				const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
				const endDate = new Date(year, month, 0, 23, 59, 59, 999);
				return { startDate, endDate };
			}
			
			case 'currentYear': {
				const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
				const endDate = new Date(referenceDate);
				endDate.setHours(23, 59, 59, 999);
				return { startDate, endDate };
			}
			
			default:
				// Fallback: últimos 30 dias
				return this._calculateRelative('days', 30, referenceDate);
		}
	}

	/**
	 * Parse custom range com validação
	 */
	_parseCustomRange(startDateStr, endDateStr) {
		const startDate = new Date(startDateStr);
		const endDate = new Date(endDateStr);

		// Ajusta horários
		startDate.setHours(0, 0, 0, 0);
		endDate.setHours(23, 59, 59, 999);

		return { startDate, endDate };
	}

	/**
	 * Calcula período de ciclo de faturamento de cartão
	 * @param {number} renewalDay - Dia do fechamento (1-31)
	 * @param {Date} referenceDate - Data de referência
	 * @returns {object} - { startDate, endDate, dueDate }
	 */
	calculateBillingCycle(renewalDay, referenceDate = new Date()) {
		const currentDay = referenceDate.getDate();
		const year = referenceDate.getFullYear();
		const month = referenceDate.getMonth();

		let cycleStartDate, cycleEndDate;

		if (currentDay >= renewalDay) {
			// Ciclo atual começou este mês
			cycleStartDate = new Date(year, month, renewalDay, 0, 0, 0, 0);
			cycleEndDate = new Date(year, month + 1, renewalDay - 1, 23, 59, 59, 999);
		} else {
			// Ciclo atual começou no mês anterior
			cycleStartDate = new Date(year, month - 1, renewalDay, 0, 0, 0, 0);
			cycleEndDate = new Date(year, month, renewalDay - 1, 23, 59, 59, 999);
		}

		return {
			startDate: cycleStartDate,
			endDate: cycleEndDate
		};
	}

	/**
	 * Formata data para exibição
	 */
	formatDate(date, format = 'iso') {
		if (!date) return null;
		
		const d = new Date(date);
		
		switch (format) {
			case 'iso':
				return d.toISOString().split('T')[0];
			case 'br':
				return d.toLocaleDateString('pt-BR');
			case 'full':
				return d.toISOString();
			default:
				return d.toISOString().split('T')[0];
		}
	}

	/**
	 * Verifica se uma data está dentro de um range
	 */
	isDateInRange(date, startDate, endDate) {
		const d = new Date(date);
		return d >= startDate && d <= endDate;
	}

	/**
	 * Calcula diferença em dias entre duas datas
	 */
	daysBetween(startDate, endDate) {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const diffTime = Math.abs(end - start);
		return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
	}
}

module.exports = {
	DateProcessor,
	DATE_TERM_CONFIG
};
