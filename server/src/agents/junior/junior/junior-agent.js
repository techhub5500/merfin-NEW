/**
 * Junior Agent - Simple User Response Agent with Memory Integration
 *
 * This agent responds to user messages using LLM with full memory context.
 */

const BaseAgent = require('../../shared/base-agent');
const chatIntegration = require('../../shared/chat-integration');
const memoryIntegration = require('../../../core/memory/memory-integration');
const OpenAI = require('openai');

// Configuração da OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class JuniorAgent extends BaseAgent {
  constructor() {
    super('JuniorAgent');

    this.model = 'gpt-5-nano';
    // Limite de tokens de saída (aumentado para garantir espaço após reasoning)
    this.max_output_tokens = 800;
    // Esforço médio de reasoning para balancear qualidade e tokens disponíveis
    this.reasoning_effort = 'medium';

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
   * Método principal para integração com chats da plataforma
   * @param {Object} params - Parâmetros da mensagem
   * @returns {Promise<Object>} Resposta processada
   */
  async processChatMessage(params) {
    const { message, sessionId, history, userId, chatId } = params;

    try {
      // Valida mensagem usando integração comum
      const validation = chatIntegration.validateMessage(message);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Initialize session if needed
      if (sessionId && userId) {
        try {
          memoryIntegration.initializeSession(sessionId, userId, {
            startedAt: new Date().toISOString(),
            chatId: chatId
          });
        } catch (error) {
          // Session might already exist, that's OK
          console.log('[JuniorAgent] Session already exists or error:', error.message);
        }
      }

      // Build memory context
      let memoryContext = null;
      if (sessionId && chatId && userId) {
        try {
          console.log('[JuniorAgent] 🔍 Carregando contexto de memória...');
          memoryContext = await memoryIntegration.buildAgentContext(sessionId, chatId, userId);
          console.log('[JuniorAgent] ✅ Memory context loaded:', {
            hasWorking: Object.keys(memoryContext.workingMemory || {}).length > 0,
            hasEpisodic: !!memoryContext.episodicMemory,
            ltmCount: memoryContext.longTermMemory?.length || 0
          });
          console.log('[JuniorAgent] 📊 Working Memory:', JSON.stringify(memoryContext.workingMemory, null, 2));
          console.log('[JuniorAgent] 📖 Episodic Memory:', JSON.stringify(memoryContext.episodicMemory, null, 2));
          console.log('[JuniorAgent] 💾 Long-term Memory:', JSON.stringify(memoryContext.longTermMemory, null, 2));
        } catch (error) {
          console.warn('[JuniorAgent] Error loading memory context:', error.message);
        }
      }

      // Converte histórico para formato do agente
      const agentHistory = chatIntegration.convertHistoryForAgent(history || []);

      // Construir contexto com histórico + memória - System Prompt otimizado
      let contextualInput = 'Você é um assistente financeiro prestativo. Responda de forma clara, objetiva e concisa em português brasileiro. Seja direto e útil.\n\n';
      
      // Add memory context if available
      if (memoryContext) {
        const formattedContext = memoryIntegration.formatContextForPrompt(memoryContext);
        if (formattedContext) {
          contextualInput += '## Contexto da Memória:\n';
          contextualInput += formattedContext;
          contextualInput += '---\n\n';
        }
      }
      
      // Adiciona histórico ao contexto
      if (agentHistory.length > 0) {
        contextualInput += 'Histórico da conversa:\n';
        agentHistory.forEach(msg => {
          const role = msg.role === 'user' ? 'Usuário' : 'Assistente';
          contextualInput += `${role}: ${msg.content}\n`;
        });
        contextualInput += '\n';
      }
      
      // Adiciona mensagem atual
      contextualInput += `Usuário: ${message}\n\nAssistente:`;

      // Generate response using gpt-5-nano API
      const response = await openai.responses.create({
        model: this.model,
        input: contextualInput,
        max_output_tokens: this.max_output_tokens,
        reasoning: { effort: this.reasoning_effort },
      });
      const responseText = this._extractResponseText(response);

      if (!responseText) {
        console.error('[JuniorAgent] Resposta vazia da API:', JSON.stringify(response));
      }

      const finalResponse = responseText || 'Desculpe, não consegui gerar uma resposta.';

      // Process memories in background (non-blocking)
      if (sessionId && chatId && userId) {
        console.log('[JuniorAgent] 🔄 Iniciando processamento de memórias em background...');
        console.log('[JuniorAgent] 📦 Dados para memória:', {
          sessionId,
          chatId,
          userId,
          userMessageLength: message.length,
          aiResponseLength: finalResponse.length,
          historyLength: agentHistory.length
        });
        memoryIntegration.processInteractionMemories({
          sessionId,
          chatId,
          userId,
          userMessage: message,
          aiResponse: finalResponse,
          history: agentHistory
        }).catch(error => {
          console.error('[JuniorAgent] ❌ Background memory processing error:', error);
        });
      }

      return {
        response: finalResponse,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Erro no processamento de chat:', error);
      console.error('Detalhes do erro:', error.message);
      // Fallback
      return {
        response: 'Desculpe, houve um erro ao processar sua mensagem. Tente novamente.',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Extrai texto da resposta da Responses API de forma resiliente a variações de formato.
   * @param {object} response
   * @returns {string|null}
   */
  _extractResponseText(response) {
    if (!response) return null;

    // Campo direto output_text (documentado)
    if (typeof response.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }

    // Campo output (lista) com content
    if (Array.isArray(response.output)) {
      for (const item of response.output) {
        // item.content é um array de blocos
        if (Array.isArray(item?.content)) {
          for (const block of item.content) {
            if (typeof block?.text === 'string' && block.text.trim()) {
              return block.text.trim();
            }
            if (typeof block === 'string' && block.trim()) {
              return block.trim();
            }
          }
        }
        // item.text direto
        if (typeof item?.text === 'string' && item.text.trim()) {
          return item.text.trim();
        }
      }
    }

    // Compatibilidade com eventuais formatos de chat
    if (Array.isArray(response.choices)) {
      const choice = response.choices[0];
      const content = choice?.message?.content;
      if (typeof content === 'string' && content.trim()) return content.trim();
      if (Array.isArray(content)) {
        const textPart = content.find(part => part.type === 'text' && typeof part.text === 'string');
        if (textPart?.text?.trim()) return textPart.text.trim();
      }
    }

    return null;
  }
}

module.exports = JuniorAgent;