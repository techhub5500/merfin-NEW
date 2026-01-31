/**
 * Junior Agent - Intelligent Triage and Routing Agent with Persistent Memory
 *
 * SISTEMA DE TRIAGEM INTELIGENTE:
 * - Classificação Primária: Trivial, Lançamento, Simplista ou Complexa
 * - Análise Secundária: Escolha de domínio, coordenador e prompts (para queries complexas)
 * - Handover: Empacotamento e roteamento para agentes especializados
 * 
 * SISTEMA DE MEMÓRIA PERSISTENTE:
 * - Janela deslizante: Últimos 2 ciclos (4 mensagens) mantidos integralmente
 * - Resumo cumulativo: Histórico antigo compactado progressivamente pelo GPT-5 Nano
 * - Threshold: 3500 tokens gatilha resumo automático
 * - Modelo: GPT-5 Mini (verbosity: low, reasoning_effort: low para classificação)
 * 
 * ARQUITETURA:
 * - ConversationalMemory (MongoDB): Persiste resumos + janela recente
 * - MemorySummaryService: Gera resumos usando GPT-5 Nano
 * - Token estimation: 1 palavra = 0,75 tokens
 */

const BaseAgent = require('../../shared/base-agent');
const OpenAI = require('openai');
const ConversationalMemory = require('../../../database/schemas/conversational-memory-schema');
const memorySummaryService = require('../../../services/memory-summary-service');
const LancadorAgent = require('../lançador/lancador-agent');
const fs = require('fs');
const path = require('path');

// ===== CONSTANTES DE CATEGORIAS =====
const CATEGORIES = Object.freeze({
  TRIVIAL: 'trivial',
  LANCAMENTO: 'lancamento',
  SIMPLISTA: 'simplista',
  COMPLEXA: 'complexa'
});

// ===== POLÍTICAS DE MEMÓRIA =====
const MEMORY_POLICY = Object.freeze({
  NONE: 'none',           // Não carrega nem salva (classificação)
  READ_ONLY: 'read_only', // Carrega mas não salva (complexa - coordenador salva)
  WRITE_ONLY: 'write_only', // Não envia contexto, mas salva (lançamento)
  READ_WRITE: 'read_write' // Carrega e salva (trivial, simplista)
});

// Mapeamento de políticas de memória por categoria
const CATEGORY_MEMORY_MAP = Object.freeze({
  [CATEGORIES.TRIVIAL]: MEMORY_POLICY.READ_WRITE,    // Carrega, processa, salva
  [CATEGORIES.LANCAMENTO]: MEMORY_POLICY.WRITE_ONLY, // Não envia contexto, mas salva
  [CATEGORIES.SIMPLISTA]: MEMORY_POLICY.READ_WRITE,  // Carrega contexto, salva
  [CATEGORIES.COMPLEXA]: MEMORY_POLICY.READ_ONLY     // Carrega para enviar, não salva (coordenador salva)
});

// Inicialização lazy do cliente OpenAI
let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

class JuniorAgent extends BaseAgent {
  constructor() {
    super('JuniorAgent');
    
    this.model = 'gpt-5-mini';
    this.max_completion_tokens = 1500;
    this.RECENT_WINDOW_SIZE = 4; // 2 ciclos = 4 mensagens (2 user + 2 assistant)
    this.MAX_SUMMARY_WORDS = 3500; // Limite de palavras no resumo cumulativo
    
    // Cache para arquivos JSON (evita I/O repetitivo)
    this._jsonCache = null;
  }

  // =====================================================
  // GERENCIAMENTO DE MEMÓRIA POR CATEGORIA
  // =====================================================

  /**
   * Retorna a política de memória para uma categoria
   * @param {string} categoria - ID da categoria
   * @returns {string} - Política de memória (NONE, READ_ONLY, WRITE_ONLY, READ_WRITE)
   */
  _getMemoryPolicy(categoria) {
    return CATEGORY_MEMORY_MAP[categoria] || MEMORY_POLICY.READ_WRITE;
  }

  /**
   * Verifica se a política permite leitura de memória
   * @param {string} policy - Política de memória
   * @returns {boolean}
   */
  _canReadMemory(policy) {
    return policy === MEMORY_POLICY.READ_ONLY || policy === MEMORY_POLICY.READ_WRITE;
  }

  /**
   * Verifica se a política permite escrita de memória
   * @param {string} policy - Política de memória
   * @returns {boolean}
   */
  _canWriteMemory(policy) {
    return policy === MEMORY_POLICY.WRITE_ONLY || policy === MEMORY_POLICY.READ_WRITE;
  }

  /**
   * Recupera contexto de memória formatado para envio a coordenadores
   * @param {string} chatId - ID do chat
   * @param {string} userId - ID do usuário
   * @param {string} sessionId - ID da sessão
   * @param {string} currentMessage - Mensagem atual (opcional)
   * @returns {Promise<string>} - Contexto formatado
   */
  async _getMemoryContext(chatId, userId, sessionId, currentMessage = null) {
    try {
      const memory = await ConversationalMemory.findOrCreate(chatId, userId, sessionId);
      
      let context = '';

      if (memory.cumulativeSummary && memory.cumulativeSummary.trim().length > 0) {
        context += `[HISTÓRICO_RESUMIDO]\n${memory.cumulativeSummary}\n\n`;
      }

      if (memory.recentWindow && memory.recentWindow.length > 0) {
        context += '[JANELA_ATUAL]\n';
        for (const msg of memory.recentWindow) {
          const prefix = msg.role === 'user' ? 'U' : 'A';
          context += `${prefix}: ${msg.content}\n`;
        }
        context += '\n';
      }

      if (currentMessage) {
        context += `[MENSAGEM_ATUAL]\n${currentMessage}`;
      }

      return context;
    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro ao recuperar contexto de memória:', error.message);
      return currentMessage ? `[MENSAGEM_ATUAL]\n${currentMessage}` : '';
    }
  }

  // =====================================================
  // MÉTODO PRINCIPAL - PONTO DE ENTRADA
  // =====================================================

  /**
   * Método principal de execução do agente com sistema de triagem
   * @param {Object} request - Requisição do usuário
   * @returns {Promise<Object>} Resposta do agente
   */
  async execute(request) {
    const { parameters } = request;
    const { message, chatId, userId, sessionId } = parameters;

    console.log('[JuniorAgent] 📨 Processando mensagem:', {
      chatId,
      userId,
      sessionId,
      messageLength: message?.length || 0
    });

    try {
      // Validação básica
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Mensagem inválida ou vazia');
      }

      // ===== ETAPA 1: CLASSIFICAÇÃO PRIMÁRIA =====
      const categoria = await this.classifyQuery(message);
      console.log(`[JuniorAgent] 🔵 Categoria identificada: ${categoria}`);

      // ===== ETAPA 2: PROCESSAMENTO POR CATEGORIA =====
      switch (categoria) {
        case CATEGORIES.TRIVIAL:
          console.log('[JuniorAgent] 🟢 Fluxo TRIVIAL');
          return await this.processTrivialQuery(parameters);
        
        case CATEGORIES.LANCAMENTO:
          console.log('[JuniorAgent] 🟡 Fluxo LANÇAMENTO');
          return await this.routeToLancador(parameters);
        
        case CATEGORIES.SIMPLISTA:
          console.log('[JuniorAgent] 🟡 Fluxo SIMPLISTA');
          return await this.routeToSimplista(parameters);
        
        case CATEGORIES.COMPLEXA:
          console.log('[JuniorAgent] 🟠 Fluxo COMPLEXA');
          return await this.processComplexQuery(parameters);
        
        default:
          console.log('[JuniorAgent] 🔴 Categoria desconhecida, usando COMPLEXA como fallback');
          return await this.processComplexQuery(parameters);
      }

    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro no execute():', error.message);
      
      // Fallback: tentar processar como trivial em caso de erro na classificação
      console.log('[JuniorAgent] 🔄 Tentando fallback para fluxo trivial...');
      try {
        return await this.processTrivialQuery(parameters);
      } catch (fallbackError) {
        return {
          response: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          error: error.message || 'Erro desconhecido'
        };
      }
    }
  }

  // =====================================================
  // CLASSIFICAÇÃO PRIMÁRIA
  // =====================================================

  /**
   * Classifica query em uma das 4 categorias
   * @param {string} message - Mensagem do usuário
   * @returns {Promise<string>} - ID da categoria (trivial|lancamento|simplista|complexa)
   */
  async classifyQuery(message) {
    console.log('[JuniorAgent] 🔵 Classificando query...');
    
    try {
      const systemPrompt = this._buildClassificationPrompt();
      
      const response = await Promise.race([
        getOpenAI().chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_completion_tokens: 100,
          verbosity: 'low',
          reasoning_effort: 'low'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na classificação')), 30000)
        )
      ]);

      const responseText = response.choices[0]?.message?.content?.trim();
      
      // Tentar parsear JSON da resposta
      try {
        // Remover possíveis marcadores de código markdown
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        const categoriaId = parsed.categoria_id?.toLowerCase();
        
        // Validar se é uma categoria conhecida
        if (Object.values(CATEGORIES).includes(categoriaId)) {
          console.log(`[JuniorAgent] 🔵 Classificação bem-sucedida: ${categoriaId}`);
          return categoriaId;
        } else {
          console.warn(`[JuniorAgent] ⚠️ Categoria desconhecida: ${categoriaId}, usando 'complexa'`);
          return CATEGORIES.COMPLEXA;
        }
      } catch (parseError) {
        console.error('[JuniorAgent] ⚠️ Erro ao parsear JSON de classificação:', parseError.message);
        console.log('[JuniorAgent] 📝 Resposta bruta:', responseText);
        return CATEGORIES.COMPLEXA;
      }
      
    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro na classificação:', error.message);
      return CATEGORIES.COMPLEXA; // Fallback seguro
    }
  }

  /**
   * Constrói prompt de classificação primária
   * @returns {string} - System prompt para classificação
   */
  _buildClassificationPrompt() {
    return `### TAREFA: CLASSIFICAÇÃO DE QUERY

Você é um classificador de queries financeiras. Analise a mensagem do usuário e retorne APENAS um JSON com a categoria identificada.

## CATEGORIAS DISPONÍVEIS:

**trivial** — Saudações, agradecimentos, perguntas sobre o sistema, despedidas
Exemplos: "Oi", "Obrigado", "O que você faz?", "Tchau", "Bom dia", "Como você funciona?"

**lancamento** — Qualquer menção a transação financeira, gasto, receita, pagamento, compra, ou valor monetário que necessite registro
Sinais claros: verbos como "gastei", "recebi", "paguei", "comprei", "preciso pagar", "vou receber", "fui ao [lugar]", ou valores em reais
Exemplos: 
- "Gastei R$ 150 no supermercado"
- "Fui ao cinema ontem" (implica gasto)
- "Recebi meu salário"
- "Paguei a conta de luz"
- "Comprei uma roupa"
- "Preciso pagar o IPTU de 1200 reais" (futura despesa)
- "200 reais" (contexto de conversa sobre lançamento)

**simplista** — Consultas diretas a dados já registrados, perguntas sobre saldos ou totais existentes
Sinais: "quanto", "qual meu", "total de", "saldo", "gastei este mês" (pergunta, não afirmação)
Exemplos: "Quanto gastei este mês?", "Qual meu saldo?", "Quanto tenho investido?"

**complexa** — Análises, planejamentos estratégicos, comparações, recomendações de investimento
Sinais: "como melhorar", "estratégia", "plano de", "devo investir em", "o que fazer para"
Exemplos: "Como melhorar minhas finanças?", "Quero investir em ações", "Preciso de um plano financeiro"

## FORMATO DE RESPOSTA:

Retorne APENAS um JSON válido, sem markdown, sem explicações:
{"categoria_id": "trivial|lancamento|simplista|complexa"}

## REGRAS DE PRIORIDADE:
1. Se mencionar transação/gasto/pagamento/compra/receita → lancamento
2. Se mencionar apenas valor (ex: "200 reais") → lancamento (assume contexto de lançamento)
3. Se mencionar lugar/estabelecimento (cinema, mercado, uber) → lancamento
4. Se for pergunta sobre saldo/total → simplista
5. Se pedir análise/estratégia → complexa
6. Se for saudação/agradecimento → trivial`;
  }

  // =====================================================
  // PROCESSAMENTO DE QUERIES TRIVIAIS
  // =====================================================

  /**
   * Processa queries triviais (saudações, agradecimentos, etc.)
   * Reutiliza o fluxo original com memória persistente
   * @param {Object} params - Parâmetros da mensagem
   * @returns {Promise<Object>} Resposta processada
   */
  async processTrivialQuery(params) {
    // Delega para o método original de processamento de chat
    return await this.processChatMessage(params);
  }

  // =====================================================
  // PROCESSAMENTO DE QUERIES COMPLEXAS
  // =====================================================

  /**
   * Processa queries complexas com análise secundária e handover
   * Política: READ_ONLY - Carrega memória para enviar ao coordenador, mas não salva
   * O coordenador é responsável por salvar a interação após processar
   * @param {Object} params - Parâmetros da mensagem
   * @returns {Promise<Object>} Resposta do coordenador
   */
  async processComplexQuery(params) {
    const { message, chatId, userId, sessionId } = params;

    try {
      // 1. Carregar memória (READ_ONLY - coordenador salva depois)
      const memoryPolicy = this._getMemoryPolicy(CATEGORIES.COMPLEXA);
      console.log('[JuniorAgent] 🟠 Carregando memória para query complexa...', { memoryPolicy });
      
      const memory = await ConversationalMemory.findOrCreate(chatId, userId, sessionId);

      console.log('[JuniorAgent] 💾 Memória carregada para análise (READ_ONLY):', {
        hasSummary: !!memory.cumulativeSummary,
        recentWindowSize: memory.recentWindow?.length || 0
      });

      // 2. Análise secundária - escolher domínio, coordenador e prompts
      const analysis = await this.analyzeComplexQuery(message, memory);

      // 3. Montar pacote para coordenador (inclui memória + parâmetros para ele salvar)
      const handoverPackage = await this._buildHandoverPackage(analysis, memory, message, params);

      // 4. Rotear para coordenador (ele será responsável por salvar a memória)
      const response = await this.routeToCoordinator(handoverPackage, params);

      // Nota: Em produção, o coordenador real salvaria a memória
      // Por enquanto (modo teste), salvamos aqui para manter consistência
      if (response.response && !response.error) {
        await this._updateMemory(memory, message, response.response, true);
        console.log('[JuniorAgent] 💾 Memória salva após resposta do coordenador (modo teste)');
      }

      return response;

    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro no processamento de query complexa:', error.message);
      
      // Fallback: tentar responder como trivial
      console.log('[JuniorAgent] 🔄 Fallback para processamento trivial...');
      return await this.processTrivialQuery(params);
    }
  }

  // =====================================================
  // ANÁLISE SECUNDÁRIA
  // =====================================================

  /**
   * Analisa query complexa e escolhe roteamento
   * @param {string} message - Mensagem do usuário
   * @param {Object} memory - Documento ConversationalMemory
   * @returns {Promise<Object>} - { dominio_id, coordenador_selecionado, prompts_orquestracao_ids }
   */
  async analyzeComplexQuery(message, memory) {
    console.log('[JuniorAgent] 🟠 Iniciando análise secundária...');

    try {
      // Carregar arquivos JSON de configuração
      const { dominios, prompts, contratos } = this._loadJSONFiles();

      // Construir prompt de análise secundária
      const systemPrompt = this._buildSecondaryAnalysisPrompt(dominios, contratos, prompts);

      // Construir contexto com memória para análise contextualizada
      let contextualInput = '';
      
      if (memory.cumulativeSummary && memory.cumulativeSummary.trim().length > 0) {
        contextualInput += `[HISTÓRICO_RESUMIDO]\n${memory.cumulativeSummary}\n\n`;
      }
      
      if (memory.recentWindow && memory.recentWindow.length > 0) {
        contextualInput += '[JANELA_ATUAL]\n';
        for (const msg of memory.recentWindow) {
          const prefix = msg.role === 'user' ? 'U' : 'A';
          contextualInput += `${prefix}: ${msg.content}\n`;
        }
        contextualInput += '\n';
      }
      
      contextualInput += `[MENSAGEM_ATUAL]\n${message}`;

      // Chamar GPT-5 Mini para análise
      const response = await Promise.race([
        getOpenAI().chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextualInput }
          ],
          max_completion_tokens: 300,
          verbosity: 'low',
          reasoning_effort: 'low'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na análise secundária')), 45000)
        )
      ]);

      const responseText = response.choices[0]?.message?.content?.trim();

      // Parsear resposta JSON
      try {
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analysis = JSON.parse(cleanJson);

        // Validar campos obrigatórios
        if (!analysis.dominio_id || !analysis.coordenador_selecionado || !analysis.prompts_orquestracao_ids) {
          throw new Error('Campos obrigatórios ausentes na análise');
        }

        // Garantir que prompts_orquestracao_ids é um array com 1-2 elementos
        if (!Array.isArray(analysis.prompts_orquestracao_ids)) {
          analysis.prompts_orquestracao_ids = [analysis.prompts_orquestracao_ids];
        }
        analysis.prompts_orquestracao_ids = analysis.prompts_orquestracao_ids.slice(0, 2);

        console.log('[JuniorAgent] 🟠 Análise secundária concluída:', {
          dominio: analysis.dominio_id,
          coordenador: analysis.coordenador_selecionado,
          prompts: analysis.prompts_orquestracao_ids,
          justificativa: analysis.justificativa_breve || 'N/A'
        });

        return analysis;

      } catch (parseError) {
        console.error('[JuniorAgent] ⚠️ Erro ao parsear análise secundária:', parseError.message);
        console.log('[JuniorAgent] 📝 Resposta bruta:', responseText);
        
        // Fallback: retornar análise padrão
        return this._getDefaultAnalysis();
      }

    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro na análise secundária:', error.message);
      return this._getDefaultAnalysis();
    }
  }

  /**
   * Retorna análise padrão para casos de erro
   * @returns {Object} - Análise com valores padrão
   */
  _getDefaultAnalysis() {
    console.log('[JuniorAgent] 🔄 Usando análise padrão (fallback)');
    return {
      dominio_id: 'planejamento_financeiro_integrado',
      coordenador_selecionado: 'coord_planejamentos',
      prompts_orquestracao_ids: ['p_plano_passo_a_passo'],
      justificativa_breve: 'Fallback automático devido a erro na análise'
    };
  }

  /**
   * Constrói prompt de análise secundária
   * @param {Object} dominios - Lista de domínios
   * @param {Object} contratos - Contratos dos coordenadores
   * @param {Object} prompts - Lista de prompts de orquestração
   * @returns {string} - System prompt
   */
  _buildSecondaryAnalysisPrompt(dominios, contratos, prompts) {
    return `### TAREFA: ANÁLISE SECUNDÁRIA DE QUERY COMPLEXA

Você deve analisar a query do usuário (considerando o contexto da conversa) e fazer três escolhas sequenciais:
1. DOMÍNIO: Qual é o tema central da query?
2. COORDENADOR: Qual agente especializado deve processar?
3. PROMPTS: Qual(is) prompt(s) de orquestração usar? (máximo 2)

## DOMÍNIOS DISPONÍVEIS:
${JSON.stringify(dominios.dominios, null, 2)}

## COORDENADORES DISPONÍVEIS:
${JSON.stringify(Object.values(contratos).map(c => ({
  id: c.id,
  nome: c.nome,
  descricao: c.descricao,
  dominios_atendidos: c.dominios_atendidos
})), null, 2)}

## PROMPTS DE ORQUESTRAÇÃO:
${JSON.stringify(prompts.prompts.map(p => ({
  id: p.id,
  titulo: p.titulo,
  contexto: p.contexto,
  aplicavel_a: p.aplicavel_a
})), null, 2)}

## PROCESSO DE ESCOLHA:

1. Leia a mensagem atual e o contexto (se houver) para entender a real intenção
2. Identifique o DOMÍNIO principal (tema central da necessidade)
3. Escolha o COORDENADOR cujo dominios_atendidos inclua o domínio escolhido
4. Selecione 1 prompt de orquestração (ou 2 se extremamente necessário) que seja aplicável ao coordenador

## FORMATO DE RESPOSTA:

Retorne APENAS um JSON válido, sem markdown:
{
  "dominio_id": "id_do_dominio_escolhido",
  "coordenador_selecionado": "coord_analises|coord_investimentos|coord_planejamentos",
  "prompts_orquestracao_ids": ["id_prompt_1"],
  "justificativa_breve": "Uma frase explicando a escolha"
}

## REGRAS:
- Escolha apenas 1 prompt, a menos que 2 sejam REALMENTE necessários
- O coordenador deve ter o domínio escolhido em sua lista de dominios_atendidos
- Se não encontrar domínio exato, escolha o mais próximo
- Se o contexto revelar informações adicionais (ex: usuário tem dívidas), considere isso`;
  }

  // =====================================================
  // CARREGAMENTO DE ARQUIVOS JSON
  // =====================================================

  /**
   * Carrega arquivos JSON de configuração com cache
   * @returns {Object} { dominios, prompts, contratos }
   */
  _loadJSONFiles() {
    if (this._jsonCache) {
      return this._jsonCache;
    }

    console.log('[JuniorAgent] 📂 Carregando arquivos JSON...');

    try {
      const basePath = path.join(__dirname, '../../jsons');
      const contratosPath = path.join(__dirname, '../../contratos');

      // Verificar se os caminhos existem
      if (!fs.existsSync(basePath)) {
        throw new Error(`Pasta de JSONs não encontrada: ${basePath}`);
      }

      // Carregar dominios
      const dominiosPath = path.join(basePath, 'dominios.json');
      if (!fs.existsSync(dominiosPath)) {
        throw new Error(`Arquivo dominios.json não encontrado: ${dominiosPath}`);
      }
      const dominios = JSON.parse(fs.readFileSync(dominiosPath, 'utf-8'));

      // Carregar prompts de orquestração
      const promptsPath = path.join(basePath, 'prompts_orquestracao.json');
      if (!fs.existsSync(promptsPath)) {
        throw new Error(`Arquivo prompts_orquestracao.json não encontrado: ${promptsPath}`);
      }
      const prompts = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));

      // Carregar contratos dos coordenadores
      const contratos = {};
      const coordenadores = ['coord_analises', 'coord_investimentos', 'coord_planejamentos'];
      
      for (const coord of coordenadores) {
        const coordPath = path.join(contratosPath, `${coord}.json`);
        if (fs.existsSync(coordPath)) {
          contratos[coord.replace('coord_', '')] = JSON.parse(fs.readFileSync(coordPath, 'utf-8'));
        } else {
          console.warn(`[JuniorAgent] ⚠️ Contrato não encontrado: ${coordPath}`);
        }
      }

      this._jsonCache = { dominios, prompts, contratos };
      console.log('[JuniorAgent] 📂 JSONs carregados e cacheados com sucesso');
      
      return this._jsonCache;

    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro ao carregar JSONs:', error.message);
      
      // Retornar estrutura vazia para evitar crash
      return {
        dominios: { dominios: [] },
        prompts: { prompts: [] },
        contratos: {}
      };
    }
  }

  /**
   * Carrega conteúdo de um prompt de orquestração
   * @param {string} promptId - ID do prompt
   * @returns {string|null} - System prompt completo ou null se não encontrado
   */
  _loadPromptContent(promptId) {
    try {
      const promptPath = path.join(__dirname, '../../jsons/prompts', `${promptId}.json`);
      
      if (!fs.existsSync(promptPath)) {
        console.warn(`[JuniorAgent] ⚠️ Arquivo de prompt não encontrado: ${promptId}`);
        return null;
      }

      const content = JSON.parse(fs.readFileSync(promptPath, 'utf-8'));
      return content.system_prompt || null;

    } catch (error) {
      console.error(`[JuniorAgent] ❌ Erro ao carregar prompt ${promptId}:`, error.message);
      return null;
    }
  }

  // =====================================================
  // HANDOVER PARA COORDENADORES
  // =====================================================

  /**
   * Monta pacote completo para handover ao coordenador
   * @param {Object} analysis - Resultado da análise secundária
   * @param {Object} memory - Documento ConversationalMemory
   * @param {string} currentMessage - Mensagem atual do usuário
   * @param {Object} params - Parâmetros originais (chatId, userId, sessionId)
   * @returns {Object} - Pacote de handover
   */
  async _buildHandoverPackage(analysis, memory, currentMessage, params) {
    console.log('[JuniorAgent] 📦 Montando pacote de handover...');

    // 1. Carregar conteúdo dos prompts selecionados
    const promptContents = analysis.prompts_orquestracao_ids
      .map(id => this._loadPromptContent(id))
      .filter(Boolean);
    
    const systemPrompt = promptContents.length > 0 
      ? promptContents.join('\n\n---\n\n')
      : 'Responda à query do usuário de forma útil e estruturada.';

    // 2. Montar contexto com memória
    let context = '';
    
    if (memory.cumulativeSummary && memory.cumulativeSummary.trim().length > 0) {
      context += `[HISTÓRICO_RESUMIDO]\n${memory.cumulativeSummary}\n\n`;
    }
    
    if (memory.recentWindow && memory.recentWindow.length > 0) {
      context += '[JANELA_ATUAL]\n';
      for (const msg of memory.recentWindow) {
        const prefix = msg.role === 'user' ? 'U' : 'A';
        context += `${prefix}: ${msg.content}\n`;
      }
      context += '\n';
    }
    
    context += `[MENSAGEM_ATUAL]\n${currentMessage}`;

    // 3. Montar metadados
    const metadata = {
      dominio_id: analysis.dominio_id,
      coordenador_id: analysis.coordenador_selecionado,
      prompts_ids: analysis.prompts_orquestracao_ids,
      justificativa: analysis.justificativa_breve || '',
      timestamp: new Date().toISOString(),
      chatId: params.chatId,
      userId: params.userId,
      sessionId: params.sessionId
    };

    console.log('[JuniorAgent] 📦 Pacote montado:', {
      systemPromptLength: systemPrompt.length,
      contextLength: context.length,
      coordenador: metadata.coordenador_id
    });

    return { system_prompt: systemPrompt, context, metadata };
  }

  /**
   * Roteia pacote para coordenador apropriado
   * @param {Object} handoverPackage - Pacote montado por _buildHandoverPackage
   * @param {Object} params - Parâmetros originais (chatId, userId, sessionId)
   * @returns {Promise<Object>} - Resposta do coordenador
   */
  async routeToCoordinator(handoverPackage, params) {
    const { metadata, system_prompt, context } = handoverPackage;
    const { sessionId } = params;

    console.log(`[JuniorAgent] 📤 Roteando para: ${metadata.coordenador_id}`);

    try {
      // Carregar contrato do coordenador para obter system_prompt_teste
      const contratos = this._loadJSONFiles().contratos;
      const coordenadorKey = metadata.coordenador_id.replace('coord_', '');
      const contrato = contratos[coordenadorKey];

      if (!contrato) {
        throw new Error(`Coordenador não encontrado: ${metadata.coordenador_id}`);
      }

      // Montar system prompt completo: prompt de teste do coordenador + prompts de orquestração
      const fullSystemPrompt = `${contrato.system_prompt_teste}\n\n` +
        `--- DOMÍNIO RECEBIDO: ${metadata.dominio_id} ---\n\n` +
        `--- PROMPTS DE ORQUESTRAÇÃO ---\n${system_prompt}`;

      // Chamar GPT-5 Mini como mock do coordenador
      console.log('[JuniorAgent] 🚀 Enviando para coordenador...');
      const startTime = Date.now();

      const response = await Promise.race([
        getOpenAI().chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: context }
          ],
          max_completion_tokens: 4000, // Aumentado para comportar reasoning + output
          verbosity: 'high', // Forçar mais output de texto
          reasoning_effort: 'low' // Reduzir tokens gastos em reasoning
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout no coordenador')), 80000)
        )
      ]);

      const elapsedTime = Date.now() - startTime;
      
      // Extração robusta da resposta considerando diferentes estruturas
      let responseText = '';
      
      if (response.choices && response.choices[0]) {
        const choice = response.choices[0];
        
        // Tentar diferentes estruturas possíveis
        if (choice.message?.content) {
          responseText = choice.message.content;
        } else if (choice.text) {
          responseText = choice.text;
        } else if (choice.message?.text) {
          responseText = choice.message.text;
        }
      }
      
      // Fallback: tentar acessar diretamente
      if (!responseText && response.content) {
        responseText = response.content;
      }
      
      responseText = responseText?.trim() || '';
      
      console.log(`[JuniorAgent] 📝 Resposta extraída (${responseText.length} chars)`);
      console.log(`[JuniorAgent] ✅ Resposta do ${metadata.coordenador_id} recebida em ${elapsedTime}ms`);

      // Log de tokens consumidos
      if (response?.usage) {
        console.log('[JuniorAgent] 💰 Tokens consumidos pelo coordenador:', response.usage);
      }

      // Validação: garantir que a resposta não está vazia
      if (!responseText || responseText.length === 0) {
        console.warn('[JuniorAgent] ⚠️ Resposta vazia recebida do coordenador');
        throw new Error('Coordenador retornou resposta vazia');
      }

      return {
        response: responseText,
        sessionId,
        timestamp: new Date().toISOString(),
        metadata: {
          coordenador: metadata.coordenador_id,
          dominio: metadata.dominio_id,
          prompts: metadata.prompts_ids,
          fluxo: 'complexa'
        }
      };

    } catch (error) {
      console.error(`[JuniorAgent] ❌ Erro no roteamento para ${metadata.coordenador_id}:`, error.message);
      
      return {
        response: 'Desculpe, houve um erro ao processar sua solicitação complexa. Por favor, tente reformular sua pergunta.',
        sessionId,
        timestamp: new Date().toISOString(),
        error: error.message,
        metadata: {
          coordenador: metadata.coordenador_id,
          fluxo: 'complexa',
          status: 'error'
        }
      };
    }
  }

  // =====================================================
  // INTEGRAÇÃO COM LANÇADOR E STUBS
  // =====================================================

  /**
   * Roteia para Agente Lançador
   * Política: WRITE_ONLY - Não envia contexto, mas salva a interação
   * @param {Object} params - Parâmetros da mensagem
   * @returns {Promise<Object>} - Resposta do Lançador
   */
  async routeToLancador(params) {
    const { message, chatId, userId, sessionId } = params;
    console.log('[JuniorAgent] 📝 Roteando para Lançador');

    try {
      // Instanciar Lançador (singleton por sessão)
      if (!this._lancadorAgent) {
        this._lancadorAgent = new LancadorAgent();
      }

      // Executar Lançador (formato BaseAgent: { parameters: {...} })
      const result = await this._lancadorAgent.execute({
        parameters: {
          message,
          chatId,
          userId,
          sessionId
        }
      });

      // Política WRITE_ONLY: Salvar interação na memória
      try {
        const memory = await ConversationalMemory.findOrCreate(chatId, userId, sessionId);
        await this._updateMemory(memory, message, result.response, true);
        console.log('[JuniorAgent] 💾 Lançamento salvo na memória');
      } catch (memError) {
        console.warn('[JuniorAgent] ⚠️ Erro ao salvar na memória:', memError.message);
      }

      return result;

    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro no Lançador:', error.message);
      return {
        response: `❌ Desculpe, ocorreu um erro ao processar seu lançamento. Por favor, tente novamente.`,
        sessionId,
        timestamp: new Date().toISOString(),
        metadata: { 
          agente: 'lancador', 
          status: 'error',
          error: error.message
        }
      };
    }
  }

  /**
   * Roteia para Agente Simplista
   * Política: READ_WRITE - Carrega contexto para consulta e salva a interação
   * @param {Object} params - Parâmetros da mensagem
   * @returns {Promise<Object>} - Resposta do Simplista
   */
  async routeToSimplista(params) {
    const { message, chatId, userId, sessionId } = params;
    console.log('[JuniorAgent] 🟡 Roteando para Simplista');

    try {
      // Carregar memória para incluir contexto (READ_WRITE policy)
      const memory = await ConversationalMemory.findOrCreate(chatId, userId, sessionId);
      const hasContext = !!memory.cumulativeSummary || (memory.recentWindow?.length > 0);

      console.log('[JuniorAgent] 💾 Contexto carregado para Simplista (READ_WRITE):', {
        hasSummary: !!memory.cumulativeSummary,
        recentWindowSize: memory.recentWindow?.length || 0
      });

      // Importação lazy do SimplistaAgent
      const { getSimplistaAgent } = require('../simplista');
      const simplistaAgent = getSimplistaAgent();

      // Preparar contexto de memória para o Simplista
      const memoryContext = {
        summary: memory.cumulativeSummary || '',
        recent: memory.recentWindow || []
      };

      // Executar o Simplista
      const result = await simplistaAgent.execute({
        userId,
        memory: memoryContext,
        message
      });

      // Extrair resposta
      const responseText = result.resposta || result.response || 'Não consegui processar sua consulta.';

      // Salvar na memória (READ_WRITE policy)
      await this._updateMemory(memory, message, responseText, true);
      
      console.log('[JuniorAgent] 💾 Interação Simplista salva na memória');

      // Verificar se Simplista solicitou transição para outro agente
      if (result.metadata?.transitionFlag) {
        console.log(`[JuniorAgent] 🔄 Simplista solicitou transição para: ${result.metadata.transitionFlag}`);
        
        if (result.metadata.transitionFlag === 'COMPLEXA') {
          return await this.processComplexQuery(params);
        } else if (result.metadata.transitionFlag === 'LANCAMENTO') {
          return await this.routeToLancador(params);
        }
      }

      return {
        response: responseText,
        sessionId,
        timestamp: new Date().toISOString(),
        metadata: { 
          agente: 'simplista', 
          status: 'active', 
          hasContext,
          fluxo: 'simplista',
          memoryPolicy: 'READ_WRITE',
          tempoExecucao: result.metadata?.tempoExecucao,
          fontesConsultadas: result.metadata?.fontesConsultadas || [],
          ofereceuAprofundamento: result.metadata?.ofereceuAprofundamento || false
        }
      };

    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro no Simplista:', error.message);
      return {
        response: 'Desculpe, houve um erro ao processar sua consulta. Pode tentar novamente?',
        sessionId,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // =====================================================
  // PROCESSAMENTO DE CHAT (FLUXO ORIGINAL)
  // =====================================================

  /**
   * Processa uma mensagem de chat com memória persistente
   * @param {Object} params - Parâmetros da mensagem
   * @returns {Promise<Object>} Resposta processada
   */
  async processChatMessage(params) {
    const { message, sessionId, chatId, userId } = params;

    try {
      // ===== VALIDAÇÃO =====
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Mensagem inválida ou vazia');
      }

      if (!chatId || !userId) {
        throw new Error('chatId e userId são obrigatórios para memória persistente');
      }

      console.log('[JuniorAgent] 📨 Processando mensagem:', {
        chatId,
        userId,
        sessionId,
        messageLength: message.length
      });

      // ===== CARREGAR/CRIAR MEMÓRIA =====
      let memory = await ConversationalMemory.findOrCreate(chatId, userId, sessionId);

      console.log('[JuniorAgent] 💾 Memória carregada:', {
        hasSummary: !!memory.cumulativeSummary,
        summaryTokens: memory.summaryTokens,
        recentWindowSize: memory.recentWindow.length,
        totalTokens: memory.totalTokens
      });

      // ===== CONSTRUIR CONTEXTO PARA IA =====
      const { systemPrompt, contextualInput } = this._buildPromptWithMemory(
        memory,
        message
      );

      console.log('[JuniorAgent] 📝 Prompt construído:', {
        systemLength: systemPrompt.length,
        contextLength: contextualInput.length,
        estimatedInputTokens: memorySummaryService.estimateTokens(systemPrompt + contextualInput)
      });

      // Log detalhado para observabilidade da memória injetada (quando disponível)
      try {
        const { getLogger } = require('../../../utils/logger');
        let logger = null;
        try { logger = getLogger(); } catch (e) { /* logger não inicializado */ }

        if (logger) {
          const memoryInfo = {
            hasSummary: !!memory.cumulativeSummary,
            summaryPreview: memory.cumulativeSummary ? String(memory.cumulativeSummary).slice(0, 300) : '',
            summaryTokens: memory.summaryTokens || 0,
            recentWindowCount: memory.recentWindow ? memory.recentWindow.length : 0,
            recentWindowPreview: Array.isArray(memory.recentWindow) ? memory.recentWindow.slice(-4).map(m => `${m.role}:${m.content}`).join(' | ').slice(0, 500) : '',
            totalTokens: memory.totalTokens || 0,
            sessionId,
            chatId,
            userId
          };

          logger.logAIPrompt(this.model, systemPrompt, contextualInput, { memoryInfo, sessionId, chatId, userId });
        }
      } catch (err) {
        console.warn('[JuniorAgent] ⚠️ Não foi possível registrar prompt detalhado:', err.message);
      }

      // ===== CHAMAR GPT-5 MINI =====
      console.log('[JuniorAgent] 🚀 Enviando requisição para OpenAI...');
      const startTime = Date.now();
      
      const response = await Promise.race([
        getOpenAI().chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextualInput }
          ],
          max_completion_tokens: this.max_completion_tokens,
          verbosity: 'low',
          reasoning_effort: 'low'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: OpenAI não respondeu em 80 segundos')), 80000)
        )
      ]);

      const elapsedTime = Date.now() - startTime;
      console.log(`[JuniorAgent] ⏱️ Resposta recebida em ${elapsedTime}ms`);

      const responseText = response.choices[0]?.message?.content?.trim();

      if (!responseText) {
        console.error('[JuniorAgent] ❌ Resposta vazia da API');
        throw new Error('Resposta vazia da API');
      }

      // Log de uso de tokens
      if (response?.usage) {
        console.log('[JuniorAgent] 💰 Tokens consumidos:', response.usage);
      }

      // ===== ATUALIZAR MEMÓRIA =====
      await this._updateMemory(memory, message, responseText);

      console.log('[JuniorAgent] ✅ Resposta gerada e memória atualizada');

      return {
        response: responseText,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      // Log detalhado do erro para diagnóstico
      console.error('[JuniorAgent] ❌ Erro no processamento:', {
        message: error.message || 'Erro desconhecido',
        name: error.name,
        status: error.status, // Status HTTP (ex: 429 = rate limit)
        type: error.type, // Tipo do erro OpenAI
        code: error.code, // Código específico do erro
        stack: error.stack?.split('\n').slice(0, 3).join('\n') // Primeiras 3 linhas do stack
      });

      // Log adicional se for erro da OpenAI
      if (error.status) {
        console.error('[JuniorAgent] 🔴 Erro da OpenAI API:', {
          status: error.status,
          statusText: this._getErrorStatusText(error.status),
          type: error.type,
          code: error.code
        });
      }

      return {
        response: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        error: error.message || 'Erro desconhecido',
        errorDetails: {
          type: error.name || 'UnknownError',
          status: error.status,
          code: error.code
        }
      };
    }
  }

  /**
   * Interpreta códigos de status HTTP da OpenAI
   * @param {number} status - Código HTTP
   * @returns {string} Descrição do erro
   */
  _getErrorStatusText(status) {
    const statusMap = {
      400: 'Bad Request - Requisição inválida',
      401: 'Unauthorized - API Key inválida',
      403: 'Forbidden - Acesso negado',
      404: 'Not Found - Modelo não encontrado',
      429: 'Rate Limit - Muitas requisições (aguarde antes de tentar novamente)',
      500: 'Internal Server Error - Erro interno da OpenAI',
      503: 'Service Unavailable - Serviço temporariamente indisponível'
    };
    return statusMap[status] || `Erro HTTP ${status}`;
  }

  /**
   * Constrói prompts do sistema e contexto com memória integrada
   * @param {Object} memory - Documento ConversationalMemory do MongoDB
   * @param {string} currentMessage - Mensagem atual do usuário
   * @returns {Object} - { systemPrompt, contextualInput }
   */
  _buildPromptWithMemory(memory, currentMessage) {
    // System prompt com diretrizes de memória
    const systemPrompt = this._buildSystemPrompt();

    // Contexto conversacional
    let contextualInput = '';

    // 1. Injetar HISTÓRICO_RESUMIDO se existir
    if (memory.cumulativeSummary && memory.cumulativeSummary.trim().length > 0) {
      contextualInput += `[HISTÓRICO_RESUMIDO]\n${memory.cumulativeSummary}\n\n`;
    }

    // 2. Adicionar JANELA_ATUAL (últimas mensagens íntegras)
    if (memory.recentWindow && memory.recentWindow.length > 0) {
      contextualInput += '[JANELA_ATUAL]\n';
      for (const msg of memory.recentWindow) {
        const prefix = msg.role === 'user' ? 'U' : 'A';
        contextualInput += `${prefix}: ${msg.content}\n`;
      }
      contextualInput += '\n';
    }

    // 3. Adicionar mensagem atual
    contextualInput += `U: ${currentMessage}\nA:`;

    return { systemPrompt, contextualInput };
  }

  /**
   * Atualiza memória persistente após interação
   * @param {Object} memory - Documento ConversationalMemory
   * @param {string} userMessage - Mensagem do usuário
   * @param {string} aiResponse - Resposta da IA
   * @param {boolean} shouldSave - Se deve salvar no banco (default: true)
   */
  async _updateMemory(memory, userMessage, aiResponse, shouldSave = true) {
    try {
      // Estimar tokens das novas mensagens
      const userTokens = memorySummaryService.estimateTokens(userMessage);
      const aiTokens = memorySummaryService.estimateTokens(aiResponse);

      // Adicionar novas mensagens à janela recente
      memory.recentWindow.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        tokens: userTokens
      });

      memory.recentWindow.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        tokens: aiTokens
      });

      // Recalcular total de tokens
      const recentWindowTokens = memory.recentWindow.reduce((sum, msg) => sum + msg.tokens, 0);
      memory.totalTokens = memory.summaryTokens + recentWindowTokens;

      // Contar ciclos (1 ciclo = 1 user + 1 assistant)
      const cycleCount = Math.floor(memory.recentWindow.length / 2);

      console.log('[JuniorAgent] 📊 Tokens após atualização:', {
        summaryTokens: memory.summaryTokens,
        recentWindowTokens,
        totalTokens: memory.totalTokens,
        recentWindowLength: memory.recentWindow.length,
        cycleCount,
        summaryWordCount: memory.cumulativeSummary ? memory.cumulativeSummary.split(/\s+/).length : 0
      });

      // LÓGICA CORRETA: Resumir SEMPRE quando tiver mais de 2 ciclos (> 4 mensagens)
      if (memory.recentWindow.length > this.RECENT_WINDOW_SIZE) {
        
        console.log('[JuniorAgent] 🔄 Mais de 2 ciclos detectado - iniciando resumo cumulativo...');
        console.log('[JuniorAgent] 📋 Mensagens a resumir:', {
          totalMensagens: memory.recentWindow.length,
          ciclosCompletos: cycleCount,
          mensagensParaResumo: memory.recentWindow.length - this.RECENT_WINDOW_SIZE,
          ultimosCiclosIntegros: 2
        });
        
        await this._performSummary(memory);
      }

      // Salvar memória somente se permitido pela política
      if (shouldSave) {
        await memory.save();
        console.log('[JuniorAgent] 💾 Memória salva:', {
          recentWindowSize: memory.recentWindow.length,
          totalTokens: memory.totalTokens,
          summaryCount: memory.summaryCount
        });
      } else {
        console.log('[JuniorAgent] 💾 Memória preparada (não salva - coordenador/outro agente salvará)');
      }

    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro ao atualizar memória:', error);
      // Não propaga erro - memória é best-effort
    }
  }

  /**
   * Executa resumo cumulativo quando threshold é atingido
   * @param {Object} memory - Documento ConversationalMemory
   */
  async _performSummary(memory) {
    try {
      // Mensagens que vão sair da janela (todas exceto as 4 últimas)
      const messagesToSummarize = memory.recentWindow.slice(0, -this.RECENT_WINDOW_SIZE);

      const previousWordCount = memory.cumulativeSummary ? 
        memory.cumulativeSummary.split(/\s+/).filter(Boolean).length : 0;

      console.log('[JuniorAgent] 📋 Resumindo mensagens:', {
        count: messagesToSummarize.length,
        previousSummaryLength: memory.cumulativeSummary?.length || 0,
        previousWordCount,
        maxSummaryWords: this.MAX_SUMMARY_WORDS
      });

      // Gerar novo resumo cumulativo
      const result = await memorySummaryService.generateCumulativeSummary(
        memory.cumulativeSummary,
        messagesToSummarize
      );

      if (result.error) {
        console.error('[JuniorAgent] ⚠️ Erro no resumo, mantendo versão anterior');
        return;
      }

      // Atualizar memória com novo resumo
      memory.cumulativeSummary = result.summary;
      memory.summaryTokens = result.tokens;
      memory.lastSummaryAt = new Date();
      memory.summaryCount += 1;

      // Manter apenas últimas 4 mensagens na janela (2 ciclos)
      memory.recentWindow = memory.recentWindow.slice(-this.RECENT_WINDOW_SIZE);

      // Recalcular tokens
      const recentWindowTokens = memory.recentWindow.reduce((sum, msg) => sum + msg.tokens, 0);
      memory.totalTokens = memory.summaryTokens + recentWindowTokens;

      console.log('[JuniorAgent] ✅ Resumo concluído:', {
        newSummaryLength: result.summary.length,
        newSummaryWordCount: result.wordCount || 0,
        wasTruncated: result.wasTruncated || false,
        newSummaryTokens: result.tokens,
        newTotalTokens: memory.totalTokens,
        summaryCount: memory.summaryCount,
        recentWindowSize: memory.recentWindow.length
      });

    } catch (error) {
      console.error('[JuniorAgent] ❌ Erro crítico ao executar resumo:', error);
      // Em caso de erro, mantém estado anterior
    }
  }

  /**
   * Constrói prompt do sistema com diretrizes de memória
   * @returns {string} - System prompt
   */
  _buildSystemPrompt() {
    return `### DIRETRIZES DE MEMÓRIA E CONTEXTO

Você possui um sistema de memória de longo prazo. Antes de cada interação, você receberá um bloco identificado como [HISTÓRICO_RESUMIDO].

Suas instruções sobre esse histórico:

**Prioridade de Fatos**: Trate as informações contidas no resumo como fatos estabelecidos. Se o usuário já se identificou, informou valores ou preferências no resumo, não pergunte novamente.

**Continuidade**: Use o resumo para manter a fluidez da conversa e demonstrar que você "lembra" de interações anteriores.

**Prioridade Cronológica**: As mensagens na [JANELA_ATUAL] (últimas mensagens) têm prioridade sobre o resumo caso haja alguma contradição (ex: o usuário mudou de ideia).

**Invisibilidade**: Não mencione termos técnicos como "meu sistema de resumo" ou "estou lendo meu histórico". Apenas use a informação de forma natural, como se você se lembrasse perfeitamente.

---

Você é um assistente financeiro pessoal amigável e direto.

## Regras de comunicação:
1. Seja conciso e acolhedor - evite longas listas logo de início
2. Perguntas diretas merecem respostas diretas
3. Use tom amigável, primeira pessoa, tutear o usuário
4. Máximo 3-4 linhas para respostas iniciais; expanda só se pedido
5. Se o usuário já compartilhou informações no histórico ou resumo, USE essas informações
6. Não repita informações que o usuário já sabe
7. Demonstre continuidade - se o usuário disse o nome antes, use-o naturalmente

## Formato de resposta:
- Responda em português brasileiro natural
- Use emojis com moderação (1-2 por mensagem no máximo)
- Seja objetivo e útil
- Personalize com base no que você "lembra" (resumo + janela atual)`;
  }
}

module.exports = JuniorAgent;