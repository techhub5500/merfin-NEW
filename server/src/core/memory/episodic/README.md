# Episodic Memory - Memória de Chat Persistente

Esta pasta contém o sistema de memória episódica, responsável por gerenciar o contexto persistente de cada conversa (chat) individual com o usuário, incluindo curadoria inteligente via IA e compressão automática.

## Arquivos e Responsabilidades

### episodic-memory.js
Arquivo central que gerencia operações CRUD (criar, ler, atualizar, deletar) para memórias específicas de cada chat. Cada conversa tem sua própria memória isolada, que persiste informações relevantes sobre preferências, decisões e contexto do usuário.

O arquivo implementa curadoria inteligente usando DeepSeek AI, antes de armazenar qualquer conteúdo, a chave da api do deepsick esta em .env esta em "C:\Users\edmar\OneDrive\Desktop\Nova pasta\.env" como "DEEPSEEK_API_KEY"  . A IA analisa se o conteúdo é relevante, remove informações sensíveis (senhas, CPF, detalhes de cartão) e sanitiza dados antes do armazenamento. Conteúdo spam, irrelevante ou malicioso é rejeitado automaticamente. Conteúdo válido é limpo mas preserva seu significado essencial.

Cada memória episódica tem um orçamento de 500 palavras. Quando o conteúdo atinge 80% desse limite (400 palavras), o sistema automaticamente comprime a memória para 60% do orçamento (300 palavras), priorizando informações mais importantes. A compressão pode usar IA ou regras determinísticas. 

Memórias episódicas têm expiração automática: após 20 dias de inatividade (inatividade = chat da memoria nao utilizado), são excluidas. Toda atualização no chat renova esse prazo. O arquivo persiste dados no MongoDB através do schema `episodic-memory-schema` e mantém contadores de compressão e timestamps de última compressão para auditoria.

Oferece funções para criar nova memória de chat, atualizar (com merge ou substituição), obter memória atual, comprimir manualmente, arquivar (definir expiração), deletar permanentemente e listar todas as memórias de um usuário.

### chat-state-manager.js
Wrapper de alto nível sobre o `episodic-memory.js` que adiciona lógica específica de gerenciamento de estado de chat. Funciona como uma camada de abstração simplificada para operações comuns de ciclo de vida de conversas. 

O arquivo oferece niterface amigável para inicializar um novo chat (criando sua memória), atualizar o estado da conversa, recuperar o estado atual (retornando apenas o conteúdo da memória, não metadados internos), encerrar um chat (arquivando sua memória para expiração futura) e deletar completamente um chat.

Esta camada de abstração facilita a integração com o sistema de chat, isolando a complexidade da gestão de memória. Outros módulos podem usar este arquivo sem precisar entender detalhes internos de curadoria, compressão ou persistência. Delega todas as operações complexas para o `episodic-memory.js`.

### compression-engine.js
Motor responsável por decidir quando e como comprimir memórias episódicas. Monitora continuamente o tamanho das memórias e dispara compressão automática quando necessário.

A função `needsCompression()` verifica se uma memória está próxima do limite (padrão: 80% do orçamento de 500 palavras, ou seja, 400 palavras). Quando esse threshold é atingido, a função `compressEpisodicMemory()` é chamada para reduzir o tamanho.

A compressão deve acontecer da seguinte forma: usando LLM deepseeck para decidir o que manter. 

O arquivo define target de compressão: reduzir para 60% do orçamento (300 palavras), deixando margem para crescimento futuro antes da próxima compressão. Retorna metadados sobre o processo: palavras antes e depois, taxa de compressão e método usado.

É chamado automaticamente pelo `episodic-memory.js` durante atualizações quando detecta proximidade do limite. Integra-se com módulos compartilhados (`word-counter`, `memory-compressor`) para realizar a compressão efetiva.

### relevance-scorer.js
Sistema de pontuação de relevância usando DeepSeek AI para avaliar a importância de fragmentos de memória. Usado durante compressão para decidir quais informações priorizar e quais descartar.

A função `scoreFragment()` analisa um fragmento de texto e retorna score de 0 a 1 indicando sua relevância. A IA considera cinco fatores: valor estratégico (contém estratégias de investimento?), especificidade (é concreto ou genérico?), unicidade (comportamento único do usuário ou informação comum?), utilidade futura (pode ser útil em conversas futuras?) e contexto de recência (informações recentes têm peso configurável).

A análise usa keywords fornecidas como contexto e considera o contexto geral do chat. Se a chamada à IA falhar, um fallback simples usa matching de keywords e recency para calcular score básico.

A função `prioritizeInformation()` processa um objeto de memória completo e identifica quais campos/itens são mais valiosos para manter quando o espaço é limitado. Prioriza estratégias de investimento, preferências do usuário, tolerância a risco, decisões financeiras importantes e padrões comportamentais únicos.

É utilizada pelo compression-engine durante compressão inteligente para maximizar a retenção de informações valiosas enquanto descarta conteúdo menos relevante. Logging detalhado explica decisões de priorização para auditoria.
