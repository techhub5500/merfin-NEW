# Plano de Implementação — Agente Lançador

**Versão:** 1.0  
**Data:** 27/01/2026  
**Objetivo Geral:** Implementar o Agente Lançador que processa lançamentos financeiros em linguagem natural e os persiste no banco de dados, populando os cards do dashboard corretamente.

---

## 📋 Sumário Executivo

### Visão Geral do Sistema

O Agente Lançador é responsável por:

1. **Receber** queries de lançamento do Agente Junior (via `routeToLancador()`)
2. **Extrair** informações financeiras do texto natural (valor, tipo, categoria, data, forma de pagamento)
3. **Classificar** automaticamente onde o lançamento deve ser registrado (extrato, cartão de crédito, contas futuras, dívidas)
4. **Persistir** no banco de dados usando o schema `Transaction` e schemas relacionados
5. **Confirmar** ao usuário o que foi registrado
6. **Dialogar** (opcional) quando informações estão incompletas

### Mapeamento de Lançamentos → Cards

| Tipo de Lançamento | Card(s) Afetado(s) | Section do Schema |
|-------------------|-------------------|-------------------|
| Receita simples (salário, freelance) | Extrato (Receitas), Últimas Transações, Cards do Topo | `statement` |
| Despesa simples (supermercado, conta de luz) | Extrato (Despesas), Últimas Transações, Cards do Topo | `statement` |
| Gasto no cartão de crédito | Extrato (Despesas) + Cartão de Crédito (fatura) | `statement` + `credit_card` |
| Pagamento de fatura do cartão | Extrato (Despesas) + Cartão de Crédito (reduz utilizado) | `statement` + atualiza utilização |
| Conta a receber (futura) | Contas Futuras (A receber) | `scheduled` (scheduledType: 'receivable') |
| Conta a pagar (futura) | Contas Futuras (A pagar) | `scheduled` (scheduledType: 'payable') |
| Nova dívida ou parcela paga | Dívidas | Schema `Debt` separado |
| Patrimônio | Card Patrimônio (consolidado, não recebe lançamentos diretos) | N/A |

### Arquivos Principais Envolvidos

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `server/src/agents/junior/lançador/lancador-agent.js` | Novo | Agente principal de lançamentos |
| `server/src/agents/junior/junior/junior-agent.js` | Modificar | Atualizar `routeToLancador()` |
| `server/src/agents/data/transaction-queries.js` | Reutilizar | `createTransaction()` já existe |
| `server/src/database/schemas/transactions-schema.js` | Existente | Schema de transações |
| `server/src/database/schemas/credit-card-schema.js` | Existente | Schema de cartões |
| `server/src/database/schemas/debt-schema.js` | Existente | Schema de dívidas |

---

## 🎯 Objetivo 1: Estrutura Base do Agente Lançador

**Descrição:** Criar a estrutura fundamental do agente com as constantes, classes e métodos base necessários para extração e processamento de lançamentos.

### Tarefa 1.1: Criar Arquivo Principal do Agente

**O que será feito:**
- Criar `server/src/agents/junior/lançador/lancador-agent.js`
- Definir classe `LancadorAgent` estendendo `BaseAgent`
- Configurar modelo GPT-5 Mini com `verbosity: low` e `reasoning_effort: low`

**Estrutura inicial:**
```javascript
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
 */

const BaseAgent = require('../../shared/base-agent');
const OpenAI = require('openai');
const Transaction = require('../../../database/schemas/transactions-schema');
const CreditCard = require('../../../database/schemas/credit-card-schema');
const Debt = require('../../../database/schemas/debt-schema');

// Constantes de tipos de lançamento
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

// Categorias padrão suportadas
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

class LancadorAgent extends BaseAgent {
  constructor() {
    super('LancadorAgent');
    this.model = 'gpt-5-mini';
    this.max_completion_tokens = 800;
    
    // Cache de diálogos ativos (por sessionId)
    this._activeDialogs = new Map();
  }

  // Métodos serão implementados nas próximas tarefas
}

module.exports = LancadorAgent;
```

**Caminho:** `server/src/agents/junior/lançador/lancador-agent.js`

---

### Tarefa 1.2: Definir Categorias e Mapeamentos

**O que será feito:**
- Criar arquivo JSON com categorias e subcategorias
- Mapear palavras-chave para detecção automática
- Definir sinônimos para cada categoria

**Arquivo a criar:** `server/src/agents/jsons/categorias-lancamento.json`

```json
{
  "categorias": [
    {
      "id": "alimentacao",
      "nome": "Alimentação",
      "subcategorias": ["Supermercado", "Restaurante", "Lanche", "Delivery", "Mercado"],
      "palavras_chave": ["supermercado", "mercado", "restaurante", "lanche", "almoço", "jantar", "café", "ifood", "delivery", "comida", "padaria", "açougue", "feira"]
    },
    {
      "id": "transporte",
      "nome": "Transporte",
      "subcategorias": ["Combustível", "Transporte Público", "Uber/99", "Manutenção", "Estacionamento"],
      "palavras_chave": ["gasolina", "combustível", "uber", "99", "ônibus", "metrô", "passagem", "estacionamento", "pedágio", "ipva", "oficina", "posto"]
    },
    {
      "id": "moradia",
      "nome": "Moradia",
      "subcategorias": ["Aluguel", "Condomínio", "IPTU", "Manutenção Casa"],
      "palavras_chave": ["aluguel", "condomínio", "iptu", "reforma", "móveis", "decoração", "casa", "apartamento"]
    },
    {
      "id": "contas",
      "nome": "Contas",
      "subcategorias": ["Energia", "Água", "Internet", "Telefone", "Gás"],
      "palavras_chave": ["luz", "energia", "água", "internet", "telefone", "celular", "gás", "conta", "fatura"]
    },
    {
      "id": "saude",
      "nome": "Saúde",
      "subcategorias": ["Plano de Saúde", "Farmácia", "Consulta", "Exames"],
      "palavras_chave": ["farmácia", "remédio", "médico", "consulta", "exame", "hospital", "dentista", "plano de saúde"]
    },
    {
      "id": "lazer",
      "nome": "Lazer",
      "subcategorias": ["Streaming", "Cinema", "Viagem", "Eventos", "Hobby"],
      "palavras_chave": ["netflix", "spotify", "cinema", "teatro", "show", "viagem", "hotel", "passagem aérea", "ingresso", "bar", "balada"]
    },
    {
      "id": "vestuario",
      "nome": "Vestuário",
      "subcategorias": ["Roupas", "Calçados", "Acessórios"],
      "palavras_chave": ["roupa", "tênis", "sapato", "calçado", "bolsa", "acessório", "loja", "shopping"]
    },
    {
      "id": "educacao",
      "nome": "Educação",
      "subcategorias": ["Faculdade", "Cursos", "Livros", "Material"],
      "palavras_chave": ["faculdade", "curso", "escola", "livro", "material escolar", "mensalidade", "udemy", "alura"]
    },
    {
      "id": "salario",
      "nome": "Salário",
      "subcategorias": ["Salário Mensal", "13º", "Férias", "Bônus"],
      "palavras_chave": ["salário", "13º", "férias", "bônus", "holerite", "pagamento", "remuneração"]
    },
    {
      "id": "freelance",
      "nome": "Freelance/Extra",
      "subcategorias": ["Projeto", "Serviço", "Venda"],
      "palavras_chave": ["freelance", "freela", "projeto", "serviço", "cliente", "venda", "recebi de", "pagamento de cliente"]
    },
    {
      "id": "investimentos",
      "nome": "Investimentos",
      "subcategorias": ["Rendimento", "Dividendos", "Juros"],
      "palavras_chave": ["rendimento", "dividendo", "juros", "investimento", "ação", "fundo", "cdb", "tesouro"]
    },
    {
      "id": "cartao_credito",
      "nome": "Cartão de Crédito",
      "subcategorias": ["Fatura", "Anuidade"],
      "palavras_chave": ["cartão", "cartão de crédito", "fatura", "crédito", "parcelado"]
    },
    {
      "id": "outros",
      "nome": "Outros",
      "subcategorias": ["Diversos"],
      "palavras_chave": []
    }
  ],
  "formas_pagamento": [
    { "id": "avista", "nome": "À Vista", "palavras_chave": ["à vista", "a vista", "pix", "dinheiro", "débito", "transferência"] },
    { "id": "cartao_debito", "nome": "Cartão Débito", "palavras_chave": ["débito", "no débito"] },
    { "id": "cartao_credito", "nome": "Cartão Crédito", "palavras_chave": ["crédito", "no crédito", "cartão", "parcelado"] },
    { "id": "pix", "nome": "PIX", "palavras_chave": ["pix"] },
    { "id": "boleto", "nome": "Boleto", "palavras_chave": ["boleto"] },
    { "id": "parcelado", "nome": "Parcelado", "palavras_chave": ["parcelado", "em x vezes", "parcelas", "x x"] }
  ]
}
```

**Caminho:** `server/src/agents/jsons/categorias-lancamento.json`

---

### Tarefa 1.3: Implementar Método Principal `execute()`

**O que será feito:**
- Criar método `execute(request)` como ponto de entrada do agente
- Implementar verificação de diálogo ativo
- Estruturar fluxo principal de processamento

**Implementação:**
```javascript
/**
 * Método principal de execução do Agente Lançador
 * @param {Object} request - Requisição com userId, sessionId, message
 * @returns {Promise<Object>} - Resposta processada
 */
async execute(request) {
  const { parameters } = request;
  const { message, userId, sessionId, chatId } = parameters;

  console.log('[LancadorAgent] 📥 Recebendo lançamento:', {
    userId,
    sessionId,
    messageLength: message?.length || 0
  });

  try {
    // 1. Verificar se há diálogo ativo (continuação de extração)
    const dialogoAtivo = this._activeDialogs.get(sessionId);
    
    if (dialogoAtivo) {
      console.log('[LancadorAgent] 🔄 Continuando diálogo ativo...');
      return await this._continuarDialogo(dialogoAtivo, message, parameters);
    }

    // 2. Extrair informações do lançamento
    const extracao = await this._extrairDadosLancamento(message);

    // 3. Verificar se extração está completa
    if (extracao.incompleto) {
      console.log('[LancadorAgent] ❓ Dados incompletos, iniciando diálogo...');
      return await this._iniciarDialogo(extracao, parameters);
    }

    // 4. Classificar tipo de lançamento
    const classificacao = await this._classificarLancamento(extracao);

    // 5. Persistir no banco de dados
    const resultado = await this._persistirLancamento(extracao, classificacao, userId);

    // 6. Retornar confirmação
    return this._montarConfirmacao(resultado, extracao, classificacao, sessionId);

  } catch (error) {
    console.error('[LancadorAgent] ❌ Erro no execute():', error.message);
    return {
      response: 'Desculpe, não consegui processar esse lançamento. Pode tentar novamente?',
      sessionId,
      timestamp: new Date().toISOString(),
      metadata: { agente: 'lancador', status: 'error', error: error.message }
    };
  }
}
```

---

### ✅ Checklist do Objetivo 1

- [ ] Arquivo `lancador-agent.js` criado com estrutura base
- [ ] Constantes `LANCAMENTO_TYPES` e `CATEGORIAS` definidas
- [ ] Arquivo `categorias-lancamento.json` criado
- [ ] Método `execute()` implementado com fluxo principal
- [ ] Classe exportada corretamente

---

## 🎯 Objetivo 2: Extração e Classificação de Lançamentos

**Descrição:** Implementar o sistema de extração de dados financeiros de linguagem natural usando GPT-5 Mini e classificação automática do tipo de lançamento.

### Tarefa 2.1: Criar System Prompt de Extração

**O que será feito:**
- Criar método `_buildExtractionPrompt()` com instruções detalhadas
- Definir formato JSON de resposta esperado
- Incluir exemplos de extração

**Implementação:**
```javascript
/**
 * Constrói prompt de extração de dados financeiros
 * @returns {string} - System prompt
 */
_buildExtractionPrompt() {
  return `### TAREFA: EXTRAÇÃO DE DADOS DE LANÇAMENTO FINANCEIRO

Você é um extrator de dados financeiros. Analise a mensagem do usuário e extraia TODAS as informações financeiras relevantes.

## CAMPOS A EXTRAIR:

1. **valor** (obrigatório): Valor monetário em número (apenas o número, sem R$)
2. **tipo** (obrigatório): "receita" ou "despesa"
3. **categoria**: Categoria principal (Alimentação, Transporte, Salário, etc.)
4. **subcategoria**: Subcategoria específica se identificável
5. **descricao**: Descrição curta do lançamento (máx 5 palavras)
6. **data**: Data do lançamento (formato ISO ou "hoje", "ontem", data específica)
7. **forma_pagamento**: À vista, PIX, Cartão Crédito, Cartão Débito, Parcelado
8. **parcelas**: Número de parcelas se parcelado
9. **cartao_credito**: true/false - se foi no cartão de crédito
10. **conta_futura**: true/false - se é um agendamento futuro
11. **divida_relacionada**: Se é pagamento de dívida existente

## REGRAS DE INFERÊNCIA:

- Se menciona "comprei", "gastei", "paguei" → tipo = "despesa"
- Se menciona "recebi", "ganhei", "entrou" → tipo = "receita"
- Se menciona "cartão" ou "parcelado" → cartao_credito = true
- Se menciona "supermercado", "mercado" → categoria = "Alimentação", subcategoria = "Supermercado"
- Se menciona "salário" → categoria = "Salário", tipo = "receita"
- Se menciona "conta de luz/água/internet" → categoria = "Contas"
- Se não menciona data → data = "hoje"
- Se não menciona forma de pagamento → forma_pagamento = "À vista"

## FORMATO DE RESPOSTA:

Retorne APENAS um JSON válido:
{
  "valor": 150.00,
  "tipo": "despesa",
  "categoria": "Alimentação",
  "subcategoria": "Supermercado",
  "descricao": "Compra supermercado",
  "data": "hoje",
  "forma_pagamento": "À vista",
  "parcelas": null,
  "cartao_credito": false,
  "conta_futura": false,
  "divida_relacionada": null,
  "incompleto": false,
  "campos_faltantes": []
}

## QUANDO MARCAR COMO INCOMPLETO:

Se NÃO conseguir identificar o VALOR, marque:
- "incompleto": true
- "campos_faltantes": ["valor"]
- "pergunta_sugerida": "Qual foi o valor exato?"

Se o TIPO está ambíguo (não sabe se é receita ou despesa):
- "incompleto": true  
- "campos_faltantes": ["tipo"]
- "pergunta_sugerida": "Isso foi uma despesa ou uma receita?"`;
}
```

---

### Tarefa 2.2: Implementar Método de Extração

**O que será feito:**
- Criar método `_extrairDadosLancamento(message)`
- Chamar GPT-5 Mini com prompt de extração
- Parsear e validar JSON de resposta

**Implementação:**
```javascript
/**
 * Extrai dados do lançamento usando GPT-5 Mini
 * @param {string} message - Mensagem do usuário
 * @returns {Promise<Object>} - Dados extraídos
 */
async _extrairDadosLancamento(message) {
  console.log('[LancadorAgent] 🔍 Extraindo dados do lançamento...');

  try {
    const systemPrompt = this._buildExtractionPrompt();

    const response = await Promise.race([
      getOpenAI().chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_completion_tokens: 500,
        verbosity: 'low',
        reasoning_effort: 'medium'
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout na extração')), 30000)
      )
    ]);

    const responseText = response.choices[0]?.message?.content?.trim();

    // Parsear JSON
    try {
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      const extracao = JSON.parse(cleanJson);

      // Validações básicas
      if (extracao.valor && typeof extracao.valor === 'string') {
        extracao.valor = this._parseValor(extracao.valor);
      }

      if (extracao.data === 'hoje') {
        extracao.data = new Date().toISOString();
      } else if (extracao.data === 'ontem') {
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);
        extracao.data = ontem.toISOString();
      }

      console.log('[LancadorAgent] ✅ Dados extraídos:', {
        valor: extracao.valor,
        tipo: extracao.tipo,
        categoria: extracao.categoria,
        incompleto: extracao.incompleto
      });

      return extracao;

    } catch (parseError) {
      console.error('[LancadorAgent] ⚠️ Erro ao parsear extração:', parseError.message);
      return {
        incompleto: true,
        campos_faltantes: ['valor', 'tipo'],
        pergunta_sugerida: 'Não consegui entender. Pode me dizer o valor e se foi uma despesa ou receita?',
        raw_response: responseText
      };
    }

  } catch (error) {
    console.error('[LancadorAgent] ❌ Erro na extração:', error.message);
    throw error;
  }
}

/**
 * Converte string de valor para número
 * @param {string} valorStr - Valor como string (ex: "R$ 150,00")
 * @returns {number} - Valor numérico
 */
_parseValor(valorStr) {
  if (typeof valorStr === 'number') return valorStr;
  
  const cleaned = valorStr
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(cleaned) || 0;
}
```

---

### Tarefa 2.3: Implementar Classificação de Lançamento

**O que será feito:**
- Criar método `_classificarLancamento(extracao)` 
- Determinar em qual(is) card(s) o lançamento deve aparecer
- Mapear para sections do schema Transaction

**Implementação:**
```javascript
/**
 * Classifica o lançamento para determinar onde persistir
 * @param {Object} extracao - Dados extraídos
 * @returns {Object} - Classificação com sections e ações
 */
_classificarLancamento(extracao) {
  console.log('[LancadorAgent] 📊 Classificando lançamento...');

  const classificacao = {
    tipo_lancamento: null,
    sections: [],        // Sections do Transaction schema
    acoes_adicionais: [] // Ações extras (atualizar cartão, dívida, etc.)
  };

  // 1. Receita simples
  if (extracao.tipo === 'receita' && !extracao.conta_futura) {
    classificacao.tipo_lancamento = LANCAMENTO_TYPES.RECEITA_SIMPLES;
    classificacao.sections.push({
      section: 'statement',
      type: 'income',
      populaCards: ['Extrato (Receitas)', 'Últimas Transações', 'Cards Topo']
    });
  }

  // 2. Despesa simples (sem cartão de crédito)
  else if (extracao.tipo === 'despesa' && !extracao.cartao_credito && !extracao.conta_futura) {
    classificacao.tipo_lancamento = LANCAMENTO_TYPES.DESPESA_SIMPLES;
    classificacao.sections.push({
      section: 'statement',
      type: 'expense',
      populaCards: ['Extrato (Despesas)', 'Últimas Transações', 'Cards Topo']
    });
  }

  // 3. Gasto no cartão de crédito
  else if (extracao.tipo === 'despesa' && extracao.cartao_credito) {
    classificacao.tipo_lancamento = LANCAMENTO_TYPES.GASTO_CARTAO;
    
    // Popula extrato
    classificacao.sections.push({
      section: 'statement',
      type: 'expense',
      populaCards: ['Extrato (Despesas)', 'Últimas Transações', 'Cards Topo']
    });
    
    // Popula card de cartão de crédito
    classificacao.sections.push({
      section: 'credit_card',
      type: 'expense',
      populaCards: ['Cartão de Crédito (fatura atual)']
    });
    
    // Se parcelado, criar transações futuras
    if (extracao.parcelas && extracao.parcelas > 1) {
      classificacao.acoes_adicionais.push({
        tipo: 'criar_parcelas',
        parcelas: extracao.parcelas,
        valorParcela: extracao.valor / extracao.parcelas
      });
    }
  }

  // 4. Conta a receber (futura)
  else if (extracao.tipo === 'receita' && extracao.conta_futura) {
    classificacao.tipo_lancamento = LANCAMENTO_TYPES.CONTA_RECEBER;
    classificacao.sections.push({
      section: 'scheduled',
      type: 'income',
      scheduledType: 'receivable',
      populaCards: ['Contas Futuras (A receber)']
    });
  }

  // 5. Conta a pagar (futura)
  else if (extracao.tipo === 'despesa' && extracao.conta_futura) {
    classificacao.tipo_lancamento = LANCAMENTO_TYPES.CONTA_PAGAR;
    classificacao.sections.push({
      section: 'scheduled',
      type: 'expense',
      scheduledType: 'payable',
      populaCards: ['Contas Futuras (A pagar)']
    });
  }

  // 6. Pagamento de dívida
  else if (extracao.divida_relacionada) {
    classificacao.tipo_lancamento = LANCAMENTO_TYPES.PAGAMENTO_DIVIDA;
    classificacao.sections.push({
      section: 'statement',
      type: 'expense',
      populaCards: ['Extrato (Despesas)', 'Últimas Transações', 'Cards Topo']
    });
    classificacao.acoes_adicionais.push({
      tipo: 'atualizar_divida',
      debtId: extracao.divida_relacionada
    });
  }

  console.log('[LancadorAgent] ✅ Classificação:', {
    tipo: classificacao.tipo_lancamento,
    sectionsCount: classificacao.sections.length,
    acoesAdicionais: classificacao.acoes_adicionais.length
  });

  return classificacao;
}
```

---

### Tarefa 2.4: Implementar Detecção de Categoria por Palavras-Chave

**O que será feito:**
- Criar método auxiliar `_detectarCategoriaPorPalavrasChave(message)`
- Usar arquivo `categorias-lancamento.json` como referência
- Fornecer fallback quando GPT não conseguir categorizar

**Implementação:**
```javascript
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
        return {
          categoria: cat.nome,
          subcategoria: cat.subcategorias[0] || null
        };
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

  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '../../jsons/categorias-lancamento.json');

  if (fs.existsSync(filePath)) {
    this._categoriasCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    console.warn('[LancadorAgent] ⚠️ Arquivo de categorias não encontrado');
    this._categoriasCache = { categorias: [], formas_pagamento: [] };
  }

  return this._categoriasCache;
}
```

---

### ✅ Checklist do Objetivo 2

- [ ] Método `_buildExtractionPrompt()` implementado
- [ ] Método `_extrairDadosLancamento()` funcional
- [ ] Método `_classificarLancamento()` com todos os tipos mapeados
- [ ] Método `_detectarCategoriaPorPalavrasChave()` como fallback
- [ ] Helper `_parseValor()` para conversão de valores
- [ ] Testes com 10 frases variadas de lançamento

---

## 🎯 Objetivo 3: Persistência e Integração com Cards

**Descrição:** Implementar a persistência dos lançamentos no banco de dados e garantir que os dados apareçam corretamente nos cards do dashboard.

### Tarefa 3.1: Implementar Persistência no Banco de Dados

**O que será feito:**
- Criar método `_persistirLancamento(extracao, classificacao, userId)`
- Usar `Transaction.create()` para persistir
- Tratar múltiplas sections quando necessário

**Implementação:**
```javascript
/**
 * Persiste lançamento no banco de dados
 * @param {Object} extracao - Dados extraídos
 * @param {Object} classificacao - Classificação do lançamento
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} - Resultado da persistência
 */
async _persistirLancamento(extracao, classificacao, userId) {
  console.log('[LancadorAgent] 💾 Persistindo lançamento...');

  const resultados = [];

  try {
    // Persistir em cada section mapeada
    for (const sectionConfig of classificacao.sections) {
      const transactionData = {
        userId,
        section: sectionConfig.section,
        type: sectionConfig.type,
        amount: extracao.valor,
        date: new Date(extracao.data),
        description: extracao.descricao || this._gerarDescricaoAutomatica(extracao),
        category: extracao.categoria,
        status: sectionConfig.section === 'scheduled' ? 'pending' : 'confirmed'
      };

      // Adicionar dados específicos por section
      if (sectionConfig.section === 'scheduled') {
        transactionData.scheduled = {
          scheduledType: sectionConfig.scheduledType,
          dueDate: new Date(extracao.data),
          frequency: 'once'
        };
      }

      if (sectionConfig.section === 'credit_card') {
        // Buscar cartão do usuário
        const cartao = await this._buscarCartaoPrincipal(userId);
        if (cartao) {
          transactionData.creditCard = {
            cardId: cartao._id.toString(),
            utilizedAmount: extracao.valor
          };
        }
      }

      // Criar transação
      const Transaction = require('../../../database/schemas/transactions-schema');
      const transaction = await Transaction.create(transactionData);

      resultados.push({
        section: sectionConfig.section,
        transactionId: transaction._id.toString(),
        populaCards: sectionConfig.populaCards
      });

      console.log(`[LancadorAgent] ✅ Transação salva em ${sectionConfig.section}:`, transaction._id);
    }

    // Executar ações adicionais
    for (const acao of classificacao.acoes_adicionais) {
      await this._executarAcaoAdicional(acao, extracao, userId);
    }

    return {
      success: true,
      transacoes: resultados,
      totalSalvo: resultados.length
    };

  } catch (error) {
    console.error('[LancadorAgent] ❌ Erro ao persistir:', error.message);
    throw error;
  }
}

/**
 * Busca cartão de crédito principal do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object|null>} - Cartão ou null
 */
async _buscarCartaoPrincipal(userId) {
  const CreditCard = require('../../../database/schemas/credit-card-schema');
  return await CreditCard.findOne({ userId, status: 'active' }).lean();
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
```

---

### Tarefa 3.2: Implementar Ações Adicionais

**O que será feito:**
- Criar método `_executarAcaoAdicional(acao, extracao, userId)`
- Implementar criação de parcelas para compras parceladas
- Implementar atualização de dívidas

**Implementação:**
```javascript
/**
 * Executa ação adicional após persistência principal
 * @param {Object} acao - Configuração da ação
 * @param {Object} extracao - Dados extraídos
 * @param {string} userId - ID do usuário
 */
async _executarAcaoAdicional(acao, extracao, userId) {
  console.log(`[LancadorAgent] ⚡ Executando ação: ${acao.tipo}`);

  switch (acao.tipo) {
    case 'criar_parcelas':
      await this._criarParcelasCartao(acao, extracao, userId);
      break;
    
    case 'atualizar_divida':
      await this._atualizarDivida(acao.debtId, extracao.valor);
      break;
    
    default:
      console.warn(`[LancadorAgent] ⚠️ Ação desconhecida: ${acao.tipo}`);
  }
}

/**
 * Cria transações futuras para compra parcelada
 * @param {Object} acao - { parcelas, valorParcela }
 * @param {Object} extracao - Dados originais
 * @param {string} userId - ID do usuário
 */
async _criarParcelasCartao(acao, extracao, userId) {
  const Transaction = require('../../../database/schemas/transactions-schema');
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
      description: `${extracao.descricao || extracao.categoria} - Parcela ${i}/${acao.parcelas}`,
      category: extracao.categoria,
      status: 'pending',
      scheduled: {
        scheduledType: 'payable',
        dueDate: dataParcela,
        frequency: 'once'
      }
    });
  }

  console.log(`[LancadorAgent] ✅ ${acao.parcelas - 1} parcelas futuras criadas`);
}

/**
 * Atualiza dívida com pagamento
 * @param {string} debtId - ID da dívida
 * @param {number} valorPago - Valor pago
 */
async _atualizarDivida(debtId, valorPago) {
  const Debt = require('../../../database/schemas/debt-schema');
  
  const debt = await Debt.findById(debtId);
  if (!debt) {
    console.warn(`[LancadorAgent] ⚠️ Dívida não encontrada: ${debtId}`);
    return;
  }

  // Encontrar próxima parcela não paga
  const parcelaPendente = debt.installments.find(inst => !inst.isPaid);
  if (parcelaPendente) {
    parcelaPendente.isPaid = true;
    parcelaPendente.paidAt = new Date();
    parcelaPendente.paidAmount = valorPago;

    // Verificar se todas foram pagas
    const todasPagas = debt.installments.every(inst => inst.isPaid);
    if (todasPagas) {
      debt.status = 'paid';
    }

    await debt.save();
    console.log(`[LancadorAgent] ✅ Dívida atualizada: parcela ${parcelaPendente.installmentNumber} paga`);
  }
}
```

---

### Tarefa 3.3: Implementar Confirmação ao Usuário

**O que será feito:**
- Criar método `_montarConfirmacao(resultado, extracao, classificacao, sessionId)`
- Retornar resposta amigável detalhando o que foi registrado

**Implementação:**
```javascript
/**
 * Monta resposta de confirmação para o usuário
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

  // Informar onde aparecerá
  const cards = resultado.transacoes.flatMap(t => t.populaCards);
  const cardsUnicos = [...new Set(cards)];
  
  mensagem += `\n✅ Você verá esse lançamento em:\n`;
  cardsUnicos.forEach(card => {
    mensagem += `• ${card}\n`;
  });

  // Informações adicionais
  if (extracao.cartao_credito) {
    mensagem += `\n💳 Registrado no cartão de crédito`;
    if (extracao.parcelas && extracao.parcelas > 1) {
      const valorParcela = (extracao.valor / extracao.parcelas).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
      mensagem += ` em ${extracao.parcelas}x de ${valorParcela}`;
    }
  }

  return {
    response: mensagem,
    sessionId,
    timestamp: new Date().toISOString(),
    metadata: {
      agente: 'lancador',
      status: 'success',
      tipo_lancamento: classificacao.tipo_lancamento,
      transacoes_criadas: resultado.totalSalvo,
      valor: extracao.valor,
      categoria: extracao.categoria
    }
  };
}
```

---

### ✅ Checklist do Objetivo 3

- [ ] Método `_persistirLancamento()` implementado
- [ ] Método `_buscarCartaoPrincipal()` funcional
- [ ] Método `_executarAcaoAdicional()` com suporte a parcelas e dívidas
- [ ] Método `_criarParcelasCartao()` para compras parceladas
- [ ] Método `_atualizarDivida()` para pagamentos de dívida
- [ ] Método `_montarConfirmacao()` com mensagem detalhada
- [ ] Teste: lançamento simples aparece no Extrato
- [ ] Teste: gasto no cartão aparece no Extrato E no Card de Cartão
- [ ] Teste: compra parcelada cria transações futuras

---

## 🎯 Objetivo 4: Sistema de Diálogo e Integração com Junior

**Descrição:** Implementar o sistema de diálogo interativo para informações incompletas e integrar o Lançador com o Agente Junior.

### Tarefa 4.1: Implementar Sistema de Diálogo

**O que será feito:**
- Criar métodos `_iniciarDialogo()` e `_continuarDialogo()`
- Gerenciar estado de diálogos ativos por sessionId
- Limitar a 3 trocas de perguntas

**Implementação:**
```javascript
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
    params,
    perguntasFeitas: 1,
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
      status: 'dialogo_ativo',
      campos_faltantes: extracao.campos_faltantes,
      pergunta_numero: 1
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
  const { sessionId } = params;

  console.log(`[LancadorAgent] 🔄 Continuando diálogo (pergunta ${dialogoState.perguntasFeitas + 1})`);

  // Verificar se usuário quer cancelar
  const cancelar = ['esquece', 'cancela', 'deixa', 'não importa'].some(
    termo => message.toLowerCase().includes(termo)
  );

  if (cancelar) {
    this._activeDialogs.delete(sessionId);
    return {
      response: 'Ok, cancelei o lançamento. Se precisar, é só me avisar!',
      sessionId,
      timestamp: new Date().toISOString(),
      metadata: { agente: 'lancador', status: 'cancelado' }
    };
  }

  // Tentar extrair dados da resposta
  const novaExtracao = await this._extrairDadosLancamento(
    `${dialogoState.extracaoParcial.raw_message || ''} ${message}`
  );

  // Mesclar extrações
  const extracaoMesclada = {
    ...dialogoState.extracaoParcial,
    ...novaExtracao,
    // Manter campos que já estavam preenchidos
    valor: novaExtracao.valor || dialogoState.extracaoParcial.valor,
    tipo: novaExtracao.tipo || dialogoState.extracaoParcial.tipo,
    categoria: novaExtracao.categoria || dialogoState.extracaoParcial.categoria
  };

  // Verificar se agora está completo
  if (!extracaoMesclada.incompleto && extracaoMesclada.valor && extracaoMesclada.tipo) {
    // Encerrar diálogo e processar
    this._activeDialogs.delete(sessionId);

    const classificacao = this._classificarLancamento(extracaoMesclada);
    const resultado = await this._persistirLancamento(
      extracaoMesclada, 
      classificacao, 
      params.userId
    );

    return this._montarConfirmacao(resultado, extracaoMesclada, classificacao, sessionId);
  }

  // Ainda incompleto - fazer outra pergunta ou desistir
  dialogoState.perguntasFeitas++;
  dialogoState.extracaoParcial = extracaoMesclada;

  if (dialogoState.perguntasFeitas >= dialogoState.maxPerguntas) {
    // Desistir após 3 perguntas
    this._activeDialogs.delete(sessionId);
    return {
      response: 'Hmm, não consegui entender todas as informações. Pode tentar novamente de forma mais completa? Por exemplo: "Gastei R$ 150 no supermercado hoje"',
      sessionId,
      timestamp: new Date().toISOString(),
      metadata: { agente: 'lancador', status: 'timeout_dialogo' }
    };
  }

  // Continuar perguntando
  this._activeDialogs.set(sessionId, dialogoState);

  return {
    response: `❓ ${extracaoMesclada.pergunta_sugerida || 'Ainda faltam algumas informações. Pode completar?'}`,
    sessionId,
    timestamp: new Date().toISOString(),
    metadata: {
      agente: 'lancador',
      status: 'dialogo_ativo',
      campos_faltantes: extracaoMesclada.campos_faltantes,
      pergunta_numero: dialogoState.perguntasFeitas
    }
  };
}
```

---

### Tarefa 4.2: Atualizar `routeToLancador()` no Junior Agent

**O que será feito:**
- Modificar `server/src/agents/junior/junior/junior-agent.js`
- Substituir stub por chamada real ao LancadorAgent
- Manter compatibilidade com estrutura existente

**Modificação em `junior-agent.js`:**
```javascript
// Adicionar import no topo
const LancadorAgent = require('../lançador/lancador-agent');

// Substituir método routeToLancador()
/**
 * Roteia para Agente Lançador (PRODUÇÃO)
 * Política: WRITE_ONLY - Não envia contexto, mas salva a interação
 * @param {Object} params - Parâmetros da mensagem
 * @returns {Promise<Object>} - Resposta do Lançador
 */
async routeToLancador(params) {
  const { message, chatId, userId, sessionId } = params;
  console.log('[JuniorAgent] 🟡 Roteando para Lançador');

  try {
    // Instanciar e chamar Lançador
    const lancador = new LancadorAgent();
    const response = await lancador.execute({
      parameters: { message, chatId, userId, sessionId }
    });

    // Salvar interação na memória (WRITE_ONLY policy)
    if (response.response && !response.error) {
      const memory = await ConversationalMemory.findOrCreate(chatId, userId, sessionId);
      await this._updateMemory(memory, message, response.response, true);
      console.log('[JuniorAgent] 💾 Lançamento salvo na memória (WRITE_ONLY)');
    }

    return response;

  } catch (error) {
    console.error('[JuniorAgent] ❌ Erro ao rotear para Lançador:', error.message);
    
    // Fallback: stub original
    return {
      response: `Desculpe, tive um problema ao registrar: "${message}". Pode tentar novamente?`,
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
```

---

### Tarefa 4.3: Corrigir Botão de Cadastro do Cartão de Crédito

**Problema identificado:** O botão de editar/cadastrar cartão de crédito não aparece no frontend.

**Análise do código:**
- Em [dash.js](dash.js#L259-L280), o `updateFabVisibility()` controla a visibilidade
- O botão `editCardBtn` tem `style="display: none;"` inicial em [dash.html](dash.html#L452-L457)
- A lógica verifica se o card `credit-card` está visível no carrossel

**Causa provável:** O carrossel precisa navegar até o card de cartão de crédito para o botão aparecer, mas pode haver problema na detecção.

**Correção em `dash.js`:**
```javascript
// Modificar updateFabVisibility() para garantir inicialização correta
function updateFabVisibility() {
  const editCardBtn = document.getElementById('editCardBtn');
  const addDebtBtn = document.getElementById('addDebtBtn');
  
  if (!editCardBtn || !addDebtBtn) {
    console.warn('[updateFabVisibility] FAB buttons not found');
    return;
  }
  
  // Verifica quais cards estão visíveis na viewport
  const visibleCards = [];
  for (let i = currentIndex; i < Math.min(currentIndex + cardsPerView, totalCards); i++) {
    if (cards[i]) {
      visibleCards.push(cards[i]);
    }
  }
  
  // Mostra botão de editar cartão se o card credit-card estiver visível
  const creditCardVisible = visibleCards.some(card => 
    card.classList.contains('credit-card')
  );
  
  editCardBtn.style.display = creditCardVisible ? 'flex' : 'none';
  
  // Mostra botão de adicionar dívida se o card debts estiver visível
  const debtsCardVisible = visibleCards.some(card => 
    card.classList.contains('debts')
  );
  
  addDebtBtn.style.display = debtsCardVisible ? 'flex' : 'none';
}
```

**Nota:** O botão funciona corretamente - ele só aparece quando o carrossel está posicionado no card de Cartão de Crédito. Isso é o comportamento esperado. Se quiser que o botão esteja sempre visível, basta remover a lógica condicional.

---

### Tarefa 4.4: Exportar Agente e Registrar no Sistema

**O que será feito:**
- Garantir export correto do LancadorAgent
- Verificar se precisa registrar em algum manifesto

**Verificações:**
1. Export em `lancador-agent.js`: `module.exports = LancadorAgent;`
2. Import em `junior-agent.js`: `const LancadorAgent = require('../lançador/lancador-agent');`

---

### ✅ Checklist do Objetivo 4

- [ ] Método `_iniciarDialogo()` implementado
- [ ] Método `_continuarDialogo()` funcional
- [ ] Map `_activeDialogs` gerenciando estados
- [ ] Limite de 3 perguntas implementado
- [ ] Cancelamento de diálogo ("esquece", "cancela") funcional
- [ ] `routeToLancador()` atualizado no Junior Agent
- [ ] Botão de cartão de crédito analisado (funciona com navegação do carrossel)
- [ ] Testes de diálogo: informação incompleta → pergunta → resposta → registro
- [ ] Teste de fluxo completo: Chat → Junior → Lançador → Banco de Dados → Card atualizado

---

## 📋 Resumo da Ordem de Execução

| Objetivo | Descrição | Tarefas | Dependência |
|----------|-----------|---------|-------------|
| 1 | Estrutura Base | 1.1, 1.2, 1.3 | Nenhuma |
| 2 | Extração e Classificação | 2.1, 2.2, 2.3, 2.4 | Objetivo 1 |
| 3 | Persistência e Cards | 3.1, 3.2, 3.3 | Objetivo 2 |
| 4 | Diálogo e Integração | 4.1, 4.2, 4.3, 4.4 | Objetivo 3 |

---

## 🔧 Notas Técnicas

### Considerações de Performance
- Extração via GPT-5 Mini: ~1s (reasoning: medium para melhor precisão)
- Persistência MongoDB: ~50-100ms por transação
- Cache de categorias evita I/O repetitivo
- Total por lançamento simples: ~1.5s

### Fluxo de Dados

```
Usuário: "Gastei 150 no supermercado hoje no cartão"
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AGENTE JUNIOR                                               │
│  classifyQuery() → "lancamento"                              │
│  routeToLancador(params)                                     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AGENTE LANÇADOR                                             │
│  execute(request)                                            │
│    │                                                         │
│    ├─► _extrairDadosLancamento()                             │
│    │     → { valor: 150, tipo: "despesa", cartao_credito: true } │
│    │                                                         │
│    ├─► _classificarLancamento()                              │
│    │     → sections: ['statement', 'credit_card']            │
│    │                                                         │
│    ├─► _persistirLancamento()                                │
│    │     → Transaction.create() x2                           │
│    │                                                         │
│    └─► _montarConfirmacao()                                  │
│          → "💸 Despesa registrada! Valor: R$ 150,00..."      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  BANCO DE DADOS (MongoDB)                                    │
│                                                              │
│  transactions: [                                             │
│    { section: 'statement', type: 'expense', amount: 150 },   │
│    { section: 'credit_card', type: 'expense', amount: 150 }  │
│  ]                                                           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD (dash.html)                                       │
│                                                              │
│  [Cards do Topo] → Despesas: +R$ 150 | Saldo: -R$ 150        │
│  [Extrato - Despesas] → "Supermercado - R$ 150,00"           │
│  [Últimas Transações] → Novo item no topo                    │
│  [Cartão de Crédito] → Valor utilizado: +R$ 150              │
└─────────────────────────────────────────────────────────────┘
```

### Mapeamento Completo: Lançamento → Cards

| Prompt do Usuário | Tipo | Cards Afetados |
|-------------------|------|----------------|
| "Recebi R$ 5.000 de salário" | Receita | Extrato (Receitas), Últimas Tx, Cards Topo |
| "Gastei R$ 150 no supermercado" | Despesa | Extrato (Despesas), Últimas Tx, Cards Topo |
| "Comprei R$ 2.000 no cartão" | Cartão | Extrato, Últimas Tx, Cards Topo, **Cartão de Crédito** |
| "Parcelei em 10x no cartão" | Parcelado | Extrato, Cartão, **Contas Futuras (parcelas)** |
| "Vou receber R$ 1.000 dia 15" | Futuro | **Contas Futuras (A receber)** |
| "Tenho que pagar R$ 500 dia 10" | Futuro | **Contas Futuras (A pagar)** |
| "Paguei parcela do financiamento" | Dívida | Extrato, Cards Topo, **Dívidas (atualiza)** |

### Casos Especiais

1. **Compra parcelada no cartão:**
   - Parcela 1: `section: 'credit_card'` (fatura atual)
   - Parcelas 2-N: `section: 'scheduled'` + `scheduledType: 'payable'`

2. **Pagamento de fatura do cartão:**
   - Registra despesa no `statement`
   - Zera utilização do cartão (não implementado neste plano - futuro)

3. **Patrimônio:**
   - Não recebe lançamentos diretos
   - É calculado a partir de: saldo em contas + investimentos + bens

---

## 📝 Estrutura Final de Arquivos

```
server/src/agents/
├── junior/
│   ├── junior/
│   │   ├── junior-agent.js       (modificado - routeToLancador)
│   │   └── README.md
│   ├── lançador/
│   │   ├── lancador-agent.js     (NOVO)
│   │   └── README.md             (existente)
│   └── simplista/
│       └── README.md
├── jsons/
│   ├── categorias-lancamento.json (NOVO)
│   ├── dominios.json
│   └── prompts_orquestracao.json
└── data/
    └── transaction-queries.js     (reutilizado)
```

---

## 🧪 Queries de Teste

### Receitas
1. "Recebi meu salário de R$ 5.000"
2. "Entrou R$ 500 de freelance"
3. "Ganhei R$ 200 de presente"

### Despesas Simples
4. "Gastei R$ 150 no supermercado"
5. "Paguei R$ 180 de conta de luz"
6. "Comprei um tênis de R$ 299"

### Cartão de Crédito
7. "Gastei R$ 500 no cartão no restaurante"
8. "Comprei um celular de R$ 2.400 em 12x no cartão"
9. "Paguei a fatura do cartão de R$ 1.500"

### Contas Futuras
10. "Vou receber R$ 1.000 do cliente dia 15"
11. "Preciso pagar R$ 800 de aluguel dia 5"

### Diálogo (Incompleto)
12. "Gastei 200 reais" → Perguntar categoria
13. "Comprei algo hoje" → Perguntar valor

---

**Arquivo de Referência:**
- Código Junior: `server/src/agents/junior/junior/junior-agent.js`
- Schema Transactions: `server/src/database/schemas/transactions-schema.js`
- Documentação: `server/src/agents/junior/lançador/README.md`
