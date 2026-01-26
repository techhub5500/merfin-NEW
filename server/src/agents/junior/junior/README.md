---
agente junior:
## 3. Arquitetura conceitual do agente

O Agente Junior opera como a **porta de entrada inteligente** do sistema multi-agente, sendo o primeiro ponto de contato com o usuário. Ele é responsável por triagem rápida e eficiente, classificando queries e direcionando-as aos agentes apropriados. É o agente mais "leve" do sistema, focado em velocidade e precisão na classificação inicial.

### 📚 Especialização e Limites

O agente é ativado para **todas as queries** do usuário. Ele não realiza análises profundas, cálculos ou decisões estratégicas - apenas classifica e direciona. Sua inteligência está na triagem, não no processamento.

---

## 4. 🔀 Missão do Agente Junior

### Definição Clara
Este agente é responsável por receber todas as queries do usuário e classificá-las rapidamente, direcionando-as aos agentes especializados apropriados ou respondendo diretamente quando trivial.

### ❌ Não é usado para:
- Análises financeiras
- Cálculos numéricos.
- Decisões estratégicas
- Consultas a dados
- Qualquer processamento além da triagem

### ✅ É usado quando:
- Qualquer entrada do usuário
- Sempre é o primeiro agente acionado
- Classificação precisa de domínio
- Respostas diretas para queries triviais

---

## 5. 🧠 Processo de Triagem Inteligente

O Agente Junior segue um processo em camadas:


### 📊 ETAPA 1 — Processamento por Categoria

{aqui o sistema (logica) vai identificar se essa conversa tem contexto (memoria) se tiver os sitema guarda essa memória pois ela pode ser usada por outros agentes. }

**Para Trivial:**
- Responde diretamente
- Encerra sem acionar outros agentes
- sistema envia o contexto  (memoria + prompt atual) para poder responder

**Para Lançamento:**
- Chama Agente Lançador via Message Bus
- Recebe confirmação e repassa ao usuário
- O contexto  (memoria + prompt atual) da conversa nao é enviado, somente o prompt atual.

**Para Simplista:**
- Chama Agente Simplista via Message Bus
- O agente  simplista recebe o contexto (memoria + prompt atual) e elabora a resposta e envia para o usuario.

**Para Complexa:**
- Continua com o junior para análise secundária
- a memoria fica preservada para ser enviada quando passar para o agente coordenador.

Após analisar ele responde com o ID, se o ID for o "Trivial" o sistema (logica) envia para o agente junior responder, agora se for o "Lançamento" ou "Simplista" o sistema envia para o agente de lançamento ou simplista responder, agora se for o ID de "Complexa", o sistema envia o agente junior para a terceira etapa.

### 🎯 ETAPA 2 — Análise Secundária (Queries Complexas)
Para queries que passam da triagem primária:

- Identifica domínio principal (dominio detalhado abaixo)
- Escolhe um agente coordenadores ( detalhados abaixo)
- Seleciona prompts de orquestração apropriados (prompts de orquestração detalhados abaixo)

### Dominio 
- O Domínio é o tema central e a intenção principal do prompt do usuário.
Ele representa sobre o que o usuário realmente quer resolver ou entender, funcionando como a categoria que guia a análise secundária.
O domínio deve ser específico, direto e funcional, evitando descrições vagas

Exemplos de Prompts e Domínios
Prompt: "Quero entender como organizar meu orçamento mensal para conseguir guardar dinheiro sem deixar de aproveitar a vida."
Domínio: Gestao_orcamento_pessoal

Prompt: "Explique quais são os principais tipos de investimentos de baixo risco disponíveis no Brasil."
Domínio: Educacao_investimentos_basicos

Prompt: "Preciso de ajuda para calcular quanto devo investir por mês para alcançar 500 mil reais em 20 anos."
Domínio: Planejamento_financeiro_de_longoprazo

- (📏 Prompt maior)
Prompt: "Estou começando a investir e gostaria de uma análise detalhada sobre como equilibrar minha carteira entre renda fixa, ações e fundos imobiliários, levando em conta meu perfil conservador e objetivo de aposentadoria tranquila."
Domínio: Analise_carteira_investimentos

Prompt: "Quais aplicativos de finanças pessoais são mais recomendados para controlar gastos e planejar investimentos?"
Domínio: Comparacao_ferramentas_financeiras

- (📏 Prompt maior)
Prompt: "Tenho dívidas no cartão de crédito e ao mesmo tempo quero começar a investir. Preciso de uma estratégia clara para quitar minhas dívidas sem perder a oportunidade de iniciar aportes em investimentos simples e seguros."
Domínio: Estrategia_dividas_e_investimentos

Prompt: "Mostre como calcular o impacto da inflação sobre um investimento de renda fixa ao longo de 10 anos."
Domínio: Analise_inflacao_investimentos

- (📏 Prompt maior)
Prompt: "Gostaria de um plano financeiro completo que inclua reserva de emergência, investimentos para médio prazo e estratégias para aposentadoria, considerando que tenho renda variável como autônomo e preciso de estabilidade futura."
Domínio: Planejamento_financeiro_integrado

Na Etapa 2, o agente júnior receberá três arquivos JSON:
- Um arquivo com os IDs dos domínios disponíveis, para que ele escolha o mais adequado.
- Um arquivo com o “contrato” dos três agentes coordenadores, permitindo que, com base no domínio escolhido e no prompt do usuário, selecione o coordenador que melhor se encaixa.
- Um arquivo com os prompts de orquestração, dos quais ele deverá escolher o mais apropriado. ele poderá escolher até 2, o recomendado é um, porem se ele identificar que 2 prompts do sistema pode ser ultil ele pode selecionar até 2.
a logica por tras disso é que o agente coordenador escolhido receba o system prompt mais adequado para ele saber coordenar o processo de orquestraçaõ de tarefas. é melhor o agente junior poder escolher o prompt do sistema mais adequado do que o agente coordenador ter 1 prompt unico para tudo. a titulo de ocntexto o papel do coordenador é estrturar o processo entre outros agentes que ele terá acesso inclusive outros coordenadores para fazer a melhor resposta possivel para o usuario.

É fundamental que o system prompt do agente júnior seja estruturado de forma clara, mostrando a ordem correta do processo:
- Primeiro, a escolha do domínio.
- Em seguida, a escolha do agente coordenador.
- Por fim, a escolha do prompt de orquestração.
A resposta do agente júnior deve sempre ser um JSON indicando suas escolhas, para que a lógica do sistema consiga recuperar cada elemento e avançar para a próxima etapa.


os agentes coordenadores são: agente de analises, investimentos e planejamentos.


### 📤 ETAPA 3 — Encaminhamento para Orquestrador
- O sistema monta o pacote com o system prompt escolhido + contexto (memoria do sistema + prompt atual)
- Envia para Orquestrador escolhido
---

## 6. 📋 Exemplos de Classificação

### Trivial
- "Oi" → Responde saudação
- "O que você faz?" → Explica sistema
- "Obrigado" → Agradece

### Lançamento
- "Gastei R$ 150 no supermercado" → Chama Lançador
- "Recebi meu salário de R$ 5.000" → Chama Lançador

### Simplista
- "Quanto gastei este mês?" → Chama Simplista
- "Qual meu saldo atual?" → Chama Simplista
- "Quanto tenho em conta corrente?" → Chama Simplista
- "Quanto investi no total?" → Chama Simplista
- "Qual meu patrimônio líquido?" → Chama Simplista
- "Quanto tenho em reserva de emergência?" → Chama Simplista
- "Quanto economizei este ano?" → Chama Simplista
- "Quanto paguei de juros este ano?" → Chama Simplista

### Complexa
- "Como melhorar minhas finanças?" → Análise secundária → Coordenadores
- "Quero investir em ações" → Análise secundária → Coordenadores

### MUITO IMPORTANTE:

Após implementar o agente júnior possuirá três funcionalidades principais:

- Classificação primária e processamento por categoria – responsável por identificar e organizar o domínio inicial da requisição.

- Resposta direta ao usuário (quando trivial) – utilizada em casos simples, sem necessidade de coordenação complexa.

- Análise secundária – aplicada em queries mais elaboradas, que exigem encaminhamento para agentes coordenadores.
Por questões de especificação, economia de tokens e redução de latência, o agente júnior terá um system prompt específico para cada funcionalidade.

- O primeiro prompt enviado será sempre o de classificação primária e processamento por categoria.
- Em seguida, apenas mais um system prompt será enviado, escolhido com base no ID retornado pelo agente júnior (podendo ser o de resposta trivial ou o de análise secundária).

Ou seja, não são enviados os três prompts ao mesmo tempo. Apenas dois system prompts são utilizados, de forma escalonada e sequencial, conforme a etapa do processo.

Atualmente, o agente júnior está funcional, mas foi originalmente criado para atuar como único agente. Agora, é necessário adaptar sua lógica para que ele assuma apenas o papel de responder questões triviais e, ao mesmo tempo, incorporar suas novas funcionalidades de classificação e análise secundária. Além disso, o agente júnior nas novas etapas sempre utilizará o modelo GPT‑5 Mini, configurado com reasoning e verbosity low. Essa configuração já está implementada no código atual.
A titulo de informação você pode acessar o arquivo "docs\junior-agent.md", pode ter informação ou outra desuatualizada, porém a ideia central de como ele funciona atualmente está completa.

1. Foco Atual: Agente Junior Completo O Agente Junior deve estar 100% funcional antes da implementação profunda dos especialistas. Ele é o cérebro da triagem e deve ser capaz de:

Classificar em: Trivial, Lançamento, Simplista ou Complexa.

Executar a análise secundária para queries complexas com precisão cirúrgica.

Retornar o JSON de roteamento para a lógica do sistema.

2. Status dos Agentes Especialistas (Mock-up de Teste) Enquanto os agentes coordenadores não são desenvolvidos em sua totalidade, utilizaremos "Agentes de Teste".

Modelo: GPT-5 Mini (Reasoning: middle / Verbosity: middle).

Comportamento: Devem apenas confirmar o recebimento do pacote e descrever brevemente o que fariam com os dados recebidos.

3. Lógica de Envio (Handover) O Agente Junior deve preparar o pacote de saída para a lógica do sistema seguindo o contrato:

Se Complexa: O sistema captura o coordenador_selecionado, busca o conteúdo dos prompts_orquestracao_ids escolhidos pelo Junior e injeta no system_prompt do coordenador junto com o contexto (Memória + Prompt atual).


Novos Arquivos JSON (Conteúdo para Testes)
em server\src\agents\jsons\prompts_orquestracao.json:

Já temos os arquivos estruturados da seguinte forma:
- Pasta: server\src\agents\jsons
- Contém o arquivo domínios.json.
- Contém o arquivo prompts_orquestracao.json.
- Observação: Os arquivos JSON com o conteúdo dos prompts de orquestração ainda não foram criados. Eles devem ser gerados apenas para fins de teste.
- Após a finalização de todo o processo, farei as modificações necessárias diretamente nos arquivos JSON, sem alterar a lógica do sistema.
- A estrutura desses arquivos jsons é simples:
- Utilizar o mesmo ID definido em prompts_orquestracao.json.
- Incluir o conteúdo correspondente no campo "system_prompt".
- Deve ser criado um JSON separado para cada system prompt.
- Para saber quais prompts de orquestração precisam ser criados, siga exatamente o que está definido em prompts_orquestracao.json.


- Pasta: server\src\agents\contratos
- Contém os arquivos JSON dos contratos de cada agente.


System Prompts Básicos (Para os Coordenadores de Teste)
Estes prompts devem ser usados na sua lógica de backend apenas para validar se o Agente Junior está enviando as coisas certas para o lugar certo:

Para o Agente de Análises:
"Você é o Agente de Análises (VERSÃO DE TESTE). Sua função é receber dados de gastos e identificar padrões. Status atual: Aguardando implementação profunda. Sua tarefa agora: Apenas valide se você recebeu o domínio e o prompt de orquestração corretos do Agente Junior e dê um breve insight."

Para o Agente de Investimentos:
"Você é o Agente de Investimentos (VERSÃO DE TESTE). Sua função é sugerir alocações. Status atual: Aguardando implementação profunda. Sua tarefa agora: Liste os investimentos que você analisaria com base no domínio enviado pelo Junior."

Para o Agente de Planejamentos:
"Você é o Agente de Planejamento (VERSÃO DE TESTE). Sua função é criar planos de longo prazo. Status atual: Aguardando implementação profunda. Sua tarefa agora: Estruture um cronograma básico (Passo 1, 2 e 3) com base no que o Junior roteou para você."


Todos os arquivos JSON (Domínios, Contratos e Prompts de Orquestração e +) criados nesta fase são exclusivamente para testes de funcionamento e validação de fluxo.

A Lógica do Sistema: O código que lê os arquivos, chama as APIs e faz o roteamento (Handover) deve ser final e robusto.

O Conteúdo: Os textos dentro dos JSONs serão modificados para "Produção" posteriormente. Nenhuma alteração na lógica de programação deve ser necessária quando trocarmos os textos dos prompts.