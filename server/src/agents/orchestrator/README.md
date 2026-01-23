# SISTEMA MULTI-AGENTE DE IA

---

## 1. VISÃO GERAL DA ARQUITETURA

### Princípios Fundamentais

**Separação de Responsabilidades:**

- Orquestrador define OBJETIVOS ESTRATÉGICOS e escolhe coordenador líder
- Agentes Coordenadores planejam TÁTICAS, executam e consolidam autonomamente
- Agentes Executores realizam OPERAÇÕES ATÔMICAS com fallbacks
- Message Bus gerencia COMUNICAÇÃO DIRETA entre agentes

**Autonomia Real:**

- Nível 0 (Junior): autonomia para queries triviais e classificação de domínio
- Nível 1 (Orquestrador): autonomia estratégica - escolhe coordenador, fornece contexto, define objetivo
- Nível 2 (Coordenadores): autonomia tática COMPLETA - decidem como atingir objetivo sem limites externos
- Nível 3 (Executores): autonomia operacional - executam com fallbacks automáticos

**Controle por Objetivo, Não por Processo:**

- Orquestrador define O QUE precisa ser alcançado
- Coordenadores decidem COMO alcançar
- Timeout global é única restrição hard (não há limites de ciclos ou ações)
- Intervenção apenas em timeout ou falha catastrófica

---

## 2. CAMADA 0: AGENTE JUNIOR (TRIAGEM INTELIGENTE)

### Responsabilidades 
**Detecção de Queries Triviais:**

- Saudações e agradecimentos
- Perguntas sobre o próprio sistema
- Contextos simples do dia a dia
- **Acesso direto ao Serper:** Para queries triviais que precisam de dados externos (ex.: cotações, índices)
- Responde diretamente sem acionar outros agentes

**Detecção de Queries de Lançamento:**

- Identifica registro de movimentação financeira
- Encaminha diretamente ao Agente de Lançamento
- Não passa pelo orquestrador

**Detecção de Queries Simplistas:**

- Consultas operacionais diretas sobre dados financeiros pessoais
- **Acesso direto a dados externos:** Pode consultar Serper e Brapi para enriquecer respostas (ex.: cotações, indicadores básicos)
- Encaminha ao Agente Simplista
- Não passa pelo orquestrador

**Raciocínio para Classificação Simplista vs Complexa:**

Queries que parecem complexas mas são essencialmente consultas diretas de informação devem ser classificadas como simplistas se:

- **Foco em recuperação de fatos:** "Quanto tenho investido?" (soma total) vs "Como investir melhor?" (análise estratégica)
- **Cálculos básicos:** "Qual meu patrimônio líquido?" (ativos - passivos) vs "Como otimizar meu patrimônio?" (planejamento)
- **Dados agregados simples:** "Quanto economizei este ano?" (receitas - despesas) vs "Por que não economizei mais?" (diagnóstico comportamental)
- **Informações específicas:** "Quanto tenho em reserva?" (consulta direta) vs "Preciso de mais reserva?" (avaliação de adequação)
- **Listas e totais:** "Quais minhas receitas fixas?" (lista) vs "Como aumentar minhas receitas?" (estratégia)

**Exemplos de queries aparentemente complexas mas simplistas:**
- "Quanto tenho investido no total?" → Simplista (soma agregada)
- "Qual meu patrimônio líquido?" → Simplista (cálculo básico)
- "Quanto investi em renda fixa?" → Simplista (filtro e soma)
- "Quanto economizei este ano?" → Simplista (subtração simples)
- "Qual foi meu maior investimento?" → Simplista (máximo de valores)

**Quando escalar para complexo:**
- Qualquer query que implique análise, recomendação, planejamento ou diagnóstico
- "Como melhorar meus investimentos?" → Complexo (estratégia)
- "Por que minhas finanças não melhoram?" → Complexo (diagnóstico)
- "Qual o melhor investimento para mim?" → Complexo (recomendação personalizada)

**Classificação de Domínio:**

- Analisa queries complexas
- Escolhe até 2 prompts de orquestração
- Identifica até 2 CANDIDATOS a coordenador líder com score de confiança

### Novo Fluxo de Classificação

**Entrada do Agente Junior:**

- Query original do usuário

**Análise Primária:**

- É trivial? → Responde e encerra
- É lançamento? → Agente de Lançamento e encerra
- É simplista? → Agente Simplista e encerra
- É complexa? → Continua análise

---

## 2.1 SISTEMA DE CONTEXTO DE DIÁLOGO

### Modo de Resposta Direta

Quando agentes Junior, Lançador ou Simplista iniciam um diálogo para esclarecer dúvidas, o sistema ativa o **Modo de Resposta Direta**:

**Como Funciona:**
1. **Agente identifica necessidade de esclarecimento**
2. **Formula pergunta específica**
3. **Sistema marca contexto:** "diálogo_ativo: {agente}, pergunta: {conteúdo}" e envia para o usuário. A partir desse momento, o agente DeepSeek, com uma instrução básica de aproximadamente 70 palavras, vai identificar se a resposta do usuário responde à pergunta enviada ou não. Caso não, o agente DeepSeek envia para a triagem normal; caso sim, a **Próxima entrada do usuário:** Vai direto para o agente em diálogo
4. **Agente processa resposta e responde**
5. **Se resposta indica complexidade:** Reseta contexto e volta à triagem normal

**Agente DeepSeek para Detecção de Transição:**
- **System Prompt:** "Você é um agente de detecção de continuidade de diálogo no sistema multi-agente de IA financeira. Sua tarefa é analisar se a resposta do usuário responde diretamente à pergunta específica formulada pelo agente em diálogo ativo. Responda apenas com 'sim' se a resposta for relevante e direta à pergunta, ou 'não' se não for, indicando que deve voltar à triagem normal. Não adicione explicações ou texto extra."
- Responde exclusivamente com "sim" ou "não".

**Agentes que Podem Iniciar Diálogo:**
- **Agente Junior:** Para saudações ou contexto inicial
- **Agente Lançador:** Para completar informações de lançamento
- **Agente Simplista:** Para refinar queries informacionais simples

**Detecção de Transição para Complexidade:**
- A análise é realizada pelo agente DeepSeek, que determina se a resposta do usuário é relevante à pergunta em diálogo ou se indica uma mudança para uma query complexa, resetando o contexto para triagem normal.

**Exemplo de Fluxo:**
```
Usuário: "gastei 450 reais"
Junior → Lançador
Lançador: "Em que você gastou os R$ 450?"
Sistema: marca "diálogo_ativo: lançador, pergunta: Em que você gastou os R$ 450?"
Usuário: "no supermercado"
DeepSeek analisa: resposta responde à pergunta? → "sim" → direto para Lançador
Lançador: registra e confirma
```

**Exemplo de Transição:**
```
Usuário: "esquece, faça uma análise das minhas finanças"
DeepSeek analisa: resposta não responde à pergunta em diálogo → "não" → reseta contexto → triagem normal → Orquestrador
```

Este sistema evita retrabalho e mantém eficiência em diálogos simples, enquanto permite escalabilidade para análises complexas.


## 2.2 MEMÓRIA E CONTEXTO (VISÃO SIMPLIFICADA)

O sistema possui **dois sistemas de memória distintos e independentes**:

### Sistema de Memória de Contexto (Chat entre Usuário e Agente)
Este sistema mantém o contexto da conversa entre o usuário e a IA, sendo enviado automaticamente a todos os agentes para fornecer background histórico.

- **Working Memory (volátil):** memória de sessão (curto prazo) usada para variáveis de execução, diálogos ativos e resultados intermediários. Construída e entregue pelo `context-builder`.
- **Episodic Memory (por chat):** histórico persistente da conversa individual, curado e comprimido pelo sistema de memória episódica (`episodic-memory`). Contém o histórico relevante da interação do usuário.
- **Long-Term Memory (perfil):** perfil permanente do usuário (LTM) com memórias curadas e embeddings semânticos (acessível via `profile-manager`).

Essas memórias são sempre enviadas automaticamente a todos os agentes, com identificação clara de cada tipo. Elas podem estar vazias se não houver conteúdo relevante, mas quando presentes, devem ser analisadas para prosseguir, pois podem conter informações essenciais.

### Sistema de Memória Interna (Processos dos Agentes)
Este é um sistema independente e efêmero, detalhado em `server/src/agents/working-memory/README.md`. Ele preserva a integridade dos processos internos dos agentes durante o processamento de qualquer query (não apenas complexas), garantindo que todas as operações, decisões e respostas integrais dos agentes executores e coordenadores sejam 100% preservadas.

**Propósito:** Em queries que passam por múltiplos agentes e realizam mais de 10 operações, é crucial manter o estado completo dos processos para elaborar a resposta final com integridade. Esta memória é volátil e deletada após a resposta ser enviada ao usuário.

**Integração na Resposta Final:** A resposta final deve incluir ambos os sistemas:
- **Memória de Contexto (Chat):** Exatamente a mesma enviada pelo Agente Junior, identificada claramente.
- **Memória Interna:** Dados e informações dos processos internos, devidamente divididos e preservados na sua integridade, indicando claramente a diferença entre contexto histórico e processos operacionais.

Como o contexto é construído:

- O `context-builder` é a fonte canônica do contexto de chat; agentes recebem automaticamente o contexto unificado em cada interação.
- Cada agente recebe: `sessionId`, `userId`, `sessionMetadata`, `workingMemory` (pares chave-valor voláteis), `episodicSummary` (trechos relevantes da memória episódica, quando aplicável), `prompt_current` (o texto exato do usuário que originou a request).

Regras de acesso e privacidade:

- **Todos os agentes recebem o contexto de chat automaticamente:** Agente Junior, Agente Simplista, Agente Lançador, Agentes Coordenadores (Analista, Planejamento, Investimentos), Agente Matemático e Agente de Pesquisa Externa.
- Conteúdo pode estar vazio para agentes que não precisam de certos tipos de memória (ex.: Agente Matemático pode receber `workingMemory` vazio se não aplicável).
- **Dados sensíveis:** Antes de qualquer inclusão no `episodicSummary` ou `workingMemory`, a curadoria remove PII sensível (CPF, números de cartão, senhas). Agentes devem tratar qualquer dado recebido como potencialmente sensível e seguir políticas de privacidade.

Operacionalmente:

- Agentes não precisam solicitar o contexto de chat; ele é entregue automaticamente em cada ciclo ou interação.
- Ao enviar pacotes ao Orquestrador ou a coordenadores, o agente emissor deve incluir `prompt_current` e um resumo curto do contexto (se aplicável) para manter rastreabilidade.


**Análise Secundária (para queries complexas):**

- Qual o domínio financeiro principal?
- Educação financeira
- Diagnóstico financeiro
- Comportamento financeiro
- Orçamento estratégico
- Planejamento financeiro
- Investimentos fundamentos
- Investimentos estratégia

**REVISADO - Sugestão de Coordenadores Candidatos:**

- O Agente Junior agora identifica ATÉ 2 COORDENADORES CANDIDATOS
- Para cada candidato, atribui score de confiança (0-100)
- Opções disponíveis:
    - Agente de Análise Financeira Pessoal (coordenador)
    - Agente de Investimentos (coordenador)
    - Agente de Planejamento Financeiro (coordenador)

**Critérios de Sugestão:**

- Se query foca em análise de investimentos, ações, fundos → Investimentos (score alto)
- Se query foca em gastos, orçamento, dívidas → Análise Financeira (score alto)
- Se query foca em metas longas, aposentadoria, múltiplos objetivos → Planejamento (score alto)
- Se query mistura domínios → sugere 2 candidatos com scores próximos

**Pacote Enviado ao Orquestrador:**

- Query original do usuário
- 1 ou 2 prompts de orquestração escolhidos
- Array de candidatos a coordenador: [{nome: "AgentePlanejamento", score: 85}, {nome: "AgenteInvestimentos", score: 60}]
- Justificativa curta da escolha de cada candidato

---

## 3. CAMADA 1: ORQUESTRADOR GLOBAL (ESTRATÉGIA)

### Papel definido

**O Orquestrador é um Estrategista Puro que:**

- Recebe sugestões do Junior e VALIDA/ESCOLHE o coordenador líder
- Define objetivo estratégico de alto nível (O QUÊ precisa ser alcançado)
- Fornece contratos de todos os agentes disponíveis
- Define APENAS timeout global da missão (única restrição hard)
- Aloca orçamento de recursos (tokens, chamadas API)
- Inicia missão e aguarda conclusão ou timeout
- NÃO monitora telemetria em tempo real
- NÃO define limites de ciclos ou ações para coordenadores
- NÃO intervém durante execução (apenas se timeout estourar)

### Fluxo do Orquestrador

**Recebe do Agente Junior:**

- Query original
- Prompt de orquestração especializado
- Array de candidatos a coordenador com scores

**Valida e Escolhe Coordenador Líder:**

- Analisa sugestões do Junior
- Pode fazer OVERRIDE da sugestão do Junior se necessário
- Registra se fez override (para análise posterior)
- Escolhe 1 coordenador líder final

**Classifica Complexidade e Define Recursos:**

- Usa DeepSeek v3 para classificar complexidade da query
- Define timeout global da missão:
    - Comparativa: 80 segundos
    - Profunda: 120 segundos
    - Análise/Investimento: 150 segundos
- Define orçamento maximo de tokens:
    - Comparativa: 4.000 tokens
    - Profunda: 7.000 tokens
    - Análise/Investimento: 10.000 tokens
- Define orçamento maximo de chamadas API externas:
    - Comparativa: 8 chamadas
    - Profunda: 12 chamadas
    - Análise/Investimento: 20 chamadas

**Monta Pacote de Missão:**

- Objetivo estratégico de alto nível (O QUÊ alcançar)
- Query original do usuário
- Contratos de todos os agentes disponíveis (ver seção 3.1)
- Orçamento de recursos alocados
- Timeout global da missão
- NENHUM limite de ciclos ou ações (coordenador decide)

**Delega ao Agente Coordenador:**

- Envia o pacote completo
- Inicia timer de timeout global
- Aguarda conclusão ou timeout
- NÃO monitora progresso durante execução

**Recebe Resultado Final:**

- Coordenador reporta consolidação final
- OU timeout estoura e força encerramento
- Se timeout estourou: solicita ao coordenador consolidação com dados parciais
- Envia para sistema de resposta final

### Estrutura do Pacote de Missão

**Bullet points do JSON enviado ao Agente Coordenador:**

- **missao_id**: identificador único da missão
- **agente_coordenador_lider**: qual agente foi designado para liderar
- **justificativa_escolha**: por que este coordenador foi escolhido (pode incluir se houve override do Junior)
- **objetivo_estrategico**: descrição clara do que precisa ser alcançado (foco em RESULTADO, não PROCESSO)
- **query_original_usuario**: texto exato do usuário
- **contratos_agentes_disponiveis**: [VER SEÇÃO 3.1 - A SER PREENCHIDA]
- **orcamento_recursos**: objeto contendo
    - orcamento_tokens: quantidade máxima de tokens
    - orcamento_chamadas_api: quantidade máxima de chamadas externas
    - consumo_atual: {tokens: 0, chamadas_api: 0} (inicializado)
- **restricoes_hard**: objeto contendo
    - timeout_global_missao: tempo máximo total em segundos (ÚNICA RESTRIÇÃO)
    - timestamp_inicio: quando a missão começou
    - timestamp_limite: quando deve encerrar
- **prompt_orquestracao_especializado**: conteúdo do prompt escolhido pelo Junior
- **instrucoes_autonomia**: texto explícito
    - "Você tem autonomia COMPLETA para decidir quantos ciclos realizar, quantas operações executar e quais agentes chamar."
    - "Sua única restrição é o timeout global de {X} segundos e o orçamento de recursos."
    - "Decida você mesmo quando o objetivo foi suficientemente alcançado."
    - "Priorize qualidade da resposta sobre economia de recursos, mas respeite orçamentos."

---

## 3.1. CONTRATOS DE AGENTES - SEÇÃO A SER PREENCHIDA

### Estrutura de Contratos

**NOTA:** Esta seção será preenchida posteriormente com os contratos detalhados de cada agente.

**Cada contrato deve seguir o padrão:**

- **nome_agente**: identificador único
- **tipo**: "coordenador" ou "executor"
- **descricao_curta**: resumo do que o agente faz
- **responsabilidades**: array de strings descrevendo capacidades
- **operacoes_disponiveis**: array de operações (cada uma com schema completo)
- **formato_requisicao**: estrutura esperada para chamadas
- **formato_resposta**: estrutura que o agente retorna
- **fallbacks_disponiveis**: array de alternativas caso operação principal falhe
- **dependencias**: quais outros agentes este agente pode precisar chamar

**Contratos a serem definidos:**

1. Agente de Análise Financeira Pessoal (coordenador)
2. Agente de Investimentos (coordenador)
3. Agente de Planejamento Financeiro (coordenador)
4. Agente de Pesquisa Externa (executor)
5. Sistema de Acesso a Dados Internos (não é um agente executor, mas um módulo direto para coordenadores)
6. Agente Matemático (executor) - possui acesso direto ao Agente de Pesquisa Externa para dados externos e ao Sistema de Acesso a Dados Internos para dados do usuário
7. Agente de Lançamento (executor)
8. Agente Simplista (executor) - possui acesso direto ao Sistema de Acesso a Dados Internos para consultas rápidas
9. [Outros agentes executores conforme necessário]

**IMPORTANTE:** Contratos devem ser auto-documentados e incluir exemplos de uso.

**NOTA ESPECIAL:** O Agente Matemático tem permissão para chamar diretamente o Agente de Pesquisa Externa quando necessita dados externos (ex.: taxas de juros, índices econômicos) e acessar diretamente o Sistema de Acesso a Dados Internos para dados do usuário (ex.: renda histórica, gastos mensais). Isso garante precisão em cálculos sem overhead adicional de Message Bus para coordenadores.

---

## 3.2. SISTEMA DE ACESSO A DADOS INTERNOS

Em vez de um agente executor dedicado, os agentes coordenadores têm acesso direto a um sistema inteligente de consulta ao banco de dados interno. Esse sistema permite acesso preciso e dinâmico aos dados do usuário, evitando chamadas desnecessárias via Message Bus.

### Funcionamento Geral:
- Os agentes coordenadores acessam um conjunto de **categorias de dados** iniciais.
- Ao selecionar uma categoria, filtros específicos são oferecidos para refinar a busca.
- O sistema é dinâmico: agentes podem voltar às categorias, adicionar/remover filtros conforme necessário.
- Antes de qualquer consulta, o agente deve avaliar qual tipo de informação é necessária, garantindo buscas precisas e relevantes.

### Exemplo de Categoria:
**ID:** Dados_receitas_e_despesas  
**Descrição:** Informações financeiras relacionadas às receitas e despesas do usuário.  
**Filtros disponíveis:**  
- Período (mensal, trimestral - especificar trimestre, anual - especificar ano e mês).  
- Tipo de receita (salário, investimentos, vendas ou todas).  
- Tipo de despesa (fixa, variável, lazer, saúde ou todas).  
- Valor mínimo/máximo (opcional).  

### Fluxo de Uso:
1. Agente escolhe a categoria "Dados_receitas_e_despesas".
2. Aplica filtro: Período = mensal, mês = março/2025.
3. Refina: Tipo de despesa = saúde.
4. Sistema retorna apenas gastos mensais de saúde em março/2025.
5. Se necessário, adiciona filtro: Valor mínimo = R$ 200, para refinar ainda mais.

Esse sistema integra-se diretamente no ciclo ReAct dos coordenadores, permitindo acesso eficiente sem overhead de agentes adicionais.

---

# SISTEMA MULTI-AGENTE DE IA

---

## 4. CAMADA 2: MESSAGE BUS (SISTEMA DE COMUNICAÇÃO)

### Propósito

O Message Bus é a **espinha dorsal da comunicação** entre agentes.

Permite que agentes conversem diretamente SEM passar pelo orquestrador a cada mensagem.

### Componentes do Message Bus

**Registro de Agentes:**

- Todos os agentes (coordenadores e executores) se registram ao iniciar
- Cada agente recebe um identificador único
- Sistema mantém mapa de agentes ativos e suas capacidades
- Inclui status de disponibilidade em tempo real

**Fila de Mensagens:**

- Cada mensagem tem ID único, remetente, destinatário, payload, timestamp
- Mensagens são enfileiradas e processadas em ordem de prioridade
- Prioridades: CRITICA, ALTA, NORMAL, BAIXA
- Mensagens de coordenadores têm prioridade maior que de executores

**Roteamento Inteligente:**

- Message Bus conhece as capacidades de cada agente
- Valida se o destinatário pode processar aquele tipo de requisição
- Rejeita mensagens inválidas antes mesmo de enviar
- Redireciona para fallback automaticamente se agente principal indisponível

**Sistema de Callback:**

- Agente remetente pode registrar callback para receber resposta
- Suporte a padrão request-response assíncrono
- Timeout configurável por mensagem
- Retry automático com backoff exponencial

**Sistema de Rastreamento de Recursos:**

- Rastreia consumo de tokens de cada mensagem
- Rastreia consumo de chamadas API externas
- Acumula totais por missão
- Disponibiliza consulta de orçamento restante a qualquer agente

### Estrutura de Mensagens

**Bullet points de uma mensagem no Message Bus:**

- **message_id**: identificador único
- **timestamp_envio**: quando foi enviada
- **prioridade**: CRITICA / ALTA / NORMAL / BAIXA
- **remetente**: nome do agente que enviou
- **destinatario**: nome do agente que deve processar
- **tipo_mensagem**: requisicao, resposta, notificacao, erro
- **payload**: objeto contendo
    - objetivo: o que está sendo solicitado
    - parametros: dados necessários para executar
    - contexto_adicional: informações de background
    - callback_esperado: booleano indicando se aguarda resposta
    - fallback_automatico: booleano indicando se pode usar fallback se destinatário falhar
- **timeout**: tempo máximo de espera pela resposta em segundos
- **tentativas_restantes**: para retry automático em caso de falha
- **rastreamento**: objeto contendo
    - missao_id: ID da missão global que originou esta mensagem
    - profundidade_chamada: nível na cadeia de chamadas
    - caminho_chamadas: array com histórico de agentes já envolvidos
- **recursos_estimados**: objeto contendo
    - tokens_estimados: quanto essa operação deve consumir
    - chamadas_api_estimadas: quantas chamadas externas

**Bullet points de uma resposta no Message Bus:**

- **response_id**: identificador único da resposta
- **message_id_original**: ID da mensagem que está sendo respondida
- **timestamp_resposta**: quando foi respondida
- **remetente**: agente que processou e respondeu
- **status**: sucesso, sucesso_via_fallback, falha_parcial, falha_total, timeout
- **payload**: objeto contendo
    - dados: resultado da operação
    - metadados: informações sobre como os dados foram obtidos
    - confiabilidade: percentual de confiança nos dados (0-100)
    - fontes: de onde vieram os dados
    - advertencias: avisos sobre limitações dos dados
    - fallback_usado: se foi usado fallback, qual foi
- **tempo_processamento**: quanto tempo levou para processar em segundos
- **recursos_consumidos**: objeto contendo
    - tokens_usados: quantidade real
    - chamadas_api_externas: quantidade real
    - chamadas_banco_dados: quantidade

### Sistemas de Segurança do Message Bus

**Detecção de Loops Circulares:**

- Análise do campo rastreamento.caminho_chamadas
- Se um agente aparece mais de 3 vezes no caminho → alerta de loop e bloqueia
- Se profundidade_chamada excede 8 níveis → bloqueia mensagem
- Algoritmo: mantém grafo direcionado de chamadas, detecta ciclos via DFS
- Quando bloqueia: notifica coordenador líder sobre loop detectado

**Detecção de Explosão de Mensagens:**

- Monitora taxa de mensagens por segundo
- Janela deslizante de 10 segundos
- Se taxa exceder 20 mensagens/segundo → throttling automático
- Throttling: atrasa mensagens de prioridade NORMAL e BAIXA
- Mensagens ALTA e CRITICA sempre passam
- Notifica coordenador sobre throttling ativo

**Sistema de Timeout e Ausência de Progresso (REVISADO):**

- Toda mensagem tem timeout individual (padrão: 60s executores, 90s coordenadores)
- Se timeout individual estourar: retorna erro ao remetente
- **NOVO:** Detector de ausência de progresso global
    - Se nenhuma mensagem for processada (nem enviada, nem respondida) em 30 segundos → alerta
    - Se ausência de progresso durar 60 segundos → força timeout global da missão
    - Previne: sistema travado sem deadlock clássico

**Controle de Orçamento Distribuído:**

- Cada mensagem carrega informação de recursos estimados
- Cada resposta carrega informação de recursos reais consumidos
- Message Bus acumula consumo total da missão em tempo real
- **REVISADO:** Quando orçamento atingir 90%:
    - Message Bus adiciona flag "orcamento_critico" em novas mensagens
    - Coordenador recebe essa informação e pode decidir priorizar operações críticas
    - Quando orçamento esgotar 100%:
        - Bloqueia novas mensagens de prioridade NORMAL e BAIXA
        - Permite mensagens CRITICA e ALTA (para encerramento gracioso)
        - Notifica coordenador: "orçamento esgotado, finalize com dados atuais"

**Sistema de Circuit Breaker com Fallback (REVISADO):**

- Rastreia taxa de sucesso de cada agente
- Se agente falhar 5 vezes consecutivas → abre circuito (circuit open)
- **NOVO:** Quando circuito abre:
    - Message Bus consulta contrato do agente para identificar fallback disponível
    - Automaticamente redireciona próximas mensagens para agente de fallback
    - Notifica coordenador sobre uso de fallback
    - Se fallback também falhar → retorna erro ao coordenador
- Estados do circuit breaker:
    - CLOSED: funcionando normalmente
    - OPEN: bloqueado, redirecionando para fallback
    - HALF-OPEN: testando se voltou a funcionar
- Após 90 segundos de cooldown → circuito vai para half-open
- Half-open: permite 1 tentativa. Se sucesso → fecha circuito. Se falha → volta a aberto

**Detecção de Starvation:**

- Mensagens têm timestamp e prioridade
- Se mensagem de prioridade ALTA espera mais de 45 segundos → força processamento imediato
- Se mensagem de prioridade CRITICA espera mais de 20 segundos → força processamento imediato
- Se mensagem qualquer espera mais de 120 segundos → força processamento ou retorna erro
- Previne: mensagens ficarem esquecidas na fila indefinidamente

---

## 5. CAMADA 3: AGENTES COORDENADORES

### Definição

Agentes Coordenadores são **orquestradores especializados autônomos** que:

- Recebem OBJETIVOS ESTRATÉGICOS, não comandos detalhados
- Planejam COMO atingir os objetivos com autonomia COMPLETA
- Decidem quantos ciclos realizar (sem limite externo)
- Decidem quantas operações executar (sem limite externo)
- Chamam agentes executores via Message Bus
- Podem chamar outros coordenadores quando necessário
- Monitoram seu próprio progresso e orçamento
- Decidem quando objetivo foi suficientemente alcançado
- Consolidam resultados e estruturam resposta final
- Reportam ao orquestrador apenas ao finalizar

### Arquitetura Interna de um Agente Coordenador

**Ciclo ReAct Próprio com Auto-Regulação:**

Todo agente coordenador opera em ciclos, mas decide autonomamente quantos ciclos realizar.

**Ciclo N - PLANEJAMENTO (primeiro ciclo):**

- Recebe pacote de missão do orquestrador
- Analisa objetivo estratégico
- Consulta contratos dos agentes disponíveis
- Consulta orçamento de recursos disponível
- Consulta tempo restante até timeout global
- Cria plano de execução interno
- Define quais agentes precisará chamar
- Define ordem e dependências entre operações

**Ciclo N+1, N+2... - EXECUÇÃO:**

- Dispara chamadas aos agentes via Message Bus
- Prioriza operações críticas primeiro
- Faz chamadas em paralelo quando possível (operações independentes)
- Aguarda respostas via callbacks
- Monitora orçamento consumido até o momento
- Monitora tempo decorrido
- Se receber flag "orcamento_critico": prioriza finalização
- Se tempo restante < 30% do timeout: prioriza finalização
- Valida cada resposta recebida
- Se resposta via fallback: registra limitação
- Se resposta falhou: decide se tenta novamente, usa cache, ou prossegue sem
- Marca operações como concluídas ou falhadas

**Ciclo N+X - AVALIAÇÃO CONTÍNUA:**

- Após cada bloco de operações, analisa:
    - Objetivo foi suficientemente alcançado?
    - Dados coletados são suficientes para resposta de qualidade?
    - Há dados críticos faltando?
    - Orçamento restante permite buscar mais dados?
    - Tempo restante permite mais operações?
- Decide: continuar (fazer novas chamadas) ou encerrar (consolidar)
- **NOVO:** Análise de custo-benefício por operação futura
    - Para cada operação ainda não executada:
        - Estima custo (tokens, tempo, chamadas API)
        - Estima benefício (quão importante para resposta final)
    - Prioriza operações com maior score

**Ciclo FINAL - CONSOLIDAÇÃO:**

- Quando coordenador decide que objetivo foi alcançado OU timeout se aproxima OU orçamento esgotou:
- Sintetiza todas as informações coletadas
- Identifica dados faltantes e limitações encontradas
- Estrutura resposta pré-formatada (reduz trabalho da síntese final)
- Inclui metadados sobre processo realizado
- Inclui recursos consumidos
- Envia ao sistema de resposta final

### System Prompt de Agente Coordenador (Estrutura)

**Bullet points do que deve conter:**

**Seção 1 - Identidade e Papel:**

- Nome do agente
- Seu papel como coordenador autônomo
- Sua especialização (ex: investimentos, planejamento, análise financeira)
- O que você coordena vs o que você executa diretamente

**Seção 2 - Autonomia e Autoridade:**

- **Você tem autonomia COMPLETA para decidir:**
    - Quantos ciclos de planejamento/execução realizar
    - Quantas operações executar
    - Quais agentes chamar e em que ordem
    - Quando considerar o objetivo alcançado
    - Como priorizar operações se recursos escassearem
- **Suas únicas restrições são:**
    - Timeout global da missão (informado no pacote)
    - Orçamento de tokens e chamadas API (informado no pacote)
    - Contratos dos agentes (só pode solicitar operações documentadas)
- **Você NÃO deve:**
    - Esperar aprovação para cada ação
    - Limitar-se artificialmente (ex: "vou fazer só 3 ciclos")
    - Priorizar economia de recursos sobre qualidade da resposta (exceto se orçamento crítico)

**Seção 3 - Capacidades e Recursos Disponíveis:**

- Lista completa de agentes que pode chamar
- Contratos completos de cada agente (ver seção 3.1)
- Outros coordenadores que pode chamar se necessário
- Como consultar orçamento restante em tempo real
- Como consultar tempo restante até timeout

**Seção 4 - Protocolo de Comunicação:**

- Como chamar agentes via Message Bus
- Estrutura de requisição esperada por tipo de agente
- Estrutura de resposta que receberá
- Como definir prioridade de mensagens (CRITICA/ALTA/NORMAL/BAIXA)
- Como lidar com timeouts de mensagens individuais
- Como lidar com fallbacks automáticos
- Como interpretar respostas parciais ou via fallback

**Subseção 4.1 - Transmissão de Memória:**

- **Para Executores:** Ao enviar requisições, avalie se é relevante incluir elementos da Memória de Contexto (Chat) ou Memória Interna. Inclua apenas o necessário para o executor realizar sua operação, evitando sobrecarga.
- **Entre Coordenadores:** Sempre envie a Memória de Contexto e a Memória Interna na sua integralidade para garantir continuidade e acesso completo aos processos anteriores.

**Seção 5 - Ciclo de Raciocínio e Tomada de Decisão:**

- **Framework de planejamento:**
    - Decomponha o objetivo em sub-objetivos
    - Identifique dependências entre operações
    - Estime recursos necessários
    - Priorize por criticidade
- **Framework de execução:**
    - Execute operações críticas primeiro
    - Paralelizar sempre que possível
    - Monitore progresso continuamente
- **Framework de avaliação:**
    - Após cada bloco de operações, pergunte-se:
        - "Os dados que tenho são suficientes para resposta de qualidade?"
        - "Há lacunas críticas que justificam mais operações?"
        - "O custo-benefício de buscar mais dados é positivo?"
    - Use análise de custo-benefício explicitamente
- **Critérios para considerar objetivo alcançado:**
    - Dados críticos foram obtidos
    - Resposta pode ser estruturada com qualidade
    - Dados adicionais teriam retorno marginal baixo
    - OU orçamento/tempo não permitem mais operações
- **Como lidar com escassez de recursos:**
    - Se orçamento < 20% restante: priorize finalização
    - Se tempo < 30% restante: priorize finalização
    - Operações críticas > operações complementares > operações opcionais
    - Use cache agressivamente
    - Aceite dados parciais se necessário

**Seção 6 - Tratamento de Falhas e Degradação:**

- O que fazer se agente executor falhar
    - Verificar se fallback foi usado automaticamente
    - Se fallback também falhou: decidir próximo passo
    - Opções: tentar novamente, usar cache, usar dados parciais, prosseguir sem
- O que fazer se orçamento esgotar
    - Message Bus bloqueará mensagens de baixa prioridade
    - Finalize com dados disponíveis
    - Documente limitações na consolidação
- O que fazer se timeout se aproximar
    - Quando tempo restante < 40s: inicie consolidação
    - Não inicie novas operações longas
    - Force finalização de operações em andamento
- Como documentar limitações
    - Liste operações que não puderam ser executadas
    - Explique por que (timeout, orçamento, falha de agente)
    - Indique impacto na qualidade da resposta

**Seção 7 - Formato de Consolidação Final:**

- **Estrutura JSON de resposta ao orquestrador:**
    - **status**: sucesso_completo / sucesso_parcial / falha
    - **objetivo_alcancado**: booleano
    - **resposta_pre_estruturada**: objeto contendo
        - resposta_principal: texto estruturado respondendo à query (já em linguagem natural)
        - dados_suporte: array de dados concretos que sustentam a resposta
        - calculos_realizados: array de cálculos relevantes
        - comparacoes_feitas: array de comparações
    - **limitacoes_encontradas**: array de objetos
        - tipo_limitacao: timeout / orcamento / falha_agente / dados_indisponiveis
        - descricao: explicação
        - impacto: baixo / medio / alto
        - operacoes_nao_executadas: lista
    - **recomendacoes_adicionais**: array de sugestões extras (pode estar vazio)
    - **proximos_passos_sugeridos**: array de ações para o usuário (pode estar vazio)
    - **metadados_execucao**: objeto contendo
        - ciclos_realizados: quantidade
        - operacoes_executadas: quantidade total
        - operacoes_falhadas: quantidade
        - agentes_chamados: array de nomes
        - fallbacks_usados: array de objetos {agente, fallback_usado}
    - **recursos_consumidos**: objeto contendo
        - tokens_usados: total
        - chamadas_api_externas: total
        - tempo_execucao: segundos
        - percentual_orcamento_tokens: % usado
        - percentual_orcamento_api: % usado

**Seção 8 - Estratégia Específica do Coordenador:**

- Framework de raciocínio específico deste coordenador
- Ordem lógica típica de etapas para problemas do seu domínio
- Como lidar com cenários comuns da sua especialização
- Exemplos de boas execuções passadas
- Padrões de priorização específicos

**Seção 9 - Colaboração com Outros Coordenadores:**

- Quando chamar outro coordenador ao invés de executores
- Como estruturar requisição para outro coordenador
- Como integrar resposta de outro coordenador na sua consolidação
- Evitar chamadas circulares (A chama B, B chama A)

---

# SISTEMA MULTI-AGENTE DE IA


---

## 6. CAMADA 4: AGENTES EXECUTORES

### Definição

Agentes Executores são **agentes especializados operacionais** que:

- Executam tarefas específicas e atômicas
- Possuem raciocínio operacional LOCAL, limitado ao escopo da operação solicitada
- NÃO realizam planejamento multi-etapas
- NÃO avaliam custo-benefício global
- NÃO redefinem objetivos


### Arquitetura Interna de um Agente Executor

**Ciclo Simples com Fallback:**

**Etapa 1 - Receber Requisição:**

- Via Message Bus
- Valida se possui os parâmetros obrigatórios
- Valida se operação solicitada está no contrato
- Se faltar algo crítico → retorna erro imediatamente com detalhes

**Etapa 2 - Verificar Disponibilidade de Cache:**

- Consulta se há dados em cache para esta requisição
- Verifica se cache ainda é válido (não expirou)
- Se cache válido E requisição permite cache → retorna cache imediatamente
- Se cache inválido ou requisição exige dados frescos → prossegue

**Etapa 3 - Executar Operação Principal:**

- Processa a requisição de forma determinística dentro de um espaço de decisão operacional previamente definido no contrato
- Acessa API externa primária se necessário
- Consulta banco de dados se necessário
- Realiza cálculos se necessário
- Define timeout interno (padrão: 80% do timeout da mensagem)

**Etapa 4 - Executar Fallback se Necessário (NOVO):**

- Se operação principal falhou (timeout, API indisponível, erro):
    - Consulta seu próprio contrato para identificar fallback
    - Tenta fallback automático (ex: API alternativa, cache antigo, dados estáticos)
    - Se fallback funcionar: prossegue (marca que usou fallback)
    - Se fallback também falhar: registra falha e prossegue para retorno de erro

**Etapa 5 - Estruturar Resposta:**

- Formata dados no padrão definido no contrato
- Adiciona metadados obrigatórios:
    - fontes: de onde vieram os dados
    - timestamp_coleta: quando foram obtidos
    - confiabilidade: score 0-100 (100 = dados frescos de fonte primária, 70 = dados de fallback, 40 = cache antigo)
    - fallback_usado: booleano + descrição se aplicável
- Adiciona advertências se aplicável:
    - Dados parciais
    - Dados desatualizados
    - Fonte alternativa usada
- Atualiza cache se aplicável

**Etapa 6 - Retornar via Message Bus:**

- Envia resposta ao agente solicitante
- Inclui recursos consumidos (tokens, chamadas API, tempo)
- Marca status: sucesso / sucesso_via_fallback / falha_parcial / falha_total

### System Prompt de Agente Executor (Estrutura)

**Bullet points do que deve conter:**

**Seção 1 - Identidade:**

- Nome do agente
- Papel como executor operacional
- Especialização (ex: pesquisa de dados de mercado, cálculos matemáticos, consultas internas)

**Seção 2 - Restrições Fundamentais:**

- Você é um EXECUTOR, não um coordenador
- Você NÃO decide estratégias ou prioridades
- Você NÃO chama outros agentes
- Você executa a operação solicitada utilizando raciocínio operacional estritamente limitado à execução dessa operação, conforme definido no seu contrato, e retorna dados estruturados.
- Você responde SOMENTE ao que foi solicitado (não adiciona operações extras)
- Você deve ser RÁPIDO (timeout padrão: 60 segundos)

**Seção 3 - Operações Disponíveis:**

- Lista completa de operações que sabe executar
- Para cada operação:
    - Nome da operação
    - Descrição clara
    - Parâmetros obrigatórios (nome, tipo, descrição, exemplo)
    - Parâmetros opcionais (nome, tipo, descrição, valor padrão)
    - Estrutura de resposta (schema JSON)
    - Tempo médio de execução
    - Fontes de dados que acessa

**Seção 4 - Sistema de Fallback:**

- Para cada operação, lista de fallbacks em ordem de prioridade
- Exemplo de fallback para operação "dados_fundamentalistas":
    - Prioridade 1: API Brapi (fonte primária)
    - Prioridade 2: Cache de 24h (se API indisponível)
    - Prioridade 3: API Yahoo Finance (fonte alternativa)
    - Prioridade 4: Dados estáticos do banco (pode estar desatualizado)
    - Prioridade 5: Retorna erro com dados parciais se houver
- Quando usar cada fallback
- Como marcar que fallback foi usado
- Como ajustar score de confiabilidade baseado em fallback

**Seção 5 - Protocolo de Resposta:**

- Formato JSON obrigatório
- Estrutura de dados por tipo de operação
- Metadados obrigatórios em toda resposta:
    - fontes
    - timestamp_coleta
    - confiabilidade (0-100)
    - fallback_usado
    - advertencias (array, pode estar vazio)
- Recursos consumidos:
    - tokens_usados
    - chamadas_api_externas
    - tempo_execucao

**Seção 6 - Tratamento de Erros:**

- O que fazer se faltarem parâmetros obrigatórios
    - Retorna erro imediato com lista de parâmetros faltantes
    - Não tenta "adivinhar" valores
- O que fazer se APIs externas estiverem indisponíveis
    - Tenta fallback automaticamente
    - Se todos fallbacks falharem: retorna erro com detalhes
    - Nunca inventa dados
- Como lidar com falhas parciais
    - Se obteve 70% dos dados solicitados: retorna com advertência
    - Se obteve < 50%: considera falha total
- Como reportar indisponibilidade temporária
    - Status: falha_total
    - Mensagem clara: "API Brapi temporariamente indisponível, todos fallbacks falharam"
    - Sugestão: "Tente novamente em 60 segundos"

**Seção 7 - Gestão de Cache:**

- Quais operações podem usar cache
- Tempo de validade do cache por tipo de dado
- Como invalidar cache manualmente
- Como marcar resposta que veio de cache

**Seção 8 - Otimização de Performance:**

- Priorizar velocidade sobre perfeição
- Timeout interno: sempre 80% do timeout da mensagem
- Se operação demorar > 50% do timeout: considerar abortar e usar fallback
- Cache agressivo quando apropriado
- Batch de requisições quando possível

---

## 7. SISTEMA DE CONTROLE E SEGURANÇA

### Controle Multi-Camadas

**Camada 1 - Timeouts Hierárquicos:**

**Timeout Global da Missão (ÚNICO HARD LIMIT):**

- Definido pelo orquestrador baseado em complexidade
- Comparativa: 80 segundos
- Profunda: 120 segundos
- Análise/Investimento: 150 segundos
- Quando estourar:
    - Orquestrador força encerramento
    - Envia sinal ao coordenador: "timeout, consolide com dados parciais"
    - Coordenador tem 10 segundos para consolidar
    - Sistema aciona resposta final com dados disponíveis

**Timeout por Mensagem Individual:**

- Toda mensagem no Message Bus tem timeout próprio
- Padrão: 60 segundos para executores, 90 segundos para coordenadores
- Definido pelo remetente da mensagem
- Se estourar:
    - Message Bus retorna erro ao remetente
    - Remetente (coordenador) decide: tentar novamente, usar fallback, ou prosseguir sem

**Timeout Interno de Agente Executor:**

- Cada executor define timeout interno: 80% do timeout da mensagem
- Previne que executor demore exatamente até timeout da mensagem
- Permite margem para processamento e retorno

**Camada 2 - Limites de Recursos (Auto-Regulados):**

**Orçamento de Tokens:**

- Definido por complexidade (5k, 10k, 20k)
- Message Bus rastreia consumo acumulado
- Quando atingir 80%:
    - Message Bus adiciona flag "orcamento_alto" em novas mensagens
    - Coordenador recebe aviso mas continua operando
- Quando atingir 90%:
    - Message Bus adiciona flag "orcamento_critico"
    - Coordenador deve priorizar operações críticas
- Quando atingir 100%:
    - Message Bus bloqueia mensagens NORMAL e BAIXA
    - Permite ALTA e CRITICA (para encerramento gracioso)
    - Notifica coordenador: "orçamento esgotado, finalize imediatamente"
    - Coordenador consolida com dados disponíveis

**Orçamento de Chamadas API Externas:**

- Definido por complexidade (8, 15, 25 chamadas)
- Message Bus rastreia quantidade
- Alertas nos mesmos thresholds (80%, 90%, 100%)
- Quando esgotar: executores usam cache ou fallbacks locais

**Camada 3 - Detecção de Anomalias (REVISADO):**

**Detector de Loop Circular:**

- Message Bus mantém grafo direcionado de chamadas
- A cada nova mensagem: verifica se criar ciclo
- Algoritmo: DFS (Depth-First Search) para detecção de ciclos
- Condições de bloqueio:
    - Agente aparece mais de 3 vezes no mesmo caminho
    - Profundidade > 8 níveis
- Quando detectar: bloqueia mensagem, notifica coordenador

**Detector de Explosão de Mensagens:**

- Monitora taxa de mensagens por segundo
- Janela deslizante de 10 segundos
- Se taxa > 20 msg/s:
    - Throttling automático em mensagens NORMAL e BAIXA
    - ALTA e CRITICA sempre passam
    - Notifica coordenador sobre throttling

**Detector de Ausência de Progresso (NOVO):**

- Monitora se ALGUMA mensagem foi processada ou enviada
- Se 30 segundos sem atividade: alerta interno
- Se 60 segundos sem atividade:
    - Considera missão travada
    - Força timeout global
    - Solicita consolidação com dados parciais
- Previne: deadlocks não-clássicos, agentes travados, race conditions

**Detector de Starvation:**

- Mensagens com timestamp e prioridade
- CRITICA esperando > 20s: força processamento imediato
- ALTA esperando > 45s: força processamento imediato
- Qualquer esperando > 120s: força processamento ou erro

**Camada 4 - Circuit Breaker com Fallback Automático (REVISADO):**

**Funcionamento:**

- Rastreia taxa de sucesso de cada agente
- Janela de análise: últimas 10 tentativas
- Se taxa de falha > 50% em 10 tentativas: abre circuito

**Estados:**

- **CLOSED**: funcionando normalmente (taxa de sucesso > 50%)
- **OPEN**: bloqueado após falhas excessivas
    - Novas chamadas são redirecionadas para fallback automaticamente
    - Se não há fallback disponível: retorna erro imediato
    - Duração: 90 segundos
- **HALF-OPEN**: testando recuperação
    - Permite 1 tentativa ao agente original
    - Se sucesso: volta a CLOSED
    - Se falha: volta a OPEN por mais 90 segundos

**Sistema de Fallback Integrado:**

- Message Bus consulta contrato do agente para identificar fallback
- Redireciona mensagens automaticamente para fallback
- Adiciona flag na mensagem: "usando_fallback_por_circuit_breaker"
- Fallback retorna resposta com "fallback_usado: true"
- Coordenador recebe resposta e registra uso de fallback
- Se fallback também falhar: circuit breaker se aplica ao fallback

**Camada 5 - Sistema de Degradação Graciosa:**

**Quando Recursos Escasseiam (coordenador decide):**

- **Priorização automática:**
    - Operações CRÍTICAS: essenciais para responder query
    - Operações COMPLEMENTARES: melhoram resposta mas não essenciais
    - Operações OPCIONAIS: contexto adicional, nice-to-have
- **Ações do coordenador:**
    - Se orçamento crítico: executa apenas CRÍTICAS
    - Se orçamento moderado: executa CRÍTICAS + COMPLEMENTARES
    - Se orçamento folgado: executa todas
- **Uso de cache agressivo:**
    - Aceita cache de até 7 dias se orçamento apertado
    - Aceita cache de até 24h em condições normais
- **Dados parciais:**
    - Melhor ter dados de 80% das métricas que falhar completamente
    - Documenta quais dados faltaram e por quê

**Exemplo Prático:**

- Orçamento de tokens: 20.000
- Consumido até agora: 18.500 (92.5%)
- Restante: 1.500 tokens
- Coordenador precisa:
    - A) Dados fundamentalistas (crítico, 800 tokens)
    - B) Comparação setorial (complementar, 700 tokens)
    - C) Análise histórica 10 anos (opcional, 1.200 tokens)
- Decisão: executa A e B, omite C
- Na consolidação: informa que análise histórica foi omitida por limite de recursos

**Camada 6 - Monitoramento de Saúde (Passivo):**

**Métricas Rastreadas (não alertam durante execução):**

- Latência média de cada agente (últimas 100 execuções)
- Taxa de sucesso de cada agente (últimas 100 execuções)
- Carga atual (quantas requisições cada agente está processando)
- Disponibilidade de APIs externas
- Taxa de uso de fallbacks

**Uso dessas métricas:**

- Análise offline para melhorias futuras
- Ajuste de timeouts padrão
- Identificação de agentes problemáticos
- Planejamento de capacidade
- NÃO usadas para intervenção em tempo real durante missão

### Exemplos Práticos Adicionais

**Exemplo 1: Coordenação em Análise Financeira Pessoal**

- Query: "Posso comprar uma casa com minha renda atual?"
- Agente Junior classifica como análise financeira, sugere Agente de Análise Financeira Pessoal (score 90).
- Orquestrador define objetivo: "Avaliar viabilidade de compra imobiliária baseada em dados financeiros".
- Coordenador (Analista) planeja: chama Agente de Dados Internos para renda/transações, aplica framework de compra de imóvel.
- Execução: Coleta dados, simula financiamento, avalia riscos.
- Consolidação: Resposta explicável com framework usado, métricas (comprometimento de renda 28%), recomendações.

**Exemplo 2: Colaboração entre Coordenadores**

- Query: "Como planejar aposentadoria com investimentos?"
- Junior sugere Análise Financeira (score 70) e Planejamento (score 85).
- Orquestrador escolhe Planejamento como líder, mas permite chamada ao Analista.
- Planejamento coordena: chama Analista para análise de renda atual, integra com projeções de investimentos.
- Resultado: Plano holístico com análise de gaps e estratégias de investimento.

**Exemplo 3: Gerenciamento de Recursos em Missão Complexa**

- Missão: Análise de portfólio de investimentos (timeout 150s, orçamento 10k tokens).
- Coordenador (Investimentos) consome 8k tokens em dados externos.
- Message Bus sinaliza orçamento crítico (90%).
- Coordenador prioriza: omite análise histórica opcional, consolida com dados essenciais.
- Resposta: Análise completa de risco/retorno, nota limitação em projeções longas.

---

## 8. SISTEMA DE RESPOSTA FINAL

### Propósito

Transformar a consolidação técnica do coordenador em uma resposta natural, útil e compreensível para o usuário.

### Quando Ocorre

A resposta final é acionada quando:

- Coordenador reporta consolidação final
- OU timeout global estoura

### Processo de Resposta Final

**Etapa 1 - Recebimento da Consolidação:**

- Sistema recebe JSON de consolidação do coordenador, preservado integralmente na Memória Interna dos Agentes (`server/src/agents/working-memory/README.md`)
- A consolidação inclui 100% das respostas e dados processados pelos agentes executores e coordenadores
- JSON contém:
    - resposta_pre_estruturada (já em linguagem natural)
    - dados_suporte
    - calculos_realizados
    - limitacoes_encontradas
    - recomendacoes_adicionais
    - proximos_passos_sugeridos
    - metadados_execucao
    - recursos_consumidos

**Etapa 2 - Construção do Contexto Mínimo:**

- Sistema extrai apenas informações essenciais, distinguindo claramente:
    - **Memória de Contexto (Chat):** Query original e histórico de conversa (exatamente como enviado pelo Agente Junior)
    - **Memória Interna:** Dados e processos preservados da execução dos agentes
- Query original do usuário
- Resposta pré-estruturada do coordenador
- Limitações encontradas (se houver)
- Recomendações adicionais (se houver)
- **NOVO:** Reduz drasticamente o contexto enviado ao LLM de síntese
- Dados brutos, cálculos detalhados e metadados ficam armazenados mas NÃO vão para síntese

**Etapa 3 - Prompt de Síntese Otimizado (REVISADO):**

**Bullet points do prompt (versão enxuta):**

**Parte 1 - Contexto Mínimo:**

- Query original do usuário: {query}
- Resposta estruturada pelo coordenador: {resposta_pre_estruturada}

**Parte 2 - Limitações (se houver):**

- Dados que não puderam ser obtidos: {limitacoes_encontradas}
- Como comunicar isso ao usuário de forma transparente mas sem alarmar

**Parte 3 - Instruções de Formatação:**

- Transforme a resposta estruturada em linguagem natural e fluida
- Mantenha todos os dados concretos (números, valores, datas) fornecidos
- Use tom consultivo, prestativo e empático
- Estrutura sugerida:
    - Primeiro parágrafo: resposta direta à pergunta principal
    - Parágrafos intermediários: detalhamento com evidências
    - Último parágrafo: recomendações ou próximos passos (se houver)
- Formato: parágrafos corridos, NÃO listas (exceto se usuário pediu lista explicitamente)
- Proibido mencionar: agentes, orquestrador, ciclos, Message Bus, system prompts
- Proibido usar jargão técnico: ReAct, payload, timeout, fallback
- Se houve limitações: explique honestamente mas de forma construtiva
- Exemplo: "Não foi possível obter comparação com outras empresas devido a indisponibilidade temporária dos dados, mas a análise individual da empresa oferece um panorama claro."

**Parte 4 - Formato de Saída:**

- JSON contendo:
    - resposta_ao_usuario: texto final formatado
    - tom_usado: "consultivo" / "educativo" / "técnico" (para registro)

**Estimativa de Tokens do Prompt de Síntese:** 1.000-2.000 tokens (vs 8.000-12.000 da versão anterior)

**Etapa 4 - Geração da Resposta:**

- LLM de síntese (GPT-4 ou Opus) processa o prompt
- Gera resposta em linguagem natural
- Tempo estimado: 3-5 segundos

**Etapa 5 - Validação da Resposta:**

- Sistema valida:
    - Resposta tem pelo menos 100 caracteres
    - Resposta não contém termos técnicos proibidos (lista: "agente", "orquestrador", "Message Bus", "ReAct", "payload", "ciclo", "timeout")
    - Resposta menciona dados concretos fornecidos pelo coordenador
- Se validação falhar:
    - Regenera com instrução adicional: "Evite termos: {termos_encontrados}"
    - Máximo 2 tentativas de regeneração
    - Se ainda falhar: envia resposta do coordenador diretamente (fallback)

**Etapa 6 - Envio ao Usuário:**

- Resposta final é enviada via interface de chat
- Formatação natural (markdown se apropriado)
- Se houve limitações significativas:
    - Opcionalmente adiciona botão: "Tentar novamente com mais recursos"

---

# SISTEMA MULTI-AGENTE DE IA


---

## 9. FLUXOS COMPLETOS DE EXECUÇÃO (REVISADOS)

### Fluxo 1: Query Trivial (SEM MUDANÇAS)

**Usuário:** "Oi, tudo bem?"

**Processamento:**

1. Agente Junior recebe
2. Detecta: query trivial
3. Responde diretamente: "Olá! Tudo bem sim, e com você? Como posso ajudar com suas finanças hoje?"
4. Não aciona orquestrador nem agentes
5. Fim (latência: < 1 segundo)

---

### Fluxo 2: Query de Lançamento (SEM MUDANÇAS)

**Usuário:** "Gastei R$ 150 no supermercado hoje"

**Processamento:**

1. Agente Junior recebe
2. Detecta: query de lançamento
3. Chama diretamente Agente de Lançamento via Message Bus
4. Agente de Lançamento:
    - Extrai: valor R$ 150, tipo despesa, categoria supermercado, data hoje
    - Registra transação no banco de dados
    - Retorna confirmação
5. Agente Junior recebe confirmação
6. Responde ao usuário: "Registrado! Despesa de R$ 150,00 em Supermercado na data de hoje."
7. Não aciona orquestrador
8. Fim (latência: 2-3 segundos)

---

### Fluxo 3: Query Simplista (SEM MUDANÇAS)

**Usuário:** "Quanto gastei esse mês?"

**Processamento:**

1. Agente Junior recebe
2. Detecta: query simplista (consulta operacional direta)
3. Chama diretamente Agente Simplista via Message Bus
4. Agente Simplista:
    - Identifica operação: soma de despesas do mês atual
    - Consulta banco de dados
    - Calcula total
    - Retorna: R$ 3.450,00
5. Agente Junior recebe resposta
6. Responde ao usuário: "Neste mês você gastou R$ 3.450,00."
7. Não aciona orquestrador
8. Fim (latência: 2-3 segundos)

---

### Fluxo 4: Query Complexa - Análise de Investimento (REVISADO)

**Usuário:** "A Petrobras caiu 3% ontem, vale a pena comprar agora?"

**ETAPA 1 - Triagem (Agente Junior):**

1. Recebe query
2. Detecta: NÃO é trivial, NÃO é lançamento, NÃO é simplista
3. Analisa domínio: investimentos
4. Escolhe prompt: "investimentos_estrategia"
5. **NOVO:** Identifica candidatos a coordenador:
    - Candidato 1: Agente de Investimentos (score: 90) - query é sobre decisão de investimento
    - Candidato 2: Agente de Planejamento (score: 40) - pode ter relevância secundária
6. Envia ao Orquestrador

**ETAPA 2 - Orquestração Estratégica (REVISADO):**

1. Orquestrador recebe pacote do Junior
2. **NOVO:** Valida escolha de coordenador:
    - Analisa scores: Investimentos 90, Planejamento 40
    - Consulta perfil do usuário: conservador
    - Decisão: concorda com Junior, escolhe Agente de Investimentos
3. Classifica complexidade: "Profunda"
4. Define recursos: 120s timeout, 10k tokens, 15 chamadas API
5. Monta Pacote de Missão e envia ao Agente de Investimentos

**ETAPA 3 - Coordenação Autônoma (Agente de Investimentos):**

**Ciclo 1 - Planejamento:**

- Analisa objetivo: avaliar oportunidade de compra
- Cria plano: dados de mercado, fundamentos, notícias, portfólio, simulação

**Ciclo 2 - Primeira Onda (Operações Críticas em Paralelo):**

- Chama Agente de Pesquisa Externa: dados de mercado + fundamentos PETR4
- Chama Agente de Dados Internos: portfólio atual
- Aguarda respostas (timeout: 60s cada)

**Ciclo 3 - Consolidação Primeira Onda:**

- Recebe: Preço R$ 38.50, queda 3.1%, P/L 4.2, ROE 18%
- Recebe: Portfólio R$ 100k, 20% em ações
- Orçamento consumido: 3.800 tokens (38%)
- Tempo: 15s (12.5%)
- Decisão: recursos folgados, continuar

**Ciclo 4 - Segunda Onda (Complementares):**

- Chama Agente de Pesquisa Externa: notícias recentes + comparação setorial

**Ciclo 5 - Terceira Onda (Simulação):**

- Chama Agente Matemático: simular alocação R$ 5.000
- Recebe: nova exposição 25%, volatilidade 7.5%, retorno esperado 36%

**Ciclo 6 - Análise Final:**

- Orçamento: 8.200 tokens (82%)
- Tempo: 42s (35%)
- Análise custo-benefício: análise histórica não vale 2.000 tokens
- Decisão: OMITIR análise histórica, consolidar

**Ciclo 7 - Consolidação:**

- Estrutura resposta completa com recomendação
- Status: sucesso_completo
- Limitação: análise histórica omitida (impacto baixo)

**ETAPA 4 - Resposta Final:**

- Sistema recebe consolidação
- Gera resposta natural em linguagem consultiva
- Usuário recebe análise completa com recomendação gradual

**Latência total:** ~50 segundos **Recursos:** 8.200 tokens (82%), 6 chamadas API (40%)

---

### Fluxo 5: Query Complexa com Múltiplos Coordenadores (REVISADO)

**Usuário:** "Quero comprar um carro de R$ 80.000, tenho R$ 20.000 guardados. Faz sentido financiar ou poupar mais? Também estou pensando em investir na bolsa."

**ETAPA 1 - Triagem:**

- Junior identifica: planejamento (primário) + investimentos (secundário)
- Candidatos: Planejamento (85), Investimentos (65)

**ETAPA 2 - Orquestração:**

- Orquestrador escolhe: Agente de Planejamento (líder)
- Recursos: 120s, 10k tokens, 15 chamadas API

**ETAPA 3 - Coordenação (Planejamento):**

**Ciclos 1-2:** Coleta dados financeiros e simula financiamento

- Sobra mensal: R$ 1.500
- Parcela financiamento: R$ 1.700 (consome toda sobra)

**Ciclos 3-4:** Simula alternativa (poupar)

- Em 40 meses junta: R$ 60k + R$ 20k inicial = R$ 80k

**Ciclo 5 - Chama Outro Coordenador:**

- **Agente de Planejamento chama Agente de Investimentos**
- Pergunta: "Quanto renderiam R$ 20k em 40 meses?"
- Investimentos analisa e retorna: R$ 27.000 (retorno 35%)

**Ciclo 6 - Consolidação Final:**

- Compara cenários:
    - A) Financiar: custo R$ 85k, sem investir, carro imediato
    - B) Poupar: R$ 60k poupado + R$ 27k investido = R$ 87k, compra à vista
- Cenário B é R$ 12k melhor
- Recomendação clara: poupar enquanto investe

**Latência:** ~55 segundos

**Pontos Importantes:**

- Coordenador chamou outro coordenador
- Trabalho dividido por especialização
- Resposta mais completa

---

### Fluxo 6: Cenário de Timeout Global (NOVO)

**Usuário:** "Analise completamente minha situação financeira, investimentos, orçamento, dívidas e diga tudo para aposentar aos 55 anos com R$ 15 mil de renda passiva."

**ETAPA 1-2:** Triagem e Orquestração

- Complexidade máxima: 150s timeout, 20k tokens, 25 chamadas API
- Coordenador: Planejamento

**ETAPA 3 - Coordenação com Timeout:**

**Ciclos 1-5 (60s):** Coleta massiva de dados

- Dados financeiros completos
- Portfólio investimentos
- Histórico despesas
- Análise dívidas
- Projeções mercado

**Ciclos 6-8 (50s):** Análises e simulações

- Simulação aposentadoria
- Cálculo valor necessário (R$ 3 milhões)
- Estratégia acumulação
- Ajustes orçamento

**Ciclo 9 (125s):** Tentativa operação final

- Inicia análise comparativa cenários
- Operação demora 15s

**Ciclo 10 (140s):** Iniciando consolidação

- **TIMEOUT ESTOURA EM 150s**
- Orquestrador: "timeout, consolide imediatamente"

**Consolidação Forçada (10s):**

- Coordenador interrompe análise comparativa
- Consolida com dados disponíveis:
    - ✅ Análise situação atual
    - ✅ Valor necessário (R$ 3M)
    - ✅ Estratégia acumulação
    - ❌ Comparação cenários (timeout)
- Status: sucesso_parcial
- Limitação documentada: impacto médio

**ETAPA 4 - Resposta Final:**

- Usuário recebe análise completa
- Transparência: "Comparação de cenários não foi concluída devido ao tempo"
- Opção: pedir análise específica depois

---

### Fluxo 7: Cenário de Fallback em Cascata (NOVO)

**Usuário:** "Qual o P/L da Magazine Luiza?"

**ETAPA 1-2:** Triagem e Orquestração

- Coordenador: Investimentos

**ETAPA 3 - Coordenação com Fallbacks:**

**Ciclo 1:**

- Coordenador chama Agente de Pesquisa Externa
- Operação: dados_fundamentalistas (MGLU3)

**Execução no Agente de Pesquisa Externa:**

1. Tenta API Brapi (fonte primária)
    
    - **FALHA: timeout 15s**
    - Circuit Breaker: 1ª falha registrada
2. **Fallback nível 1:** Cache 24h
    
    - **Cache vazio** (empresa não consultada recentemente)
3. **Fallback nível 2:** API Yahoo Finance
    
    - **SUCESSO!** P/L = 18.5
4. Retorna resposta:
    

```json
{
  "status": "sucesso_via_fallback",
  "dados": {"ticker": "MGLU3", "pl": 18.5},
  "confiabilidade": 85,
  "fontes": ["Yahoo Finance (fallback)"],
  "fallback_usado": true,
  "advertencias": ["Dados de fonte alternativa"]
}
```

**Ciclo 2:**

- Coordenador recebe e consolida
- Registra: fallback usado, confiabilidade 85

**ETAPA 4 - Resposta Final:** "O P/L da Magazine Luiza está em 18.5. Os dados foram obtidos de fonte alternativa devido a uma indisponibilidade temporária, mas a informação é confiável e atualizada."

**Benefícios:**

- Resposta entregue mesmo com falha primária
- Transparência sobre fonte
- Sistema resiliente

---

## 10. MÉTRICAS E MONITORAMENTO OFFLINE

### Propósito

Coletar dados de execução para análise posterior e melhoria contínua do sistema.

### Dados Coletados por Missão

**Para cada missão executada, armazenar:**

**Identificação:**

- missao_id
- timestamp_inicio
- timestamp_fim
- duracao_total

**Entrada:**

- query_original
- dominio_classificado
- coordenador_sugerido_junior (com score)
- coordenador_escolhido_orquestrador
- houve_override (booleano)

**Recursos:**

- orcamento_tokens_alocado
- orcamento_tokens_consumido
- orcamento_api_alocado
- orcamento_api_consumido
- timeout_alocado
- tempo_real_execucao

**Execução:**

- ciclos_realizados_coordenador
- operacoes_totais_executadas
- operacoes_falhadas
- fallbacks_usados (array)
- agentes_chamados (array)
- profundidade_maxima_chamadas

**Resultado:**

- status_final (sucesso_completo / sucesso_parcial / falha / timeout)
- objetivo_alcancado (booleano)
- limitacoes_encontradas (array)
- qualidade_resposta (score 0-100, avaliado depois por humano)

**Usuário:**

- feedback_usuario (thumbs up/down se fornecido)
- query_followup (se houve follow-up nos próximos 5 minutos)

### Análises Offline (Executadas Semanalmente)

**Análise 1 - Precisão do Junior:**

- Quantas vezes Junior sugeriu coordenador correto (sem override)?
- Taxa de override: se > 30%, Junior precisa ajuste
- Padrões de erro: Junior sempre erra em que tipo de query?

**Análise 2 - Performance por Coordenador:**

- Taxa de sucesso de cada coordenador
- Tempo médio de execução
- Consumo médio de recursos
- Coordenador mais eficiente por tipo de query

**Análise 3 - Eficiência de Recursos:**

- Missões que sempre estouram orçamento de tokens
- Missões que sempre dão timeout
- Oportunidades de otimização (operações redundantes, cache não utilizado)

**Análise 4 - Confiabilidade de Agentes:**

- Taxa de sucesso de cada executor
- Frequência de uso de fallbacks
- Executores que mais falham (candidatos a revisão)

**Análise 5 - Satisfação do Usuário:**

- Correlação entre recursos consumidos e satisfação
- Queries que sempre recebem thumbs down
- Padrões de queries de follow-up (indica resposta incompleta?)

**Análise 6 - Padrões de Uso:**

- Tipos de query mais comuns
- Horários de pico
- Tendências ao longo do tempo

### Uso das Análises

**Ajustes no Sistema:**

- Atualizar pesos de decisão do Junior
- Ajustar orçamentos padrão por complexidade
- Identificar agentes que precisam de manutenção
- Otimizar ordem de operações em coordenadores
- Melhorar prompts que geram overrides frequentes

**Melhoria Contínua:**

- Sistema aprende com uso real
- Decisões baseadas em dados, não intuição
- Evolução gradual sem quebrar funcionamento

---

## PRÓXIMOS PASSOS

### Implementação

1. **Preencher contratos de agentes (Seção 3.1)**
    
    - Definir operações disponíveis
    - Documentar schemas de entrada/saída
    - Especificar fallbacks
2. **Implementar prompts dos coordenadores (Seção 5)**
    
    - Prompt do Agente de Investimentos
    - Prompt do Agente de Planejamento
    - Prompt do Agente de Análise Financeira
3. **Implementar prompts dos executores (Seção 6)**
    
    - Agente de Pesquisa Externa
    - Agente de Dados Internos
    - Agente Matemático
    - Outros executores
4. **Definir schema de telemetria (Seção 10)**
    
    - Estrutura de banco de dados
    - Queries de análise
    - Dashboards de monitoramento
5. **Testes de integração**
    
    - Testes unitários por agente
    - Testes de fluxo completo
    - Testes de cenários de falha
    - Validação de performance

---
