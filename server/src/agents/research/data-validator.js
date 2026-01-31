/**
 * NOTE (data-validator.js):
 * Purpose: Valida estrutura e conteúdo das respostas das APIs externas.
 * Detecta dados inválidos, incompletos ou inconsistentes antes de entregar ao usuário.
 * Controls: validate() principal, validateBrapi/Tavily/Serper específicos.
 * Behavior: Retorna { valido, dados, avisos[], erros[] }.
 * Integration notes: Usado pelo ResearchAgent antes de consolidar respostas.
 */

/**
 * DataValidator - Validador de Respostas de API
 * 
 * Validações realizadas:
 * - Estrutura: campos obrigatórios presentes
 * - Tipos: valores numéricos são números, datas são válidas
 * - Sanidade: preços > 0, datas não futuras, variações razoáveis
 * - Completude: quantos campos esperados estão presentes
 */
class DataValidator {
	constructor(options = {}) {
		this.strictMode = options.strictMode ?? false;
		this.maxAgeHours = options.maxAgeHours ?? 24;
	}

	/**
	 * Valida resposta de qualquer fonte
	 * @param {object} response - Resposta da API
	 * @param {string} fonte - 'BRAPI', 'TAVILY', 'SERPER'
	 * @returns {object} - { valido, dados, avisos, erros }
	 */
	validate(response, fonte) {
		if (!response) {
			return {
				valido: false,
				dados: null,
				avisos: [],
				erros: ['Resposta vazia ou nula']
			};
		}

		// Se a resposta tem erro da API
		if (response.error) {
			return {
				valido: false,
				dados: response,
				avisos: [],
				erros: [response.error]
			};
		}

		switch (fonte.toUpperCase()) {
			case 'BRAPI':
				return this.validateBrapi(response);
			case 'TAVILY':
				return this.validateTavily(response);
			case 'SERPER':
				return this.validateSerper(response);
			default:
				return this.validateGeneric(response);
		}
	}

	/**
	 * Valida resposta do Brapi
	 */
	validateBrapi(response) {
		const avisos = [];
		const erros = [];

		// Verifica estrutura básica
		if (!response.data) {
			erros.push('Brapi: Campo "data" ausente');
			return { valido: false, dados: response, avisos, erros };
		}

		const data = response.data;

		// Se é array de cotações
		if (Array.isArray(data)) {
			for (const item of data) {
				const itemValidation = this._validateBrapiQuote(item);
				avisos.push(...itemValidation.avisos);
				erros.push(...itemValidation.erros);
			}
		} else if (typeof data === 'object') {
			// Objeto único (ex: currency, prime rate)
			const itemValidation = this._validateBrapiQuote(data);
			avisos.push(...itemValidation.avisos);
			erros.push(...itemValidation.erros);
		}

		// Verifica timestamp
		const timestamp = response.timestamp;
		if (timestamp) {
			const age = this._getAgeInHours(timestamp);
			if (age > this.maxAgeHours) {
				avisos.push(`Brapi: Dados com ${age.toFixed(1)}h de idade (máximo: ${this.maxAgeHours}h)`);
			}
		}

		const valido = erros.length === 0 || !this.strictMode;
		return { valido, dados: response, avisos, erros };
	}

	/**
	 * Valida cotação individual do Brapi
	 * @private
	 */
	_validateBrapiQuote(quote) {
		const avisos = [];
		const erros = [];

		if (!quote) {
			erros.push('Cotação nula');
			return { avisos, erros };
		}

		// Valida symbol/ticker
		if (!quote.symbol && !quote.currency) {
			erros.push('Brapi: symbol ou currency ausente');
		}

		// Valida preço
		if (quote.regularMarketPrice !== undefined) {
			if (typeof quote.regularMarketPrice !== 'number') {
				erros.push(`Brapi: regularMarketPrice não é número: ${typeof quote.regularMarketPrice}`);
			} else if (quote.regularMarketPrice <= 0) {
				avisos.push(`Brapi: regularMarketPrice <= 0 (${quote.regularMarketPrice})`);
			} else if (quote.regularMarketPrice > 1000000) {
				avisos.push(`Brapi: regularMarketPrice muito alto (${quote.regularMarketPrice})`);
			}
		}

		// Valida variação percentual
		if (quote.regularMarketChangePercent !== undefined) {
			if (typeof quote.regularMarketChangePercent !== 'number') {
				erros.push(`Brapi: regularMarketChangePercent não é número`);
			} else if (Math.abs(quote.regularMarketChangePercent) > 50) {
				avisos.push(`Brapi: Variação percentual muito alta (${quote.regularMarketChangePercent}%)`);
			}
		}

		// Valida data de atualização
		if (quote.regularMarketTime) {
			const marketTime = new Date(quote.regularMarketTime);
			if (isNaN(marketTime.getTime())) {
				avisos.push('Brapi: regularMarketTime inválido');
			} else if (marketTime > new Date()) {
				avisos.push('Brapi: regularMarketTime está no futuro');
			}
		}

		// Valida indicadores fundamentalistas
		if (quote.priceEarnings !== undefined && quote.priceEarnings < 0) {
			avisos.push(`Brapi: P/L negativo (${quote.priceEarnings})`);
		}

		if (quote.dividendYield !== undefined) {
			if (quote.dividendYield < 0 || quote.dividendYield > 100) {
				avisos.push(`Brapi: Dividend Yield fora do esperado (${quote.dividendYield}%)`);
			}
		}

		return { avisos, erros };
	}

	/**
	 * Valida resposta do Tavily
	 */
	validateTavily(response) {
		const avisos = [];
		const erros = [];

		// Verifica estrutura
		if (!response.data) {
			// Pode ter formato direto (não wrapper)
			if (response.results || response.answer) {
				// OK, formato direto
			} else {
				erros.push('Tavily: Nem "data" nem "results/answer" encontrados');
				return { valido: false, dados: response, avisos, erros };
			}
		}

		const data = response.data || response;

		// Valida resultados
		const results = data.results || data.resultados || [];
		if (results.length === 0 && !data.answer) {
			avisos.push('Tavily: Nenhum resultado encontrado');
		}

		for (const result of results) {
			// Valida URL
			if (result.url) {
				if (!this._isValidUrl(result.url)) {
					avisos.push(`Tavily: URL inválida: ${result.url}`);
				}
			} else {
				avisos.push('Tavily: Resultado sem URL');
			}

			// Valida score
			if (result.score !== undefined && (result.score < 0 || result.score > 1)) {
				avisos.push(`Tavily: Score fora do range [0,1]: ${result.score}`);
			}

			// Valida conteúdo
			if (!result.content && !result.snippet && !result.title) {
				avisos.push('Tavily: Resultado sem conteúdo, snippet ou título');
			}
		}

		// Verifica timestamp
		if (response.timestamp) {
			const age = this._getAgeInHours(response.timestamp);
			if (age > 6) {
				avisos.push(`Tavily: Dados com ${age.toFixed(1)}h de idade`);
			}
		}

		const valido = erros.length === 0 || !this.strictMode;
		return { valido, dados: response, avisos, erros };
	}

	/**
	 * Valida resposta do Serper
	 */
	validateSerper(response) {
		const avisos = [];
		const erros = [];

		// Verifica estrutura
		if (!response.data) {
			erros.push('Serper: Campo "data" ausente');
			return { valido: false, dados: response, avisos, erros };
		}

		const data = response.data;

		// Valida resultados
		const resultados = data.resultados || data.organic || [];
		const noticias = data.noticias || data.news || [];

		if (resultados.length === 0 && noticias.length === 0) {
			avisos.push('Serper: Nenhum resultado ou notícia encontrado');
		}

		// Valida cada resultado
		for (const result of resultados) {
			if (result.link && !this._isValidUrl(result.link)) {
				avisos.push(`Serper: URL inválida: ${result.link}`);
			}
			if (!result.title && !result.snippet) {
				avisos.push('Serper: Resultado sem título ou snippet');
			}
		}

		// Valida notícias
		for (const news of noticias) {
			if (news.link && !this._isValidUrl(news.link)) {
				avisos.push(`Serper: URL de notícia inválida: ${news.link}`);
			}
		}

		// Knowledge Graph
		if (data.knowledgeGraph) {
			const kg = data.knowledgeGraph;
			if (!kg.title && !kg.description) {
				avisos.push('Serper: Knowledge Graph vazio');
			}
		}

		const valido = erros.length === 0 || !this.strictMode;
		return { valido, dados: response, avisos, erros };
	}

	/**
	 * Validação genérica
	 */
	validateGeneric(response) {
		const avisos = [];
		const erros = [];

		if (typeof response !== 'object') {
			erros.push(`Tipo inesperado de resposta: ${typeof response}`);
			return { valido: false, dados: response, avisos, erros };
		}

		// Verifica se tem pelo menos algum dado
		const keys = Object.keys(response);
		if (keys.length === 0) {
			erros.push('Resposta vazia (objeto sem propriedades)');
		}

		// Verifica erros embutidos
		if (response.error || response.erro) {
			erros.push(response.error || response.erro);
		}

		const valido = erros.length === 0;
		return { valido, dados: response, avisos, erros };
	}

	/**
	 * Valida e limpa dados para apresentação
	 * @param {object[]} resultados - Array de respostas validadas
	 * @returns {object} - Dados consolidados e limpos
	 */
	consolidate(resultados) {
		const consolidado = {
			dados: [],
			fontes: [],
			avisos: [],
			erros: [],
			metadata: {
				total_fontes: resultados.length,
				fontes_validas: 0,
				fontes_com_avisos: 0,
				coletado_em: new Date().toISOString()
			}
		};

		for (const resultado of resultados) {
			if (!resultado) continue;

			const fonte = resultado.fonte || 'DESCONHECIDA';
			consolidado.fontes.push(fonte);

			if (resultado.valido !== false) {
				consolidado.metadata.fontes_validas++;
				consolidado.dados.push({
					fonte,
					...resultado.dados
				});
			}

			if (resultado.avisos && resultado.avisos.length > 0) {
				consolidado.metadata.fontes_com_avisos++;
				consolidado.avisos.push(...resultado.avisos.map(a => `[${fonte}] ${a}`));
			}

			if (resultado.erros && resultado.erros.length > 0) {
				consolidado.erros.push(...resultado.erros.map(e => `[${fonte}] ${e}`));
			}

			// Dados de fallback
			if (resultado.fallback) {
				consolidado.avisos.push(`[${fonte}] Dados obtidos via fallback`);
			}

			if (resultado.advertencia) {
				consolidado.avisos.push(`[${fonte}] ${resultado.advertencia}`);
			}
		}

		return consolidado;
	}

	/**
	 * Calcula idade em horas
	 * @private
	 */
	_getAgeInHours(timestamp) {
		const then = new Date(timestamp);
		const now = new Date();
		return (now - then) / (1000 * 60 * 60);
	}

	/**
	 * Valida URL
	 * @private
	 */
	_isValidUrl(string) {
		try {
			new URL(string);
			return true;
		} catch {
			return false;
		}
	}
}

module.exports = DataValidator;
