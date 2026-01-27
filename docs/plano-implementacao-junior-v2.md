# Plano de Implementação — Agente Junior V2

**Versão:** 2.1  
**Data:** 27/01/2026  
**Objetivo Geral:** Transformar o agente júnior de assistente único em sistema inteligente de triagem e roteamento multi-agente, preservando memória persistente.

---

## 📋 Sumário Executivo

### Visão Geral do Sistema

O Agente Junior será transformado de um assistente conversacional único para uma **porta de entrada inteligente** que:

1. **Classifica** todas as queries em 4 categorias: Trivial, Lançamento, Simplista ou Complexa
2. **Responde diretamente** queries triviais (usando o fluxo atual com memória)
3. **Roteia** queries para agentes especializados (Lançador, Simplista, Coordenadores)
4. **Analisa** queries complexas para escolher domínio, coordenador e prompts de orquestração

### Fluxo de Processamento

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    MENSAGEM DO USUÁRIO                       │
                    └─────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │           ETAPA 1: CLASSIFICAÇÃO PRIMÁRIA                    │
                    │         (GPT-5 Mini, reasoning: low, verbosity: low)         │
                    │                   Sem acesso à memória                       │
                    └─────────────────────────────────────────────────────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
            ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
            │   TRIVIAL     │           │  LANÇAMENTO   │           │  SIMPLISTA    │
            │               │           │               │           │               │
            │ → Junior      │           │ → Lançador    │           │ → Simplista   │
            │   responde    │           │   (sem ctx)   │           │   (com ctx)   │
            │   (com ctx)   │           │               │           │               │
            └───────────────┘           └───────────────┘           └───────────────┘
                                                │
                                                ▼
                                        ┌───────────────┐
                                        │   COMPLEXA    │
                                        │               │
                                        │ → Etapa 2     │
                                        └───────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │           ETAPA 2: ANÁLISE SECUNDÁRIA                        │
                    │         (GPT-5 Mini, reasoning: low, verbosity: low)         │
                    │           Com acesso à memória (contexto completo)           │
                    │                                                              │
                    │   Escolhe: Domínio → Coordenador → Prompts de Orquestração   │
                    └─────────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │           ETAPA 3: HANDOVER PARA COORDENADOR                 │
                    │                                                              │
                    │   Empacota: System Prompt (prompts selecionados)             │
                    │           + Contexto (memória + mensagem atual)              │
                    │           + Metadados (domínio, coordenador)                 │
                    │                                                              │
                    │   Envia para: Analises | Investimentos | Planejamentos       │
                    └─────────────────────────────────────────────────────────────┘
```

### Arquivos Envolvidos

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `junior-agent.js` | Principal | Agente refatorado com classificação e roteamento |
| `dominios.json` | Dados | Lista de domínios financeiros disponíveis |
| `prompts_orquestracao.json` | Índice | Lista de prompts com metadados |
| `prompts/*.json` | Conteúdo | System prompts completos para cada estratégia |
| `contratos/*.json` | Contratos | Definições dos 3 coordenadores |

---

## 🔧 Fase 0: Infraestrutura de Dados (Pré-Requisito)

**Descrição:** Preparar toda a estrutura de arquivos JSON que será consumida pelo sistema de classificação e roteamento. Esta fase é executada primeiro para garantir que a base de dados esteja pronta antes de qualquer implementação de lógica.

**Status dos Arquivos Existentes:**
- ✅ `dominios.json` — Existe, mas precisa expansão (5 domínios → 8-10)
- ✅ `prompts_orquestracao.json` — Existe, mas precisa expansão (3 prompts → 5-8)
- ✅ `contratos/coord_*.json` — Existem e estão bem estruturados
- ❌ `prompts/*.json` — Arquivos de conteúdo NÃO existem (precisam ser criados)

### Tarefa 0.1: Expandir e Validar `dominios.json`

**O que será feito:**
- Expandir arquivo existente de 5 para 8-10 domínios financeiros representativos

**Estrutura Atual:**
```json
{
  "dominios": [
    { "id": "gestao_orcamento_pessoal", "descricao": "..." },
    { "id": "educacao_investimentos_basicos", "descricao": "..." },
    { "id": "planejamento_financeiro_longoprazo", "descricao": "..." },
    { "id": "analise_carteira_investimentos", "descricao": "..." },
    { "id": "estrategia_dividas_e_investimentos", "descricao": "..." }
  ]
}
```

**Domínios a Adicionar:**
- `comparacao_ferramentas_financeiras` — Apps e ferramentas de controle
- `analise_inflacao_investimentos` — Impacto da inflação em investimentos
- `planejamento_financeiro_integrado` — Planos completos (emergência + médio + longo prazo)

**Dicas práticas:**
- Descrições devem ser direcionais: "Use quando o usuário quer..."
- Cada domínio deve ter mapeamento claro para pelo menos 1 coordenador
- Validar JSON com linter antes de salvar
- Manter arquivo com indentação de 2 espaços

**Caminho:** `server/src/agents/jsons/dominios.json`

---

### Tarefa 0.2: Expandir e Validar `prompts_orquestracao.json`

**O que será feito:**
- Expandir arquivo existente de 3 para 5-8 prompts de orquestração
- Adicionar campo `aplicavel_a` mapeando para coordenadores compatíveis

**Estrutura Atual:**
```json
{
  "prompts": [
    { "id": "p_metodologia_50_30_20", "contexto": "..." },
    { "id": "p_estrategia_agressiva", "contexto": "..." },
    { "id": "p_quitacao_dividas", "contexto": "..." }
  ]
}
```

**Estrutura Proposta (Expandida):**
```json
{
  "prompts": [
    {
      "id": "p_metodologia_50_30_20",
      "titulo": "Metodologia 50/30/20",
      "contexto": "Foca em divisão de renda para quem precisa de organização básica.",
      "aplicavel_a": ["coord_analises", "coord_planejamentos"],
      "versao": "test"
    },
    {
      "id": "p_estrategia_agressiva",
      "titulo": "Estratégia Agressiva de Investimentos",
      "contexto": "Foca em maximização de lucros para perfis de alto risco.",
      "aplicavel_a": ["coord_investimentos"],
      "versao": "test"
    },
    {
      "id": "p_quitacao_dividas",
      "titulo": "Quitação de Dívidas",
      "contexto": "Foca em método bola de neve ou juros altos primeiro.",
      "aplicavel_a": ["coord_planejamentos", "coord_analises"],
      "versao": "test"
    }
  ]
}
```

**Prompts a Adicionar:**
- `p_analise_detalhada` — Diagnóstico profundo de situação financeira
- `p_comparacao_opcoes` — Comparativo entre alternativas de investimento
- `p_plano_passo_a_passo` — Cronograma estruturado com marcos
- `p_balanceamento_carteira` — Reequilíbrio de ativos por perfil de risco
- `p_reserva_emergencia` — Cálculo e estratégia para fundo de emergência

**Caminho:** `server/src/agents/jsons/prompts_orquestracao.json`

---

### Tarefa 0.3: Atualizar Contratos dos Coordenadores

**O que será feito:**
- Adicionar campo `dominios_atendidos` aos contratos existentes
- Adicionar campo `versao: "test"` para marcar como temporário
- Adicionar system prompt de teste em cada contrato

**Arquivos a Atualizar:**

**`contratos/coord_analises.json`:**
```json
{
  "id": "coord_analises",
  "nome": "Coordenador de Análises Financeiras",
  "descricao": "Especialista em diagnóstico, identificação de padrões de consumo e saúde financeira atual.",
  "dominios_atendidos": [
    "gestao_orcamento_pessoal",
    "analise_carteira_investimentos",
    "comparacao_ferramentas_financeiras"
  ],
  "quando_chamar": [...],
  "ferramentas_disponiveis": [...],
  "objetivo_final": "...",
  "system_prompt_teste": "Você é o Agente de Análises (VERSÃO DE TESTE). Sua função é receber dados de gastos e identificar padrões. Status atual: Aguardando implementação profunda. Sua tarefa agora: Apenas valide se você recebeu o domínio e o prompt de orquestração corretos do Agente Junior e dê um breve insight.",
  "versao": "test"
}
```

**`contratos/coord_investimentos.json`:**
```json
{
  "dominios_atendidos": [
    "educacao_investimentos_basicos",
    "analise_carteira_investimentos",
    "analise_inflacao_investimentos"
  ],
  "system_prompt_teste": "Você é o Agente de Investimentos (VERSÃO DE TESTE). Sua função é sugerir alocações. Status atual: Aguardando implementação profunda. Sua tarefa agora: Liste os investimentos que você analisaria com base no domínio enviado pelo Junior.",
  "versao": "test"
}
```

**`contratos/coord_planejamentos.json`:**
```json
{
  "dominios_atendidos": [
    "planejamento_financeiro_longoprazo",
    "estrategia_dividas_e_investimentos",
    "planejamento_financeiro_integrado"
  ],
  "system_prompt_teste": "Você é o Agente de Planejamento (VERSÃO DE TESTE). Sua função é criar planos de longo prazo. Status atual: Aguardando implementação profunda. Sua tarefa agora: Estruture um cronograma básico (Passo 1, 2 e 3) com base no que o Junior roteou para você.",
  "versao": "test"
}
```

**Caminho:** `server/src/agents/contratos/`

---

### Tarefa 0.4: Criar Arquivos de Conteúdo dos Prompts

**O que será feito:**
- Criar pasta `server/src/agents/jsons/prompts/`
- Criar um arquivo JSON por prompt listado em `prompts_orquestracao.json`

**Estrutura de cada arquivo:**
```json
{
  "id": "p_metodologia_50_30_20",
  "versao": "test",
  "system_prompt": "/* ARQUIVO DE TESTE */\n\nVocê recebeu uma query sobre organização de orçamento pessoal.\n\nSeu papel como coordenador:\n1. Aplicar a metodologia 50/30/20 (50% necessidades, 30% desejos, 20% poupança)\n2. Analisar o perfil de gastos do usuário baseado no contexto fornecido\n3. Sugerir ajustes práticos e realistas\n\nDomínio recebido: [será injetado pelo sistema]\nContexto da conversa: [será injetado pelo sistema]\n\nResponda de forma estruturada e acionável."
}
```

**Arquivos a Criar:**
| ID do Prompt | Nome do Arquivo |
|--------------|-----------------|
| `p_metodologia_50_30_20` | `p_metodologia_50_30_20.json` |
| `p_estrategia_agressiva` | `p_estrategia_agressiva.json` |
| `p_quitacao_dividas` | `p_quitacao_dividas.json` |
| `p_analise_detalhada` | `p_analise_detalhada.json` |
| `p_comparacao_opcoes` | `p_comparacao_opcoes.json` |
| `p_plano_passo_a_passo` | `p_plano_passo_a_passo.json` |
| `p_balanceamento_carteira` | `p_balanceamento_carteira.json` |
| `p_reserva_emergencia` | `p_reserva_emergencia.json` |

**Dicas práticas:**
- Prompts de teste devem ser funcionais mas simples (50-100 palavras)
- Usar placeholders claros: `[será injetado pelo sistema]`
- Foco em validar o fluxo, não a qualidade final do prompt
- Todos os arquivos devem ter `"versao": "test"`

**Caminho:** `server/src/agents/jsons/prompts/`

---

### ✅ Checklist da Fase 0

- [ ] `dominios.json` expandido para 8-10 domínios
- [ ] `prompts_orquestracao.json` expandido para 5-8 prompts com `aplicavel_a`
- [ ] `coord_analises.json` atualizado com `dominios_atendidos` e `system_prompt_teste`
- [ ] `coord_investimentos.json` atualizado com `dominios_atendidos` e `system_prompt_teste`
- [ ] `coord_planejamentos.json` atualizado com `dominios_atendidos` e `system_prompt_teste`
- [ ] Pasta `prompts/` criada com arquivos individuais de cada prompt
- [ ] Todos os JSONs validados com linter (sem erros de sintaxe)

---

## 🎯 Objetivo 1: Sistema de Classificação Primária

**Descrição:** Implementar módulo de triagem inicial que classifica todas as queries em quatro categorias: Trivial, Lançamento, Simplista ou Complexa usando GPT-5 Mini.

**Pré-requisitos:** ✅ Fase 0 concluída

### Tarefa 1.1: Criar Constantes e Enums

**O que será feito:**
- Definir constantes para categorias de classificação
- Criar enum para políticas de memória

**Código a implementar:**
```javascript
// No início do arquivo junior-agent.js
const CATEGORIES = {
  TRIVIAL: 'trivial',
  LANCAMENTO: 'lancamento',
  SIMPLISTA: 'simplista',
  COMPLEXA: 'complexa'
};

const MEMORY_POLICY = {
  NONE: 'none',           // Não carrega nem salva
  READ_ONLY: 'read_only', // Carrega mas não salva
  READ_WRITE: 'read_write' // Carrega e salva
};
```

**Dicas práticas:**
- Usar `Object.freeze()` para prevenir modificações acidentais
- Exportar constantes para uso em outros módulos se necessário

---

### Tarefa 1.2: Criar System Prompt de Classificação

**O que será feito:**
- Novo método `_buildClassificationPrompt()` específico para classificação primária

**Comportamento esperado:**
- Prompt sem acesso à memória (stateless)
- Foco em precisão, não criatividade
- Retorno deve ser JSON estruturado

**Estrutura do prompt:**
```javascript
_buildClassificationPrompt() {
  return `### TAREFA: CLASSIFICAÇÃO DE QUERY

Você é um classificador de queries financeiras. Analise a mensagem do usuário e retorne APENAS um JSON com a categoria identificada.

## CATEGORIAS DISPONÍVEIS:

**trivial** — Saudações, agradecimentos, perguntas sobre o sistema
Exemplos: "Oi", "Obrigado", "O que você faz?", "Tchau"

**lancamento** — Registro de transações financeiras (gastos ou receitas)
Exemplos: "Gastei R$ 150 no supermercado", "Recebi meu salário de R$ 5.000", "Paguei a conta de luz"

**simplista** — Consultas diretas a dados já registrados
Exemplos: "Quanto gastei este mês?", "Qual meu saldo atual?", "Quanto tenho investido?"

**complexa** — Análises, planejamentos, estratégias ou qualquer query que exija processamento elaborado
Exemplos: "Como melhorar minhas finanças?", "Quero investir em ações", "Preciso de um plano para quitar dívidas"

## FORMATO DE RESPOSTA:

Retorne APENAS um JSON válido, sem markdown, sem explicações:
{"categoria_id": "trivial|lancamento|simplista|complexa"}

## REGRAS:
- Na dúvida entre simplista e complexa, escolha complexa
- Queries com múltiplos tópicos são complexas
- Consultas simples de saldo/valor são simplistas`;
}
```

---

### Tarefa 1.3: Criar Método de Classificação

**O que será feito:**
- Novo método `classifyQuery(message)` que retorna categoria

**Comportamento esperado:**
- Recebe apenas a mensagem (sem contexto de memória)
- Chama GPT-5 Mini com reasoning: low, verbosity: low
- Parseia JSON de resposta e valida categoria
- Retorna ID da categoria ou fallback para 'complexa' em caso de erro

**Assinatura:**
```javascript
/**
 * Classifica query em uma das 4 categorias
 * @param {string} message - Mensagem do usuário
 * @returns {Promise<string>} - ID da categoria (trivial|lancamento|simplista|complexa)
 */
async classifyQuery(message)
```

**Tratamento de erros:**
- Se JSON inválido → log + retorna 'complexa'
- Se categoria desconhecida → log + retorna 'complexa'
- Se timeout da API → log + retorna 'complexa'

**Logs esperados:**
```
[JuniorAgent] 🔵 Classificando query...
[JuniorAgent] 🔵 Categoria identificada: {categoria_id}
```

---

### Tarefa 1.4: Refatorar Método `execute()`

**O que será feito:**
- Modificar fluxo principal para executar classificação primeiro
- Implementar switch/case para cada categoria

**Fluxo proposto:**
```javascript
async execute(request) {
  const { parameters } = request;
  const { message, chatId, userId, sessionId } = parameters;

  // ETAPA 1: Classificação Primária
  const categoria = await this.classifyQuery(message);
  console.log(`[JuniorAgent] 🔵 Categoria: ${categoria}`);

  // ETAPA 2: Processamento por Categoria
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
      console.log('[JuniorAgent] 🔴 Categoria desconhecida, usando COMPLEXA');
      return await this.processComplexQuery(parameters);
  }
}
```

**Dicas práticas:**
- `processTrivialQuery()` reutiliza `processChatMessage()` existente
- `routeToLancador()` e `routeToSimplista()` são stubs por enquanto
- `processComplexQuery()` será implementado no Objetivo 2
- Manter retrocompatibilidade: se tudo falhar, usar fluxo atual

---

### Tarefa 1.5: Criar Método `processTrivialQuery()`

**O que será feito:**
- Extrair lógica de resposta trivial do método `processChatMessage()` atual

**Comportamento:**
- Carrega memória (READ_WRITE)
- Usa system prompt de resposta conversacional (atual `_buildSystemPrompt()`)
- Chama GPT-5 Mini
- Salva memória
- Retorna resposta

**Essencialmente:** É o fluxo atual renomeado, sem alterações funcionais.

---

### ✅ Checklist do Objetivo 1

- [ ] Constantes `CATEGORIES` e `MEMORY_POLICY` criadas
- [ ] Método `_buildClassificationPrompt()` implementado
- [ ] Método `classifyQuery(message)` funcional
- [ ] Método `execute()` refatorado com switch/case
- [ ] Método `processTrivialQuery()` extraído
- [ ] Stubs para `routeToLancador()` e `routeToSimplista()` criados
- [ ] Testes com 20 queries variadas (5 de cada categoria)
- [ ] Logs funcionando com emojis coloridos

---

## 🎯 Objetivo 2: Análise Secundária para Queries Complexas

**Descrição:** Desenvolver sistema que escolhe domínio, coordenador e prompts de orquestração para queries classificadas como complexas.

**Pré-requisitos:** ✅ Objetivo 1 concluído

### Tarefa 2.1: Implementar Carregamento de JSONs

**O que será feito:**
- Método `_loadJSONFiles()` que carrega todos os arquivos de configuração
- Sistema de cache para evitar I/O repetitivo

**Arquivos a carregar:**
- `dominios.json` → Lista de domínios disponíveis
- `prompts_orquestracao.json` → Índice de prompts
- `contratos/*.json` → Contratos dos 3 coordenadores

**Implementação:**
```javascript
/**
 * Carrega arquivos JSON de configuração com cache
 * @returns {Object} { dominios, prompts, contratos }
 */
_loadJSONFiles() {
  if (this._jsonCache) {
    return this._jsonCache;
  }

  const fs = require('fs');
  const path = require('path');
  const basePath = path.join(__dirname, '../../jsons');
  const contratosPath = path.join(__dirname, '../../contratos');

  // Carregar dominios
  const dominios = JSON.parse(
    fs.readFileSync(path.join(basePath, 'dominios.json'), 'utf-8')
  );

  // Carregar prompts de orquestração
  const prompts = JSON.parse(
    fs.readFileSync(path.join(basePath, 'prompts_orquestracao.json'), 'utf-8')
  );

  // Carregar contratos dos coordenadores
  const contratos = {
    analises: JSON.parse(fs.readFileSync(path.join(contratosPath, 'coord_analises.json'), 'utf-8')),
    investimentos: JSON.parse(fs.readFileSync(path.join(contratosPath, 'coord_investimentos.json'), 'utf-8')),
    planejamentos: JSON.parse(fs.readFileSync(path.join(contratosPath, 'coord_planejamentos.json'), 'utf-8'))
  };

  this._jsonCache = { dominios, prompts, contratos };
  console.log('[JuniorAgent] 📂 JSONs carregados e cacheados');
  
  return this._jsonCache;
}
```

**Dicas práticas:**
- Usar `path.join(__dirname, ...)` para caminhos relativos
- Validar que arquivos existem com `fs.existsSync()` antes de ler
- Tratar erros de parse JSON com try-catch
- Log de confirmação após carregar

---

### Tarefa 2.2: Criar System Prompt de Análise Secundária

**O que será feito:**
- Novo método `_buildSecondaryAnalysisPrompt(dominios, contratos, prompts)` 

**Comportamento:**
- Injeta conteúdo dos JSONs no prompt
- Instrui IA a escolher sequencialmente: domínio → coordenador → prompts
- Retorno deve ser JSON estruturado

**Estrutura do prompt:**
```javascript
_buildSecondaryAnalysisPrompt(dominios, contratos, prompts) {
  return `### TAREFA: ANÁLISE SECUNDÁRIA DE QUERY COMPLEXA

Você deve analisar a query do usuário e fazer três escolhas sequenciais:
1. DOMÍNIO: Qual é o tema central da query?
2. COORDENADOR: Qual agente especializado deve processar?
3. PROMPTS: Qual(is) prompt(s) de orquestração usar? (máximo 2)

## DOMÍNIOS DISPONÍVEIS:
${JSON.stringify(dominios, null, 2)}

## COORDENADORES DISPONÍVEIS:
${JSON.stringify(contratos, null, 2)}

## PROMPTS DE ORQUESTRAÇÃO:
${JSON.stringify(prompts, null, 2)}

## PROCESSO DE ESCOLHA:

1. Leia a query e identifique o DOMÍNIO principal (tema central)
2. Com base no domínio, escolha o COORDENADOR mais adequado
3. Selecione 1 prompt de orquestração (ou 2 se extremamente necessário)

## FORMATO DE RESPOSTA:

Retorne APENAS um JSON válido:
{
  "dominio_id": "id_do_dominio_escolhido",
  "coordenador_selecionado": "coord_analises|coord_investimentos|coord_planejamentos",
  "prompts_orquestracao_ids": ["id_prompt_1"] ou ["id_prompt_1", "id_prompt_2"],
  "justificativa_breve": "Uma frase explicando a escolha"
}

## REGRAS:
- Escolha apenas 1 prompt, a menos que 2 sejam realmente necessários
- O coordenador deve ter o domínio escolhido em sua lista de domínios_atendidos
- Se não encontrar domínio exato, escolha o mais próximo`;
}
```

---

### Tarefa 2.3: Criar Método de Análise Secundária

**O que será feito:**
- Novo método `analyzeComplexQuery(message, memory)` que retorna escolhas

**Comportamento:**
- Recebe mensagem E contexto de memória (para análise contextualizada)
- Carrega JSONs via `_loadJSONFiles()`
- Chama GPT-5 Mini com reasoning: low, verbosity: low
- Parseia e valida resposta JSON
- Retorna objeto com escolhas ou fallback em caso de erro

**Assinatura:**
```javascript
/**
 * Analisa query complexa e escolhe roteamento
 * @param {string} message - Mensagem do usuário
 * @param {Object} memory - Documento ConversationalMemory
 * @returns {Promise<Object>} - { dominio_id, coordenador_selecionado, prompts_orquestracao_ids }
 */
async analyzeComplexQuery(message, memory)
```

**Logs esperados:**
```
[JuniorAgent] 🟠 Iniciando análise secundária...
[JuniorAgent] 🟠 Domínio escolhido: {dominio_id}
[JuniorAgent] 🟠 Coordenador: {coordenador_selecionado}
[JuniorAgent] 🟠 Prompts: [{ids}]
```

---

### Tarefa 2.4: Criar Método `processComplexQuery()`

**O que será feito:**
- Implementar fluxo completo para queries complexas

**Fluxo:**
1. Carregar memória (READ_ONLY - coordenador salva depois)
2. Chamar `analyzeComplexQuery(message, memory)`
3. Chamar `_buildHandoverPackage()` (Objetivo 3)
4. Chamar `routeToCoordinator()` (Objetivo 3)
5. Retornar resposta do coordenador

**Implementação:**
```javascript
async processComplexQuery(params) {
  const { message, chatId, userId, sessionId } = params;

  // 1. Carregar memória
  const memory = await ConversationalMemory.findOrCreate(chatId, userId, sessionId);

  // 2. Análise secundária
  const analysis = await this.analyzeComplexQuery(message, memory);

  // 3. Montar pacote para coordenador
  const package = await this._buildHandoverPackage(analysis, memory, message);

  // 4. Rotear para coordenador
  const response = await this.routeToCoordinator(package, params);

  return response;
}
```

---

### ✅ Checklist do Objetivo 2

- [ ] Método `_loadJSONFiles()` com cache implementado
- [ ] Método `_buildSecondaryAnalysisPrompt()` criado
- [ ] Método `analyzeComplexQuery()` funcional
- [ ] Método `processComplexQuery()` integrado
- [ ] Testes com 10 queries complexas variadas
- [ ] Validação de que JSON retornado é válido
- [ ] Logs detalhados em cada etapa

---

## 🎯 Objetivo 3: Lógica de Handover para Coordenadores

**Descrição:** Criar sistema de empacotamento e envio de dados para agentes coordenadores com contexto completo.

**Pré-requisitos:** ✅ Objetivo 2 concluído

### Tarefa 3.1: Implementar Carregamento de Conteúdo de Prompts

**O que será feito:**
- Método `_loadPromptContent(promptId)` que carrega conteúdo completo de um prompt

**Implementação:**
```javascript
/**
 * Carrega conteúdo de um prompt de orquestração
 * @param {string} promptId - ID do prompt
 * @returns {string} - System prompt completo
 */
_loadPromptContent(promptId) {
  const fs = require('fs');
  const path = require('path');
  const promptPath = path.join(__dirname, '../../jsons/prompts', `${promptId}.json`);
  
  if (!fs.existsSync(promptPath)) {
    console.warn(`[JuniorAgent] ⚠️ Prompt não encontrado: ${promptId}`);
    return null;
  }

  const content = JSON.parse(fs.readFileSync(promptPath, 'utf-8'));
  return content.system_prompt;
}
```

---

### Tarefa 3.2: Criar Método de Empacotamento

**O que será feito:**
- Método `_buildHandoverPackage(analysis, memory, currentMessage)` que monta pacote completo

**Estrutura do pacote:**
```javascript
{
  system_prompt: "...",      // Prompts de orquestração concatenados
  context: "...",            // [HISTÓRICO_RESUMIDO] + [JANELA_ATUAL] + mensagem atual
  metadata: {
    dominio_id: "...",
    coordenador_id: "...",
    prompts_ids: ["..."],
    timestamp: "...",
    chatId: "...",
    userId: "...",
    sessionId: "..."
  }
}
```

**Implementação:**
```javascript
async _buildHandoverPackage(analysis, memory, currentMessage) {
  // 1. Carregar conteúdo dos prompts selecionados
  const promptContents = analysis.prompts_orquestracao_ids
    .map(id => this._loadPromptContent(id))
    .filter(Boolean);
  
  const systemPrompt = promptContents.join('\n\n---\n\n');

  // 2. Montar contexto com memória
  let context = '';
  
  if (memory.cumulativeSummary) {
    context += `[HISTÓRICO_RESUMIDO]\n${memory.cumulativeSummary}\n\n`;
  }
  
  if (memory.recentWindow?.length > 0) {
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
    timestamp: new Date().toISOString()
  };

  return { system_prompt: systemPrompt, context, metadata };
}
```

---

### Tarefa 3.3: Criar Método de Roteamento para Coordenadores

**O que será feito:**
- Método `routeToCoordinator(package, params)` que envia pacote ao coordenador

**Para fase de teste:** Usar GPT-5 Mini com system prompt do coordenador

**Implementação:**
```javascript
/**
 * Roteia pacote para coordenador apropriado
 * @param {Object} package - Pacote montado por _buildHandoverPackage
 * @param {Object} params - Parâmetros originais (chatId, userId, sessionId)
 * @returns {Promise<Object>} - Resposta do coordenador
 */
async routeToCoordinator(package, params) {
  const { metadata, system_prompt, context } = package;
  const { sessionId } = params;

  console.log(`[JuniorAgent] 📤 Roteando para: ${metadata.coordenador_id}`);

  // Carregar contrato do coordenador para obter system_prompt_teste
  const contratos = this._loadJSONFiles().contratos;
  const coordenadorKey = metadata.coordenador_id.replace('coord_', '');
  const contrato = contratos[coordenadorKey];

  if (!contrato) {
    throw new Error(`Coordenador não encontrado: ${metadata.coordenador_id}`);
  }

  // Montar system prompt completo: teste + prompts de orquestração
  const fullSystemPrompt = `${contrato.system_prompt_teste}\n\n---\n\n${system_prompt}`;

  // Chamar GPT-5 Mini como mock do coordenador
  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: fullSystemPrompt },
      { role: 'user', content: context }
    ],
    max_completion_tokens: 1500,
    verbosity: 'medium',
    reasoning_effort: 'medium'
  });

  const responseText = response.choices[0]?.message?.content?.trim();

  console.log(`[JuniorAgent] ✅ Resposta do ${metadata.coordenador_id} recebida`);

  return {
    response: responseText,
    sessionId,
    timestamp: new Date().toISOString(),
    metadata: {
      coordenador: metadata.coordenador_id,
      dominio: metadata.dominio_id,
      prompts: metadata.prompts_ids
    }
  };
}
```

---

### Tarefa 3.4: Criar Stubs para Lançador e Simplista

**O que será feito:**
- Métodos `routeToLancador()` e `routeToSimplista()` como stubs de teste

**Implementação:**
```javascript
/**
 * @todo Implementar integração real com Agente Lançador
 */
async routeToLancador(params) {
  const { message, sessionId } = params;
  console.log('[JuniorAgent] 🟡 [STUB] Roteando para Lançador');

  // Mock: retornar confirmação
  return {
    response: `[TESTE] Recebi sua transação: "${message}". Em produção, o Agente Lançador processaria e salvaria esse lançamento.`,
    sessionId,
    timestamp: new Date().toISOString(),
    metadata: { agente: 'lancador', status: 'stub' }
  };
}

/**
 * @todo Implementar integração real com Agente Simplista
 */
async routeToSimplista(params) {
  const { message, chatId, userId, sessionId } = params;
  console.log('[JuniorAgent] 🟡 [STUB] Roteando para Simplista');

  // Carregar memória para incluir contexto
  const memory = await ConversationalMemory.findOrCreate(chatId, userId, sessionId);

  // Mock: retornar confirmação com contexto
  return {
    response: `[TESTE] Recebi sua consulta: "${message}". Em produção, o Agente Simplista consultaria seus dados e retornaria o valor solicitado.`,
    sessionId,
    timestamp: new Date().toISOString(),
    metadata: { agente: 'simplista', status: 'stub', hasContext: !!memory.cumulativeSummary }
  };
}
```

---

### ✅ Checklist do Objetivo 3

- [ ] Método `_loadPromptContent()` implementado
- [ ] Método `_buildHandoverPackage()` funcional
- [ ] Método `routeToCoordinator()` funcionando com GPT-5 Mini
- [ ] Stubs `routeToLancador()` e `routeToSimplista()` criados
- [ ] Teste de fluxo completo: query complexa → classificação → análise → roteamento
- [ ] Resposta do coordenador sendo retornada corretamente
- [ ] Metadados incluídos na resposta

---

## 🎯 Objetivo 4: Adaptar Sistema de Memória

**Descrição:** Ajustar gerenciamento de memória para funcionar em todos os fluxos, preservando contexto adequado conforme tipo de query.

**Pré-requisitos:** ✅ Objetivo 3 concluído

### Tarefa 4.1: Definir Políticas de Memória por Categoria

**O que será feito:**
- Método `_getMemoryPolicy(categoria)` que retorna política apropriada

**Mapeamento de políticas:**
| Categoria | Política | Descrição |
|-----------|----------|-----------|
| Classificação | `NONE` | Não carrega nem salva (stateless) |
| Trivial | `READ_WRITE` | Carrega, processa, salva (fluxo atual) |
| Lançamento | `WRITE_ONLY` | Não envia contexto, mas salva para referência |
| Simplista | `READ_WRITE` | Carrega contexto, salva interação |
| Complexa | `READ_ONLY` | Carrega para enviar, não salva (coordenador salva) |

**Implementação:**
```javascript
_getMemoryPolicy(categoria) {
  const policies = {
    [CATEGORIES.TRIVIAL]: MEMORY_POLICY.READ_WRITE,
    [CATEGORIES.LANCAMENTO]: MEMORY_POLICY.WRITE_ONLY,
    [CATEGORIES.SIMPLISTA]: MEMORY_POLICY.READ_WRITE,
    [CATEGORIES.COMPLEXA]: MEMORY_POLICY.READ_ONLY
  };
  return policies[categoria] || MEMORY_POLICY.READ_WRITE;
}
```

---

### Tarefa 4.2: Adaptar `_updateMemory()` com Flag de Controle

**O que será feito:**
- Adicionar parâmetro `shouldSave = true` ao método `_updateMemory()`

**Implementação:**
```javascript
async _updateMemory(memory, userMessage, aiResponse, shouldSave = true) {
  try {
    // ... código existente de atualização ...

    // Salvar apenas se permitido
    if (shouldSave) {
      await memory.save();
      console.log('[JuniorAgent] 💾 Memória salva');
    } else {
      console.log('[JuniorAgent] 💾 Memória preparada (não salva - coordenador salvará)');
    }

  } catch (error) {
    console.error('[JuniorAgent] ❌ Erro ao atualizar memória:', error);
  }
}
```

---

### Tarefa 4.3: Criar Método de Recuperação de Contexto

**O que será feito:**
- Método `_getMemoryContext(chatId, userId)` que retorna contexto formatado

**Uso:** Enviar contexto para coordenadores sem duplicar lógica

**Implementação:**
```javascript
/**
 * Recupera contexto de memória formatado
 * @param {string} chatId - ID do chat
 * @param {string} userId - ID do usuário
 * @param {string} currentMessage - Mensagem atual (opcional)
 * @returns {Promise<string>} - Contexto formatado
 */
async _getMemoryContext(chatId, userId, currentMessage = null) {
  const memory = await ConversationalMemory.findByChatId(chatId);
  
  if (!memory) {
    return currentMessage ? `[MENSAGEM_ATUAL]\n${currentMessage}` : '';
  }

  let context = '';

  if (memory.cumulativeSummary) {
    context += `[HISTÓRICO_RESUMIDO]\n${memory.cumulativeSummary}\n\n`;
  }

  if (memory.recentWindow?.length > 0) {
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
}
```

---

### ✅ Checklist do Objetivo 4

- [ ] Políticas de memória definidas para cada categoria
- [ ] Método `_getMemoryPolicy()` implementado
- [ ] Método `_updateMemory()` adaptado com flag `shouldSave`
- [ ] Método `_getMemoryContext()` criado
- [ ] Teste: query trivial salva memória
- [ ] Teste: query complexa NÃO salva memória (coordenador salva)
- [ ] Teste: memória é recuperada corretamente para contexto

---

## 🎯 Objetivo 5: Integração, Testes e Validação Final

**Descrição:** Consolidar todos os componentes, executar testes end-to-end e validar funcionamento completo do sistema.

**Pré-requisitos:** ✅ Objetivos 1-4 concluídos

### Tarefa 5.1: Integrar Todos os Fluxos

**O que será feito:**
- Garantir que `execute()` orquestra corretamente todos os fluxos
- Validar transições entre etapas
- Verificar tratamento de erros em cascata

**Checklist de integração:**
- [ ] Classificação → Trivial → Resposta direta ✅
- [ ] Classificação → Lançamento → Stub do Lançador ✅
- [ ] Classificação → Simplista → Stub do Simplista ✅
- [ ] Classificação → Complexa → Análise → Handover → Coordenador ✅

---

### Tarefa 5.2: Criar Suite de Testes

**O que será feito:**
- Documentar queries de teste para cada categoria
- Validar classificações corretas
- Verificar roteamento adequado

**Queries de Teste:**

**Triviais (5):**
1. "Oi"
2. "Obrigado pela ajuda"
3. "O que você consegue fazer?"
4. "Tchau"
5. "Bom dia!"

**Lançamentos (5):**
1. "Gastei R$ 150 no supermercado"
2. "Recebi meu salário de R$ 5.000"
3. "Paguei a conta de luz, R$ 180"
4. "Comprei um tênis por R$ 299"
5. "Entrou R$ 500 de freela"

**Simplistas (5):**
1. "Quanto gastei este mês?"
2. "Qual meu saldo atual?"
3. "Quanto tenho investido?"
4. "Qual foi meu maior gasto?"
5. "Quanto economizei esse ano?"

**Complexas (5):**
1. "Como posso melhorar minhas finanças?"
2. "Quero começar a investir em ações"
3. "Preciso de um plano para quitar minhas dívidas"
4. "Como montar uma carteira de investimentos?"
5. "Quero fazer um planejamento para aposentadoria"

---

### Tarefa 5.3: Validar Logs e Observabilidade

**O que será feito:**
- Verificar que todos os logs estão funcionando
- Validar formato dos logs com emojis

**Logs esperados para query complexa:**
```
[JuniorAgent] 📨 Processando mensagem
[JuniorAgent] 🔵 Classificando query...
[JuniorAgent] 🔵 Categoria: complexa
[JuniorAgent] 🟠 Fluxo COMPLEXA
[JuniorAgent] 💾 Memória carregada
[JuniorAgent] 🟠 Iniciando análise secundária...
[JuniorAgent] 📂 JSONs carregados e cacheados
[JuniorAgent] 🟠 Domínio: planejamento_financeiro_longoprazo
[JuniorAgent] 🟠 Coordenador: coord_planejamentos
[JuniorAgent] 🟠 Prompts: [p_plano_passo_a_passo]
[JuniorAgent] 📤 Roteando para: coord_planejamentos
[JuniorAgent] ✅ Resposta do coord_planejamentos recebida
```

---

### Tarefa 5.4: Documentar Sistema Finalizado

**O que será feito:**
- Atualizar README do agente junior
- Documentar API e fluxos
- Listar arquivos modificados/criados

**Estrutura final de arquivos:**
```
server/src/agents/
├── contratos/
│   ├── coord_analises.json      (atualizado)
│   ├── coord_investimentos.json (atualizado)
│   └── coord_planejamentos.json (atualizado)
├── jsons/
│   ├── dominios.json            (expandido)
│   ├── prompts_orquestracao.json (expandido)
│   └── prompts/                  (NOVO)
│       ├── p_metodologia_50_30_20.json
│       ├── p_estrategia_agressiva.json
│       ├── p_quitacao_dividas.json
│       ├── p_analise_detalhada.json
│       ├── p_comparacao_opcoes.json
│       ├── p_plano_passo_a_passo.json
│       ├── p_balanceamento_carteira.json
│       └── p_reserva_emergencia.json
└── junior/
    └── junior/
        └── junior-agent.js       (refatorado)
```

---

### ✅ Checklist do Objetivo 5

- [ ] Todos os fluxos integrados e funcionando
- [ ] 20 queries de teste executadas com sucesso
- [ ] Classificações corretas em 90%+ dos casos
- [ ] Análise secundária retornando JSON válido
- [ ] Coordenadores recebendo pacotes completos
- [ ] Memória sendo gerenciada corretamente por categoria
- [ ] Logs completos e informativos
- [ ] README atualizado com documentação final

---

## 📋 Resumo da Ordem de Execução

| Fase | Objetivo | Descrição | Dependência |
|------|----------|-----------|-------------|
| 0 | Infraestrutura | Preparar JSONs de configuração | Nenhuma |
| 1 | Classificação | Sistema de triagem primária | Fase 0 |
| 2 | Análise | Escolha de domínio/coordenador/prompts | Objetivo 1 |
| 3 | Handover | Empacotamento e roteamento | Objetivo 2 |
| 4 | Memória | Políticas por categoria | Objetivo 3 |
| 5 | Integração | Testes e validação final | Objetivos 1-4 |

---

## 🔧 Notas Técnicas

### Considerações de Performance
- Cache de JSONs evita I/O repetitivo (economia ~50ms por request)
- Classificação: ~500ms (GPT-5 Mini, reasoning: low)
- Análise secundária: ~1s (GPT-5 Mini, reasoning: low)
- Roteamento para coordenador: ~2s (GPT-5 Mini, reasoning: medium)
- Total para query complexa: ~3.5s

### Compatibilidade
- ✅ Fluxo atual (Trivial) continua funcionando sem alterações
- ✅ Testes existentes de memória não quebram
- ✅ API externa (`/api/chat/process`) mantém mesma interface
- ✅ Novos fluxos são adição, não substituição

### Custos Estimados (GPT-5)
- **Classificação**: ~$0.10 por 1M tokens (prompt curto)
- **Análise secundária**: ~$0.15 por 1M tokens (prompt com JSONs)
- **Coordenador (teste)**: ~$0.10 por 1M tokens
- Total por query complexa: ~$0.0001 (estimativa)

---

**Arquivo de Referência:**
- Código atual: `server/src/agents/junior/junior/junior-agent.js`
- Documentação: `docs/junior-agent.md`, `server/src/agents/junior/junior/README.md`
