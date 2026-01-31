---
# AGENTE DE PESQUISA EXTERNA (EXECUTOR ESPECIALIZADO)

## 📋 Status de Implementação

**FUTURO** - Este agente será implementado quando houver demanda por pesquisas de dados externos.



**Quando será usado:**
- o agente de pesquisa externa é um agente de IA, porem ele recebe informações de outros agentes, por exemplo, se o usuario pergunta para o agente de investimentos "deve comprar a petrobras", o agente de investimentos vai decidir o que ele precisa para responder o usuario, e uma dessas coisas pode ser informações externa, ai o agente envia para o agente de pesquisa externa um json do que ele precisa, o agente de pesquisa externa recebe e a função dele é decidir como vai pesquisar com objetivo de retornar os melhores dados e informações acionar as API de busca que serao 3 e por fim retornar a pesquisa para o agente que enviou para ele pesquisar.

---

# ARQUITETURA COMPLETA DO AGENTE DE PESQUISA EXTERNA (EXECUTOR)

---

## 1. IDENTIDADE E PAPEL

### Nome

**Agente de Pesquisa Externa**

### Tipo

**Executor Operacional Especializado**

### Especialização

Coleta inteligente de dados externos através de múltiplas fontes (Brapi, Tavily, Serper), com roteamento automático baseado no tipo de informação solicitada e execução paralela para otimização de performance.

### 🔗 Integração com Outros Agentes


**O que Research Agent NÃO recebe:**
- Memória  do usuário

- Apenas parâmetros estruturados da pesquisa

**O que Research Agent recebe:**
- Objetivo da pesquisa (string descritiva)
- Contexto adicional para melhorar precisão
- Tickers/códigos se aplicável
- Nível de profundidade (básica, média, profunda)

**O que Research Agent retorna:**
- Dados consolidados de múltiplas fontes
- fontes usadas
- Fallbacks utilizados (se aplicável)
- Advertenças sobre frescor dos dados

### O que Executa vs O que NÃO Executa

**✅ EXECUTA:**

- Análise semântica da requisição para identificar tipo de dado necessário
- Descoberta de entidades necessárias à execução (ex: identificar ticker de ações/FIIs, códigos de moedas, códigos de fundos, setores ou ativos listados quando não fornecido)
- Roteamento inteligente para fonte(s) apropriada(s)
- Execução paralela de chamadas quando múltiplas fontes são necessárias
- Validação e normalização de dados retornados
- Fallbacks automáticos em caso de falha de fonte primária
- Consolidação de dados de múltiplas fontes em resposta unificada

**❌ NÃO EXECUTA:**

- Decisões estratégicas sobre quais dados coletar (ela já recebe quais ele precisa)
- Análise ou interpretação dos dados coletados (apenas coleta e normaliza)
- Chamadas a outros agentes (opera de forma independente)



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


#### **Regra 2: TAVILY (Inteligência Qualitativa)**

**Dispara quando:**

- Palavras-chave de análise: `por que`, `razão`, `motivo`, `causa`, `explicação`
- Opinião de mercado: `o que dizem`, `visão da XP`, `analistas`, `recomendação`, `relatório`
- Contexto profundo: `riscos`, `tese de investimento`, `falas do CEO`, `estratégia da empresa`
- Eventos: `balanço`, `resultado trimestral`, `assembleia`, `aquisição`, `fusão`
- Crises: `histórico de crises`, `escândalos`, `investigações`


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

- **BRAPI:** Timeout inicial 20s, ajustado dinamicamente 
- **TAVILY:** Timeout inicial 20s, ajustado
- **SERPER:** Timeout inicial 20s, ajustado

**Timeout total da operação:** `MAX(timeouts individuais) + 10s de overhead`

**Exemplo:**

- Operação BRAPI + TAVILY paralela: `MAX(BRAPI, TAVILY) + 10s = Xs`

Se uma thread falhar por timeout, as outras **continuam** e o fallback é acionado apenas para a que falhou.
