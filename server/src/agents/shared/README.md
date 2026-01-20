# Shared - Módulos Compartilhados dos Agentes

Esta pasta contém componentes fundamentais reutilizados por todos os agentes do sistema, garantindo consistência, padronização e redução de duplicação de código.

## Arquivos e Responsabilidades

### base-agent.js
Classe abstrata que serve como fundação para todos os agentes do sistema. Ela define o contrato padrão que cada agente deve seguir e fornece métodos auxiliares compartilhados, eliminando a necessidade de reimplementar funcionalidades comuns.

Cada agente concreto (DataAgent, AnalystAgent, etc.) estende esta classe e implementa o método `execute()`, onde fica sua lógica específica. A classe base fornece automaticamente logging estruturado, formatação padronizada de respostas, tratamento centralizado de erros e validação básica de requisições.

Quando um agente é chamado, o método `run()` da classe base gerencia todo o ciclo de vida da requisição: registra o início da operação, valida a estrutura da requisição, executa a lógica específica do agente, captura erros e formata a resposta final. Isso garante que todos os agentes se comportem de forma previsível e consistente.

A classe também gera IDs únicos para rastreamento de requisições, mede tempo de execução automaticamente e integra-se perfeitamente com os sistemas de logging e formatação de resposta. Não pode ser instanciada diretamente, apenas estendida.

### constants.js
Arquivo central que define todas as constantes utilizadas pelos agentes, funcionando como fonte única da verdade para valores configuráveis do sistema. Qualquer valor que precise ser consistente entre múltiplos agentes deve estar definido aqui.

O arquivo organiza constantes em categorias: níveis de complexidade de tarefas (que determinam quantos ciclos ReAct são permitidos), status de transações e contas, perfis de risco do usuário, limites de ciclos, TTLs de cache por tipo de dado, timeouts de operações, limites de dados por query e moedas suportadas.

Uma das seções mais importantes é o mapeamento de ações por agente, que define quais operações cada agente pode executar. Isso é usado pelo orquestrador para decidir qual agente chamar para cada tarefa. Os TTLs de cache são estrategicamente definidos: dados que mudam raramente (perfil do usuário) têm cache longo (30 minutos), enquanto dados voláteis (saldos) têm cache curto (1 minuto).

Modificar valores aqui afeta automaticamente todo o sistema sem necessidade de alterar código dos agentes individuais. É importado por praticamente todos os módulos do sistema de agentes.

### contracts.js
Define os contratos (schemas) de requisição e resposta para comunicação entre agentes e orquestrador. Utiliza a biblioteca Joi para validação rigorosa da estrutura de dados, garantindo que apenas requisições bem formadas sejam processadas.

O arquivo especifica exatamente como uma requisição deve ser estruturada: deve conter campos obrigatórios como `agent_name` e `action`, pode incluir `parameters` e `context`, e cada campo tem tipo e validações específicas. O mesmo vale para respostas: respostas de sucesso devem incluir `status: 'success'`, `data` e `metadata` com timestamp e tempo de execução.

Existem dois schemas de resposta: um para sucesso e outro para erro. Respostas de erro seguem um formato específico com código de erro, mensagem, tipo e detalhes opcionais. Isso permite que o orquestrador e o frontend tratem erros de forma consistente, independentemente de qual agente os gerou.

As funções de validação (`validateRequest`, `validateSuccessResponse`, `validateErrorResponse`) retornam objetos indicando se a validação passou e, em caso de falha, qual foi o problema. Isso previne que requisições malformadas cheguem aos agentes e causem comportamentos inesperados.

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
