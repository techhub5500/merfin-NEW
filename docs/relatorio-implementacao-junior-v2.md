# Relatório de Implementação — Agente Junior V2 (Fase 0 + Objetivos 1, 2 e 3)

**Data:** 27/01/2026  
**Versão:** 2.1  
**Status:** ✅ Implementação Concluída (Fase 0 a Objetivo 3)

---

## 📋 Resumo Executivo

Foi implementada a fundação completa do sistema de triagem inteligente do Agente Junior, transformando-o de um assistente único em uma porta de entrada para um sistema multi-agente. O sistema agora classifica queries, analisa contexto e roteia para coordenadores especializados.

---

## ✅ O Que Foi Implementado

### Fase 0: Infraestrutura de Dados

#### Tarefa 0.1: Expandir `dominios.json`
- **Arquivo:** `server/src/agents/jsons/dominios.json`
- **Alteração:** Expandido de 5 para 8 domínios financeiros
- **Domínios adicionados:**
  - `comparacao_ferramentas_financeiras`
  - `analise_inflacao_investimentos`
  - `planejamento_financeiro_integrado`
- **Formato:** Descrições direcionais ("Use quando o usuário quer...")

#### Tarefa 0.2: Expandir `prompts_orquestracao.json`
- **Arquivo:** `server/src/agents/jsons/prompts_orquestracao.json`
- **Alteração:** Expandido de 3 para 8 prompts de orquestração
- **Prompts adicionados:**
  - `p_analise_detalhada`
  - `p_comparacao_opcoes`
  - `p_plano_passo_a_passo`
  - `p_balanceamento_carteira`
  - `p_reserva_emergencia`
- **Campos adicionados:** `titulo`, `aplicavel_a`, `versao`

#### Tarefa 0.3: Atualizar Contratos dos Coordenadores
- **Arquivos atualizados:**
  - `server/src/agents/contratos/coord_analises.json`
  - `server/src/agents/contratos/coord_investimentos.json`
  - `server/src/agents/contratos/coord_planejamentos.json`
- **Campos adicionados:**
  - `dominios_atendidos` — Lista de domínios que cada coordenador processa
  - `system_prompt_teste` — Prompt para fase de teste
  - `versao: "test"`

#### Tarefa 0.4: Criar Pasta `prompts/`
- **Pasta criada:** `server/src/agents/jsons/prompts/`
- **8 arquivos criados:**
  - `p_metodologia_50_30_20.json`
  - `p_estrategia_agressiva.json`
  - `p_quitacao_dividas.json`
  - `p_analise_detalhada.json`
  - `p_comparacao_opcoes.json`
  - `p_plano_passo_a_passo.json`
  - `p_balanceamento_carteira.json`
  - `p_reserva_emergencia.json`
- **Cada arquivo contém:** `id`, `versao`, `system_prompt` completo para teste

---

### Objetivo 1: Sistema de Classificação Primária

#### Implementações no `junior-agent.js`:

1. **Constantes e Enums:**
   ```javascript
   const CATEGORIES = Object.freeze({
     TRIVIAL: 'trivial',
     LANCAMENTO: 'lancamento',
     SIMPLISTA: 'simplista',
     COMPLEXA: 'complexa'
   });

   const MEMORY_POLICY = Object.freeze({
     NONE: 'none',
     READ_ONLY: 'read_only',
     WRITE_ONLY: 'write_only',
     READ_WRITE: 'read_write'
   });
   ```

2. **Método `classifyQuery(message)`:**
   - Recebe mensagem do usuário
   - Chama GPT-5 Mini com `reasoning: low`, `verbosity: low`
   - Retorna categoria identificada
   - Fallback para 'complexa' em caso de erro

3. **Método `_buildClassificationPrompt()`:**
   - System prompt específico para classificação
   - Exemplos claros de cada categoria
   - Regras de desempate

4. **Método `execute()` Refatorado:**
   - Chama `classifyQuery()` primeiro
   - Switch/case para roteamento por categoria
   - Tratamento de erros com fallback

5. **Método `processTrivialQuery()`:**
   - Delega para `processChatMessage()` (fluxo original)
   - Mantém compatibilidade com sistema de memória

---

### Objetivo 2: Análise Secundária para Queries Complexas

1. **Método `_loadJSONFiles()`:**
   - Carrega `dominios.json`, `prompts_orquestracao.json` e contratos
   - Sistema de cache para evitar I/O repetitivo
   - Tratamento de erros com fallback seguro

2. **Método `_buildSecondaryAnalysisPrompt()`:**
   - Injeta JSONs no prompt
   - Instrui IA a escolher: domínio → coordenador → prompts
   - Considera contexto de memória

3. **Método `analyzeComplexQuery(message, memory)`:**
   - Recebe mensagem e memória
   - Chama GPT-5 Mini para análise
   - Retorna: `{ dominio_id, coordenador_selecionado, prompts_orquestracao_ids }`

4. **Método `processComplexQuery(params)`:**
   - Orquestra fluxo completo de query complexa
   - Carrega memória → Análise → Handover → Roteamento

5. **Método `_getDefaultAnalysis()`:**
   - Fallback com valores padrão para erros

---

### Objetivo 3: Lógica de Handover para Coordenadores

1. **Método `_loadPromptContent(promptId)`:**
   - Carrega conteúdo de um prompt específico da pasta `prompts/`

2. **Método `_buildHandoverPackage()`:**
   - Monta pacote completo para coordenador
   - Estrutura:
     ```javascript
     {
       system_prompt: "...",  // Prompts de orquestração concatenados
       context: "...",        // [HISTÓRICO_RESUMIDO] + [JANELA_ATUAL] + mensagem
       metadata: { ... }      // Metadados para rastreabilidade
     }
     ```

3. **Método `routeToCoordinator(handoverPackage, params)`:**
   - Carrega contrato do coordenador
   - Monta system prompt completo (teste + orquestração)
   - Chama GPT-5 Mini como mock do coordenador
   - Retorna resposta com metadados

4. **Stubs para Lançador e Simplista:**
   - `routeToLancador(params)` — Retorna mensagem de teste
   - `routeToSimplista(params)` — Retorna mensagem de teste com indicação de contexto

---

## 📁 Estrutura Final de Arquivos

```
server/src/agents/
├── contratos/
│   ├── coord_analises.json      ✅ Atualizado
│   ├── coord_investimentos.json ✅ Atualizado
│   └── coord_planejamentos.json ✅ Atualizado
├── jsons/
│   ├── dominios.json            ✅ Expandido (8 domínios)
│   ├── prompts_orquestracao.json ✅ Expandido (8 prompts)
│   └── prompts/                  ✅ NOVA PASTA
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
        └── junior-agent.js       ✅ Refatorado (~1160 linhas)
```

---

## ⚠️ Mudanças Importantes

### Alterações no Fluxo Original

1. **Método `execute()`:** Agora faz classificação antes de processar
2. **Imports adicionados:** `fs` e `path` para manipulação de arquivos
3. **Nova propriedade:** `this._jsonCache` para cache de JSONs

### Compatibilidade Mantida

- ✅ Fluxo trivial funciona igual ao anterior
- ✅ Sistema de memória persistente inalterado
- ✅ API externa (`/api/chat/process`) mantém mesma interface
- ✅ Método `processChatMessage()` preservado

---

## 🧪 Testes que VOCÊ Precisa Fazer

### 1. Teste de Classificação

Execute queries de cada categoria e verifique nos logs:

**Triviais (devem retornar 'trivial'):**
- "Oi"
- "Obrigado pela ajuda"
- "O que você consegue fazer?"
- "Tchau"
- "Bom dia!"

**Lançamentos (devem retornar 'lancamento'):**
- "Gastei R$ 150 no supermercado"
- "Recebi meu salário de R$ 5.000"
- "Paguei a conta de luz, R$ 180"

**Simplistas (devem retornar 'simplista'):**
- "Quanto gastei este mês?"
- "Qual meu saldo atual?"
- "Quanto tenho investido?"

**Complexas (devem retornar 'complexa'):**
- "Como posso melhorar minhas finanças?"
- "Quero começar a investir em ações"
- "Preciso de um plano para quitar minhas dívidas"

### 2. Teste de Análise Secundária

Para queries complexas, verifique nos logs:
- `[JuniorAgent] 🟠 Análise secundária concluída: { dominio_id, coordenador_selecionado, prompts_orquestracao_ids }`
- O `dominio_id` deve ser um dos 8 domínios disponíveis
- O `coordenador_selecionado` deve ser um dos 3 coordenadores (coord_analises, coord_investimentos, coord_planejamentos)
- Os `prompts_orquestracao_ids` devem ser válidos (estão em `prompts_orquestracao.json`)

### 3. Teste de Handover

Verifique se a resposta do coordenador contém:
- Log `[JuniorAgent] 📤 Roteando para: {coord_id}`
- Log `[JuniorAgent] 🚀 Enviando para coordenador...`
- Log `[JuniorAgent] ✅ Resposta do {coord_id} recebida em {Xms}ms`
- Resposta coerente do GPT-5 Mini (não deve ser vazia)
- Metadados no retorno com campos: `coordenador_id`, `dominio`, `handover_timestamp`

### 4. Teste de Stubs (Lançador e Simplista)

Para queries de **lançamento**:
- Log `[JuniorAgent] 🟡 [STUB] Roteando para Lançador`
- Resposta deve começar com `[MODO TESTE]`
- `metadata.status: 'stub'` e `metadata.tipo_stub: 'lancador'`

Para queries de **simplista**:
- Log `[JuniorAgent] 🟡 [STUB] Roteando para Simplista`
- Resposta deve começar com `[MODO TESTE]`
- `metadata.status: 'stub'` e `metadata.tipo_stub: 'simplista'`

### 5. Teste de Fallback

Simule erros e verifique:
- **Se classificação falhar:** Sistema faz fallback para 'complexa'
  - Log `[JuniorAgent] 🔴 Categoria desconhecida, usando COMPLEXA como fallback`
- **Se análise secundária falhar:** Sistema usa análise padrão
  - Log `[JuniorAgent] 🔄 Usando análise padrão (fallback)`
- **Se coordenador falhar:** Sistema faz fallback para processChatMessage
  - Log `[JuniorAgent] 🔄 Fallback para processamento trivial...`

### 6. Teste de Carregamento de JSON

Para queries complexas, verifique:
- Log `[JuniorAgent] 📂 Carregando arquivos JSON...`
- Log `[JuniorAgent] 📂 JSONs carregados e cacheados com sucesso`
- Na segunda query complexa, o cache deve ser reutilizado (mesmo log aparece 1x por session)

### 7. Teste de Montagem de Pacote

Para queries complexas, verifique:
- Log `[JuniorAgent] 📦 Montando pacote de handover...`
- Log `[JuniorAgent] 📦 Pacote montado: { context_tokens, metadata }`
- O contexto deve incluir `[HISTÓRICO_RESUMIDO]` e `[JANELA_ATUAL]` se houver histórico

---

## 🔍 Logs Esperados

### Query Trivial
```
[JuniorAgent] 📨 Processando mensagem: { userId, message: 'Oi' }
[JuniorAgent] 🔵 Classificando query...
[JuniorAgent] 🔵 Classificação bem-sucedida: trivial
[JuniorAgent] 🔵 Categoria identificada: trivial
[JuniorAgent] 🟢 Fluxo TRIVIAL
[JuniorAgent] 💾 Memória carregada: { hasSummary: false, windowSize: 0 }
[JuniorAgent] 📝 Prompt construído: { systemPromptLength, userContextLength }
[JuniorAgent] 🚀 Enviando requisição para OpenAI...
[JuniorAgent] ⏱️ Resposta recebida em ~300ms
[JuniorAgent] 💰 Tokens consumidos: { prompt_tokens, completion_tokens, total_tokens }
[JuniorAgent] ✅ Resposta gerada e memória atualizada
```

### Query Lançamento
```
[JuniorAgent] 📨 Processando mensagem: { userId, message: 'Gastei R$ 150 no supermercado' }
[JuniorAgent] 🔵 Classificando query...
[JuniorAgent] 🔵 Classificação bem-sucedida: lancamento
[JuniorAgent] 🔵 Categoria identificada: lancamento
[JuniorAgent] 🟡 Fluxo LANÇAMENTO
[JuniorAgent] 🟡 [STUB] Roteando para Lançador
[JuniorAgent] ✅ [MODO TESTE] Lançamento registrado com sucesso
```

### Query Simplista
```
[JuniorAgent] 📨 Processando mensagem: { userId, message: 'Quanto gastei este mês?' }
[JuniorAgent] 🔵 Classificando query...
[JuniorAgent] 🔵 Classificação bem-sucedida: simplista
[JuniorAgent] 🔵 Categoria identificada: simplista
[JuniorAgent] 🟡 Fluxo SIMPLISTA
[JuniorAgent] 🟡 [STUB] Roteando para Simplista
[JuniorAgent] ✅ [MODO TESTE] Extrato simplificado (contexto de memória) retornado
```

### Query Complexa
```
[JuniorAgent] 📨 Processando mensagem: { userId, message: 'Como devo distribuir minha renda?' }
[JuniorAgent] 🔵 Classificando query...
[JuniorAgent] 🔵 Classificação bem-sucedida: complexa
[JuniorAgent] 🔵 Categoria identificada: complexa
[JuniorAgent] 🟠 Fluxo COMPLEXA
[JuniorAgent] 🟠 Carregando memória para query complexa...
[JuniorAgent] 💾 Memória carregada para análise: { hasSummary: true, windowSize: 4, tokens: 1250 }
[JuniorAgent] 🟠 Iniciando análise secundária...
[JuniorAgent] 📂 Carregando arquivos JSON...
[JuniorAgent] 📂 JSONs carregados e cacheados com sucesso
[JuniorAgent] 🟠 Análise secundária concluída: { dominio_id: 'planejamento_financeiro_integrado', coordenador_selecionado: 'coord_planejamentos', prompts_orquestracao_ids: [...] }
[JuniorAgent] 📦 Montando pacote de handover...
[JuniorAgent] 📦 Pacote montado: { context_tokens: 2500, metadata: { ... } }
[JuniorAgent] 📤 Roteando para: coord_planejamentos
[JuniorAgent] 🚀 Enviando para coordenador...
[JuniorAgent] ⏱️ Resposta recebida em ~2100ms
[JuniorAgent] 💰 Tokens consumidos pelo coordenador: { prompt_tokens: 3200, completion_tokens: 1100, total_tokens: 4300 }
[JuniorAgent] ✅ Resposta do coord_planejamentos recebida em 2100ms
```

---

## 📌 Pendências para Objetivos 4 e 5

### Objetivo 4: Adaptar Sistema de Memória
- Implementar método `_getMemoryPolicy(categoria)`
- Adaptar `_updateMemory()` com flag `shouldSave`
- Criar método `_getMemoryContext()`

### Objetivo 5: Integração e Testes
- Validar fluxo completo com 20 queries
- Verificar que memória é gerenciada corretamente
- Atualizar documentação final

---

## 🐛 Possíveis Problemas e Soluções

1. **Se classificação sempre retornar 'complexa':**
   - ✅ Isso é esperado como fallback se houver erro na API ou parsing
   - ❌ Se acontecer mesmo com queries triviais, verificar:
     - Se a API OpenAI está respondendo (testar com curl)
     - Se o modelo `gpt-5-mini` existe e está disponível
     - Se o JSON retornado tem formato `{ "categoria_id": "trivial" }`
     - Se há erro no console: `❌ Erro na classificação`

2. **Se JSONs não carregarem:**
   - ❌ Você verá log: `❌ Erro ao carregar JSONs`
   - Soluções:
     - Verificar se a pasta `server/src/agents/jsons/prompts/` existe
     - Confirmar que todos os 8 arquivos `p_*.json` existem
     - Verificar se `dominios.json` e `prompts_orquestracao.json` estão em `jsons/`
     - Confirmar encoding UTF-8 em todos os arquivos
     - Verificar permissões de leitura da pasta

3. **Se coordenador não for encontrado:**
   - ❌ Você verá log: `⚠️ Contrato não encontrado`
   - Soluções:
     - Verificar se `server/src/agents/contratos/coord_*.json` existe (3 arquivos)
     - Confirmar que cada arquivo tem o campo `system_prompt_teste`
     - Verificar se `dominios_atendidos` contém domínios válidos
     - Verificar se a estrutura JSON está correta (usar jsonlint)

4. **Se memória não carregar:**
   - ❌ Você verá log: `⚠️ Erro ao carregar memória`
   - Soluções:
     - Verificar se MongoDB está conectado
     - Verificar se `ConversationalMemory` está acessível
     - Checar se o schema de memória está correto

5. **Se nenhum log aparecer:**
   - ❌ Sistema pode estar falhando silenciosamente
   - Soluções:
     - Ativar modo DEBUG: `DEBUG_MODE=true npm start`
     - Verificar arquivo de log em `log/log_*.md`
     - Verificar console do terminal para erros
     - Fazer telemetria: `curl http://localhost:3000/api/chat/process -d '{...}'`

6. **Se handover falhar para coordenador:**
   - ❌ Você verá log: `❌ Erro no roteamento para coord_xxx`
   - Soluções:
     - Verificar se GPT-5 Mini está disponível
     - Verificar se o system_prompt está bem formatado
     - Verificar se há espaço em tokens (prompt + history)
     - Confirmar que a resposta da API não está vazia

7. **Se análise secundária retornar valores inválidos:**
   - ❌ Log mostrará dominio/coordenador/prompts não reconhecidos
   - Soluções:
     - Verificar se o JSON injetado no prompt está correto
     - Verificar se a IA está conseguindo parsear os dados
     - Aumentar verbosidade do prompt de análise
     - Usar fallback padrão se houver erro no parse

---

## 📊 Métricas de Latência Esperadas

| Etapa | Tempo Esperado | Observação |
|-------|----------------|-----------|
| Classificação | ~300-500ms | Chat completion com verbosity:low |
| Carregamento de JSONs | ~10-50ms | Primeira vez; cache nas próximas |
| Análise Secundária | ~800-1200ms | Análise com JSONs injetados |
| Montagem de Handover | ~5-20ms | CPU-bound, muito rápido |
| Roteamento (Coordenador) | ~1500-2500ms | Chat completion com verbosity:medium |
| **Total Query Trivial** | ~400-700ms | Sem análise secundária |
| **Total Query Lançamento** | ~200-300ms | Stub, sem IA |
| **Total Query Simplista** | ~200-300ms | Stub, sem IA |
| **Total Query Complexa** | ~3000-4500ms | Classificação + Análise + Handover |

### Observações
- Tempos podem variar conforme latência da API OpenAI
- Cache de JSONs economiza ~50-100ms nas queries subsequentes
- Primeira query complexa será mais lenta (carregamento de JSON)
- Próximas queries usarão cache (mais rápidas)
- Se memória tiver histórico, Análise Secundária pode ser mais lenta (~100-200ms extra)

---

**Próximo Passo:** Após validar os testes, solicite a implementação dos Objetivos 4 e 5 para finalizar o sistema.
