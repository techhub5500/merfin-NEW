# Shared - Módulos Compartilhados dos Agentes

Esta pasta contém componentes fundamentais reutilizados por todos os agentes do sistema, garantindo consistência, padronização e redução de duplicação de código.

## 📋 Visão Geral da Arquitetura Atual

O sistema atualmente possui:
- **Junior Agent**: Ponto de entrada, triagem e roteamento de queries
- **Simplista Agent**: Consultas simples e informacionais (futuro)
- **Lançador Agent**: Lançamentos transacionais (futuro)
- **Data Agent**: Acesso a dados do MongoDB (implementado ✅)

Os agentes se comunicam diretamente através do serverAgent.js, sem Message Bus ou Orquestrador por enquanto. Esses componentes serão implementados em etapas futuras quando houver agentes de análise complexa (Analyst, Research, Strategist).

## Arquivos e Responsabilidades

### base-agent.js
Classe abstrata que serve como fundação para todos os agentes do sistema. Ela define o contrato padrão que cada agente deve seguir e fornece métodos auxiliares compartilhados, eliminando a necessidade de reimplementar funcionalidades comuns.

**Agentes que estendem BaseAgent:**
- `DataAgent` (implementado) - Consultas ao banco de dados
- `JuniorAgent` (próximo) - Triagem de queries
- `SimplistaAgent` (futuro) - Consultas simples
- `LançadorAgent` (futuro) - Lançamentos transacionais



Cada agente concreto estende esta classe e implementa o método `execute()`, onde fica sua lógica específica. A classe base fornece automaticamente logging estruturado, formatação padronizada de respostas, tratamento centralizado de erros e validação básica de requisições.

Quando um agente é chamado, o método `run()` da classe base gerencia todo o ciclo de vida da requisição: registra o início da operação, valida a estrutura da requisição, executa a lógica específica do agente, captura erros e formata a resposta final. Isso garante que todos os agentes se comportem de forma previsível e consistente.

A classe também gera IDs únicos para rastreamento de requisições, mede tempo de execução automaticamente e integra-se perfeitamente com os sistemas de logging e formatação de resposta. Não pode ser instanciada diretamente, apenas estendida.

### constants.js
Arquivo central que define todas as constantes utilizadas pelos agentes, funcionando como fonte única da verdade para valores configuráveis do sistema. Qualquer valor que precise ser consistente entre múltiplos agentes deve estar definido aqui.

**Constantes principais:**
- **COMPLEXITY**: Níveis de complexidade (TRIVIAL, LAUNCH, SIMPLE, COMPLEX)
- **AGENT_TYPES**: Tipos de agente (Junior, Simplista, Lançador, Data, etc)
- **TRANSACTION_CATEGORIES**: Categorias de despesas (Alimentação, Transporte, Saúde, etc)
- **DIALOG_STATE**: Estados de diálogo ativo (simplista_active, lancador_active, etc)
- **LIMITS_INTERACTION**: Limites de diálogos e tentativas
- **TIMEOUTS**: Timeouts específicos por tipo de operação
- **CACHE_TTL**: Time-to-live para diferentes tipos de cache

Os TTLs de cache são estrategicamente definidos: dados que mudam raramente (perfil do usuário) têm cache longo (30 minutos), enquanto dados voláteis (saldos) têm cache curto (1 minuto). Modificar valores aqui afeta automaticamente todo o sistema sem necessidade de alterar código dos agentes individuais.

**Importante**: Este arquivo é importado por todos os módulos do sistema. Sempre use constantes daqui ao invés de valores hardcoded.

### contracts.js
Define os contratos (schemas) de requisição e resposta para comunicação entre agentes. Utiliza a biblioteca Joi para validação rigorosa da estrutura de dados, garantindo que apenas requisições bem formadas sejam processadas.

**Estrutura de Requisição:**
```javascript
{
  request_id: "uuid",
  agent_name: "DataAgent",
  action: "fetchAccountBalance",
  parameters: { user_id: "123", account_id: "456" },
  context: { session_id: "abc", user_id: "123", toolContext: {...} }
}
```

**Estrutura de Resposta de Sucesso:**
```javascript
{
  request_id: "uuid",
  agent_name: "DataAgent",
  status: "success",
  data: { ... },
  metadata: {
    timestamp: "2026-01-23T14:32:15Z",
    execution_time_ms: 45,
    cached: false
  }
}
```

Existem dois schemas de resposta: um para sucesso e outro para erro. Respostas de erro seguem um formato específico com código de erro, mensagem, tipo e detalhes opcionais. Isso permite que o sistema e o frontend tratem erros de forma consistente, independentemente de qual agente os gerou.

As funções de validação (`validateRequest`, `validateSuccessResponse`, `validateErrorResponse`) retornam objetos indicando se a validação passou e, em caso de falha, qual foi o problema. Isso previne que requisições malformadas cheguem aos agentes e causem comportamentos inesperados.

**Comunicação Atual:** Junior Agent → Simplista/Lançador/DataAgent (direta via serverAgent.js)

### error-handler.js
Tratador centralizado de erros que converte exceções técnicas em respostas user-friendly padronizadas. Quando um erro ocorre em qualquer agente, este módulo classifica o tipo de erro, sanitiza informações sensíveis e formata uma resposta apropriada.

O arquivo define tipos de erro (validação, banco de dados, lógica de negócio, API externa, etc.) e códigos de erro padronizados (`INSUFFICIENT_BALANCE`, `INVALID_REQUEST`, `DATABASE_TIMEOUT`, etc.). Cada tipo de erro é mapeado para um código HTTP sugerido, facilitando a integração com APIs REST.

A função `classifyError()` analisa uma exceção e determina sua categoria baseada no nome da exceção, mensagem ou código customizado. Por exemplo, erros do MongoDB são classificados como `DatabaseError`, enquanto erros de validação do Mongoose são `ValidationError`. A função `handleError()` recebe um erro, classifica-o, loga detalhes completos (incluindo stack trace) e retorna uma resposta formatada.

Importante: stack traces e detalhes técnicos sensíveis nunca são expostos ao usuário final, apenas logados para debug. Isso mantém segurança e profissionalismo nas respostas. Cada erro sempre inclui o `request_id` para facilitar rastreamento em logs.

### logger.js
Sistema de logging estruturado específico para agentes, construído sobre Winston. Registra todas as ações, erros e eventos importantes com contexto rico (nome do agente, request_id, timestamp, metadados).

O logger oferece quatro níveis de log: `debug` (informações detalhadas para desenvolvimento), `info` (eventos normais do sistema), `warn` (algo inesperado mas não crítico) e `error` (falhas que impedem operações). Cada log é formatado consistentemente com timestamp, nível, agente e metadados.

Em desenvolvimento, logs são exibidos coloridos no console para facilitar leitura. Em produção, são gravados em arquivos com rotação automática: arquivo geral (`agents.log`) contém todos os níveis info e acima, enquanto arquivo específico (`agents-errors.log`) contém apenas erros. Cada arquivo tem tamanho máximo de 10MB e mantém até 5 rotações.

O formato inclui automaticamente o nome do agente que gerou o log e o request_id da operação, permitindo rastrear toda a jornada de uma requisição através de múltiplos agentes. Stack traces de erros são incluídos automaticamente. É usado internamente pelo método `_log()` da classe BaseAgent.

### response-formatter.js
Formatador universal que garante que todas as respostas de agentes sigam exatamente o mesmo formato, independentemente de qual agente as gerou. Adiciona automaticamente metadados essenciais como timestamp, tempo de execução e informações de cache.

O arquivo fornece três funções principais: `formatSuccess()` para respostas bem-sucedidas, `formatError()` para falhas e `formatPartial()` para respostas de streaming (quando o agente retorna resultados progressivamente). Cada uma adiciona os campos obrigatórios do contrato de resposta.

Respostas de sucesso sempre incluem: `request_id`, `agent_name`, `status: 'success'`, `data` (os dados retornados) e `metadata` com timestamp ISO8601, tempo de execução em milissegundos e flag indicando se veio do cache. Se aplicável, também inclui a chave do cache e TTL.

O arquivo também oferece funções auxiliares como `sanitizeData()` que remove campos sensíveis (senhas, tokens) antes de retornar dados ao cliente, e `addCacheMetadata()` que enriquece respostas com informações de cache. É usado pelos métodos `_successResponse()` e `_errorResponse()` da classe BaseAgent, garantindo uniformidade total nas respostas do sistema.

---

## 🔄 Como os Agentes se Comunicam Atualmente

### Arquitetura de Comunicação Direta (v1.0)

Atualmente, o sistema usa comunicação **direta e síncrona** entre agentes via `serverAgent.js`:

1. **Cliente** → HTTP POST → `serverAgent.js`
2. **serverAgent.js** valida requisição via `contracts.js`
3. **serverAgent.js** roteia para agente correto (DataAgent, etc)
4. **Agente** executa ação e retorna resposta formatada
5. **serverAgent.js** retorna resposta ao cliente

**Agentes Implementados:**
- ✅ **DataAgent**: Acesso completo ao MongoDB (accounts, transactions, cards, debts)

**Agentes em Planejamento:**
- 🔜 **JuniorAgent**: Triagem inicial e roteamento inteligente
- 🔜 **SimplistaAgent**: Consultas simples com diálogo limitado
- 🔜 **LançadorAgent**: Lançamentos transacionais com validação

### Futuro: Message Bus e Orquestrador (v2.0+)

Quando houver agentes de análise complexa (Analyst, Research, Strategist), será implementado:
- **Message Bus**: Sistema assíncrono de mensagens entre agentes
- **Orquestrador**: Coordenador ReAct para tarefas complexas multi-agente
- **Working Memory**: Memória compartilhada entre agentes
- **Context Builder**: Construtor de contexto unificado

Por enquanto, **não há** Message Bus ou Orquestrador. A comunicação é direta e eficiente para as operações atuais.

---

## 📊 Integração com DataAgent

O DataAgent é o único agente executor completo implementado. Ele demonstra o padrão que outros agentes devem seguir:

```javascript
class DataAgent extends BaseAgent {
  constructor(config = {}) {
    super('DataAgent', config);
    
    this.actionMap = {
      fetchAccountBalance: this.fetchAccountBalance.bind(this),
      fetchTransactions: this.fetchTransactions.bind(this),
      // ... outras ações
    };
  }
  
  async execute(request) {
    const { action, parameters, context } = request;
    
    if (!this.actionMap[action]) {
      throw new Error(`Ação "${action}" não suportada`);
    }
    
    return await this.actionMap[action](parameters, context);
  }
}
```

**Padrões estabelecidos pelo DataAgent:**
- ✅ Estende `BaseAgent`
- ✅ Define `actionMap` para roteamento interno
- ✅ Implementa `execute()` para delegar ações
- ✅ Usa cache manager integrado ao `ToolContext`
- ✅ Valida parâmetros antes de executar
- ✅ Retorna respostas formatadas via `BaseAgent`

---

## 🎯 Diretrizes para Novos Agentes

Ao criar um novo agente, siga estes passos:

### 1. Estrutura Básica
```javascript
const BaseAgent = require('../shared/base-agent');

class MeuAgente extends BaseAgent {
  constructor(config = {}) {
    super('MeuAgente', config);
    
    this.actionMap = {
      minhaAcao: this.minhaAcao.bind(this)
    };
  }
  
  async execute(request) {
    const { action, parameters, context } = request;
    
    if (!this.actionMap[action]) {
      throw new Error(`Ação "${action}" não suportada pelo MeuAgente`);
    }
    
    return await this.actionMap[action](parameters, context);
  }
  
  async minhaAcao(parameters, context) {
    // Lógica da ação
    return { resultado: "sucesso" };
  }
}
```

### 2. Registrar no serverAgent.js
```javascript
const MeuAgente = require('./src/agents/meu-agente/meu-agente');

const agents = {
  'DataAgent': new DataAgent(),
  'MeuAgente': new MeuAgente()
};
```

### 3. Adicionar constantes em constants.js
```javascript
const AGENT_ACTIONS = {
  // ...
  MeuAgente: [
    'minhaAcao',
    'outraAcao'
  ]
};
```

### 4. Usar cache quando apropriado
```javascript
async minhaAcao(parameters, context) {
  const cacheKey = `meu_agente:acao:${parameters.id}`;
  const cached = await cacheManager.get(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const result = await executarLogica();
  await cacheManager.set(cacheKey, result, CACHE_TTL.MEU_TTL);
  
  return result;
}
```

---

## 🛠️ Manutenção e Evolução

### Quando Adicionar Novos ErrorCodes
Adicione em `error-handler.js` quando houver novos tipos de erro específicos do domínio:
```javascript
const ErrorCodes = {
  // ...
  MEU_ERRO_ESPECIFICO: 'MEU_ERRO_ESPECIFICO'
};
```

### Quando Adicionar Novas Constantes
Adicione em `constants.js` quando houver valores que precisam ser consistentes entre agentes:
```javascript
const MINHA_CATEGORIA = {
  TIPO_A: 'tipo_a',
  TIPO_B: 'tipo_b'
};
```

### Quando Atualizar Contracts
Raramente necessário. Apenas se houver mudanças fundamentais na estrutura de requisição/resposta.
