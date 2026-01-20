# Data Agent - Módulo de Acesso a Dados

Esta pasta contém o agente responsável por todas as operações de leitura de dados financeiros do sistema, incluindo contas, transações e perfil do usuário.

## Arquivos e Responsabilidades

### data-agent.js
O arquivo central do módulo, responsável por orquestrar todas as operações de leitura de dados financeiros. Ele funciona como um agente especializado que responde a cinco ações principais: buscar saldos de contas, buscar transações, buscar perfil do usuário, buscar sumário de contas e validar integridade dos dados.

Este arquivo estende a classe `BaseAgent` e utiliza um sistema de mapeamento de ações, onde cada requisição é direcionada para o método correspondente. Toda operação passa por validação de parâmetros obrigatórios e integra o sistema de cache de forma transparente. Quando uma informação é requisitada, o agente primeiro verifica se existe uma versão em cache válida antes de consultar o banco de dados, garantindo performance ideal.

O arquivo serve de modelo para outros agentes do sistema e é utilizado tanto pelo orquestrador quanto diretamente pela API. Ele não executa queries diretamente no banco, delegando essa responsabilidade para módulos especializados.

### account-queries.js
Módulo especializado em buscar informações de contas bancárias do MongoDB. Suas responsabilidades incluem recuperar saldos de contas individuais ou múltiplas, obter detalhes completos de uma conta específica e agrupar contas por status.

Quando busca saldos, o arquivo calcula automaticamente o saldo total do usuário somando todas as contas ativas. Ele sempre filtra contas fechadas por padrão, a menos que explicitamente solicitado. As queries são otimizadas com índices em `user_id` e `status` para garantir velocidade de resposta.

Este arquivo é consumido exclusivamente pelo `data-agent.js` através da ação `fetchAccountBalance`. Ele trabalha diretamente com o schema de contas do MongoDB, transformando documentos do banco em objetos de resposta padronizados.

### transaction-queries.js
Responsável por buscar e filtrar transações financeiras com suporte a paginação e agregações. Este arquivo permite buscar o histórico de transações de um usuário com diversos filtros: período de datas, tipo de transação (receita ou despesa), status, conta específica e seção (extrato, agendado, cartão de crédito, dívidas, ativos).

Além de retornar a lista de transações, o arquivo calcula automaticamente sumários financeiros como total de receitas, total de despesas e fluxo líquido. As transações são sempre ordenadas da mais recente para a mais antiga, facilitando a visualização do histórico.

O arquivo implementa limite de resultados por query (padrão de 100 transações) e suporte a paginação através dos parâmetros `limit` e `skip`. As queries são otimizadas com índices em `userId` + `date` e `accountId` + `status`. É utilizado pelo `data-agent.js` através das ações `fetchTransactions` e `fetchAccountSummary`.

### user-queries.js
Módulo dedicado a buscar o perfil financeiro completo do usuário do MongoDB. Ele recupera informações essenciais como avaliação de risco (conservador, moderado ou agressivo), objetivos de investimento, situação financeira mensal e preferências do usuário.

O perfil de risco é calculado a partir de um questionário respondido pelo usuário e usado pelos agentes de análise e estratégia para personalizar recomendações de investimento. O arquivo também calcula métricas derivadas como a taxa de poupança mensal, baseada na diferença entre receitas e despesas.

Por se tratar de dados que mudam raramente (apenas quando o usuário refaz o questionário), este arquivo trabalha com cache de TTL longo (30 minutos). Ele oferece opções para incluir ou não as respostas completas do questionário de avaliação de risco, economizando largura de banda quando apenas o perfil consolidado é necessário.

É consumido pelo `data-agent.js` através da ação `fetchUserProfile` e serve de base para decisões dos agentes de análise financeira e estratégia de investimento.

### data-validator.js
Arquivo responsável por validar a integridade dos dados financeiros armazenados no sistema. Ele detecta sete tipos de inconsistências: saldos negativos inválidos, transações com datas futuras, transações órfãs (sem conta associada), valores inválidos, incompatibilidades de moeda, transações duplicadas e inconsistências no perfil do usuário.

Este arquivo **não modifica dados**, apenas reporta problemas encontrados. Cada verificação retorna uma lista de issues (problemas graves) e warnings (alertas), classificados por severidade. É útil para auditoria periódica do sistema e detecção de bugs.

Pode ser executado sob demanda através da ação `validateDataIntegrity` do `data-agent.js` ou agendado via cron para validações automáticas. Os resultados são logados e retornados para análise pela equipe técnica.

### cache-manager.js
Gerenciador de cache especializado para o Data Agent. Este arquivo funciona como um wrapper do ToolContext (sistema central de cache), adicionando lógica específica para dados financeiros.

Suas responsabilidades incluem gerar chaves de cache consistentes, aplicar TTLs (tempo de vida) apropriados por tipo de dado e invalidar cache de forma inteligente quando dados mudam. Por exemplo: dados de perfil do usuário têm cache longo (30 minutos) pois mudam raramente, enquanto saldos e transações têm cache curto (5 minutos) pois são mais voláteis.

O arquivo implementa invalidação inteligente por padrões: ao invalidar o cache de um usuário, automaticamente limpa todas as chaves relacionadas (saldos, transações, perfil, sumários). Ele também coleta estatísticas de hit/miss do cache, úteis para análise de performance do sistema.

É utilizado internamente por todos os métodos do `data-agent.js`, tornando o cache transparente para quem consome o agente. Logs automáticos registram cada operação de cache para diagnóstico e otimização.
