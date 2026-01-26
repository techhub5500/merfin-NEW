/**
 * Junior Agent - Conversational Agent with Persistent Memory
 *
 * SISTEMA DE MEMÓRIA PERSISTENTE:
 * - Janela deslizante: Últimos 2 ciclos (4 mensagens) mantidos integralmente
 * - Resumo cumulativo: Histórico antigo compactado progressivamente pelo GPT-5 Nano
 * - Threshold: 3500 tokens gatilha resumo automático
 * - Modelo: GPT-5 Mini (verbosity: medium, reasoning_effort: medium)
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
  }

  /**
   * Método principal de execução do agente
   * @param {Object} request - Requisição do usuário
   * @returns {Promise<Object>} Resposta do agente
   */
  async execute(request) {
    const { parameters } = request;
    return await this.processChatMessage(parameters);
  }

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
      const response = await getOpenAI().chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextualInput }
        ],
        max_completion_tokens: this.max_completion_tokens,
        verbosity: 'medium',
        reasoning_effort: 'medium'
      });

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
      console.error('[JuniorAgent] ❌ Erro no processamento:', error);
      return {
        response: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
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
   */
  async _updateMemory(memory, userMessage, aiResponse) {
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

      // Salvar memória atualizada
      await memory.save();

      console.log('[JuniorAgent] 💾 Memória salva:', {
        recentWindowSize: memory.recentWindow.length,
        totalTokens: memory.totalTokens,
        summaryCount: memory.summaryCount
      });

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