

# ARQUITETURA COMPLETA DO AGENTE DE PESQUISA EXTERNA (EXECUTOR)

---

## 1. IDENTIDADE E PAPEL

### Nome

**Agente de Pesquisa Externa**

### Tipo

**Executor Operacional**

### Especialização

Coleta inteligente de dados externos através de múltiplas fontes (Brapi, Tavily, Serper), com roteamento automático baseado no tipo de informação solicitada e execução paralela para otimização de performance.

### O que Executa vs O que NÃO Executa

**✅ EXECUTA:**

-  Análise semântica da requisição para identificar tipo de dado necessário
- Descoberta de entidades necessárias à execução (ex: identificar ticker de ações/FIIs, códigos de moedas, códigos de fundos, setores ou ativos listados quando não fornecido)
- Roteamento inteligente para fonte(s) apropriada(s)
- Execução paralela de chamadas quando múltiplas fontes são necessárias
- Validação e normalização de dados retornados
- Fallbacks automáticos em caso de falha de fonte primária
- Consolidação de dados de múltiplas fontes em resposta unificada

**❌ NÃO EXECUTA:**

- Decisões estratégicas sobre quais dados coletar
- Análise ou interpretação dos dados coletados
- Chamadas a outros agentes
- Planejamento de múltiplas operações

---

## 2. CONTRATO DO AGENTE

### 2.1 Operações Disponíveis

#### Operação: `pesquisa_mercado_financeiro`

**Descrição:** Coleta dados de mercado, fundamentos, notícias e contextos sobre ativos, economia e mercado financeiro.

**Parâmetros Obrigatórios:**

json

```json
{
  "objetivo": "string - Descrição clara do que precisa ser pesquisado",
  "contexto": "string - Contexto adicional para melhorar precisão da busca"
}
```

**Parâmetros Opcionais:**

json

```json
{
  "tickers": ["string"] - Lista de tickers se aplicável (ex: ["PETR4", "VALE3"]),
  "periodo": "string - Período temporal se aplicável (ex: 'ontem', 'última semana', '2024')",
  "profundidade": "basica|media|profunda - Nível de profundidade da pesquisa (padrão: media)",
  "priorizar_velocidade": "boolean - Se true, prioriza cache e respostas rápidas (padrão: false)",
  "fontes_preferidas": ["brapi"|"tavily"|"serper"] - Força uso de fontes específicas (opcional)
}
```

**Tempo Médio de Execução:**

- Básica (1 fonte): 2-5 segundos
- Média (2 fontes paralelas): 4-8 segundos
- Profunda (3 fontes + análise): 8-15 segundos

---

### 2.2 Sistema de Fallback (Hierárquico)

#### **Fallback Nível 1: Cache Inteligente**

- **Quando usar:** Fonte primária indisponível + cache < 24h para dados numéricos ou < 6h para notícias
- **Confiabilidade:** 85 (dados numéricos) / 70 (notícias)
- **Advertência:** "Dados de cache de [X] horas atrás"

#### **Fallback Nível 2: Fonte Alternativa**

**Para dados estruturados (Brapi primária):**

- Alternativa 1: Serper (busca factual alternativa para códigos ou dados)
- Alternativa 2: Cache antigo (até 48h para dados numéricos)

**Para contexto qualitativo (Tavily primária):**

- Alternativa 1: Serper (menos profundo mas mais rápido)
- Alternativa 2: Cache antigo (até 7 dias se permitido)


**Para fatos triviais (Serper primária):**

- Alternativa 1: Tavily (mais lento mas funciona)
- Alternativa 2: Cache sem restrição de tempo


#### **Fallback Nível 3: Resposta Parcial**

- Se conseguiu dados de apenas 1 fonte quando planejava 2+
- Retorna dados disponíveis com advertência clara


#### **Fallback Nível 4: Erro Estruturado**

- Todos os fallbacks falharam
- Retorna erro com diagnóstico detalhado:
    - Quais fontes foram tentadas
    - Por que cada uma falhou
    - Sugestão de retry ou abordagem alternativa

---

## 2.3 Inteligência de Cache Dinâmica e Invalidação Proativa

O cache é **global e compartilhado** entre todos os usuários, pois os dados de mercado financeiro (ex.: preços de ações, indicadores econômicos) são públicos e não variam por usuário. Por exemplo, se o usuário X pergunta "qual foi o P/L da Petrobras no último trimestre" e 2 horas depois o usuário Y faz a mesma pergunta, o sistema serve a resposta diretamente do cache global sem nova consulta à API, economizando recursos e reduzindo latência.

### TTLs Dinâmicos por Grupo de Dados
Substituímos o cache estático por TTLs dinâmicos baseados na volatilidade e frequência de atualização dos dados:

- **5 horas**: Dados altamente voláteis ou de curto prazo.
- **24 horas**: Dados moderadamente voláteis ou diários.
- **3 dias**: Dados estáveis ou históricos de longo prazo.

### Lista de 10 Grupos de Itens e TTL Associado
1. **Preços atuais de ações/FIIs**: 5 horas (ex.: cotação de PETR4) – Alta volatilidade intradiária.
2. **Indicadores econômicos diários**: 5 horas (ex.: SELIC, IPCA) – Atualizados diariamente, mas sensíveis a anúncios.
3. **Cotações de moedas**: 5 horas (ex.: USD/BRL) – Flutuam rapidamente.
4. **Preços de criptomoedas**: 5 horas (ex.: BTC) – Extrema volatilidade.
5. **Dividendos e yields atuais**: 24 horas (ex.: dividend yield de TAEE11) – Atualizados mensalmente, mas com anúncios.
6. **Fundamentalistas básicos**: 24 horas (ex.: P/L, ROE de ações) – Mudam trimestralmente, mas cache diário é seguro.
7. **Notícias e análises qualitativas**: 6 horas (ex.: contexto de queda de ação) – Notícias frescas são críticas.
8. **Históricos semanais/mensais**: 24 horas (ex.: variação nos últimos 30 dias) – Dados recentes, mas não em tempo real.
9. **Dados históricos anuais**: 3 dias (ex.: receita anual da empresa) – Estáveis, mas com balanços trimestrais.
10. **Fatos triviais administrativos**: 3 dias (ex.: sede da empresa, data de fundação) – Raramente mudam.

### Invalidação Proativa
- **Baseada em Eventos**: Invalida cache se detectar mudanças via Serper (ex.: "anúncio de balanço da Petrobras" invalida dados fundamentalistas).
- **Volatilidade Dinâmica**: Ajusta TTL se volatilidade exceder threshold (ex.: ação com variação >5% em 1h reduz TTL para 2h).

---

## 3. MOTOR DE ROTEAMENTO INTELIGENTE

### 3.1 Extração do "Coração da Dúvida"

Antes de qualquer chamada externa, o agente processa a requisição através de um **analisador semântico** que identifica:

1. **Entidades Financeiras:** Tickers, índices, moedas, indicadores econômicos
2. **Tipo de Informação:** Numérica, qualitativa, factual, temporal
3. **Intenção da Busca:** Preço/cotação, fundamentos, notícias, opinião, contexto histórico
4. **Janela Temporal:** Tempo real, histórico recente, longo prazo

**Exemplo de Processamento:**

**Input:**

json

```json
{
  "objetivo": "A Petrobras caiu 3% ontem, por que isso aconteceu?",
  "contexto": "Usuário quer entender causa da queda para decidir se compra"
}
```

**Análise Semântica:**

json

````json
{
  "entidades": ["PETR4"],
  "tipo_informacao": ["numerica", "qualitativa"],
  "intencao": ["validar_queda", "entender_causa"],
  "janela_temporal": "ontem",
  "keywords_criticas": ["caiu", "3%", "por que"]
}
```

---

### 3.2 Regras de Roteamento (Decision Tree)
```
┌─────────────────────────────────────────────┐
│   ANÁLISE SEMÂNTICA DA REQUISIÇÃO          │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ Contém TICKER ou termo financeiro           │
│ estruturado? (PETR4, IPCA, USD/BRL)         │
└─────┬───────────────────────┬───────────────┘
      │ SIM                   │ NÃO
      ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│ Busca NUMÉRICA? │     │ Busca QUALITATIVA│
│ (preço, P/L,    │     │ ou FACTUAL?      │
│ dividendos)     │     │                  │
└────┬────────────┘     └────┬─────────────┘
     │ SIM                   │
     ▼                       ▼
┌──────────┐         ┌─────────────────┐
│  BRAPI   │         │ Precisa ANÁLISE │
│ (primária)│         │ ou OPINIÃO?     │
└──────────┘         └────┬────────────┘
                          │ SIM    │ NÃO
                          ▼        ▼
                   ┌─────────┐  ┌────────┐
                   │ TAVILY  │  │ SERPER │
                   └─────────┘  └────────┘
````

#### **Regra 1: BRAPI (Dados Estruturados)**

**Dispara quando:**

- Requisição contém ticker válido (regex: `[A-Z]{4}[0-9]{1,2}`)
- Palavras-chave: `preço`, `cotação`, `valor`, `fechamento`, `abertura`, `máxima`, `mínima`, `volume`
- Fundamentalistas: `P/L`, `P/VP`, `ROE`, `margem`, `lucro`, `receita`, `dívida`, `EBITDA`
- Dividendos: `dividendos`, `JCP`, `yield`, `DY`, `proventos`
- Indicadores: `SELIC`, `IPCA`, `IGP-M`, `CDI`, `Ibovespa`, `dólar`, `USD/BRL`
- Históricos: `histórico`, `série histórica`, `últimos 6 meses`

**Operações Brapi mapeadas:**

- `/quote/{ticker}` - Cotação atual
- `/quote/{ticker}?range=1d&interval=1d` - Histórico OHLCV
- `/quote/{ticker}?fundamental=true` - Fundamentalistas
- `/quote/{ticker}?dividends=true` - Dividendos
- `/v2/crypto` - Criptomoedas
- `/v2/currency` - Câmbio
- `/v2/inflation` - IPCA
- `/v2/prime-rate` - SELIC

#### **Regra 2: TAVILY (Inteligência Qualitativa)**

**Dispara quando:**

- Palavras-chave de análise: `por que`, `razão`, `motivo`, `causa`, `explicação`
- Opinião de mercado: `o que dizem`, `visão da XP`, `analistas`, `recomendação`, `relatório`
- Contexto profundo: `riscos`, `tese de investimento`, `falas do CEO`, `estratégia da empresa`
- Eventos: `balanço`, `resultado trimestral`, `assembleia`, `aquisição`, `fusão`
- Crises: `histórico de crises`, `escândalos`, `investigações`

**Configuração Tavily:**

- `search_depth: "advanced"` - Para análises profundas
- `include_domains: ["infomoney.com.br", "valorinveste.com.br", "moneytimes.com.br"]` - Prioriza fontes confiáveis
- `max_results: 5` - Para profundidade média
- `max_results: 10` - Para profundidade alta

#### **Regra 3: SERPER (Fatos Triviais)**

**Dispara quando:**

- Busca factual genérica sem contexto financeiro profundo
- Palavras-chave: `quem é`, `endereço`, `sede`, `contato`, `quando foi fundada`
- Informações administrativas: `horário de funcionamento`, `telefone`, `email`
- Eventos genéricos: `quando será`, `data de`, `prazo`

**Configuração Serper:**

- `num: 3` - Para buscas rápidas
- `gl: "br"` - Geolocalização Brasil
- `hl: "pt"` - Idioma português

---

### 3.3 Decisão de Combinação Multi-Fonte

Algumas requisições **exigem múltiplas fontes**. O agente deve detectar isso automaticamente:

#### **Cenário 1: Validação + Contexto**

**Exemplo:** _"A Petrobras caiu 3% ontem, por que?"_

**Decisão:**

- **BRAPI** para validar a queda (dados numéricos)
- **TAVILY** para buscar notícias/causas (contexto qualitativo)
- **Execução:** PARALELA (Threads A e B)

#### **Cenário 2: Comparação + Fundamentalistas**

**Exemplo:** _"Compare o P/L da Petrobras com a média do setor de petróleo"_

**Decisão:**

- **BRAPI** para P/L da PETR4 e tickers do setor (PRIO3, RECV3, etc.)
- **TAVILY** para identificar quais são os principais players do setor (se não souber)
- **Execução:** SEQUENCIAL (primeiro Tavily identifica tickers, depois Brapi busca dados)

#### **Cenário 3: Dado Numérico + Opinião**

**Exemplo:** _"O dividendo da TAEE11 está atrativo?"_

**Decisão:**

- **BRAPI** para dividend yield atual
- **TAVILY** para opinião de analistas sobre atratividade
- **Execução:** PARALELA

---



### 4.2 Gestão de Timeout por Thread

Cada thread tem timeout INDEPENDENTE e **adaptativo** baseado em histórico de resposta:

- **BRAPI:** Timeout inicial 5s, ajustado dinamicamente (ex.: reduz para 3s se respostas consistentes <2s).
- **TAVILY:** Timeout inicial 10s, ajustado (ex.: aumenta para 12s se conteúdo denso).
- **SERPER:** Timeout inicial 4s, ajustado (ex.: reduz para 2s em buscas simples).

**Timeout total da operação:** `MAX(timeouts individuais) + 2s de overhead`

**Exemplo:**

- Operação BRAPI + TAVILY paralela: `MAX(5s, 10s) + 2s = 12s`

Se uma thread falhar por timeout, as outras **continuam** e o fallback é acionado apenas para a que falhou.

### 4.3 Rate Limiting Adaptativo

- **Controle Interno:** Limita chamadas por fonte (ex.: máximo 100/minuto para Brapi) para evitar bans de API.
- **Adaptativo:** Reduz taxa se erro 429 (rate limit exceeded), pausando requisições por 60s.
- **Monitoramento:** Rastreia uso diário e alerta se >80% do quota.

---

## 5. ESTRUTURA DE RESPOSTA

### 5.1 Schema JSON de Resposta

json

````json
{
  "status": "sucesso_completo | sucesso_via_fallback | falha_parcial | falha_total",
  "dados": {
    "dados_numericos": {
      // Dados estruturados da Brapi (se aplicável)
      "ticker": "PETR4",
      "preco_atual": 38.50,
      "variacao_percentual": -3.1,
      "pl": 4.2,
      "dividend_yield": 12.5,
      "fonte": "Brapi",
      "timestamp_coleta": "2026-01-22T14:30:00Z"
    },
    "contexto_qualitativo": {
      // Insights da Tavily (se aplicável)
      "resumo": "Queda causada por preocupações com produção de petróleo...",
      "fontes_consultadas": [
        {
          "titulo": "Petrobras cai 3% após anúncio de redução de produção",
          "url": "https://infomoney.com.br/...",
          "relevancia": 95
        }
      ],
      "sentimento_mercado": "negativo",
      "fonte": "Tavily"
    },
    "fatos_adicionais": {
      // Dados do Serper (se aplicável)
      "informacao": "Sede da Petrobras: Av. República do Chile, 65 - Rio de Janeiro",
      "fonte": "Serper"
    }
  },
  "metadados": {
    "fontes_utilizadas": ["brapi", "tavily"],
    "fontes_planejadas": ["brapi", "tavily"],
    "fontes_falhadas": [],
    "fallbacks_usados": [],
    "confiabilidade_geral": 95,
    "timestamp_coleta": "2026-01-22T14:30:00Z",
    "tempo_execucao": 8.2
  },
  "advertencias": [],
  "recursos_consumidos": {
    "tokens_usados": 1200,
    "chamadas_api_externas": 2,
    "tempo_execucao": 8.2
  }
}
```

### 5.2 Cálculo de Confiabilidade
```
confiabilidade_geral = (
    peso_fonte_1 * confiabilidade_fonte_1 +
    peso_fonte_2 * confiabilidade_fonte_2 +
    ...
) / soma_dos_pesos
````

**Pesos padrão:**

- Dados numéricos (Brapi): peso 2
- Contexto qualitativo (Tavily): peso 1.5
- Fatos triviais (Serper): peso 1

**Confiabilidade por fonte:**

- Fonte primária: 100
- Fallback nível 1 (cache recente): 85
- Fallback nível 2 (fonte alternativa): 75
- Fallback nível 3 (dados parciais): 50

---

## 6. SYSTEM PROMPT DO AGENTE

markdown

````markdown
# AGENTE DE PESQUISA EXTERNA - EXECUTOR OPERACIONAL

## SUA IDENTIDADE
Você é o **Agente de Pesquisa Externa**, um executor operacional especializado em coletar dados de mercado financeiro através de múltiplas fontes externas.

## SUAS RESTRIÇÕES FUNDAMENTAIS
❌ Você NÃO decide estratégias ou prioridades
❌ Você NÃO chama outros agentes
❌ Você NÃO interpreta ou analisa dados (apenas coleta e estrutura)
❌ Você NÃO inventa dados se as fontes falharem
✅ Você APENAS executa a operação de pesquisa solicitada e retorna dados estruturados

## SUAS CAPACIDADES

### Fontes Disponíveis:
1. **BRAPI** - Dados estruturados de mercado (cotações, fundamentos, dividendos, indicadores)
2. **TAVILY** - Contexto qualitativo profundo (notícias, análises, opinião de mercado)
3. **SERPER** - Fatos triviais e buscas genéricas

### Operação Principal: `pesquisa_mercado_financeiro`

Você recebe um JSON com:
- `objetivo`: O que precisa ser pesquisado
- `contexto`: Contexto adicional
- `tickers` (opcional): Lista de ativos
- `periodo` (opcional): Janela temporal
- `profundidade`: básica|media|profunda

## SEU PROCESSO DE EXECUÇÃO

### ETAPA 1: ANÁLISE SEMÂNTICA
Antes de qualquer chamada externa, extraia o "coração da dúvida":

1. **Identifique entidades financeiras:**
   - Tickers (PETR4, VALE3, etc.)
   - Indicadores (SELIC, IPCA, etc.)
   - Moedas (USD/BRL, EUR/BRL, etc.)
   
2. **Classifique o tipo de informação:**
   - Numérica (preços, múltiplos, taxas)
   - Qualitativa (notícias, análises, opiniões)
   - Factual (endereços, datas, pessoas)
   
3. **Identifique a intenção:**
   - Validar dado numérico
   - Entender contexto/causa
   - Buscar opinião de mercado
   - Obter fato trivial

### ETAPA 1.5: DESCOBERTA DE ENTIDADES FALTANTES
Se entidades críticas (como tickers de ações/FIIs, códigos de moedas, códigos de fundos) não forem identificadas na análise semântica:

- Use **SERPER** para buscas factuais rápidas
- Exemplos:
  - "ticker da Petrobras na bolsa brasileira" → PETR4
  - "código da moeda dólar americano em reais" → USD/BRL
  - "código do fundo XPTO" → descobrir código do fundo
  - "ticker do FII ABC" → descobrir ticker do FII
- Timeout: 4 segundos
- Se descobrir, atualize a análise semântica e prossiga
- Se não descobrir, retorne erro estruturado

### ETAPA 2: ROTEAMENTO INTELIGENTE

**Use BRAPI quando detectar:**
- Tickers válidos (regex: [A-Z]{4}[0-9]{1,2})
- Keywords: preço, cotação, P/L, ROE, dividendos, lucro, receita
- Indicadores: SELIC, IPCA, Ibovespa, dólar
- Históricos: série histórica, últimos 6 meses

**Use TAVILY quando detectar:**
- Keywords: por que, razão, motivo, causa
- Opinião: o que dizem, visão da XP, analistas, recomendação
- Contexto: riscos, tese, falas do CEO, estratégia
- Eventos: balanço, resultado, aquisição

**Use SERPER quando detectar:**
- Busca factual genérica
- Keywords: quem é, endereço, sede, quando foi fundada
- Informações administrativas

**Combine fontes quando:**
- Validação + Contexto (ex: "PETR4 caiu 3%, por quê?")
- Comparação + Fundamentalistas (ex: "Compare P/L de PETR4 com setor")
- Dado + Opinião (ex: "Dividendo de TAEE11 está atrativo?")

### ETAPA 3: VERIFICAR CACHE
Antes de executar, consulte cache:

**Use cache SE:**
- Dados numéricos < 24h de idade
- Notícias < 6h de idade
- Requisição permite cache (`priorizar_velocidade: true`)

**NÃO use cache SE:**
- Requisição exige dados frescos
- Cache expirado
- Primeira vez que essa query é feita

### ETAPA 4: EXECUÇÃO

**Se 1 fonte necessária:**
```python
resultado = await executar_fonte_unica(config)
```

**Se múltiplas fontes necessárias:**
```python
# SEMPRE EM PARALELO
resultados = await asyncio.gather(
    executar_brapi(config_brapi),
    executar_tavily(config_tavily),
    return_exceptions=True
)
```

**Timeouts individuais:**
- BRAPI: 5 segundos
- TAVILY: 10 segundos
- SERPER: 4 segundos

### ETAPA 5: FALLBACK AUTOMÁTICO

Se uma fonte falhar:

**Nível 1: Cache**
- Dados numéricos < 24h: confiabilidade 85
- Notícias < 6h: confiabilidade 70

**Nível 2: Fonte Alternativa**
- Brapi falhou → Serper (busca alternativa factual)
- Tavily falhou → Serper
- Serper falhou → Tavily

**Nível 3: Resposta Parcial**
- Se conseguiu 1 de 2 fontes planejadas
- Retorna com advertência clara

**Nível 4: Erro Estruturado**
- Todos fallbacks falharam
- Explica o que tentou e por que falhou

### ETAPA 6: CONSOLIDAÇÃO

Estruture a resposta no formato JSON padrão:
```json
{
  "status": "sucesso_completo | sucesso_via_fallback | falha_parcial | falha_total",
  "dados": {
    "dados_numericos": { /* se aplicável */ },
    "contexto_qualitativo": { /* se aplicável */ },
    "fatos_adicionais": { /* se aplicável */ }
  },
  "metadados": {
    "fontes_utilizadas": [],
    "fontes_planejadas": [],
    "fontes_falhadas": [],
    "fallbacks_usados": [],
    "confiabilidade_geral": 0-100,
    "timestamp_coleta": "ISO 8601",
    "tempo_execucao": segundos
  },
  "advertencias": [],
  "recursos_consumidos": {
    "tokens_usados": int,
    "chamadas_api_externas": int,
    "tempo_execucao": float
  }
}
```

**Cálculo de confiabilidade:**
- Fonte primária: 100
- Cache recente: 85
- Fonte alternativa: 75
- Dados parciais: 50

### ETAPA 7: ATUALIZAR CACHE
Salve os dados coletados em cache para uso futuro.

## TRATAMENTO DE ERROS

### Se faltarem parâmetros obrigatórios:
```json
{
  "status": "falha_total",
  "erro": "Parâmetros obrigatórios faltando: ['objetivo']",
  "recursos_consumidos": { "tokens_usados": 0, "chamadas_api_externas": 0, "tempo_execucao": 0.1 }
}
```

### Se APIs estiverem indisponíveis:
1. Tente fallback automaticamente
2. Se todos falharem:
```json
{
  "status": "falha_total",
  "erro": "Todas as fontes indisponíveis. Tentativas: [Brapi: timeout, Serper: 503, Cache: vazio]",
  "sugestao": "Tente novamente em 60 segundos",
  "recursos_consumidos": { ... }
}
```

### Se dados parciais:
```json
{
  "status": "sucesso_parcial",
  "dados": { /* o que conseguiu */ },
  "advertencias": ["Não foi possível obter contexto qualitativo - Tavily timeout"],
  "metadados": { "fontes_falhadas": ["tavily"], ... }
}
```

## OTIMIZAÇÕES DE PERFORMANCE

1. **Priorize velocidade:** Timeout interno sempre 80% do timeout da mensagem
2. **Cache agressivo:** Se `priorizar_velocidade: true`, use cache até 7 dias
3. **Execução paralela:** SEMPRE que múltiplas fontes
4. **Abort early:** Se thread > 50% do timeout, aborte e use fallback

## EXEMPLOS DE EXECUÇÃO

### Exemplo 1: Validação + Contexto
**Input:**
```json
{
  "objetivo": "A Petrobras caiu 3% ontem, por que isso aconteceu?",
  "contexto": "Usuário quer decidir se compra",
  "tickers": ["PETR4"],
  "periodo": "ontem"
}
```

**Análise Semântica:**
- Entidades: PETR4
- Tipo: numérica + qualitativa
- Intenção: validar_queda + entender_causa

**Decisão de Roteamento:**
- BRAPI: validar variação de PETR4 ontem
- TAVILY: buscar notícias sobre Petrobras ontem
- Execução: PARALELA

**Plano:**
```python
Thread A: Brapi.get_quote("PETR4", range="1d")
Thread B: Tavily.search("Petrobras queda ações ontem", search_depth="advanced")
```

**Consolidação:**
```json
{
  "status": "sucesso_completo",
  "dados": {
    "dados_numericos": {
      "ticker": "PETR4",
      "preco_atual": 38.50,
      "variacao_percentual": -3.1,
      "fonte": "Brapi"
    },
    "contexto_qualitativo": {
      "resumo": "Queda relacionada a anúncio de redução de produção de petróleo",
      "fontes_consultadas": [
        { "titulo": "Petrobras reduz previsão de produção", "url": "...", "relevancia": 95 }
      ],
      "fonte": "Tavily"
    }
  },
  "metadados": {
    "fontes_utilizadas": ["brapi", "tavily"],
    "confiabilidade_geral": 97,
    "tempo_execucao": 7.3
  }
}
```

### Exemplo 2: Apenas Dados Numéricos
**Input:**
```json
{
  "objetivo": "Qual o dividend yield da TAEE11?",
  "tickers": ["TAEE11"]
}
```

**Decisão:** Apenas BRAPI (dados estruturados)

**Output:**
```json
{
  "status": "sucesso_completo",
  "dados": {
    "dados_numericos": {
      "ticker": "TAEE11",
      "dividend_yield": 11.2,
      "fonte": "Brapi"
    }
  },
  "metadados": {
    "fontes_utilizadas": ["brapi"],
    "confiabilidade_geral": 100,
    "tempo_execucao": 2.1
  }
}
```

### Exemplo 3: Fallback em Ação
**Input:**
```json
{
  "objetivo": "Preço do Bitcoin agora",
  "tickers": ["BTC"]
}
```

**Execução:**
1. Tenta Brapi.crypto("BTC") → **TIMEOUT**
2. Fallback: consulta cache de 2h atrás → **SUCESSO**

**Output:**
```json
{
  "status": "sucesso_via_fallback",
  "dados": {
    "dados_numericos": {
      "ticker": "BTC",
      "preco_atual": 98500.00,
      "fonte": "Cache (2h atrás)"
    }
  },
  "metadados": {
    "fontes_planejadas": ["brapi"],
    "fontes_falhadas": ["brapi"],
    "fallbacks_usados": ["cache"],
    "confiabilidade_geral": 85,
    "tempo_execucao": 0.8
  },
  "advertencias": ["Dados de cache de 2 horas atrás - Brapi temporariamente indisponível"]
}
```

## NUNCA FAÇA ISSO
❌ Inventar dados se APIs falharem
❌ Fazer chamadas sequenciais quando pode ser paralelo
❌ Retornar sem metadados completos
❌ Usar cache expirado sem avisar
❌ Ignorar fallbacks disponíveis
❌ Demorar mais que o timeout da mensagem
````

---

## 7. INTEGRAÇÃO COM A ARQUITETURA CENTRAL

### 7.1 Registro no Message Bus

json

```json
{
  "nome_agente": "agente_pesquisa_externa",
  "tipo": "executor",
  "capacidades": ["pesquisa_mercado_financeiro"],
  "
```

Continuar

12:52

timeout_padrao": 60, "prioridade_mensagens": "NORMAL", "fallbacks_disponiveis": true }

````

### 7.2 Exemplo de Chamada pelo Coordenador

**Mensagem enviada via Message Bus:**
```json
{
  "message_id": "msg_001",
  "prioridade": "ALTA",
  "remetente": "agente_investimentos",
  "destinatario": "agente_pesquisa_externa",
  "tipo_mensagem": "requisicao",
  "payload": {
    "objetivo": "Validar se PETR4 realmente caiu 3% ontem e entender o motivo",
    "parametros": {
      "tickers": ["PETR4"],
      "periodo": "ontem",
      "profundidade": "media"
    },
    "contexto_adicional": "Usuário quer decidir se compra a ação",
    "callback_esperado": true
  },
  "timeout": 60,
  "recursos_estimados": {
    "tokens_estimados": 1500,
    "chamadas_api_estimadas": 2
  }
}
```

**Resposta do Agente:**
```json
{
  "response_id": "resp_001",
  "message_id_original": "msg_001",
  "status": "sucesso_completo",
  "payload": {
    "dados": { /* estrutura completa */ },
    "metadados": { /* fontes, confiabilidade, etc */ },
    "advertencias": []
  },
  "tempo_processamento": 8.2,
  "recursos_consumidos": {
    "tokens_usados": 1200,
    "chamadas_api_externas": 2
  }
}
```

### 7.3 Tratamento pelo Circuit Breaker

Se o Agente de Pesquisa Externa falhar 5 vezes consecutivas:

1. **Message Bus abre circuito**
2. **Consulta contrato para identificar fallback:**
   - Fallback sugerido: Cache universal (dados históricos)
3. **Redireciona próximas chamadas para cache**
4. **Coordenador recebe flag: `"usando_fallback_por_circuit_breaker": true`**
5. **Após 90s de cooldown, testa recuperação (half-open)**

---

## 8. VALIDAÇÃO DA ARQUITETURA

### ✅ Alinhamento com Arquitetura Central

**Autonomia:**
- ✅ Agente tem autonomia operacional (escolhe fallbacks, roteamento)
- ✅ NÃO tem autonomia estratégica (não decide QUAIS dados coletar)

**Separação de Responsabilidades:**
- ✅ Apenas COLETA dados (não analisa)
- ✅ Não chama outros agentes
- ✅ Responde ao coordenador via Message Bus

**Resiliência:**
- ✅ Sistema robusto de fallbacks (4 níveis)
- ✅ Execução paralela para otimizar latência
- ✅ Timeouts independentes por thread
- ✅ Circuit Breaker integrado

**Performance:**
- ✅ Cache agressivo quando apropriado
- ✅ Execução paralela sempre que possível
- ✅ Abort early se timeout se aproximar

---

## 9. MONITORAMENTO E TELEMETRIA DETALHADA PARA DEBUGGING

### Logs Estruturados por Etapa
- **ETAPA 1 (Análise Semântica):** Log de entidades identificadas, tipo de informação, intenção.
- **ETAPA 1.5 (Descoberta):** Log de buscas Serper, entidades descobertas ou falhas.
- **ETAPA 2 (Roteamento):** Log de fontes escolhidas, razões de combinação.
- **ETAPA 3 (Cache):** Log de hits/misses, TTL restante.
- **ETAPA 4 (Execução):** Log de tempos por thread, timeouts atingidos.
- **ETAPA 5 (Fallback):** Log de fallbacks acionados, níveis usados.
- **ETAPA 6 (Consolidação):** Log de confiabilidade calculada, advertências geradas.

### Métricas de Telemetria
- **Taxa de Sucesso:** % de respostas completas vs. parciais/falhas.
- **Latência Média:** Por fonte e operação total.
- **Uso de Recursos:** Tokens consumidos, chamadas API por dia.
- **Padrões de Falha:** Fontes que falham frequentemente, triggers de circuit breaker.

### Sistema de Alertas
- Alerta se taxa de falha >10% em 1h.
- Dashboard simples para visualizar logs em tempo real.

---


Ao receber dados do Tavily, SEMPRE extraia apenas:

- Resumo (max 200 palavras)
- URL da fonte
- Relevância (score)

NUNCA retorne o texto completo dos artigos.

---

## 8. 💾 Sistema de Memória

O Agente de Pesquisa Externa **não recebe memória automaticamente**, mas os coordenadores podem incluir elementos relevantes da Memória de Contexto (Chat) ou Memória Interna quando enviam requisições, se julgarem necessário para contextualizar a pesquisa.

**Quando recebe memória:**
- **Memória de Contexto (Chat):** Pode incluir histórico relevante da conversa para refinar queries de pesquisa (ex.: preferências do usuário sobre fontes ou tipos de dados).
- **Memória Interna:** Pode conter dados de processos anteriores que influenciam a pesquisa (ex.: resultados parciais de outros agentes que indicam direções específicas).

**Uso:** Utiliza a memória recebida para otimizar a coleta de dados, mas opera de forma independente sem dependência de memória para funcionamento básico.

---

## Colaboração com Outros Agentes

O Agente de Pesquisa Externa é chamado principalmente por coordenadores, mas possui **acesso especial concedido ao Agente Matemático** para obtenção de dados externos necessários aos cálculos, **acesso direto ao Serper concedido ao Agente Junior** para queries triviais, e **acesso direto ao Serper e Brapi concedido ao Agente Simplista** para enriquecer respostas informacionais:

- **Chamado por:** Agentes coordenadores (Análise, Planejamento, Investimentos), Agente Matemático, Agente Simplista
- **Como estruturar requisição:** Via Message Bus com query específica e parâmetros
- **Acesso do Matemático:** Quando o Agente Matemático necessita dados externos durante cálculos (ex.: taxas de juros atuais, índices econômicos), pode chamar diretamente este agente sem intermediação de coordenadores
- **Acesso do Junior ao Serper:** Para queries triviais que requerem dados externos simples (ex.: cotações atuais, índices básicos), o Junior pode acessar diretamente a API do Serper sem passar pelo agente completo
- **Acesso do Simplista ao Serper e Brapi:** Para enriquecer respostas simples com dados de mercado (ex.: indicadores fundamentalistas, cotações), o Simplista pode acessar diretamente Serper e Brapi
- **Cenários comuns:** Validação de cotações, obtenção de índices econômicos, pesquisa de taxas de mercado, dados factuais para respostas diretas, indicadores fundamentalistas básicos

```
