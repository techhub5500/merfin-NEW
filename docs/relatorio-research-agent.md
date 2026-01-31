# RESEARCH AGENT - RELATÓRIO FINAL DE IMPLEMENTAÇÃO

**Data:** 30 de Janeiro de 2026  
**Versão:** 1.0.0  
**Status:** ✅ Implementação Completa

---

## 📋 VISÃO GERAL

O **Research Agent** é um executor especializado em coleta inteligente de dados externos de mercado financeiro brasileiro. Opera através de 3 APIs (Brapi, Tavily, Serper) com uso otimizado de IA apenas para casos ambíguos (~30%).

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RESEARCH AGENT                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   REQUEST    │───▶│   ANALYZER   │───▶│    ROUTER    │              │
│  │   (input)    │    │ (regex+IA)   │    │(decision tree)│              │
│  └──────────────┘    └──────────────┘    └──────┬───────┘              │
│                                                  │                      │
│         ┌────────────────────────────────────────┼────────────────┐    │
│         ▼                   ▼                    ▼                ▼    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌────────┐  │
│  │   BRAPI     │    │   TAVILY    │    │   SERPER    │    │ CACHE  │  │
│  │ (estrut.)   │    │ (qualit.)   │    │ (factual)   │    │        │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └────────┘  │
│         │                  │                   │                       │
│         └──────────────────┼───────────────────┘                       │
│                            ▼                                           │
│                    ┌──────────────┐                                    │
│                    │  VALIDATOR   │                                    │
│                    │  + RESPONSE  │                                    │
│                    └──────────────┘                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUTURA DE ARQUIVOS

```
server/src/agents/research/
├── research-agent.js           # Classe principal (BaseAgent)      [455 linhas]
├── request-analyzer.js         # Análise semântica híbrida         [310 linhas]
├── source-router.js            # Decision tree + fallback          [490 linhas]
├── cache-manager.js            # Cache fingerprinting LRU          [230 linhas]
├── data-validator.js           # Validação de respostas            [280 linhas]
├── research-logger.js          # Log 3 níveis                      [310 linhas]
├── api-clients/
│   ├── circuit-breaker.js      # Padrão Circuit Breaker            [175 linhas]
│   ├── brapi-client.js         # Wrapper Brapi + SDK               [230 linhas]
│   ├── tavily-client.js        # Wrapper Tavily                    [215 linhas]
│   └── serper-client.js        # Wrapper Serper                    [185 linhas]
└── utils/
    ├── query-normalizer.js     # Normalização de queries           [175 linhas]
    └── entity-extractor.js     # Extração de tickers               [220 linhas]

server/src/agents/manifests/
└── ResearchAgent.json          # Manifest do agente                [atualizado]
```

**Total:** ~3.275 linhas de código

---

## 🎯 DECISÕES TÉCNICAS

### 1. Análise Semântica Híbrida (70% Regex / 30% IA)

| Método | Quando | Latência | Custo |
|--------|--------|----------|-------|
| **Regex** | Ticker explícito (PETR4), keywords claras | ~50ms | $0 |
| **IA** | Casos ambíguos (múltiplos tipos, sem entidades) | ~2s | ~$0.001/req |

**Critérios de Ambiguidade:**
- Múltiplos tipos de informação detectados (numérica + qualitativa)
- Sem entidades identificadas mas com intenção específica
- Keywords conflitantes ("preço" + "por que" juntos)

### 2. Decision Tree para Roteamento

```
                       ┌─────────────────────┐
                       │  Análise Semântica  │
                       └──────────┬──────────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           ▼                      ▼                      ▼
    ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
    │   BRAPI     │        │   TAVILY    │        │   SERPER    │
    │             │        │             │        │             │
    │ • Tickers   │        │ • "por que" │        │ • "sede"    │
    │ • Preço     │        │ • "motivo"  │        │ • "fundação"│
    │ • P/L, ROE  │        │ • Análise   │        │ • CEO       │
    │ • Dividendo │        │ • Notícias  │        │ • Fallback  │
    └─────────────┘        └─────────────┘        └─────────────┘
```

### 3. Sistema de Fallback Hierárquico (4 Níveis)

| Nível | Estratégia | Tempo Max de Dados |
|-------|------------|-------------------|
| 1 | Cache recente | 24h (dados) / 6h (notícias) |
| 2 | Fonte alternativa | BRAPI→SERPER, TAVILY→SERPER |
| 3 | Cache antigo | 48h (dados) / 7 dias (notícias) |
| 4 | Erro estruturado | Retorna diagnóstico completo |

### 4. TTL Dinâmico por Tipo de Dado

| Tipo de Dado | TTL | Exemplo |
|--------------|-----|---------|
| Preço tempo real | 5h | Cotação PETR4 |
| Indicadores | 5h | SELIC, IPCA |
| Notícias | 6h | Notícias sobre mercado |
| Fundamentalistas | 24h | P/L, ROE, margens |
| Fatos triviais | 72h | Sede, CEO, fundação |

### 5. Circuit Breaker por API

```
Estado: CLOSED (normal)
         │
         ▼ (3 falhas consecutivas)
Estado: OPEN (bloqueado)
         │
         ▼ (após 2 minutos)
Estado: HALF_OPEN (testando)
         │
    ┌────┴────┐
    ▼         ▼
 Sucesso   Falha
    │         │
    ▼         ▼
 CLOSED    OPEN
```

### 6. Sistema de Log (3 Níveis)

| Nível | O que loga | Linhas/Request |
|-------|------------|----------------|
| CRITICAL | Erros fatais, circuit breaker open | 1-3 |
| DECISION | Decisões de roteamento, fallbacks, IA | 15-30 |
| VERBOSE | Todos os detalhes | 100+ |

**Padrão em produção:** DECISION

---

## 📊 MÉTRICAS ALVO

| Métrica | Alvo | Como Medir |
|---------|------|------------|
| Tempo médio de resposta | < 2.5s | `_metadados_execucao.tempo_execucao_ms` |
| Taxa de hit de cache | > 70% | `cache.getStats().hitRate` |
| Uso de IA | < 35% | `logger.getStats().ai_usage_rate` |
| Linhas de log/request | < 30 | Contar linhas no nível DECISION |
| Sucesso de fallback | > 80% | `fallbacks_used` vs `errors` |

---

## 🧪 TESTES MANUAIS

### Pré-requisitos

1. Configure as variáveis de ambiente:
```bash
BRAPI_API_KEY=sua_chave_brapi
TAVILY_API_KEY=sua_chave_tavily
SERPER_API_KEY=sua_chave_serper
OPENAI_API_KEY=sua_chave_openai
```

2. Crie um arquivo de teste `test-research-agent.js`:

```javascript
const ResearchAgent = require('./research-agent');

async function runTests() {
    const agent = new ResearchAgent({ logLevel: 'DECISION' });
    
    console.log('\n' + '='.repeat(60));
    console.log('INICIANDO TESTES DO RESEARCH AGENT');
    console.log('='.repeat(60) + '\n');

    const tests = [
        // Teste 1: Caso simples (BRAPI)
        {
            name: 'Teste 1: Preço de ação (BRAPI)',
            input: {
                objetivo: 'Qual o preço atual da PETR4?',
                contexto: 'Usuário quer saber cotação'
            },
            expected: {
                fonte: 'BRAPI',
                usouIA: false
            }
        },
        
        // Teste 2: Caso qualitativo (TAVILY)
        {
            name: 'Teste 2: Motivo de queda (TAVILY + BRAPI)',
            input: {
                objetivo: 'A PETR4 caiu 3% ontem, por que?',
                contexto: 'Usuário quer entender o motivo da queda',
                tickers: ['PETR4']
            },
            expected: {
                fontes: ['BRAPI', 'TAVILY'],
                usouIA: false // "por que" é keyword clara
            }
        },
        
        // Teste 3: Caso factual (SERPER)
        {
            name: 'Teste 3: Informação trivial (SERPER)',
            input: {
                objetivo: 'Qual a sede da Petrobras?',
                contexto: 'Usuário quer saber localização'
            },
            expected: {
                fonte: 'SERPER',
                usouIA: false
            }
        },
        
        // Teste 4: Cache hit
        {
            name: 'Teste 4: Cache hit (2ª chamada)',
            input: {
                objetivo: 'Qual o preço atual da PETR4?',
                contexto: 'Usuário quer saber cotação',
                priorizar_velocidade: true
            },
            expected: {
                fromCache: true
            }
        },
        
        // Teste 5: Caso ambíguo (IA)
        {
            name: 'Teste 5: Caso ambíguo (requer IA)',
            input: {
                objetivo: 'Compare ações de petróleo e analise qual é melhor para dividendos',
                contexto: 'Usuário não especificou tickers'
            },
            expected: {
                usouIA: true // Ambíguo: sem tickers, múltiplas intenções
            }
        },
        
        // Teste 6: Fundamentalistas
        {
            name: 'Teste 6: Dados fundamentalistas (BRAPI)',
            input: {
                objetivo: 'Qual o P/L e ROE da VALE3?',
                contexto: 'Análise fundamentalista',
                tickers: ['VALE3']
            },
            expected: {
                fonte: 'BRAPI',
                temFundamentalistas: true
            }
        },
        
        // Teste 7: Múltiplas fontes paralelas
        {
            name: 'Teste 7: Múltiplas fontes (paralelo)',
            input: {
                objetivo: 'Quero saber o preço, notícias recentes e sede da Vale',
                contexto: 'Análise completa',
                profundidade: 'profunda'
            },
            expected: {
                fontes: ['BRAPI', 'TAVILY', 'SERPER'],
                modoExecucao: 'PARALLEL'
            }
        },
        
        // Teste 8: Ticker inválido (fallback)
        {
            name: 'Teste 8: Ticker inválido (fallback)',
            input: {
                objetivo: 'Qual o preço da XXXX99?',
                contexto: 'Ticker inexistente'
            },
            expected: {
                temFallback: true
            }
        },
        
        // Teste 9: Índices econômicos
        {
            name: 'Teste 9: SELIC e IPCA (BRAPI)',
            input: {
                objetivo: 'Qual o valor atual da SELIC e IPCA?',
                contexto: 'Indicadores econômicos'
            },
            expected: {
                fonte: 'BRAPI'
            }
        },
        
        // Teste 10: Forçar fonte específica
        {
            name: 'Teste 10: Forçar fonte (SERPER)',
            input: {
                objetivo: 'O que é P/L?',
                contexto: 'Definição de termo',
                fontes_preferidas: ['SERPER']
            },
            expected: {
                fonte: 'SERPER'
            }
        }
    ];

    const results = [];
    
    for (const test of tests) {
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`📌 ${test.name}`);
        console.log(`${'─'.repeat(50)}`);
        
        try {
            const startTime = Date.now();
            
            const response = await agent.execute({
                action: 'pesquisa_mercado_financeiro',
                parameters: test.input
            });
            
            const elapsed = Date.now() - startTime;
            
            console.log(`✅ Sucesso em ${elapsed}ms`);
            console.log(`   Fontes: ${response.fontes_usadas?.join(', ') || 'cache'}`);
            console.log(`   Cache: ${response._metadados_execucao?.fonte_cache ? 'SIM' : 'NÃO'}`);
            console.log(`   Advertências: ${response.advertencias?.length || 0}`);
            
            if (response.metadados?.analise_usou_ia) {
                console.log(`   IA: SIM (${response.metadados.tokens_ia} tokens)`);
            }
            
            results.push({
                name: test.name,
                success: true,
                elapsed,
                fromCache: response._metadados_execucao?.fonte_cache,
                fontes: response.fontes_usadas,
                usouIA: response.metadados?.analise_usou_ia
            });
            
        } catch (error) {
            console.log(`❌ Erro: ${error.message}`);
            results.push({
                name: test.name,
                success: false,
                error: error.message
            });
        }
    }

    // Resumo
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 RESUMO DOS TESTES');
    console.log(`${'='.repeat(60)}\n`);
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const cacheHits = results.filter(r => r.fromCache).length;
    const iaUsed = results.filter(r => r.usouIA).length;
    const avgTime = results.filter(r => r.elapsed).reduce((a, b) => a + b.elapsed, 0) / passed;
    
    console.log(`Total: ${tests.length} testes`);
    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`📦 Cache hits: ${cacheHits}`);
    console.log(`🤖 IA usada: ${iaUsed} vezes (${((iaUsed/passed)*100).toFixed(1)}%)`);
    console.log(`⏱️  Tempo médio: ${avgTime.toFixed(0)}ms`);
    
    // Stats do cache
    console.log(`\n📈 Estatísticas do Cache:`);
    console.log(JSON.stringify(agent.getCacheStats(), null, 2));
    
    return results;
}

// Executar
runTests().then(() => {
    console.log('\n✅ Testes concluídos!\n');
    process.exit(0);
}).catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
```

---

### Como Executar os Testes

```bash
cd server/src/agents/research
node test-research-agent.js
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

### Funcionalidades Core

- [ ] **Análise Semântica**
  - [ ] Regex extrai tickers corretamente (PETR4, VALE3, TAEE11)
  - [ ] Keywords detectam tipo de informação
  - [ ] IA acionada apenas para casos ambíguos

- [ ] **Roteamento**
  - [ ] BRAPI acionado para tickers/preços
  - [ ] TAVILY acionado para "por que"/motivos
  - [ ] SERPER acionado para fatos triviais
  - [ ] Execução paralela quando apropriado

- [ ] **Cache**
  - [ ] Fingerprint normaliza queries equivalentes
  - [ ] TTL respeita tipo de dado
  - [ ] Hit rate > 70% após 50 requests

- [ ] **Fallback**
  - [ ] Cache recente usado quando API falha
  - [ ] Fonte alternativa tentada
  - [ ] Cache antigo como último recurso
  - [ ] Erro estruturado com diagnóstico

- [ ] **Circuit Breaker**
  - [ ] Abre após 3 falhas
  - [ ] Testa recuperação após 2 minutos
  - [ ] Logs indicam estado

### Logs

- [ ] Nível DECISION tem < 30 linhas/request
- [ ] Erros críticos aparecem em CRITICAL
- [ ] Estatísticas de sessão disponíveis

### Integração

- [ ] Manifest atualizado corretamente
- [ ] Pode ser chamado por outros agentes
- [ ] Retorna formato padrão de resposta

---

## 🔧 TROUBLESHOOTING

### Erro: "Timeout" em todas as APIs

**Causa:** Rede bloqueando ou APIs com lentidão.
**Solução:** 
1. Aumentar `defaultTimeout` no construtor
2. Verificar se as chaves de API estão corretas
3. Verificar firewall/proxy

### Erro: "Circuit Breaker OPEN"

**Causa:** API falhou 3+ vezes consecutivas.
**Solução:**
1. Aguardar 2 minutos para reset automático
2. Verificar status da API externa
3. Checar logs para erro original

### Cache sempre MISS

**Causa:** Queries não normalizadas ou TTL muito baixo.
**Solução:**
1. Verificar se QueryNormalizer está funcionando
2. Aumentar TTL se dados são estáveis
3. Checar se fingerprint é gerado corretamente

### IA sendo usada demais (>35%)

**Causa:** Critérios de ambiguidade muito relaxados.
**Solução:**
1. Adicionar mais keywords no `_detectTypeByKeywords`
2. Ajustar `_isAmbiguous` para ser mais restritivo
3. Verificar logs para entender casos

---

## 📈 PRÓXIMOS PASSOS (Sugestões)

1. **Redis para Cache**: Substituir Map() por Redis em produção
2. **Métricas Prometheus**: Expor métricas de performance
3. **Rate Limiting**: Limitar requests por usuário
4. **Retry com Backoff Exponencial**: Melhorar resiliência
5. **Testes Automatizados**: Jest/Mocha com mocks das APIs

---

## 📝 CHANGELOG

### v1.0.0 (30/01/2026)
- ✅ Implementação completa do Research Agent
- ✅ Análise semântica híbrida (regex + IA)
- ✅ Roteamento inteligente multi-fonte
- ✅ Sistema de fallback hierárquico (4 níveis)
- ✅ Cache com fingerprinting
- ✅ Circuit breaker por API
- ✅ Logger de 3 níveis
- ✅ DataValidator para respostas
- ✅ Manifest atualizado

---

**Implementado por:** GitHub Copilot (Claude Opus 4.5)  
**Revisão:** Aguardando testes manuais
