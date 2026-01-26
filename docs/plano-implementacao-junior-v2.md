# Plano de Implementação — Agente Junior V2

**Versão:** 2.0  
**Data:** 26/01/2026  
**Objetivo Geral:** Transformar o agente júnior de assistente único em sistema inteligente de triagem e roteamento multi-agente, preservando memória persistente.

---

## Objetivo 1: Criar Sistema de Classificação Primária

**Descrição:** Implementar módulo de triagem inicial que classifica todas as queries em quatro categorias: Trivial, Lançamento, Simplista ou Complexa usando GPT-5 Mini.

### Tarefa 1.1: Criar Método de Classificação Primária

**O que será feito:**
- Novo método `classifyQuery()` no JuniorAgent que recebe mensagem e retorna categoria (ID)

**Como será feito:**
- Criar system prompt específico para classificação com exemplos das 4 categorias
- Configurar GPT-5 Mini com `reasoning: low` e `verbosity: low`
- Retornar JSON estruturado: `{ "categoria_id": "trivial|lancamento|simplista|complexa" }`
- Método não acessa memória (classificação baseada apenas na mensagem atual)

**Dicas práticas:**
- Use temperatura zero ou reasoning baixo para classificação consistente
- Inclua no prompt 3-5 exemplos de cada categoria
- Valide que o retorno seja JSON válido com try-catch
- Log da classificação para debug: `console.log('[Classificação]', categoria_id)`

### Tarefa 1.2: Adaptar Fluxo de Execução Principal

**O que será feito:**
- Modificar método `execute()` para executar classificação antes de processar resposta

**Como será feito:**
- Chamar `classifyQuery()` primeiro (retorna ID)
- Criar switch/case baseado no ID retornado
- Se "trivial": continua com fluxo atual (`processChatMessage()`)
- Se "lancamento", "simplista" ou "complexa": chama métodos específicos (próximas etapas)
- Preservar parâmetros `chatId`, `userId`, `sessionId` em todos os fluxos

**Dicas práticas:**
- Use constants para IDs: `const CATEGORIES = { TRIVIAL: 'trivial', ... }`
- Mantenha tratamento de erro robusto para cada branch
- Log do fluxo escolhido antes de executar
- Não quebre a compatibilidade com testes existentes de memória

---

## Objetivo 2: Implementar Análise Secundária para Queries Complexas

**Descrição:** Desenvolver sistema em duas etapas que escolhe domínio, coordenador e prompts de orquestração para queries classificadas como complexas usando arquivos JSON.

### Tarefa 2.1: Criar Método de Análise Secundária

**O que será feito:**
- Novo método `analyzeComplexQuery()` que recebe mensagem e contexto de memória

**Como será feito:**
- Carregar 3 arquivos JSON: dominios.json, contratos dos coordenadores, prompts_orquestracao.json
- Criar system prompt que instrui IA a escolher sequencialmente: domínio → coordenador → prompts (1 ou 2)
- Configurar GPT-5 Mini com `reasoning: low`, `verbosity: low`
- Enviar contexto completo (resumo + janela atual) para análise contextualizada
- Retornar JSON estruturado: `{ "dominio_id": "...", "coordenador_selecionado": "...", "prompts_orquestracao_ids": ["..."] }`

**Dicas práticas:**
- Use `JSON.stringify()` para injetar conteúdo dos arquivos no prompt
- Valide que array `prompts_orquestracao_ids` tenha 1 ou 2 elementos apenas
- Adicione instruções claras: "Escolha 1 prompt, ou no máximo 2 se extremamente necessário"
- Teste com queries ambíguas para validar escolhas

### Tarefa 2.2: Criar System Prompts Específicos

**O que será feito:**
- Três system prompts independentes: classificação, resposta trivial e análise secundária

**Como será feito:**
- Extrair prompt atual para `_buildSystemPrompt('trivial_response')`
- Criar `_buildSystemPrompt('classification')` sem contexto de memória
- Criar `_buildSystemPrompt('secondary_analysis')` com instruções de escolha de domínio/coordenador
- Cada prompt deve ter propósito único e instruções específicas
- Usar parâmetro para selecionar qual prompt retornar

**Dicas práticas:**
- Mantenha prompts em métodos privados organizados
- Classifição: foco em precisão, sem criatividade
- Análise secundária: instruções passo a passo (domínio → coordenador → prompts)
- Documente com comentários JSDoc o propósito de cada prompt

### Tarefa 2.3: Implementar Leitura de Arquivos JSON

**O que será feito:**
- Método auxiliar `_loadJSONFiles()` que carrega dominios, contratos e prompts de orquestração

**Como será feito:**
- Usar `fs.readFileSync()` com caminhos absolutos usando `path.join(__dirname, ...)`
- Criar cache em memória para evitar leitura repetida (variável de classe)
- Retornar objeto com 3 propriedades: `{ dominios, contratos, prompts }`
- Tratar erros de leitura e validar JSON

**Dicas práticas:**
- Cache: `if (!this._jsonCache) { this._jsonCache = loadFiles(); }`
- Use `path.resolve()` para garantir caminhos corretos no Windows/Linux
- Valide que arquivos existem antes de ler: `fs.existsSync()`
- Log de confirmação após carregar JSONs

---

## Objetivo 3: Criar Estrutura JSON para Roteamento

**Descrição:** Desenvolver arquivos JSON de teste com domínios, contratos dos coordenadores e prompts de orquestração para validar fluxo completo de roteamento.

### Tarefa 3.1: Criar Arquivos JSON de Domínios

**O que será feito:**
- Arquivo `dominios.json` com lista de IDs e descrições dos domínios disponíveis

**Como será feito:**
- Estrutura array de objetos: `[{ "id": "gestao_orcamento_pessoal", "descricao": "..." }]`
- Incluir 8-10 domínios representativos do README
- Descrições curtas (1-2 linhas) explicando quando usar cada domínio
- Usar snake_case para IDs

**Dicas práticas:**
- Comece com domínios mais frequentes (orçamento, investimentos básicos)
- Descrições devem ser direcionais: "Use quando usuário quer..."
- Valide JSON com linter antes de salvar
- Mantenha arquivo organizado e com indentação de 2 espaços

### Tarefa 3.2: Criar Contratos dos Coordenadores

**O que será feito:**
- Três arquivos JSON na pasta `contratos/`: coord_analises.json, coord_investimentos.json, coord_planejamentos.json

**Como será feito:**
- Estrutura: `{ "id": "...", "nome": "...", "especialidade": "...", "domínios_atendidos": [...] }`
- Campo `domínios_atendidos` lista IDs de domínios que o coordenador pode processar
- Campo `especialidade` descreve em 2-3 linhas o que o coordenador faz
- Para teste: usar system prompts básicos fornecidos no README

**Dicas práticas:**
- Cada coordenador deve cobrir 3-4 domínios distintos
- Evite sobreposição excessiva de domínios entre coordenadores
- Use IDs consistentes: `analises`, `investimentos`, `planejamentos`
- Adicione campo `versao: "test"` para marcar como temporário

### Tarefa 3.3: Criar Prompts de Orquestração

**O que será feito:**
- Arquivo `prompts_orquestracao.json` com lista de IDs e descrições dos prompts disponíveis

**Como será feito:**
- Estrutura: `[{ "id": "...", "titulo": "...", "descricao": "...", "aplicavel_a": [...] }]`
- Campo `aplicavel_a` lista coordenadores compatíveis
- Criar 5-8 prompts genéricos (ex: análise_detalhada, comparacao_opcoes, plano_passo_a_passo)
- Conteúdo real dos prompts ficará em arquivos separados (próxima tarefa)

**Dicas práticas:**
- Descrições devem explicar quando o prompt é útil
- Um prompt pode ser aplicável a múltiplos coordenadores
- IDs devem ser autoexplicativos
- Marque como teste: `"versao": "test"`

### Tarefa 3.4: Criar Conteúdo dos Prompts de Orquestração

**O que será feito:**
- Arquivos individuais com system prompts completos (ex: `analise_detalhada.json`)

**Como será feito:**
- Um arquivo JSON por prompt listado em `prompts_orquestracao.json`
- Estrutura: `{ "id": "analise_detalhada", "system_prompt": "..." }`
- Para teste: prompts genéricos (50-100 palavras) descrevendo papel do coordenador
- Usar linguagem direta: "Você é o coordenador X. Sua tarefa é..."

**Dicas práticas:**
- Mantenha prompts de teste simples e funcionais
- Foco em validar o fluxo, não a qualidade final do prompt
- Adicione comentário no início: `/* ARQUIVO DE TESTE */`
- Use templates: "Você recebeu: [domínio] + [contexto] → Faça..."

---

## Objetivo 4: Implementar Lógica de Handover para Coordenadores

**Descrição:** Criar sistema de empacotamento e envio de dados para agentes coordenadores com contexto completo (memória + prompts selecionados).

### Tarefa 4.1: Criar Método de Empacotamento

**O que será feito:**
- Método `_buildHandoverPackage()` que monta pacote completo para coordenador

**Como será feito:**
- Recebe: `dominio_id`, `coordenador_id`, `prompts_ids`, `memory`, `currentMessage`
- Carrega conteúdo dos prompts de orquestração selecionados
- Monta system prompt composto: conteúdo dos prompts + instruções do coordenador
- Monta contexto: `[HISTÓRICO_RESUMIDO]` + `[JANELA_ATUAL]` + mensagem atual
- Retorna objeto: `{ system_prompt, context, metadata: { dominio, coordenador, ... } }`

**Dicas práticas:**
- Concatenar prompts com separador: `\n\n---\n\n`
- Incluir metadados no pacote para rastreabilidade
- Validar que todos os prompts_ids existem antes de montar
- Reutilizar método `_buildPromptWithMemory()` para contexto

### Tarefa 4.2: Criar Métodos de Roteamento

**O que será feito:**
- Métodos stub para cada tipo de destino: `routeToLancador()`, `routeToSimplista()`, `routeToCoordinator()`

**Como será feito:**
- Cada método recebe pacote apropriado e parâmetros de sessão
- Para fase de teste: usar agentes mock (GPT-5 Mini com prompts básicos)
- Estrutura de retorno padronizada: `{ response, metadata, timestamp }`
- Adicionar logs de rastreamento: `[Roteamento → Coordenador]`

**Dicas práticas:**
- Marque métodos como stubs no JSDoc: `@todo Implementar integração real`
- Para teste: retornar mensagem confirmando recebimento + listar dados recebidos
- Use Promise.resolve() para manter interface assíncrona
- Preparar interface para futura integração com Message Bus

### Tarefa 4.3: Integrar Fluxo Completo

**O que será feito:**
- Conectar classificação → análise secundária → empacotamento → roteamento

**Como será feito:**
- No `execute()`, adicionar case "complexa" que chama `analyzeComplexQuery()`
- Pegar resultado da análise e chamar `_buildHandoverPackage()`
- Chamar `routeToCoordinator()` com pacote montado
- Retornar resposta do coordenador ao usuário
- Preservar `sessionId` e `chatId` em toda cadeia

**Dicas práticas:**
- Use try-catch em cada etapa com logs específicos
- Teste cada etapa isoladamente antes de integrar
- Validar dados entre etapas: classificação válida? JSONs carregados? Pacote completo?
- Adicionar timeouts para evitar travamentos

---

## Objetivo 5: Adaptar Sistema de Memória para Novo Fluxo

**Descrição:** Ajustar gerenciamento de memória para funcionar em todos os fluxos, preservando contexto adequado conforme tipo de query.

### Tarefa 5.1: Definir Política de Memória por Categoria

**O que será feito:**
- Documentar e implementar regras de quando carregar/salvar memória em cada fluxo

**Como será feito:**
- **Classificação**: Não carrega nem salva memória (stateless)
- **Trivial**: Carrega memória, processa, salva (fluxo atual mantido)
- **Lançamento**: Não envia contexto, mas salva interação para futura referência
- **Simplista**: Carrega memória, envia contexto completo, salva interação
- **Complexa**: Carrega memória, envia para coordenador, NÃO salva (coordenador salva depois)

**Dicas práticas:**
- Criar enum: `const MEMORY_POLICY = { NONE: 0, READ: 1, READ_WRITE: 2 }`
- Adicionar método: `_getMemoryPolicy(categoria)` que retorna política
- Documentar no README do agente junior as políticas
- Considerar flag `preserveMemory` em cada roteamento

### Tarefa 5.2: Adaptar Método de Atualização

**O que será feito:**
- Modificar `_updateMemory()` para aceitar flag indicando se deve salvar ou não

**Como será feito:**
- Adicionar parâmetro opcional: `shouldSave = true`
- Se `shouldSave === false`: apenas atualiza objeto em memória, não chama `save()`
- Manter lógica de resumo mesmo quando não salva (prepara para próxima interação)
- Adicionar log indicando se salvou ou apenas preparou

**Dicas práticas:**
- Não quebrar comportamento padrão (default = salva)
- Use: `await this._updateMemory(memory, msg, resp, false)` para não salvar
- Útil para queries complexas onde coordenador gerencia memória
- Teste cenário: query complexa não deve duplicar salvamento

### Tarefa 5.3: Criar Método de Recuperação de Contexto

**O que será feito:**
- Método auxiliar `_getMemoryContext()` que retorna contexto formatado sem processar mensagem

**Como será feito:**
- Recebe `chatId` e `userId`, carrega memória
- Retorna string formatada: `[HISTÓRICO_RESUMIDO] + [JANELA_ATUAL]`
- Não adiciona nova mensagem, apenas monta contexto existente
- Útil para enviar contexto aos coordenadores sem duplicar lógica

**Dicas práticas:**
- Reutilizar lógica de `_buildPromptWithMemory()` sem parte da mensagem atual
- Método pode ser static se não usar estado interno
- Adicionar parâmetro opcional `includeCurrentMessage` para flexibilidade
- Teste: verificar que contexto enviado ao coordenador está completo

---

## Notas de Implementação

### Ordem Recomendada de Desenvolvimento
1. **Objetivo 3** (JSONs) → Preparar dados de teste primeiro
2. **Objetivo 1** (Classificação) → Base do sistema de triagem
3. **Objetivo 2** (Análise Secundária) → Lógica de escolha inteligente
4. **Objetivo 5** (Memória) → Adaptar gerenciamento de contexto
5. **Objetivo 4** (Handover) → Integração final com coordenadores

### Testes Progressivos
- **Após Objetivo 1:** Testar classificação com 20 queries variadas
- **Após Objetivo 2:** Validar que análise secundária retorna JSON válido
- **Após Objetivo 3:** Carregar JSONs manualmente e inspecionar estrutura
- **Após Objetivo 4:** Testar fluxo completo: query → classificação → análise → roteamento → resposta mock
- **Após Objetivo 5:** Verificar que memória é preservada corretamente em todos os fluxos

### Compatibilidade
- ✅ Fluxo atual (Trivial) deve continuar funcionando sem alterações
- ✅ Testes existentes de memória não devem quebrar
- ✅ API externa (`/api/chat/process`) mantém mesma interface
- ✅ Novos fluxos são adição, não substituição

### Monitoramento e Debug
- Adicionar logs em cada transição: `[Classificação] → [Análise] → [Roteamento]`
- Incluir IDs de categoria/domínio/coordenador em todos os logs
- Medir latência de cada etapa: classificação (~500ms), análise (~1s), roteamento (variável)
- Console colorido: 🔵 classificação, 🟢 trivial, 🟡 simplista, 🟠 complexa, 🔴 erro

### Considerações de Performance
- Cache de JSONs evita I/O repetitivo (economia ~50ms por request)
- Classificação e análise são sequenciais (custo ~1.5s total para query complexa)
- Considerar paralelização futura: classificação + carregamento de memória
- Resumo continua sendo gatilhado apenas quando necessário (> 4 mensagens)

---

**Próximos Passos Imediatos:**
1. Criar arquivos JSON de teste (Objetivo 3)
2. Implementar método `classifyQuery()` (Objetivo 1, Tarefa 1.1)
3. Testar classificação isoladamente com 10 queries de cada categoria
4. Integrar ao fluxo principal com logs detalhados
5. Continuar implementação sequencial conforme ordem recomendada

---

**Arquivo de Referência:**
- Código atual: `server/src/agents/junior/junior/junior-agent.js`
- Documentação: `docs/junior-agent.md`, `server/src/agents/junior/junior/README.md`
