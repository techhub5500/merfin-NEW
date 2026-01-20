# Shared - Utilitários Compartilhados do Sistema de Memória

Esta pasta contém módulos utilitários reutilizados por todos os tipos de memória (working, episódica e longo prazo), garantindo consistência e reduzindo duplicação de código.

## Arquivos e Responsabilidades

### memory-types.js
Arquivo central que define todas as constantes, orçamentos e thresholds do sistema de memória. Funciona como fonte única da verdade para valores configuráveis relacionados à memória.

Define três escopos de memória: **WORKING** (volátil, por sessão, 700 palavras), **EPISODIC** (persistente por chat, 500 palavras, expira após inatividade) e **LONG_TERM** (persistente cross-chat, 400 palavras, curadoria rigorosa).

Os orçamentos de palavras são estrategicamente definidos: Working tem mais espaço pois armazena temporariamente contexto de raciocínio complexo. Episódica é intermediária para contexto de conversa. Long-term é mais restrita pois armazena apenas informações altamente relevantes permanentes.

Define thresholds de impact score: mínimo de 0.5 para manter em qualquer memória, 0.7 para promoção a long-term e 0.8 como gatilho de compressão (quando memória atinge 80% do orçamento).

Thresholds de similaridade para merge (0.85) e detecção de duplicatas (0.9) são usados pelo sistema de deduplicação. Categorias de LTM são definidas: comunicação, perfil financeiro, comportamental, objetivos e relação com plataforma.

Toda configuração de memória deve usar estas constantes para garantir comportamento consistente em todo o sistema.

### word-counter.js
Utilitário preciso para contar palavras em conteúdo de memória, essencial para enforcement dos orçamentos.

A função `count()` detecta automaticamente se o conteúdo é string ou objeto. Para strings, divide por whitespace e conta tokens. Para objetos JSON, recursivamente extrai strings de todas as propriedades e conta palavras totais. Números e booleanos contam como 1 palavra.

`isNearLimit()` verifica se a contagem atual está próxima do limite (padrão: 80%), disparando alertas ou compressão automática. `percentageUsed()` calcula quanto do orçamento foi consumido (0-100%), útil para dashboards e logs.

`remainingWords()` retorna espaço disponível antes de atingir o limite. Funções auxiliares `countWordsInString()` e `countWordsInObject()` permitem contagem específica por tipo quando necessário.

Usado por todos os módulos de memória antes de armazenar conteúdo para garantir que orçamentos não sejam excedidos. Integra-se com sistemas de validação e compressão.

### hard-rules.js
Define regras não negociáveis de segurança e validação que protegem dados sensíveis e previnem armazenamento de conteúdo inadequado.

Contém lista extensiva de padrões proibidos via regex: autenticação (password, token, api_key), identificação pessoal (CPF, CNPJ, RG, passaporte), dados financeiros sensíveis (número de cartão, CVV, conta corrente) e internos do sistema (connection strings, JWT, private keys).

A função `containsForbiddenContent()` escaneia texto procurando estes padrões, rejeitando memórias que contenham dados sensíveis antes mesmo de chegarem ao banco de dados. Isso previne vazamentos acidentais de credenciais ou dados pessoais.

Lista de conteúdo proibido em LTM inclui valores temporários, cálculos intermediários, hipóteses não confirmadas, raciocínio interno de agentes, debug info e stack traces - todos efêmeros demais para armazenamento permanente.

Define gatilhos de compressão (EPISODIC: 400 palavras / LONG_TERM: 320 palavras, representando 80% dos orçamentos) e regras de limpeza automática (working: 40 minutos, episódica: 30 dias inatividade, 90 dias idade máxima).

`isSuitableForLTM()` valida se conteúdo tem características de longo prazo ou é efêmero demais. Usado pela curadoria antes de aceitar memórias para armazenamento permanente.

### memory-validator.js
Sistema universal de validação que verifica todas as memórias contra múltiplas dimensões antes do armazenamento.

`checkHardRules()` valida contra regras de segurança, rejeitando conteúdo com dados sensíveis. `checkScope()` verifica se memória é apropriada para o escopo pretendido (working/episodic/long-term), aplicando restrições extras para LTM.

`checkBudget()` calcula se adicionar novo conteúdo excederia o orçamento de palavras do tipo de memória. Se sim, rejeita. Se próximo do limite, emite warning sugerindo compressão. `checkImpact()` valida que memórias long-term têm impact score mínimo de 0.7.

`validateMemory()` é a função principal que orquestra todas as validações: executa hard rules, verifica escopo apropriado, checa orçamento de palavras e valida impact score (se aplicável). Retorna objeto com `valid` (boolean), `errors` (array de mensagens críticas) e `warnings` (array de alertas não bloqueantes).

Usado por episodic-memory.js, long-term-memory.js e working memory antes de persistir dados. Garante que apenas memórias seguras, relevantes e dentro do orçamento sejam armazenadas. Logging automático de violações facilita auditoria.

### memory-compressor.js
Motor de compressão de memórias que reduz verbosidade preservando essência do conteúdo.

Oferece dois modos de compressão: **LLM-based** (inteligente, preserva semanticamente informações críticas) e **rule-based** (rápido, determinístico, usa heurísticas).

`compressWithLLM()` usa modelo de linguagem (passado como parâmetro) para reduzir texto a target de palavras. Prompt instrui o modelo a preservar fatos críticos, padrões comportamentais, decisões, preferências e contexto relevante enquanto remove redundância, exemplos desnecessários e detalhes. Se LLM falhar, fallback para rule-based.

`compressRuleBased()` aplica cinco regras: remove whitespace extra, elimina palavras de preenchimento comuns (muito, realmente, basicamente), simplifica frases redundantes (no momento atual → atualmente), remove sentenças duplicadas e trunca por sentenças se ainda exceder target.

`compress()` é wrapper inteligente que seleciona automaticamente o método: usa LLM se disponível e não forçado rule-based, senão usa regras. Verifica primeiro se compressão é necessária (conteúdo já dentro do target).

Chamado automaticamente por episodic-memory e long-term-memory quando detectam proximidade do limite de palavras. Pode também ser invocado manualmente para otimizar espaço. Logging registra taxa de compressão e método usado.

### embedding-generator.js
Interface para geração de embeddings vetoriais usados em busca semântica de memórias.

`generate()` converte texto em vetor de 1536 dimensões usando OpenAI text-embedding-3-small. `generateBatch()` processa múltiplos textos simultaneamente para eficiência. `cosineSimilarity()` calcula similaridade entre dois vetores (resultado -1 a 1, onde 1 é idêntico).

`findMostSimilar()` busca os K vetores mais similares a um query vector em uma lista, ordenando por score de similaridade.

**Importante**: O arquivo está configurado para usar OpenAI Embeddings mas a integração real ainda não está implementada. Atualmente retorna embeddings mock (vetores aleatórios) como placeholder. Logs CRÍTICOS alertam que busca semântica não funcionará corretamente sem configuração real.

Requer variável de ambiente `OPENAI_API_KEY` e instalação do SDK (`npm install openai`). Comentários no código mostram exatamente como integrar quando a chave estiver disponível.

Usado por vector-store.js (long-term memory) e memory-merger.js para detecção de similaridade. Sem embeddings reais, o sistema funcionará mas busca semântica será degradada.

### memory-validator.js (continuação)
A validação é não bloqueante para warnings mas bloqueante para errors. Por exemplo: se memória está a 85% do orçamento, emite warning mas permite armazenamento. Se excede 100%, emite error e rejeita.

Estrutura de retorno padronizada (`ValidationResult`) facilita tratamento consistente de resultados em todos os módulos de memória. Arrays de `errors` e `warnings` permitem coletar múltiplos problemas em uma única passagem de validação.

O validador é stateless e puro, facilitando testes e debugging. Toda lógica de regras está delegada para hard-rules.js e memory-types.js, mantendo este arquivo focado apenas em orquestração de validações.
