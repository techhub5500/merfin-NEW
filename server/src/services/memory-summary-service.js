/**
 * Memory Summary Service
 * 
 * Purpose: Serviço responsável por criar e atualizar resumos cumulativos
 * usando GPT-5 Nano, mantendo informações cruciais compactadas.
 * 
 * Controls: Recebe resumo anterior + novas mensagens, retorna resumo atualizado.
 * Behavior: Usa GPT-5 Nano com verbosity:low e reasoning_effort:medium.
 * Integration: Chamado pelo JuniorAgent quando threshold de tokens é atingido.
 */

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

class MemorySummaryService {
  constructor() {
    this.model = 'gpt-5-nano';
    this.max_completion_tokens = 3000; // Permitir resumos de até ~3500 palavras
  }

  /**
   * Estima tokens de um texto (1 palavra = 0,75 tokens)
   * @param {string} text - Texto para estimar
   * @returns {number} - Tokens estimados
   */
  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.ceil(wordCount * 0.75);
  }

  /**
   * Conta palavras em um texto
   * @param {string} text - Texto para contar
   * @returns {number} - Número de palavras
   */
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Formata mensagens para o resumo
   * @param {Array} messages - Array de mensagens [{role, content}]
   * @returns {string} - Texto formatado
   */
  formatMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return '';
    
    return messages.map(msg => {
      const prefix = msg.role === 'user' ? 'Usuário' : 'Assistente';
      return `${prefix}: ${msg.content}`;
    }).join('\n');
  }

  /**
   * Gera resumo cumulativo atualizado
   * 
   * @param {string} previousSummary - Resumo anterior (pode ser vazio)
   * @param {Array} newMessages - Mensagens a serem incorporadas ao resumo
   * @returns {Promise<Object>} - { summary: string, tokens: number }
   */
  async generateCumulativeSummary(previousSummary, newMessages) {
    try {
      // Validação de entrada
      if (!Array.isArray(newMessages) || newMessages.length === 0) {
        console.log('[MemorySummaryService] Nenhuma mensagem nova para resumir');
        return {
          summary: previousSummary || '',
          tokens: this.estimateTokens(previousSummary || '')
        };
      }

      // Formata mensagens novas
      const formattedMessages = this.formatMessages(newMessages);

      // Constrói prompt do sistema
      const systemPrompt = this._buildSystemPrompt();

      // Constrói contexto para o modelo
      let userPrompt = '';
      
      if (previousSummary && previousSummary.trim().length > 0) {
        userPrompt += `[RESUMO ATUAL]\n${previousSummary}\n\n`;
      } else {
        userPrompt += '[RESUMO ATUAL]\n(Vazio - primeira interação)\n\n';
      }
      
      userPrompt += `[ÚLTIMAS MENSAGENS]\n${formattedMessages}\n\n`;
      userPrompt += '[TAREFA]\nAtualize o resumo incorporando as informações das últimas mensagens. Mantenha fatos cruciais.';

      console.log('[MemorySummaryService] 📝 Gerando resumo cumulativo...', {
        previousSummaryLength: previousSummary?.length || 0,
        newMessagesCount: newMessages.length,
        estimatedInputTokens: this.estimateTokens(systemPrompt + userPrompt)
      });

      // Chama GPT-5 Nano
      const response = await getOpenAI().chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: this.max_completion_tokens,
        verbosity: 'low',
        reasoning_effort: 'medium'
      });

      const summary = response.choices[0]?.message?.content?.trim();

      if (!summary) {
        console.error('[MemorySummaryService] ❌ Resumo vazio retornado pela API');
        throw new Error('Resumo vazio da API');
      }

      const tokens = this.estimateTokens(summary);
      const wordCount = this.countWords(summary);

      // VALIDAÇÃO: Verificar se resumo ultrapassou 3500 palavras
      if (wordCount > 3500) {
        console.warn('[MemorySummaryService] ⚠️ Resumo ultrapassou 3500 palavras:', {
          wordCount,
          limite: 3500,
          excesso: wordCount - 3500
        });
        // Truncar para 3500 palavras
        const words = summary.split(/\s+/);
        const truncatedSummary = words.slice(0, 3500).join(' ');
        console.log('[MemorySummaryService] ✂️ Resumo truncado para 3500 palavras');
        
        return {
          summary: truncatedSummary,
          tokens: this.estimateTokens(truncatedSummary),
          wordCount: 3500,
          wasTruncated: true
        };
      }

      console.log('[MemorySummaryService] ✅ Resumo gerado:', {
        summaryLength: summary.length,
        wordCount,
        tokens,
        usage: response.usage
      });

      return {
        summary,
        tokens,
        wordCount,
        wasTruncated: false
      };

    } catch (error) {
      console.error('[MemorySummaryService] Erro ao gerar resumo:', error);
      
      // Em caso de erro, retorna o resumo anterior inalterado
      return {
        summary: previousSummary || '',
        tokens: this.estimateTokens(previousSummary || ''),
        error: error.message
      };
    }
  }

  /**
   * Constrói prompt do sistema para o GPT-5 Nano
   * @returns {string} - System prompt
   */
  _buildSystemPrompt() {
    return `Você é um módulo de memória. Seu objetivo é atualizar o [Resumo Atual] incluindo as novas informações contidas nas [Últimas Mensagens]. Mantenha fatos cruciais (nomes, valores, datas e decisões). Seja extremamente conciso. Se uma informação no resumo antigo for retificada nas mensagens novas, atualize-a.`;
  }

  /**
   * Valida se é necessário gerar resumo (threshold atingido)
   * @param {number} totalTokens - Total de tokens atual
   * @param {number} threshold - Limite para gatilho (padrão: 3500)
   * @returns {boolean}
   */
  shouldTriggerSummary(totalTokens, threshold = 3500) {
    return totalTokens >= threshold;
  }
}

module.exports = new MemorySummaryService();
