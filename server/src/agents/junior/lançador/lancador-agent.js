/**
 * Lancador Agent - Agente Executor de Lançamentos Financeiros
 * 
 * RESPONSABILIDADES:
 * - Extração de dados financeiros de linguagem natural
 * - Classificação de tipo de lançamento
 * - Persistência no banco de dados
 * - Confirmação e diálogo com usuário
 * 
 * NÃO RECEBE:
 * - Memória de contexto (opera de forma independente)
 * - Working Memory ou Episodic Memory
 * 
 * RECEBE:
 * - userId, sessionId, message
 * - diálogo_ativo (flag para continuidade de diálogo)
 * 
 * MODELO: GPT-5 Mini (reasoning: low, verbosity: low)
 */

const BaseAgent = require('../../shared/base-agent');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Schemas do banco de dados
const Transaction = require('../../../database/schemas/transactions-schema');
const CreditCard = require('../../../database/schemas/credit-card-schema');
const Debt = require('../../../database/schemas/debt-schema');

// ===== CONSTANTES DE TIPOS DE LANÇAMENTO =====
const LANCAMENTO_TYPES = Object.freeze({
  RECEITA_SIMPLES: 'receita_simples',
  DESPESA_SIMPLES: 'despesa_simples',
  GASTO_CARTAO: 'gasto_cartao',
  PAGAMENTO_FATURA: 'pagamento_fatura',
  CONTA_RECEBER: 'conta_receber',
  CONTA_PAGAR: 'conta_pagar',
  PAGAMENTO_DIVIDA: 'pagamento_divida',
  NOVA_DIVIDA: 'nova_divida'
});

// ===== CATEGORIAS PADRÃO SUPORTADAS =====
const CATEGORIAS = Object.freeze({
  ALIMENTACAO: 'Alimentação',
  TRANSPORTE: 'Transporte',
  MORADIA: 'Moradia',
  SAUDE: 'Saúde',
  EDUCACAO: 'Educação',
  LAZER: 'Lazer',
  VESTUARIO: 'Vestuário',
  CONTAS: 'Contas',
  SALARIO: 'Salário',
  INVESTIMENTOS: 'Investimentos',
  OUTROS: 'Outros'
});

// ===== MAPEAMENTO DE SEÇÕES PARA CARDS =====
const SECTION_CARD_MAP = Object.freeze({
  statement: ['Extrato', 'Últimas Transações', 'Cards do Topo'],
  scheduled: ['Contas Futuras'],
  credit_card: ['Cartão de Crédito'],
  debt: ['Dívidas']
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

class LancadorAgent extends BaseAgent {
  constructor() {
    super('LancadorAgent');
    
    this.model = 'gpt-5-mini';
    this.max_completion_tokens = 800;
    
    // Cache para arquivos JSON
    this._categoriasCache = null;
    
    // Mapa de diálogos ativos (para informações incompletas)
    this._activeDialogs = new Map();
  }

  // =====================================================
  // MÉTODO PRINCIPAL - PONTO DE ENTRADA
  // =====================================================

  /**
   * Método principal de execução do Agente Lançador
   * @param {Object} request - Requisição com userId, sessionId, message
   * @returns {Promise<Object>} - Resposta processada
   */
  async execute(request) {
    const { parameters } = request;
    const { message, userId, sessionId, chatId } = parameters;
    const startTime = Date.now();

    // LOG ESTRATÉGICO: Entrada no Lançador
    console.log('[LancadorAgent] 📥 Lançamento recebido:', {
      userId: userId?.substring(0, 8) + '...',
      messagePreview: message?.substring(0, 50) + (message?.length > 50 ? '...' : '')
    });

    try {
      // 1. Validação básica
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Mensagem de lançamento inválida ou vazia');
      }

      if (!userId) {
        throw new Error('userId é obrigatório para lançamentos');
      }

      // 2. Verificar se há diálogo ativo (continuação de extração)
      const dialogoState = this._activeDialogs.get(sessionId);
      if (dialogoState) {
        console.log('[LancadorAgent] 🔄 Continuando diálogo ativo');
        return await this._continuarDialogo(dialogoState, message, parameters);
      }

      // 3. Extrair dados do lançamento usando GPT-5 Mini
      const extracao = await this._extrairDadosLancamento(message);

      // 4. Verificar se dados estão completos
      if (extracao.incompleto) {
        console.log('[LancadorAgent] ❓ Dados incompletos → Iniciando diálogo');
        return await this._iniciarDialogo(extracao, parameters);
      }

      // 5. Classificar tipo de lançamento
      const classificacao = this._classificarLancamento(extracao);

      // LOG ESTRATÉGICO: Classificação concluída
      console.log('[LancadorAgent] 🎯 Classificação:', {
        tipo: classificacao.tipo_lancamento,
        valor: `R$ ${extracao.valor?.toFixed(2)}`,
        categoria: extracao.categoria,
        sections: classificacao.sections.map(s => s.section).join(', ')
      });

      // 6. Persistir no banco de dados
      const resultado = await this._persistirLancamento(extracao, classificacao, userId);

      // 7. Montar resposta de confirmação
      const elapsedTime = Date.now() - startTime;
      
      // LOG ESTRATÉGICO: Lançamento concluído
      console.log('[LancadorAgent] ✅ Lançamento persistido:', {
        transacoes: resultado.transacoes?.length || 0,
        latencia: `${elapsedTime}ms`
      });

      return this._montarConfirmacao(resultado, extracao, classificacao, sessionId);

    } catch (error) {
      const elapsedTime = Date.now() - startTime;
      console.error('[LancadorAgent] ❌ Erro:', error.message, `(${elapsedTime}ms)`);
      
      return {
        response: `Desculpe, houve um erro ao processar seu lançamento: ${error.message}`,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        error: error.message,
        metadata: {
          agente: 'lancador',
          status: 'error'
        }
      };
    }
  }

  // =====================================================
  // EXTRAÇÃO DE DADOS - OBJETIVO 2
  // =====================================================

  /**
   * Constrói prompt de extração de dados financeiros
   * @returns {string} - System prompt
   */
  _buildExtractionPrompt() {
    // Data atual para contexto temporal
    const hoje = new Date();
    const dataAtualFormatada = hoje.toISOString().split('T')[0];
    const diaSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][hoje.getDay()];
    
    return `### TAREFA: EXTRAÇÃO DE DADOS DE LANÇAMENTO FINANCEIRO

Você é um extrator de dados financeiros. Analise a mensagem do usuário e extraia TODAS as informações financeiras relevantes.

## CONTEXTO TEMPORAL IMPORTANTE:
- **Data atual**: ${dataAtualFormatada} (${diaSemana})
- Use esta data como referência para calcular datas relativas

## CAMPOS A EXTRAIR:

1. **valor** (obrigatório): Valor monetário em número (apenas o número, sem R$)
2. **tipo** (obrigatório): "receita" ou "despesa"
3. **categoria**: Categoria principal (Alimentação, Transporte, Salário, Moradia, Saúde, Educação, Lazer, Vestuário, Contas, Investimentos, Outros)
4. **subcategoria**: Subcategoria específica se identificável (ex: Supermercado, Restaurante, Uber, etc.)
5. **descricao**: Descrição curta do lançamento (máx 5 palavras)
6. **data**: Data EXATA no formato YYYY-MM-DD (calcule a partir da data atual se for relativa)
7. **forma_pagamento**: À vista, PIX, Cartão Crédito, Cartão Débito, Parcelado
8. **parcelas**: Número de parcelas se parcelado (null se não parcelado)
9. **cartao_credito**: true/false - se foi no cartão de crédito
10. **conta_futura**: true/false - se é um agendamento futuro (data posterior a hoje)
11. **divida_relacionada**: Se é pagamento de dívida existente (true/false)
12. **nova_divida**: true/false - se é contratação de uma nova dívida/financiamento/empréstimo

## REGRAS DE CÁLCULO DE DATA (MUITO IMPORTANTE):

- "hoje" → ${dataAtualFormatada}
- "ontem" → calcule: data atual - 1 dia
- "semana passada" → calcule: data atual - 7 dias
- "daqui a X dias" ou "em X dias" → calcule: data atual + X dias
- "semana que vem" ou "próxima semana" → calcule: data atual + 7 dias
- "mês que vem" ou "próximo mês" → calcule: primeiro dia do próximo mês
- "dia DD" ou "DD/MM" → use o ano atual: YYYY-MM-DD
- "dia DD/MM/YYYY" → use a data exata fornecida
- Se não menciona data → use ${dataAtualFormatada}

**REGRA CRÍTICA**: Retorne SEMPRE a data calculada no formato YYYY-MM-DD, NUNCA retorne strings como "daqui a 15 dias".

## REGRA DE conta_futura:
- Se a data calculada é POSTERIOR a ${dataAtualFormatada} → conta_futura = true
- Se a data calculada é IGUAL ou ANTERIOR a ${dataAtualFormatada} → conta_futura = false

## REGRAS DE INFERÊNCIA:

- Se menciona "comprei", "gastei", "paguei" → tipo = "despesa"
- Se menciona "recebi", "ganhei", "entrou", "vou receber" → tipo = "receita"
- Se menciona "vou receber" → tipo = "receita" E conta_futura = true
- Se menciona "cartão" ou "crédito" (sem débito) → cartao_credito = true
- Se menciona "parcelei", "em Xx", "X vezes" → forma_pagamento = "Parcelado"
- Se menciona "financiamento", "financiei", "empréstimo", "emprestei" → nova_divida = true
- Se menciona "supermercado", "mercado" → categoria = "Alimentação", subcategoria = "Supermercado"
- Se menciona "restaurante", "lanche", "comida" → categoria = "Alimentação", subcategoria = "Restaurante"
- Se menciona "uber", "99", "táxi", "gasolina" → categoria = "Transporte"
- Se menciona "salário", "pagamento" (recebido) → categoria = "Salário", tipo = "receita"
- Se menciona "conta de luz/água/internet/telefone" → categoria = "Contas"
- Se menciona "aluguel" → categoria = "Moradia"
- Se não menciona forma de pagamento → forma_pagamento = "À vista"

## FORMATO DE RESPOSTA:

Retorne APENAS um JSON válido, sem markdown e sem explicações:
{
  "valor": 150.00,
  "tipo": "despesa",
  "categoria": "Alimentação",
  "subcategoria": "Supermercado",
  "descricao": "Compra supermercado",
  "data": "${dataAtualFormatada}",
  "forma_pagamento": "À vista",
  "parcelas": null,
  "cartao_credito": false,
  "conta_futura": false,
  "divida_relacionada": false,
  "nova_divida": false,
  "incompleto": false,
  "campos_faltantes": [],
  "pergunta_sugerida": null
}

## QUANDO MARCAR COMO INCOMPLETO:

Se NÃO conseguir identificar o VALOR, marque:
- "incompleto": true
- "campos_faltantes": ["valor"]
- "pergunta_sugerida": "Qual foi o valor exato dessa transação?"

Se o TIPO está ambíguo (não sabe se é receita ou despesa):
- "incompleto": true  
- "campos_faltantes": ["tipo"]
- "pergunta_sugerida": "Isso foi uma despesa ou uma receita?"

IMPORTANTE: Sempre tente extrair o máximo de informações possível antes de marcar como incompleto.`;
  }

  /**
   * Extrai dados do lançamento usando GPT-5 Mini
   * @param {string} message - Mensagem do usuário
   * @returns {Promise<Object>} - Dados extraídos
   */
  async _extrairDadosLancamento(message) {
    const startTime = Date.now();

    try {
      const systemPrompt = this._buildExtractionPrompt();
      
      const response = await Promise.race([
        getOpenAI().chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_completion_tokens: this.max_completion_tokens,
          verbosity: 'low',
          reasoning_effort: 'low'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na extração')), 30000)
        )
      ]);

      const elapsedTime = Date.now() - startTime;
      const responseText = response.choices[0]?.message?.content?.trim();

      if (!responseText) {
        throw new Error('Resposta vazia da API na extração');
      }

      // LOG ESTRATÉGICO: Tokens consumidos na extração
      if (response?.usage) {
        console.log('[LancadorAgent] 💰 Extração:', {
          tokens: response.usage.total_tokens,
          latencia: `${elapsedTime}ms`
        });
      }

      // Parsear JSON da resposta
      try {
        const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const extracao = JSON.parse(cleanJson);

        // Processar data
        extracao.data = this._parseData(extracao.data);

        // Processar valor
        if (extracao.valor) {
          extracao.valor = this._parseValor(extracao.valor);
        }

        // Fallback para categoria por palavras-chave se não detectou
        if (!extracao.categoria || extracao.categoria === 'Outros') {
          const detected = this._detectarCategoriaPorPalavrasChave(message);
          if (detected.categoria !== 'Outros') {
            extracao.categoria = detected.categoria;
            extracao.subcategoria = extracao.subcategoria || detected.subcategoria;
          }
        }

        // LOG ESTRATÉGICO: Dados extraídos
        console.log('[LancadorAgent] 📊 Extração:', {
          valor: extracao.valor,
          tipo: extracao.tipo,
          categoria: extracao.categoria,
          cartao: extracao.cartao_credito,
          incompleto: extracao.incompleto
        });

        return extracao;

      } catch (parseError) {
        console.warn('[LancadorAgent] ⚠️ Parse falhou, usando fallback regex');
        
        // Tentar extração básica por regex como fallback
        return this._extracaoFallback(message);
      }

    } catch (error) {
      console.error('[LancadorAgent] ❌ Erro na extração:', error.message);
      throw error;
    }
  }

  /**
   * Extração de fallback usando regex quando GPT falha
   * @param {string} message - Mensagem do usuário
   * @returns {Object} - Extração básica
   */
  _extracaoFallback(message) {
    console.log('[LancadorAgent] 🔄 Fallback: extração por regex');

    const extracao = {
      valor: null,
      tipo: null,
      categoria: 'Outros',
      subcategoria: null,
      descricao: message.substring(0, 50),
      data: new Date().toISOString().split('T')[0],
      forma_pagamento: 'À vista',
      parcelas: null,
      cartao_credito: false,
      conta_futura: false,
      divida_relacionada: false,
      incompleto: true,
      campos_faltantes: [],
      pergunta_sugerida: null
    };

    // Extrair valor por regex
    const valorMatch = message.match(/R?\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/i);
    if (valorMatch) {
      extracao.valor = this._parseValor(valorMatch[1]);
      extracao.incompleto = false;
    } else {
      extracao.campos_faltantes.push('valor');
      extracao.pergunta_sugerida = 'Qual foi o valor exato dessa transação?';
    }

    // Inferir tipo
    const msgLower = message.toLowerCase();
    if (msgLower.includes('recebi') || msgLower.includes('ganhei') || msgLower.includes('entrou')) {
      extracao.tipo = 'receita';
    } else if (msgLower.includes('gastei') || msgLower.includes('paguei') || msgLower.includes('comprei')) {
      extracao.tipo = 'despesa';
    } else {
      extracao.campos_faltantes.push('tipo');
      extracao.incompleto = true;
      extracao.pergunta_sugerida = 'Isso foi uma despesa ou uma receita?';
    }

    // Detectar categoria
    const detected = this._detectarCategoriaPorPalavrasChave(message);
    extracao.categoria = detected.categoria;
    extracao.subcategoria = detected.subcategoria;

    // Detectar cartão
    if (msgLower.includes('cartão') || msgLower.includes('cartao') || msgLower.includes('crédito')) {
      if (!msgLower.includes('débito')) {
        extracao.cartao_credito = true;
      }
    }

    // Detectar parcelamento
    const parcelasMatch = msgLower.match(/(\d+)\s*(?:x|vezes|parcelas?)/);
    if (parcelasMatch) {
      extracao.parcelas = parseInt(parcelasMatch[1]);
      extracao.forma_pagamento = 'Parcelado';
      extracao.cartao_credito = true;
    }

    return extracao;
  }

  // =====================================================
  // CLASSIFICAÇÃO DE LANÇAMENTO - OBJETIVO 2
  // =====================================================

  /**
   * Classifica o lançamento para determinar onde persistir
   * @param {Object} extracao - Dados extraídos
   * @returns {Object} - Classificação com sections e ações
   */
  _classificarLancamento(extracao) {
    const classificacao = {
      tipo_lancamento: null,
      sections: [],
      acoes_adicionais: []
    };

    // 0. Nova dívida (financiamento, empréstimo, etc.)
    if (extracao.nova_divida) {
      classificacao.tipo_lancamento = LANCAMENTO_TYPES.NOVA_DIVIDA;
      
      // Registra no card de dívidas
      classificacao.sections.push({
        section: 'debt',
        type: 'expense',
        populaCards: SECTION_CARD_MAP.debt
      });

      // Ação para criar dívida
      classificacao.acoes_adicionais.push({
        tipo: 'criar_divida',
        valor: extracao.valor,
        parcelas: extracao.parcelas || 1,
        descricao: extracao.descricao
      });

      return classificacao;
    }

    // 1. Receita simples (não futura)
    if (extracao.tipo === 'receita' && !extracao.conta_futura) {
      classificacao.tipo_lancamento = LANCAMENTO_TYPES.RECEITA_SIMPLES;
      classificacao.sections.push({
        section: 'statement',
        type: 'income',
        populaCards: SECTION_CARD_MAP.statement
      });
    }

    // 2. Despesa simples (sem cartão de crédito, não futura)
    else if (extracao.tipo === 'despesa' && !extracao.cartao_credito && !extracao.conta_futura && !extracao.divida_relacionada) {
      classificacao.tipo_lancamento = LANCAMENTO_TYPES.DESPESA_SIMPLES;
      classificacao.sections.push({
        section: 'statement',
        type: 'expense',
        populaCards: SECTION_CARD_MAP.statement
      });
    }

    // 3. Gasto no cartão de crédito
    // REGRA: NÃO vai para extrato imediato, apenas para cartão de crédito e contas futuras
    else if (extracao.tipo === 'despesa' && extracao.cartao_credito) {
      classificacao.tipo_lancamento = LANCAMENTO_TYPES.GASTO_CARTAO;
      
      // Registra APENAS no cartão de crédito (não vai para extrato)
      classificacao.sections.push({
        section: 'credit_card',
        type: 'expense',
        populaCards: SECTION_CARD_MAP.credit_card
      });

      // Se parcelado, criar parcelas futuras e registrar como dívida
      if (extracao.parcelas && extracao.parcelas > 1) {
        const valorParcela = extracao.valor / extracao.parcelas;
        
        // Criar parcelas no cartão de crédito
        classificacao.acoes_adicionais.push({
          tipo: 'criar_parcelas_cartao',
          parcelas: extracao.parcelas,
          valorParcela: valorParcela
        });

        // Criar dívida para parcelamento no cartão
        classificacao.acoes_adicionais.push({
          tipo: 'criar_divida_cartao',
          valor: extracao.valor,
          parcelas: extracao.parcelas,
          valorParcela: valorParcela,
          descricao: extracao.descricao
        });
      }
    }

    // 4. Conta a receber (futura)
    else if (extracao.tipo === 'receita' && extracao.conta_futura) {
      classificacao.tipo_lancamento = LANCAMENTO_TYPES.CONTA_RECEBER;
      classificacao.sections.push({
        section: 'scheduled',
        scheduledType: 'receivable',
        type: 'income',
        populaCards: SECTION_CARD_MAP.scheduled
      });
    }

    // 5. Conta a pagar (futura)
    else if (extracao.tipo === 'despesa' && extracao.conta_futura) {
      classificacao.tipo_lancamento = LANCAMENTO_TYPES.CONTA_PAGAR;
      classificacao.sections.push({
        section: 'scheduled',
        scheduledType: 'payable',
        type: 'expense',
        populaCards: SECTION_CARD_MAP.scheduled
      });
    }

    // 6. Pagamento de dívida
    else if (extracao.divida_relacionada) {
      classificacao.tipo_lancamento = LANCAMENTO_TYPES.PAGAMENTO_DIVIDA;
      
      // Registra no extrato
      classificacao.sections.push({
        section: 'statement',
        type: 'expense',
        populaCards: SECTION_CARD_MAP.statement
      });

      // Ação para atualizar dívida
      classificacao.acoes_adicionais.push({
        tipo: 'atualizar_divida',
        valorPago: extracao.valor
      });
    }

    // Fallback: despesa simples
    else {
      classificacao.tipo_lancamento = LANCAMENTO_TYPES.DESPESA_SIMPLES;
      classificacao.sections.push({
        section: 'statement',
        type: extracao.tipo === 'receita' ? 'income' : 'expense',
        populaCards: SECTION_CARD_MAP.statement
      });
    }

    return classificacao;
  }

  // =====================================================
  // HELPERS DE DETECÇÃO E PARSING
  // =====================================================

  /**
   * Detecta categoria usando palavras-chave (fallback)
   * @param {string} message - Mensagem do usuário
   * @returns {Object} - { categoria, subcategoria }
   */
  _detectarCategoriaPorPalavrasChave(message) {
    const categorias = this._loadCategoriasJSON();
    const messageLower = message.toLowerCase();

    for (const cat of categorias.categorias) {
      for (const palavra of cat.palavras_chave) {
        if (messageLower.includes(palavra.toLowerCase())) {
          // Buscar subcategoria
          let subcategoria = null;
          if (cat.subcategorias) {
            for (const sub of cat.subcategorias) {
              for (const subPalavra of sub.palavras_chave || []) {
                if (messageLower.includes(subPalavra.toLowerCase())) {
                  subcategoria = sub.nome;
                  break;
                }
              }
              if (subcategoria) break;
            }
          }
          return { categoria: cat.nome, subcategoria };
        }
      }
    }

    return { categoria: 'Outros', subcategoria: null };
  }

  /**
   * Carrega arquivo de categorias com cache
   * @returns {Object} - Categorias e formas de pagamento
   */
  _loadCategoriasJSON() {
    if (this._categoriasCache) {
      return this._categoriasCache;
    }

    try {
      const filePath = path.join(__dirname, '../../jsons/categorias-lancamento.json');

      if (fs.existsSync(filePath)) {
        this._categoriasCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } else {
        console.warn('[LancadorAgent] ⚠️ Arquivo de categorias não encontrado, usando padrão');
        this._categoriasCache = this._getCategoriasDefault();
      }

      return this._categoriasCache;

    } catch (error) {
      console.error('[LancadorAgent] ❌ Erro ao carregar categorias:', error.message);
      return this._getCategoriasDefault();
    }
  }

  /**
   * Retorna categorias padrão quando arquivo não existe
   * @returns {Object} - Estrutura padrão de categorias
   */
  _getCategoriasDefault() {
    return {
      categorias: [
        { id: 'alimentacao', nome: 'Alimentação', palavras_chave: ['supermercado', 'mercado', 'restaurante', 'lanche', 'comida', 'padaria', 'açougue'] },
        { id: 'transporte', nome: 'Transporte', palavras_chave: ['uber', '99', 'táxi', 'gasolina', 'combustível', 'ônibus', 'metrô', 'passagem'] },
        { id: 'moradia', nome: 'Moradia', palavras_chave: ['aluguel', 'condomínio', 'iptu', 'reforma', 'móveis'] },
        { id: 'saude', nome: 'Saúde', palavras_chave: ['médico', 'farmácia', 'remédio', 'hospital', 'consulta', 'exame', 'plano de saúde'] },
        { id: 'educacao', nome: 'Educação', palavras_chave: ['faculdade', 'curso', 'escola', 'livro', 'material escolar'] },
        { id: 'lazer', nome: 'Lazer', palavras_chave: ['cinema', 'netflix', 'spotify', 'show', 'viagem', 'bar', 'festa'] },
        { id: 'vestuario', nome: 'Vestuário', palavras_chave: ['roupa', 'calçado', 'tênis', 'sapato', 'loja'] },
        { id: 'contas', nome: 'Contas', palavras_chave: ['luz', 'água', 'internet', 'telefone', 'celular', 'energia', 'gás'] },
        { id: 'salario', nome: 'Salário', palavras_chave: ['salário', 'pagamento', 'holerite', 'ordenado'] },
        { id: 'investimentos', nome: 'Investimentos', palavras_chave: ['investimento', 'ação', 'fundo', 'tesouro', 'cdb', 'poupança'] }
      ],
      formas_pagamento: [
        { id: 'avista', nome: 'À Vista', palavras_chave: ['à vista', 'a vista', 'pix', 'dinheiro', 'débito', 'transferência'] },
        { id: 'credito', nome: 'Cartão Crédito', palavras_chave: ['cartão', 'crédito', 'cartao'] },
        { id: 'parcelado', nome: 'Parcelado', palavras_chave: ['parcelado', 'vezes', 'parcelas'] }
      ]
    };
  }

  /**
   * Converte string de valor para número
   * @param {string|number} valorStr - Valor como string (ex: "R$ 150,00")
   * @returns {number} - Valor numérico
   */
  _parseValor(valorStr) {
    if (typeof valorStr === 'number') return valorStr;
    if (!valorStr) return 0;
    
    const cleaned = String(valorStr)
      .replace(/[R$\s]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    
    return parseFloat(cleaned) || 0;
  }

  /**
   * Converte string de data para formato ISO
   * Suporta expressões temporais relativas como "daqui a X dias", "semana que vem", etc.
   * @param {string} dataStr - Data em texto
   * @returns {string} - Data em formato ISO (YYYY-MM-DD)
   */
  _parseData(dataStr) {
    if (!dataStr) return this._getDataHoje();

    // Usar data local, não UTC, para evitar problemas de timezone
    const hoje = new Date();
    const dataLower = String(dataStr).toLowerCase().trim();

    // Já está no formato ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      return dataStr;
    }

    // Hoje
    if (dataLower === 'hoje' || dataLower === 'now' || dataLower === 'today') {
      return this._getDataHoje();
    }

    // Ontem
    if (dataLower === 'ontem' || dataLower === 'yesterday') {
      const ontem = new Date(hoje);
      ontem.setDate(ontem.getDate() - 1);
      return this._formatarDataLocal(ontem);
    }

    // Amanhã
    if (dataLower === 'amanhã' || dataLower === 'amanha' || dataLower === 'tomorrow') {
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      return this._formatarDataLocal(amanha);
    }

    // "daqui a X dias" ou "em X dias"
    const diasMatch = dataLower.match(/(?:daqui\s+a|em|dentro\s+de)\s+(\d+)\s*dias?/i);
    if (diasMatch) {
      const dias = parseInt(diasMatch[1]);
      const novaData = new Date(hoje);
      novaData.setDate(novaData.getDate() + dias);
      const resultado = this._formatarDataLocal(novaData);
      console.log(`[LancadorAgent] 📅 Calculado: +${dias} dias = ${resultado}`);
      return resultado;
    }

    // "há X dias" ou "X dias atrás"
    const diasAtrasMatch = dataLower.match(/(?:há|ha)\s+(\d+)\s*dias?|(\d+)\s*dias?\s*(?:atrás|atras)/i);
    if (diasAtrasMatch) {
      const dias = parseInt(diasAtrasMatch[1] || diasAtrasMatch[2]);
      const novaData = new Date(hoje);
      novaData.setDate(novaData.getDate() - dias);
      const resultado = this._formatarDataLocal(novaData);
      console.log(`[LancadorAgent] 📅 Calculado: -${dias} dias = ${resultado}`);
      return resultado;
    }

    // "semana passada"
    if (dataLower.includes('semana passada')) {
      const semanaPassada = new Date(hoje);
      semanaPassada.setDate(semanaPassada.getDate() - 7);
      return this._formatarDataLocal(semanaPassada);
    }

    // "semana que vem" ou "próxima semana"
    if (dataLower.includes('semana que vem') || dataLower.includes('próxima semana') || dataLower.includes('proxima semana')) {
      const proxSemana = new Date(hoje);
      proxSemana.setDate(proxSemana.getDate() + 7);
      return this._formatarDataLocal(proxSemana);
    }

    // "mês passado"
    if (dataLower.includes('mês passado') || dataLower.includes('mes passado')) {
      const mesPassado = new Date(hoje);
      mesPassado.setMonth(mesPassado.getMonth() - 1);
      return this._formatarDataLocal(mesPassado);
    }

    // "mês que vem" ou "próximo mês"
    if (dataLower.includes('mês que vem') || dataLower.includes('mes que vem') || 
        dataLower.includes('próximo mês') || dataLower.includes('proximo mes')) {
      const proxMes = new Date(hoje);
      proxMes.setMonth(proxMes.getMonth() + 1);
      proxMes.setDate(1); // Primeiro dia do próximo mês
      return this._formatarDataLocal(proxMes);
    }

    // Tentar parsear data brasileira (DD/MM/YYYY ou DD/MM)
    const brMatch = dataStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (brMatch) {
      const dia = brMatch[1].padStart(2, '0');
      const mes = brMatch[2].padStart(2, '0');
      let ano = brMatch[3] || hoje.getFullYear();
      if (String(ano).length === 2) {
        ano = '20' + ano;
      }
      return `${ano}-${mes}-${dia}`;
    }

    // Tentar parsear "dia DD"
    const diaMatch = dataStr.match(/dia\s+(\d{1,2})/i);
    if (diaMatch) {
      const dia = diaMatch[1].padStart(2, '0');
      const mes = String(hoje.getMonth() + 1).padStart(2, '0');
      const ano = hoje.getFullYear();
      return `${ano}-${mes}-${dia}`;
    }

    // Fallback: retorna hoje
    console.log(`[LancadorAgent] 📅 Data não reconhecida: "${dataStr}", usando hoje`);
    return this._getDataHoje();
  }

  /**
   * Retorna a data de hoje no formato YYYY-MM-DD (local, não UTC)
   * @returns {string}
   */
  _getDataHoje() {
    const hoje = new Date();
    return this._formatarDataLocal(hoje);
  }

  /**
   * Formata uma data para YYYY-MM-DD usando timezone local (não UTC)
   * @param {Date} data - Data a formatar
   * @returns {string}
   */
  _formatarDataLocal(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  // =====================================================
  // DIÁLOGO PARA INFORMAÇÕES INCOMPLETAS
  // =====================================================

  /**
   * Inicia diálogo para obter informações faltantes
   * @param {Object} extracao - Extração incompleta
   * @param {Object} params - Parâmetros originais
   * @returns {Object} - Resposta com pergunta
   */
  async _iniciarDialogo(extracao, params) {
    const { sessionId } = params;

    // Salvar estado do diálogo
    const dialogoState = {
      extracaoParcial: extracao,
      camposFaltantes: extracao.campos_faltantes || [],
      perguntasFeitas: 0,
      maxPerguntas: 3,
      iniciadoEm: new Date()
    };

    this._activeDialogs.set(sessionId, dialogoState);

    console.log(`[LancadorAgent] 💬 Diálogo iniciado para sessionId: ${sessionId}`);

    return {
      response: `❓ ${extracao.pergunta_sugerida || 'Pode me dar mais detalhes sobre esse lançamento?'}`,
      sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        agente: 'lancador',
        status: 'aguardando_dados',
        fluxo: 'dialogo',
        camposFaltantes: dialogoState.camposFaltantes
      }
    };
  }

  /**
   * Continua diálogo existente com nova informação
   * @param {Object} dialogoState - Estado salvo do diálogo
   * @param {string} message - Nova mensagem do usuário
   * @param {Object} params - Parâmetros originais
   * @returns {Promise<Object>} - Resposta processada
   */
  async _continuarDialogo(dialogoState, message, params) {
    const { sessionId, userId } = params;

    console.log(`[LancadorAgent] 🔄 Continuando diálogo (pergunta ${dialogoState.perguntasFeitas + 1})`);

    // Verificar se usuário quer cancelar
    const msgLower = message.toLowerCase();
    const cancelar = ['esquece', 'cancela', 'deixa', 'não importa', 'para', 'desiste'].some(
      termo => msgLower.includes(termo)
    );

    if (cancelar) {
      this._activeDialogs.delete(sessionId);
      return {
        response: '✅ Ok, lançamento cancelado. Se precisar registrar algo, é só me dizer!',
        sessionId,
        timestamp: new Date().toISOString(),
        metadata: { agente: 'lancador', status: 'cancelado' }
      };
    }

    // Incrementar contador de perguntas
    dialogoState.perguntasFeitas++;

    // Tentar extrair informação faltante da nova mensagem
    const novaExtracao = await this._extrairDadosLancamento(message);

    // Mesclar com extração parcial anterior
    const extracaoMesclada = { ...dialogoState.extracaoParcial };
    
    for (const campo of dialogoState.camposFaltantes) {
      if (novaExtracao[campo] !== null && novaExtracao[campo] !== undefined) {
        extracaoMesclada[campo] = novaExtracao[campo];
      }
    }

    // Verificar se ainda há campos faltantes
    const camposAindaFaltantes = [];
    if (!extracaoMesclada.valor) camposAindaFaltantes.push('valor');
    if (!extracaoMesclada.tipo) camposAindaFaltantes.push('tipo');

    // Se ainda há campos faltantes e não excedeu limite de perguntas
    if (camposAindaFaltantes.length > 0 && dialogoState.perguntasFeitas < dialogoState.maxPerguntas) {
      dialogoState.extracaoParcial = extracaoMesclada;
      dialogoState.camposFaltantes = camposAindaFaltantes;
      
      const proxPergunta = camposAindaFaltantes[0] === 'valor' 
        ? 'Qual foi o valor exato?' 
        : 'Isso foi uma despesa ou uma receita?';

      return {
        response: `❓ ${proxPergunta}`,
        sessionId,
        timestamp: new Date().toISOString(),
        metadata: {
          agente: 'lancador',
          status: 'aguardando_dados',
          camposFaltantes: camposAindaFaltantes,
          perguntasRestantes: dialogoState.maxPerguntas - dialogoState.perguntasFeitas
        }
      };
    }

    // Limpar diálogo ativo
    this._activeDialogs.delete(sessionId);

    // Se excedeu limite de perguntas
    if (camposAindaFaltantes.length > 0) {
      return {
        response: '⚠️ Não consegui entender todos os detalhes do lançamento. Por favor, tente novamente com mais informações, como: "Gastei R$ 150 no supermercado"',
        sessionId,
        timestamp: new Date().toISOString(),
        metadata: { agente: 'lancador', status: 'timeout_dialogo' }
      };
    }

    // Dados completos, classificar e confirmar
    extracaoMesclada.incompleto = false;
    const classificacao = this._classificarLancamento(extracaoMesclada);

    console.log('[LancadorAgent] ✅ Diálogo concluído → Persistindo');

    // Persistir no banco
    const resultado = await this._persistirLancamento(extracaoMesclada, classificacao, userId);

    return this._montarConfirmacao(resultado, extracaoMesclada, classificacao, sessionId);
  }

  // =====================================================
  // PERSISTÊNCIA NO BANCO DE DADOS - OBJETIVO 3
  // =====================================================

  /**
   * Persiste lançamento no banco de dados
   * @param {Object} extracao - Dados extraídos
   * @param {Object} classificacao - Classificação do lançamento
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object>} - Resultado da persistência
   */
  async _persistirLancamento(extracao, classificacao, userId) {
    const resultados = [];

    try {
      console.log('[LancadorAgent] 📝 Iniciando persistência:', {
        userId: userId?.substring(0, 8) + '...',
        sections: classificacao.sections.map(s => s.section),
        valor: extracao.valor,
        data: extracao.data,
        tipo: extracao.tipo
      });

      // Persistir em cada section mapeada
      for (const sectionConfig of classificacao.sections) {
        // IMPORTANTE: Usar T12:00:00 para evitar problemas de timezone
        const dataTransacao = new Date(extracao.data + 'T12:00:00');
        
        const transactionData = {
          userId,
          section: sectionConfig.section,
          type: sectionConfig.type,
          amount: extracao.valor,
          date: dataTransacao,
          description: extracao.descricao || this._gerarDescricaoAutomatica(extracao),
          category: extracao.categoria,
          status: 'confirmed',
          merchant: extracao.subcategoria || null,
          tags: [extracao.forma_pagamento],
          metadata: {
            fonte: 'lancador_agent',
            subcategoria: extracao.subcategoria,
            cartao_credito: extracao.cartao_credito,
            parcelas: extracao.parcelas
          }
        };

        // Adicionar campos específicos para scheduled
        if (sectionConfig.section === 'scheduled') {
          transactionData.scheduled = {
            scheduledType: sectionConfig.scheduledType,
            dueDate: new Date(extracao.data),
            frequency: 'once'
          };
        }

        // Adicionar campos específicos para credit_card
        if (sectionConfig.section === 'credit_card') {
          const cartao = await this._buscarCartaoPrincipal(userId);
          if (cartao) {
            transactionData.creditCard = {
              cardId: cartao._id.toString()
            };
            console.log('[LancadorAgent] 💳 Cartão encontrado:', cartao._id.toString());
          } else {
            console.warn('[LancadorAgent] ⚠️ Nenhum cartão de crédito ativo encontrado para o usuário');
          }
        }

        console.log('[LancadorAgent] 💾 Salvando transação:', {
          section: transactionData.section,
          type: transactionData.type,
          amount: transactionData.amount,
          date: transactionData.date.toISOString(),
          description: transactionData.description
        });

        const transaction = await Transaction.create(transactionData);
        
        console.log('[LancadorAgent] ✅ Transação criada:', {
          id: transaction._id.toString(),
          section: sectionConfig.section
        });

        resultados.push({
          id: transaction._id.toString(),
          section: sectionConfig.section,
          type: sectionConfig.type,
          amount: extracao.valor,
          populaCards: sectionConfig.populaCards
        });
      }

      // Executar ações adicionais (parcelas, dívidas)
      for (const acao of classificacao.acoes_adicionais) {
        console.log('[LancadorAgent] ⚙️ Executando ação adicional:', acao.tipo);
        await this._executarAcaoAdicional(acao, extracao, userId);
      }

      console.log('[LancadorAgent] 🎉 Persistência concluída:', {
        transacoes: resultados.length,
        acoesAdicionais: classificacao.acoes_adicionais.length
      });

      return {
        sucesso: true,
        transacoes: resultados,
        acoesAdicionais: classificacao.acoes_adicionais.length
      };

    } catch (error) {
      console.error('[LancadorAgent] ❌ Erro ao persistir:', error.message);
      throw error;
    }
  }

  /**
   * Busca cartão de crédito principal do usuário
   * Se não existir nenhum cartão, cria um cartão default
   * @param {string} userId - ID do usuário
   * @returns {Promise<Object|null>} - Cartão ou null
   */
  async _buscarCartaoPrincipal(userId) {
    try {
      let cartao = await CreditCard.findOne({ userId, status: 'active' }).lean();
      
      if (!cartao) {
        console.log('[LancadorAgent] 💳 Nenhum cartão encontrado. Criando cartão default...');
        
        // Criar cartão default para o usuário
        const novoCartao = await CreditCard.create({
          userId,
          cardName: 'Meu Cartão de Crédito',
          creditLimit: 5000,
          billingCycleRenewalDay: 1,
          billingDueDay: 10,
          status: 'active',
          brand: 'visa',
          metadata: {
            criadoAutomaticamente: true,
            fonte: 'lancador_agent'
          }
        });
        
        console.log('[LancadorAgent] ✅ Cartão default criado:', novoCartao._id);
        cartao = novoCartao.toObject();
      }
      
      return cartao;
    } catch (error) {
      console.error('[LancadorAgent] ⚠️ Erro ao buscar/criar cartão:', error.message);
      return null;
    }
  }

  /**
   * Gera descrição automática baseada nos dados
   * @param {Object} extracao - Dados extraídos
   * @returns {string} - Descrição gerada
   */
  _gerarDescricaoAutomatica(extracao) {
    const partes = [];
    
    if (extracao.subcategoria) {
      partes.push(extracao.subcategoria);
    } else if (extracao.categoria) {
      partes.push(extracao.categoria);
    }

    if (partes.length === 0) {
      partes.push(extracao.tipo === 'receita' ? 'Receita' : 'Despesa');
    }

    return partes.join(' - ').substring(0, 50);
  }

  /**
   * Executa ação adicional após persistência principal
   * @param {Object} acao - Configuração da ação
   * @param {Object} extracao - Dados extraídos
   * @param {string} userId - ID do usuário
   */
  async _executarAcaoAdicional(acao, extracao, userId) {
    switch (acao.tipo) {
      case 'criar_parcelas':
      case 'criar_parcelas_cartao':
        await this._criarParcelasCartao(acao, extracao, userId);
        break;
      case 'atualizar_divida':
        if (extracao.divida_id) {
          await this._atualizarDivida(extracao.divida_id, acao.valorPago);
        }
        break;
      case 'criar_divida':
        await this._criarNovaDivida(acao, extracao, userId);
        break;
      case 'criar_divida_cartao':
        await this._criarDividaCartao(acao, extracao, userId);
        break;
      default:
        console.warn('[LancadorAgent] ⚠️ Ação desconhecida:', acao.tipo);
    }
  }

  /**
   * Cria uma nova dívida (financiamento, empréstimo)
   * @param {Object} acao - { valor, parcelas, descricao }
   * @param {Object} extracao - Dados originais
   * @param {string} userId - ID do usuário
   */
  async _criarNovaDivida(acao, extracao, userId) {
    try {
      const numParcelas = acao.parcelas || 1;
      const valorParcela = acao.valor / numParcelas;
      const dataInicial = new Date(extracao.data + 'T12:00:00');
      
      // Data do primeiro pagamento (próximo mês)
      const primeiroPagamento = new Date(dataInicial);
      primeiroPagamento.setMonth(primeiroPagamento.getMonth() + 1);
      
      // Gerar parcelas
      const installments = [];
      for (let i = 1; i <= numParcelas; i++) {
        const dataParcela = new Date(primeiroPagamento);
        dataParcela.setMonth(dataParcela.getMonth() + (i - 1));
        
        installments.push({
          installmentNumber: i,
          dueDate: dataParcela,
          amount: valorParcela,
          isPaid: false
        });
      }

      // Inferir tipo de dívida baseado na categoria
      let debtType = 'other';
      const catLower = (extracao.categoria || '').toLowerCase();
      if (catLower.includes('veículo') || catLower.includes('carro') || catLower.includes('transporte')) {
        debtType = 'vehicle_financing';
      } else if (catLower.includes('casa') || catLower.includes('imóvel') || catLower.includes('moradia')) {
        debtType = 'mortgage';
      } else if (extracao.cartao_credito) {
        debtType = 'credit_card_installment';
      } else {
        debtType = 'personal_loan';
      }

      // Campos obrigatórios do schema Debt
      const debtData = {
        userId,
        description: acao.descricao || extracao.descricao || extracao.categoria || 'Dívida',
        institution: extracao.subcategoria || extracao.categoria || 'Não informado',
        debtDate: dataInicial,
        totalValue: acao.valor,
        installmentCount: numParcelas,
        firstPaymentDate: primeiroPagamento,
        installmentValue: valorParcela,
        installments,
        status: 'active',
        debtType,
        notes: `Registrado via chat: ${extracao.descricao || extracao.categoria}`,
        metadata: {
          fonte: 'lancador_agent',
          tipo: 'financiamento',
          categoriaOriginal: extracao.categoria
        }
      };

      console.log('[LancadorAgent] 📋 Criando dívida com dados:', JSON.stringify(debtData, null, 2));

      const debt = await Debt.create(debtData);

      console.log('[LancadorAgent] 💳 Nova dívida criada:', debt._id, `${numParcelas}x de R$${valorParcela.toFixed(2)}`);
    } catch (error) {
      console.error('[LancadorAgent] ❌ Erro ao criar dívida:', error.message);
      console.error('[LancadorAgent] ❌ Stack:', error.stack);
    }
  }

  /**
   * Cria uma dívida relacionada a parcelamento no cartão de crédito
   * @param {Object} acao - { valor, parcelas, valorParcela, descricao }
   * @param {Object} extracao - Dados originais
   * @param {string} userId - ID do usuário
   */
  async _criarDividaCartao(acao, extracao, userId) {
    try {
      const dataInicial = new Date(extracao.data + 'T12:00:00');
      
      // Data do primeiro pagamento (próxima fatura - próximo mês)
      const primeiroPagamento = new Date(dataInicial);
      primeiroPagamento.setMonth(primeiroPagamento.getMonth() + 1);
      
      // Gerar parcelas
      const installments = [];
      for (let i = 1; i <= acao.parcelas; i++) {
        const dataParcela = new Date(primeiroPagamento);
        dataParcela.setMonth(dataParcela.getMonth() + (i - 1));
        
        installments.push({
          installmentNumber: i,
          dueDate: dataParcela,
          amount: acao.valorParcela,
          isPaid: false
        });
      }

      // Campos obrigatórios do schema Debt
      const debtData = {
        userId,
        description: `Parcelamento: ${acao.descricao || extracao.descricao || extracao.categoria || 'Compra parcelada'}`,
        institution: 'Cartão de Crédito',
        debtDate: dataInicial,
        totalValue: acao.valor,
        installmentCount: acao.parcelas,
        firstPaymentDate: primeiroPagamento,
        installmentValue: acao.valorParcela,
        installments,
        status: 'active',
        debtType: 'credit_card_installment',
        notes: `Parcelamento via cartão: ${acao.descricao || extracao.descricao || extracao.categoria}`,
        metadata: {
          fonte: 'lancador_agent',
          tipo: 'parcelamento_cartao',
          cartao_credito: true,
          categoriaOriginal: extracao.categoria
        }
      };

      console.log('[LancadorAgent] 📋 Criando dívida de cartão com dados:', JSON.stringify(debtData, null, 2));

      const debt = await Debt.create(debtData);

      console.log('[LancadorAgent] 💳 Dívida de cartão criada:', debt._id, `${acao.parcelas}x de R$${acao.valorParcela.toFixed(2)}`);
    } catch (error) {
      console.error('[LancadorAgent] ❌ Erro ao criar dívida de cartão:', error.message);
      console.error('[LancadorAgent] ❌ Stack:', error.stack);
    }
  }

  /**
   * Cria transações futuras para compra parcelada
   * @param {Object} acao - { parcelas, valorParcela }
   * @param {Object} extracao - Dados originais
   * @param {string} userId - ID do usuário
   */
  async _criarParcelasCartao(acao, extracao, userId) {
    const dataInicial = new Date(extracao.data);

    // Parcela 1 já foi criada no fluxo principal
    // Criar parcelas 2 a N como scheduled
    for (let i = 2; i <= acao.parcelas; i++) {
      const dataParcela = new Date(dataInicial);
      dataParcela.setMonth(dataParcela.getMonth() + (i - 1));

      await Transaction.create({
        userId,
        section: 'scheduled',
        type: 'expense',
        amount: acao.valorParcela,
        date: dataParcela,
        description: `${extracao.descricao || extracao.categoria} (${i}/${acao.parcelas})`,
        category: extracao.categoria,
        status: 'pending',
        scheduled: {
          scheduledType: 'payable',
          dueDate: dataParcela,
          frequency: 'once'
        },
        metadata: {
          fonte: 'lancador_agent',
          parcela: i,
          totalParcelas: acao.parcelas,
          parcelaOriginal: extracao.descricao
        }
      });
    }

    console.log('[LancadorAgent] 📅 Parcelas criadas:', acao.parcelas - 1);
  }

  /**
   * Atualiza dívida com pagamento
   * @param {string} debtId - ID da dívida
   * @param {number} valorPago - Valor pago
   */
  async _atualizarDivida(debtId, valorPago) {
    try {
      const debt = await Debt.findById(debtId);
      if (!debt) {
        console.warn('[LancadorAgent] ⚠️ Dívida não encontrada:', debtId);
        return;
      }

      // Encontrar próxima parcela não paga
      const parcelaPendente = debt.installments.find(inst => !inst.isPaid);
      if (parcelaPendente) {
        parcelaPendente.isPaid = true;
        parcelaPendente.paidAt = new Date();
        parcelaPendente.paidAmount = valorPago;

        // Verificar se todas as parcelas foram pagas
        const todasPagas = debt.installments.every(inst => inst.isPaid);
        if (todasPagas) {
          debt.status = 'paid';
        }

        await debt.save();
        console.log('[LancadorAgent] 💳 Dívida atualizada: parcela', parcelaPendente.installmentNumber);
      }
    } catch (error) {
      console.warn('[LancadorAgent] ⚠️ Erro ao atualizar dívida:', error.message);
    }
  }

  // =====================================================
  // RESPOSTAS DE CONFIRMAÇÃO
  // =====================================================

  /**
   * Monta resposta de confirmação com resultado real
   * @param {Object} resultado - Resultado da persistência
   * @param {Object} extracao - Dados extraídos
   * @param {Object} classificacao - Classificação
   * @param {string} sessionId - ID da sessão
   * @returns {Object} - Resposta formatada
   */
  _montarConfirmacao(resultado, extracao, classificacao, sessionId) {
    const valor = extracao.valor.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    });

    const tipoEmoji = extracao.tipo === 'receita' ? '💰' : '💸';
    const tipoTexto = extracao.tipo === 'receita' ? 'Receita' : 'Despesa';

    let mensagem = `${tipoEmoji} **${tipoTexto} registrada com sucesso!**\n\n`;
    mensagem += `📝 **Valor:** ${valor}\n`;
    mensagem += `📁 **Categoria:** ${extracao.categoria || 'Outros'}`;
    
    if (extracao.subcategoria) {
      mensagem += ` > ${extracao.subcategoria}`;
    }
    mensagem += '\n';

    if (extracao.descricao) {
      mensagem += `📋 **Descrição:** ${extracao.descricao}\n`;
    }

    mensagem += `📅 **Data:** ${extracao.data}\n`;
    mensagem += `💳 **Forma de pagamento:** ${extracao.forma_pagamento}`;
    
    if (extracao.parcelas && extracao.parcelas > 1) {
      mensagem += ` (${extracao.parcelas}x de ${(extracao.valor / extracao.parcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`;
    }
    mensagem += '\n';

    // Informar onde aparece
    const cards = resultado.transacoes.flatMap(t => t.populaCards);
    const cardsUnicos = [...new Set(cards)];
    
    mensagem += `\n✅ **Registrado em:**\n`;
    cardsUnicos.forEach(card => {
      mensagem += `• ${card}\n`;
    });

    // Informações adicionais
    if (resultado.acoesAdicionais > 0) {
      mensagem += `\n📅 Ações adicionais executadas: ${resultado.acoesAdicionais}`;
    }

    console.log(`[LancadorAgent] ✅ Lançamento confirmado: ${resultado.transacoes.length} transação(ões)`);

    return {
      response: mensagem,
      sessionId,
      timestamp: new Date().toISOString(),
      metadata: {
        agente: 'lancador',
        status: 'success',
        fluxo: 'lancamento',
        tipoLancamento: classificacao.tipo_lancamento,
        transacoes: resultado.transacoes.map(t => ({
          id: t.id,
          section: t.section
        })),
        acoesAdicionais: resultado.acoesAdicionais
      }
    };
  }
}

module.exports = LancadorAgent;

module.exports = LancadorAgent;
