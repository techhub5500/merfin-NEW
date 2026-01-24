# Long-Term Memory - Memória Permanente do Usuário

Sistema de memória permanente organizado em **10 categorias temáticas**, totalizando **3500 palavras**. Cada categoria tem orçamento de **350 palavras** com compressão automática individual.

## Categorias de Memória (350 palavras cada)

1. **perfil_profissional** - Carreira, emprego, renda, histórico profissional
2. **situacao_financeira** - Patrimônio, dívidas, contas, fluxo de caixa
3. **investimentos** - Ativos, estratégias, performance, alocação
4. **objetivos_metas** - Metas financeiras, prazos, prioridades
5. **comportamento_gastos** - Padrões de consumo, hábitos, preferências
6. **perfil_risco** - Tolerância a risco, preferências de investimento
7. **conhecimento_financeiro** - Nível de conhecimento, aprendizados
8. **planejamento_futuro** - Aposentadoria, grandes compras, projetos
9. **familia_dependentes** - Dependentes, responsabilidades familiares
10. **relacao_plataforma** - Preferências de comunicação, feedback, uso da ferramenta

## Características Especiais

### Personalização com Nome
Memórias sempre usam o nome do usuário (ex: "João precisa poupar R$ 500/mês") ao invés de "O usuário". Isso melhora legibilidade e permite que o usuário visualize suas próprias memórias de forma natural.

### Controle do Usuário
O usuário pode visualizar e excluir memórias por categoria através de uma interface que sera criada porteriormente. Cada categoria é apresentada de forma clara com seus itens organizados por impact score.

## Arquivos e Responsabilidades

### long-term-memory.js
API central para gerenciar memórias de longo prazo. Este arquivo orquestra todo o processo de propor, validar, armazenar e recuperar memórias permanentes que definem o perfil do usuário.

O fluxo principal começa com `propose()`: quando uma memória candidata é submetida, ela passa por curadoria híbrida (regras + IA) que valida se o conteúdo é digno de armazenamento permanente. Apenas memórias com impact score acima de 0.7 são aceitas. O conteúdo é então refinado e comprimido se necessário.

Antes de armazenar, o sistema verifica duplicatas usando similarity search. Se encontrar memória similar existente, faz merge inteligente ao invés de criar duplicata. Cada memória recebe um embedding vetorial para busca semântica futura.

O sistema mantém orçamento rígido de 3500 palavras total. Quando o limite é atingido, memórias com menor impact score são descartadas automaticamente para abrir espaço. A função `retrieve()` oferece busca semântica vetorial ou filtragem por categoria e impact score.

A função `merge()` extrai informações de alto impacto de memórias episódicas (conversas individuais) e promove para LTM permanente. Oferece também cálculo de impact score e estatísticas de curadoria (total proposto, aceito, rejeitado).

### memory-curator.js
Sistema híbrido de curadoria que combina regras determinísticas com raciocínio de IA DeepSeek para validar e refinar memórias antes do armazenamento permanente.

A função `curate()` executa cinco etapas de validação: primeiro, verifica regras rígidas que bloqueiam conteúdo proibido (senhas, dados sensíveis, spam). Segundo, valida se a categoria é válida (user_preferences, strategic_goals, behavior_patterns, critical_decisions, domain_knowledge). Terceiro, avalia adequação geral para LTM usando heurísticas.

Quarto, calcula impact score usando IA: análise de recorrência, impacto estrutural, durabilidade, especificidade e acionabilidade. Apenas scores acima de 0.7 passam. Quinto, refina o conteúdo com LLM DeepSeek, removendo ruído e redundância enquanto preserva informações essenciais. Limite de 100 palavras por memória.

Se conteúdo refinado ainda for verboso, aplica compressão adicional para 80 palavras. Retorna resultado estruturado: aceito/rejeitado, razão, conteúdo curado e impact score.

A função `extractHighImpact()` analisa memórias episódicas usando IA, identificando informações dignas de promoção para LTM. Extrai candidatos com reasoning explicando por que cada um tem alto impacto.

### category-definitions.js
Define as 10 categorias de LTM com prompts especializados para cada uma. Cada categoria tem:

- **Nome identificador** e **label em português**
- **Prompt especializado** que instrui a IA sobre o que extrair e como formular memórias ideais
- **Exemplos** de boas memórias para a categoria
- **Critérios de impact score** específicos

Prompts são usados por `memory-curator.js` durante extração e curadoria. Cada prompt instrui sobre:
- Que informações são valiosas naquela categoria
- Como formular memórias (usar nome do usuário, ser específico, incluir datas/valores)
- O que evitar (genericidade, informações temporárias)

Categorias são balanceadas: cada uma pode armazenar 350 palavras, permitindo profundidade adequada sem desperdício de orçamento.

### memory-merger.js
Detecta e funde memórias duplicadas ou muito similares para evitar redundância no perfil de longo prazo.

A função `checkAndMerge()` é chamada antes de adicionar nova memória. Gera embedding vetorial do novo conteúdo e compara com memórias existentes na mesma categoria. Usa cosine similarity para encontrar matches. Se similaridade for ≥ threshold (configurável), faz merge ao invés de adicionar duplicata.

A fusão usa `fuseMemories()` que atualmente implementa deduplicação por sentença: divide ambos conteúdos em sentenças, remove duplicatas, reconstrói texto único. Comentários indicam futuro upgrade para fusão baseada em LLM que preserve nuances semânticas.

O impact score da memória fundida é o máximo entre os dois. Contadores de acesso são somados. O embedding vetorial é atualizado com o novo conteúdo fundido.

`detectDuplicates()` varre toda a LTM procurando pares duplicados (útil para manutenção). `batchMergeDuplicates()` executa fusão em lote de todas as duplicatas encontradas, limpando o perfil do usuário. Sempre mantém a memória com maior impact score como keeper.

### profile-manager.js
Interface de alto nível para acessar e organizar o perfil de memória do usuário por categorias.

A função `getProfileByCategory()` retorna todas as memórias de uma categoria específica (ex: preferências do usuário, objetivos estratégicos). `getFullProfile()` retorna perfil completo organizado em estrutura de categorias, facilitando análise holística do usuário.

`getTopMemories()` retorna as N memórias com maior impact score independente de categoria, útil para resumos rápidos do que é mais importante sobre o usuário.

`getCategoryStats()` calcula estatísticas por categoria: quantidade de memórias, impact score médio, total de palavras e média de palavras por memória. Útil para análise de como o perfil está distribuído.

`trackMemoryAccess()` registra quando uma memória é acessada, incrementando contadores que alimentam o cálculo de recorrência no impact score. `removeMemory()` deleta permanentemente uma memória, incluindo seu embedding vetorial.

Trabalha diretamente com o schema `LongTermMemory` do MongoDB mas oferece interface simplificada e estruturada.

### relevance-calculator.js
Calcula impact scores (0 a 1) para memórias usando raciocínio de IA DeepSeek, avaliando cinco fatores ponderados.

A função `calculate()` submete conteúdo e contexto para análise de IA. DeepSeek avalia: **Recurrence** (25% de peso) - frequência de menção/acesso, tema recorrente; **Structurality** (30% de peso) - impacto em finanças, decisões, estratégias; **Durability** (20% de peso) - relevância longa vs efêmera; **Specificity** (15% de peso) - concretude vs genericidade; **Actionability** (10% de peso) - leva a ações concretas.

A IA retorna score de 0 a 1 para cada fator mais reasoning explicando a avaliação. Os scores são combinados usando os pesos para produzir score final. Threshold de 0.7 é usado para admissão em LTM.

O contexto fornecido inclui métricas objetivas: access count (quantas vezes acessada), sourceChats (em quantos chats foi mencionada), mention count, categoria e idade da informação. A IA usa essas métricas para informar sua avaliação qualitativa.

Se a chamada de IA falhar, `calculateFallback()` usa scoring algorítmico simples baseado em keywords relevantes, métricas de acesso e heurísticas. Menos preciso que IA mas garante que o sistema continue funcionando.

Logging detalhado registra score final, reasoning e breakdown de fatores para auditoria e refinamento do modelo de scoring.

### vector-store.js
Camada de abstração para armazenamento vetorial (Pinecone/Qdrant), permitindo busca semântica de memórias por similaridade de significado.

`storeEmbedding()` gera embedding vetorial do conteúdo usando OpenAI (text-embedding-3-small) e armazena no banco vetorial com metadados (userId, categoria, impact score). Retorna vectorId para referência futura.

`search()` realiza busca semântica: dado um query em linguagem natural, gera embedding e busca vetores similares do usuário. Suporta filtros por categoria e minimum similarity score. Retorna memórias mais relevantes ordenadas por similaridade.

`getEmbedding()` recupera vetor por ID, `updateEmbedding()` atualiza quando conteúdo muda, `deleteEmbedding()` remove permanentemente.

**Importante**: O arquivo está configurado para usar Pinecone ou Qdrant mas a integração real ainda não está implementada. Atualmente usa armazenamento em memória volátil (Map global) como fallback temporário. Logs CRÍTICOS alertam que memórias serão perdidas em restart do servidor.

A implementação real requer configurar variáveis de ambiente: `VECTOR_STORE_PROVIDER` (pinecone), `VECTOR_STORE_URL`, `VECTOR_STORE_API_KEY`, `VECTOR_INDEX_NAME`. Comentários no código mostram estrutura das chamadas SDK para implementação futura.

Usado por `long-term-memory.js` para armazenamento e busca, e por `memory-merger.js` para detecção de similaridade.
