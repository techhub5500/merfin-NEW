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
- Cálculos numéricos
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

O Agente Junior segue um processo de classificação em camadas:

### 📥 ETAPA 1 — Recebimento e Análise Inicial
- Recebe query natural do usuário
- Verifica se há contexto de diálogo ativo
- Se há contexto → direciona diretamente ao agente em diálogo

### 🔍 ETAPA 2 — Classificação Primária
Analisa se a query se encaixa em categorias básicas:

- **Trivial:** Saudações, perguntas sobre o sistema, contextos simples
- **Lançamento:** Registro de transações financeiras
- **Simplista:** Consultas operacionais diretas sobre dados
- **Complexa:** Análises, planejamentos, decisões estratégicas

### 📊 ETAPA 3 — Processamento por Categoria

**Para Trivial:**
- Responde diretamente
- Encerra sem acionar outros agentes

**Para Lançamento:**
- Chama Agente Lançador via Message Bus
- Recebe confirmação e repassa ao usuário

**Para Simplista:**
- Chama Agente Simplista via Message Bus
- Recebe resposta e repassa ao usuário

**Para Complexa:**
- Continua para análise secundária

### 🎯 ETAPA 4 — Análise Secundária (Queries Complexas)
Para queries que passam da triagem primária:

- Identifica domínio financeiro principal
- Escolhe até 2 coordenadores candidatos
- Atribui scores de confiança (0-100)
- Seleciona prompts de orquestração apropriados

### 📤 ETAPA 5 — Encaminhamento para Orquestrador
- Monta pacote com sugestões
- Envia para Orquestrador via Message Bus
- Recebe decisão final e coordenada a execução

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

---

## 7. 🔗 Acesso Direto ao Serper

O Agente Junior possui **acesso direto à API do Serper** (parte do Agente de Pesquisa Externa) para consultas rápidas de informação externa quando necessário:

- **Quando usar:** Queries triviais que requerem verificação externa (ex.: "Qual a cotação do dólar hoje?")
- **Acesso direto:** Pode consultar Serper sem passar pelo Agente de Pesquisa completo
- **Limitações:** Apenas para informações factuais simples e rápidas
- **Integração:** Resultados são incorporados na resposta direta

**Exemplo de uso:**
1. Query: "Qual a cotação do dólar hoje?"
2. Junior acessa Serper diretamente
3. Recebe cotação atual
4. Responde: "A cotação atual do dólar é R$ 5,23 (fonte: ...)"
5. Encerra sem acionar outros agentes

Este acesso direto permite respostas completas para queries triviais que precisam de dados externos atualizados.

---

## 8. 💬 Sistema de Contexto de Diálogo

O Agente Junior gerencia o **Modo de Resposta Direta** para diálogos ativos:

### 📝 Quando Ativar
- Lançador ou Simplista iniciam esclarecimento
- Sistema marca contexto ativo
- Próximas respostas vão direto para o agente em diálogo

### 🔄 Gerenciamento
- **Verifica contexto:** Antes de qualquer triagem, checa se há diálogo ativo
- **Direciona diretamente:** Se há contexto, envia para agente específico
- **Detecta transição:** Se resposta indica complexidade, reseta e volta à triagem
- **Mantém eficiência:** Evita retrabalho em conversas simples

### 📝 Exemplo
```
Usuário: "Quanto gastei?"
Junior: classifica como simplista → chama Simplista
Simplista: "Qual período?" → marca contexto
Sistema: "diálogo_ativo: simplista"
Usuário: "Este mês"
Junior: detecta contexto → direto para Simplista
Simplista: responde com dados
```

---

## Colaboração com Outros Agentes

O Agente Junior é o hub central de comunicação:

- **Chama diretamente:** Lançador, Simplista para queries básicas
- **Sugere para Orquestrador:** Coordenadores para queries complexas
- **Acesso especial:** Serper para dados externos em queries triviais
- **Gerencia contexto:** Diálogos ativos com Lançador e Simplista

**Importante:** Junior nunca processa conteúdo - apenas classifica e direciona, garantindo que cada agente especializado receba exatamente o tipo de query que sabe lidar.

Este agente garante que o sistema multi-agente seja acessível e eficiente, respondendo rapidamente queries simples enquanto escala perfeitamente para análises complexas.

## Memória e Contexto

- O Agente Junior consulta sempre o contexto unificado antes de tomar decisões de triagem. Esse contexto é construído pelo `context-builder` e contém: `workingMemory` (memória de sessão), `episodicSummary` (trechos relevantes da memória episódica) e `prompt_current` (texto do usuário).
- Uso prático: o Junior usa `diálogo_ativo` vindo do `workingMemory`/`episodicSummary` para direcionar entradas subsequentes ao agente correto sem re-triagem.
- Regras de acesso: o Junior pode ler `workingMemory` e `episodicSummary` e incluir um resumo do contexto ao encaminhar queries. Não envia memórias completas para o Agente Matemático ou para o Agente de Pesquisa Externa.

