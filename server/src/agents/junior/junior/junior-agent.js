/**
 * Junior Agent - Simple User Response Agent with Conversational Memory
 *
 * NOVO SISTEMA DE MEMÓRIA:
 * - Memória conversacional simplificada baseada em ciclos
 * - Últimos 4 ciclos mantidos integralmente  
 * - Ciclos anteriores comprimidos progressivamente
 * - Limite máximo de 3.000 tokens de contexto
 */

const BaseAgent = require('../../shared/base-agent');
const memoryIntegration = require('../../../core/memory/memory-integration-new');
const OpenAI = require('openai');

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
    
    this.model = 'gpt-4.1-mini';
    this.max_output_tokens = 1500;
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
   * Processa uma mensagem de chat completa
   * @param {Object} params - Parâmetros da mensagem
   * @returns {Promise<Object>} Resposta processada
   */
  async processChatMessage(params) {
    const { message, sessionId, history, userId, chatId } = params;

    try {
      // Validação básica da mensagem
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Mensagem inválida ou vazia');
      }

      // Inicializa sessão se necessário
      if (sessionId && userId) {
        try {
          memoryIntegration.initializeSession(sessionId, userId, {
            startedAt: new Date().toISOString(),
            chatId: chatId
          });
        } catch (error) {
          console.log('[JuniorAgent] Sessão já existe:', error.message);
        }
      }

      // Constrói contexto de memória conversacional
      let memoryContext = null;
      if (sessionId && chatId && userId) {
        try {
          console.log('[JuniorAgent] 🔍 Carregando contexto de memória...');
          memoryContext = await memoryIntegration.buildAgentContext(sessionId, chatId, userId);
          console.log('[JuniorAgent] ✅ Contexto carregado:', memoryContext.stats);
        } catch (error) {
          console.warn('[JuniorAgent] Erro ao carregar memória:', error.message);
        }
      }

      // Monta prompt do sistema
      const systemPrompt = this._buildSystemPrompt();
      
      // Monta contexto de memória
      let contextualInput = '';
      if (memoryContext?.conversationalContext) {
        contextualInput = memoryContext.conversationalContext + '\n\n';
      }
      
      // Adiciona mensagem atual
      contextualInput += `U: ${message}\nA:`;

      // Log do prompt
      console.log('[JuniorAgent] 📝 Prompt construído:', {
        systemLength: systemPrompt.length,
        contextLength: contextualInput.length,
        estimatedTokens: Math.ceil((systemPrompt.length + contextualInput.length) / 4)
      });

      // Log do prompt completo enviado à IA
      console.log('[AI_PROMPT] 🤖 PROMPT COMPLETO ENVIADO PARA IA:', {
        model: this.model,
        system_prompt: systemPrompt,
        user_context: contextualInput,
        max_tokens: this.max_output_tokens,
        temperature: 0.7,
        sessionId,
        chatId,
        userId
      });

      // Gera resposta usando OpenAI Chat Completions
      const response = await getOpenAI().chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextualInput }
        ],
        max_tokens: this.max_output_tokens,
        temperature: 0.7
      });
      
      // Log de consumo de tokens
      if (response?.usage) {
        const usage = response.usage;
        console.log('[JuniorAgent] 💰 Tokens consumidos:', {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens
        });
      }
      
      const responseText = response.choices[0]?.message?.content?.trim();

      if (!responseText) {
        console.error('[JuniorAgent] ❌ Resposta vazia da API');
        throw new Error('Resposta vazia da API');
      }

      const finalResponse = responseText;

      // Processa memórias em background (não bloqueante)
      if (sessionId && chatId && userId) {
        memoryIntegration.processInteractionMemories({
          sessionId,
          chatId,
          userId,
          userMessage: message,
          aiResponse: finalResponse
        }).catch(error => {
          console.error('[JuniorAgent] Erro no processamento de memória:', error);
        });
      }

      return {
        response: finalResponse,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[JuniorAgent] Erro no processamento:', error);
      return {
        response: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Constrói prompt do sistema
   * @returns {string} - System prompt
   */
  _buildSystemPrompt() {
    return `Você é um assistente financeiro pessoal amigável e direto.

## Regras de comunicação:
1. Seja conciso e acolhedor - evite longas listas logo de início
2. Perguntas diretas merecem respostas diretas
3. Use tom amigável, primeira pessoa, tutear o usuário
4. Máximo 3-4 linhas para respostas iniciais; expanda só se pedido
5. Se o usuário já compartilhou informações no histórico, USE essas informações
6. Não repita informações que o usuário já sabe

## Formato de resposta:
- Responda em português brasileiro natural
- Use emojis com moderação (1-2 por mensagem no máximo)
- Seja objetivo e útil`;
  }
}

module.exports = JuniorAgent;