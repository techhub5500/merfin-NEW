/**
 * Junior Agent - Simple User Response Agent
 *
 * This agent responds to user messages using LLM.
 */

const BaseAgent = require('../../shared/base-agent');
const chatIntegration = require('../../shared/chat-integration');
const OpenAI = require('openai');

// Configuração da OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class JuniorAgent extends BaseAgent {
  constructor() {
    super('JuniorAgent');

    this.model = 'gpt-5-nano';
    // Limite de tokens de saída (aumentado para evitar corte durante reasoning)
    this.max_output_tokens = 320;
    // Reduz esforço de reasoning para sobrar tokens para a resposta textual
    this.reasoning_effort = 'low';

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
    const { message, sessionId, history } = params;

    try {
      // Valida mensagem usando integração comum
      const validation = chatIntegration.validateMessage(message);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Converte histórico para formato do agente
      const agentHistory = chatIntegration.convertHistoryForAgent(history || []);

      // Construir contexto com histórico - System Prompt otimizado
      let contextualInput = 'Você é um assistente financeiro prestativo. Responda de forma clara, objetiva e concisa em português brasileiro. Seja direto e útil.\n\n';
      
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

      return {
        response: responseText || 'Desculpe, não consegui gerar uma resposta.',
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