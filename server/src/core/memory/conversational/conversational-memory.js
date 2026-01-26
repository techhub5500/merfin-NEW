/**
 * NOTE (conversational-memory.js):
 * Purpose: Sistema automático de memória conversacional que mantém contexto relevante
 * respeitando limite máximo de 3.000 tokens através de retenção total dos ciclos
 * recentes e resumos progressivos inteligentes dos ciclos mais antigos.
 * 
 * DEFINIÇÕES:
 * - Ciclo de interação: 1 mensagem do usuário + 1 resposta da IA
 * - Janela de memória ativa: Conjunto de ciclos (inteiros ou resumidos) enviado à IA
 * 
 * REGRAS:
 * 1. Últimos 4 ciclos: preservados integralmente (memória de alta fidelidade)
 * 2. A partir do 5º ciclo: compressão progressiva em camadas de 3 ciclos
 *    - Camada 1: resumo ~25% do original
 *    - Camada 2: resumo adicional ~25% (total ~6% do original)
 *    - E assim por diante
 * 3. Limite global: máximo 3.000 tokens
 * 
 * Controls: Adiciona ciclos, comprime automaticamente, formata para prompt
 * Behavior: Persistência via MongoDB (chat-schema), compressão inteligente com LLM
 * Integration notes: Usado pelo JuniorAgent para contexto de conversa
 */

const OpenAI = require('openai');

// Inicialização lazy do cliente OpenAI para evitar erros quando API key não está disponível
let openai = null;
function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Configurações do sistema
const CONFIG = {
  MAX_TOKENS: 3000,               // Limite global de tokens
  FULL_CYCLES: 4,                 // Ciclos mantidos integralmente
  CYCLES_PER_LAYER: 3,            // Ciclos por camada de resumo
  COMPRESSION_RATIO: 0.25,        // 25% de compressão por camada
  CHARS_PER_TOKEN: 4,             // Estimativa: 4 caracteres = 1 token
  MODEL_SUMMARIZE: 'gpt-4.1-nano' // Modelo para resumos
};

/**
 * Estrutura de um ciclo de interação
 * @typedef {Object} Cycle
 * @property {number} index - Índice do ciclo (0 = mais antigo)
 * @property {string} userMessage - Mensagem do usuário
 * @property {string} aiResponse - Resposta da IA
 * @property {string} timestamp - Timestamp ISO
 * @property {boolean} isCompressed - Se é um resumo comprimido
 * @property {number} originalCycles - Quantos ciclos originais representa (se comprimido)
 */

/**
 * Classe principal de memória conversacional
 */
class ConversationalMemory {
  constructor() {
    // Cache em memória: chatId -> cycles[]
    this.cache = new Map();
  }

  /**
   * Estima tokens de um texto
   * @param {string} text - Texto para estimar
   * @returns {number} - Tokens estimados
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / CONFIG.CHARS_PER_TOKEN);
  }

  /**
   * Estima tokens de um array de ciclos
   * @param {Cycle[]} cycles - Array de ciclos
   * @returns {number} - Total de tokens estimados
   */
  estimateCyclesTokens(cycles) {
    if (!cycles || cycles.length === 0) return 0;
    
    let total = 0;
    for (const cycle of cycles) {
      total += this.estimateTokens(cycle.userMessage || '');
      total += this.estimateTokens(cycle.aiResponse || '');
    }
    return total;
  }

  /**
   * Converte mensagens do formato do banco para ciclos
   * @param {Array} messages - Array de mensagens do chat-schema
   * @returns {Cycle[]} - Array de ciclos estruturados
   */
  messagesToCycles(messages) {
    if (!messages || messages.length === 0) return [];
    
    const cycles = [];
    let currentCycle = null;
    
    for (const msg of messages) {
      if (msg.type === 'user') {
        // Inicia novo ciclo
        if (currentCycle && currentCycle.aiResponse) {
          // Salva ciclo anterior completo
          cycles.push(currentCycle);
        }
        currentCycle = {
          index: cycles.length,
          userMessage: msg.content,
          aiResponse: null,
          timestamp: msg.timestamp || new Date().toISOString(),
          isCompressed: false,
          originalCycles: 1
        };
      } else if (msg.type === 'ai' && currentCycle) {
        // Completa ciclo atual
        currentCycle.aiResponse = msg.content;
      }
    }
    
    // Adiciona último ciclo se completo
    if (currentCycle && currentCycle.aiResponse) {
      cycles.push(currentCycle);
    }
    
    return cycles;
  }

  /**
   * Gera resumo inteligente de ciclos usando LLM
   * @param {Cycle[]} cycles - Ciclos a resumir
   * @param {number} targetCompression - Ratio de compressão (0.25 = 25%)
   * @returns {Promise<string>} - Texto resumido
   */
  async summarizeCycles(cycles, targetCompression = CONFIG.COMPRESSION_RATIO) {
    if (!cycles || cycles.length === 0) return '';
    
    // Monta texto original
    let originalText = '';
    for (const cycle of cycles) {
      originalText += `Usuário: ${cycle.userMessage}\n`;
      originalText += `IA: ${cycle.aiResponse}\n\n`;
    }
    
    const originalTokens = this.estimateTokens(originalText);
    const targetTokens = Math.ceil(originalTokens * targetCompression);
    
    // Prompt de resumo inteligente
    const prompt = `Você é um compressor de memória conversacional. Resuma a conversa abaixo em aproximadamente ${targetTokens} tokens (${Math.ceil(targetTokens * CONFIG.CHARS_PER_TOKEN)} caracteres).

REGRAS DO RESUMO:
✅ PRIORIZE:
- O que foi decidido
- O que o usuário quer/precisa
- O que já foi tentado
- Mudanças importantes na conversa
- Informações factuais críticas (valores, datas, nomes)
- Preferências persistentes do usuário
- Compromissos assumidos

❌ ELIMINE:
- Saudações e frases sociais
- Repetições
- Exemplos descartáveis
- Detalhes que não impactam decisões futuras
- Redundâncias conversacionais

FORMATO: Escreva em formato narrativo compacto, terceira pessoa.
Exemplo: "Usuário quer investir R$5.000. Preferência: baixo risco. Decidiu por CDB 12 meses."

CONVERSA A RESUMIR:
${originalText}

RESUMO:`;

    try {
      const response = await getOpenAI().chat.completions.create({
        model: CONFIG.MODEL_SUMMARIZE,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: targetTokens + 50, // Margem para completar frases
        temperature: 0.3 // Baixa temperatura para resumos consistentes
      });
      
      const summary = response.choices[0]?.message?.content?.trim() || '';
      console.log(`[ConversationalMemory] Resumo gerado: ${originalTokens} -> ${this.estimateTokens(summary)} tokens`);
      return summary;
      
    } catch (error) {
      console.error('[ConversationalMemory] Erro ao gerar resumo:', error.message);
      // Fallback: trunca texto mantendo início e fim
      const chars = Math.ceil(originalTokens * targetCompression * CONFIG.CHARS_PER_TOKEN);
      return originalText.substring(0, chars) + '...';
    }
  }

  /**
   * Aplica compressão progressiva aos ciclos
   * @param {Cycle[]} cycles - Todos os ciclos
   * @returns {Promise<Object>} - { fullCycles, summaries, totalTokens }
   */
  async applyProgressiveCompression(cycles) {
    if (!cycles || cycles.length === 0) {
      return { fullCycles: [], summaries: [], totalTokens: 0 };
    }
    
    // Separa ciclos integrais (últimos 4)
    const fullCycles = cycles.slice(-CONFIG.FULL_CYCLES);
    const cyclesToCompress = cycles.slice(0, -CONFIG.FULL_CYCLES);
    
    if (cyclesToCompress.length === 0) {
      return {
        fullCycles,
        summaries: [],
        totalTokens: this.estimateCyclesTokens(fullCycles)
      };
    }
    
    // Organiza em camadas de 3 ciclos cada
    const layers = [];
    for (let i = cyclesToCompress.length; i > 0; i -= CONFIG.CYCLES_PER_LAYER) {
      const start = Math.max(0, i - CONFIG.CYCLES_PER_LAYER);
      const layerCycles = cyclesToCompress.slice(start, i);
      if (layerCycles.length > 0) {
        layers.unshift(layerCycles); // Adiciona no início (mais antigos primeiro)
      }
    }
    
    // Aplica compressão progressiva a cada camada
    const summaries = [];
    let compressionLevel = 1;
    
    for (const layerCycles of layers) {
      // Calcula ratio acumulado: 25% -> 6.25% -> 1.56%...
      const accumulatedRatio = Math.pow(CONFIG.COMPRESSION_RATIO, compressionLevel);
      
      const summary = await this.summarizeCycles(layerCycles, accumulatedRatio);
      
      summaries.push({
        cycleRange: `${layerCycles[0].index + 1}-${layerCycles[layerCycles.length - 1].index + 1}`,
        compressionLevel: `${Math.round((1 - accumulatedRatio) * 100)}%`,
        originalCycles: layerCycles.length,
        summary
      });
      
      compressionLevel++;
    }
    
    // Calcula tokens totais
    let totalTokens = this.estimateCyclesTokens(fullCycles);
    for (const s of summaries) {
      totalTokens += this.estimateTokens(s.summary);
    }
    
    // Se ainda excede limite, funde resumos mais antigos
    while (totalTokens > CONFIG.MAX_TOKENS && summaries.length > 1) {
      console.log(`[ConversationalMemory] Tokens ${totalTokens} > ${CONFIG.MAX_TOKENS}, fundindo resumos...`);
      
      // Funde os dois resumos mais antigos
      const oldest1 = summaries.shift();
      const oldest2 = summaries.shift();
      
      const mergedText = `${oldest1.summary}\n${oldest2.summary}`;
      const mergedSummary = await this.summarizeCycles([{
        userMessage: mergedText,
        aiResponse: ''
      }], 0.5);
      
      summaries.unshift({
        cycleRange: `${oldest1.cycleRange.split('-')[0]}-${oldest2.cycleRange.split('-')[1]}`,
        compressionLevel: 'merged',
        originalCycles: oldest1.originalCycles + oldest2.originalCycles,
        summary: mergedSummary
      });
      
      // Recalcula tokens
      totalTokens = this.estimateCyclesTokens(fullCycles);
      for (const s of summaries) {
        totalTokens += this.estimateTokens(s.summary);
      }
    }
    
    return { fullCycles, summaries, totalTokens };
  }

  /**
   * Constrói contexto de memória para o prompt da IA
   * @param {string} chatId - ID do chat
   * @param {Array} messages - Mensagens do chat
   * @returns {Promise<Object>} - { context: string, stats: Object }
   */
  async buildContext(chatId, messages) {
    const cycles = this.messagesToCycles(messages);
    
    if (cycles.length === 0) {
      return {
        context: '',
        stats: {
          totalCycles: 0,
          fullCycles: 0,
          compressedCycles: 0,
          tokens: 0
        }
      };
    }
    
    // Aplica compressão progressiva
    const { fullCycles, summaries, totalTokens } = await this.applyProgressiveCompression(cycles);
    
    // Formata para prompt
    let context = '';
    
    // Adiciona resumos (memória de longo prazo)
    if (summaries.length > 0) {
      context += '### Histórico Resumido:\n';
      for (const s of summaries) {
        context += `[Ciclos ${s.cycleRange}, ${s.compressionLevel}] ${s.summary}\n`;
      }
      context += '\n';
    }
    
    // Adiciona ciclos integrais (memória recente)
    if (fullCycles.length > 0) {
      context += '### Conversa Recente:\n';
      for (const cycle of fullCycles) {
        context += `U: ${cycle.userMessage}\n`;
        context += `A: ${cycle.aiResponse}\n\n`;
      }
    }
    
    // Estatísticas
    const compressedCount = cycles.length - fullCycles.length;
    
    console.log(`[ConversationalMemory] Contexto construído:`, {
      chatId,
      totalCycles: cycles.length,
      fullCycles: fullCycles.length,
      compressedCycles: compressedCount,
      summaryLayers: summaries.length,
      estimatedTokens: totalTokens
    });
    
    return {
      context: context.trim(),
      stats: {
        totalCycles: cycles.length,
        fullCycles: fullCycles.length,
        compressedCycles: compressedCount,
        summaryLayers: summaries.length,
        tokens: totalTokens
      }
    };
  }

  /**
   * Formata histórico simples (sem compressão) para contexto básico
   * Usado quando há poucos ciclos ou para fallback
   * @param {Array} messages - Mensagens do chat
   * @param {number} maxMessages - Máximo de mensagens a incluir
   * @returns {string} - Contexto formatado
   */
  formatSimpleHistory(messages, maxMessages = 10) {
    if (!messages || messages.length === 0) return '';
    
    const recentMessages = messages.slice(-maxMessages);
    let context = '';
    
    for (const msg of recentMessages) {
      const prefix = msg.type === 'user' ? 'U:' : 'A:';
      context += `${prefix} ${msg.content}\n`;
    }
    
    return context.trim();
  }

  /**
   * Limpa cache de um chat específico
   * @param {string} chatId - ID do chat
   */
  clearCache(chatId) {
    this.cache.delete(chatId);
  }

  /**
   * Limpa todo o cache
   */
  clearAllCache() {
    this.cache.clear();
  }
}

// Instância singleton
const conversationalMemory = new ConversationalMemory();

module.exports = conversationalMemory;
