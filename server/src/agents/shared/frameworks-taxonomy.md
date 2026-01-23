# Taxonomia de Frameworks - Sistema Multi-Agente

---

## 1. VISÃO GERAL

Este documento define a estrutura padrão, nomenclatura e versionamento dos frameworks utilizados pelos agentes coordenadores (Analyst, Investment, Planning) do sistema multi-agente.

---

## 2. ESTRUTURA HIERÁRQUICA PADRÃO

### Níveis de Frameworks

**Nível 1 - Frameworks Centrais:**
- Definem a linha de raciocínio macro (ex.: "Análise de Endividamento")
- Contêm apenas ID e "quando usar"
- Agentes veem apenas este nível inicialmente

**Nível 2 - Frameworks Secundários:**
- Definem análises específicas dentro de um framework central
- Ainda sem conteúdo detalhado, apenas contexto de uso
- Agentes escolhem após selecionar framework central

**Nível 3 - Conteúdo Completo:**
- Liberado apenas após escolha explícita do framework secundário
- Contém: objetivo, premissas, etapas, métricas, critérios de decisão, limitações

---

## 3. CAMPOS OBRIGATÓRIOS

### Framework Nível 1 (Central)
```json
{
  "framework_id": "NOME_DO_FRAMEWORK",
  "version": "1.0",
  "quando_usar": ["contexto1", "contexto2"],
  "coordenadores_aplicaveis": ["Analyst", "Investment", "Planning"],
  "compartilhavel": true
}
```

### Framework Nível 2 (Secundário)
```json
{
  "framework_id": "NOME_ESPECIFICO",
  "framework_central_pai": "NOME_DO_FRAMEWORK_PAI",
  "version": "1.0",
  "quando_usar": ["contexto_especifico1"],
  "compartilhavel": false
}
```

### Framework Nível 3 (Completo)
```json
{
  "framework_id": "NOME_ESPECIFICO",
  "version": "1.2",
  "objetivo": "Descrição clara do objetivo",
  "premissas": ["premissa1", "premissa2"],
  "etapas": ["etapa1", "etapa2"],
  "metricas_chave": ["metrica1", "metrica2"],
  "criterios_de_decisao": {
    "criterio_nome": valor_threshold
  },
  "limitacoes": ["limitacao1"],
  "criado_em": "2026-01-15",
  "ultima_atualizacao": "2026-01-20"
}
```

---

## 4. CONVENÇÕES DE NOMENCLATURA

### IDs de Frameworks
- **Formato:** `CATEGORIA_DE_ACAO_ESPECIFICA`
- **Exemplos:**
  - `ANALISE_DE_ENDIVIDAMENTO` (Nível 1)
  - `ANALISE_DE_DIVIDAS_DE_CARTAO` (Nível 2)
  - `AVALIACAO_DE_CAPACIDADE_DE_PAGAMENTO` (Nível 2)
  - `PLANEJAMENTO_DE_COMPRA_DE_IMOVEL` (Nível 2)

### Versionamento (Semantic Versioning)
- **Formato:** `major.minor`
- **Major:** Mudanças breaking (estrutura, critérios fundamentais)
- **Minor:** Melhorias, ajustes de thresholds, novas métricas

**Exemplos:**
- `1.0` → versão inicial
- `1.1` → melhorias incrementais
- `2.0` → mudança breaking (ex.: adicionar premissa obrigatória)

---

## 5. FRAMEWORKS COMPARTILHÁVEIS

Frameworks que podem ser usados por múltiplos coordenadores:

### 5.1 ANALISE_DE_RISCO
- **Coordenadores:** Analyst, Investment, Planning
- **Versão Atual:** 1.2
- **Descrição:** Avalia riscos financeiros em diferentes contextos
- **Quando usar:** Qualquer análise que exija avaliação de risco

### 5.2 AVALIACAO_DE_CAPACIDADE_DE_PAGAMENTO
- **Coordenadores:** Analyst, Planning
- **Versão Atual:** 1.0
- **Descrição:** Avalia capacidade do usuário de assumir novos compromissos
- **Quando usar:** Análise de dívidas, planejamento de compras grandes

### 5.3 PROJECAO_DE_CENARIOS
- **Coordenadores:** Investment, Planning
- **Versão Atual:** 1.1
- **Descrição:** Projeta cenários futuros baseados em premissas
- **Quando usar:** Planejamento de longo prazo, análise de investimentos

### 5.4 ANALISE_DE_COMPORTAMENTO_FINANCEIRO
- **Coordenadores:** Analyst, Planning
- **Versão Atual:** 1.0
- **Descrição:** Identifica padrões comportamentais em gastos/renda
- **Quando usar:** Diagnóstico financeiro, planejamento comportamental

---

## 6. FRAMEWORKS ESPECÍFICOS POR COORDENADOR

### 6.1 Analyst (Análise Financeira Pessoal)
**Frameworks exclusivos:**
- `ANALISE_DE_ENDIVIDAMENTO` (1.0)
- `AVALIACAO_DE_ORCAMENTO_MENSAL` (1.1)
- `GESTAO_DE_RENDA_E_CARREIRA` (1.0)
- `DIAGNOSTICO_FINANCEIRO_COMPLETO` (1.2)

### 6.2 Investment (Investimentos)
**Frameworks exclusivos:**
- `DEFINICAO_DE_OBJETIVOS_E_HORIZONTE` (1.0)
- `ALOCACAO_DE_ATIVOS` (1.3)
- `ANALISE_DE_RENDA_FIXA` (1.1)
- `ANALISE_DE_RENDA_VARIAVEL` (1.2)
- `GESTAO_DE_RISCO_E_VOLATILIDADE` (1.0)
- `ANALISE_MACROECONOMICA` (1.0)

### 6.3 Planning (Planejamento Financeiro)
**Frameworks exclusivos:**
- `PLANEJAMENTO_DE_CURTO_PRAZO` (1.0)
- `PLANEJAMENTO_DE_MEDIO_PRAZO` (1.1)
- `PLANEJAMENTO_DE_LONGO_PRAZO` (1.0)
- `PLANEJAMENTO_DE_MULTIPLOS_OBJETIVOS` (1.2)

---

## 7. CARREGAMENTO E USO

### 7.1 Fluxo de Seleção
```
1. Agente recebe query → analisa contexto
2. Acessa biblioteca de Nível 1 → vê apenas IDs + quando_usar
3. Seleciona 1+ frameworks centrais
4. Sistema abre frameworks centrais escolhidos
5. Agente vê frameworks secundários (Nível 2) disponíveis
6. Seleciona frameworks secundários necessários
7. Sistema libera conteúdo completo (Nível 3)
8. Agente aplica frameworks aos dados do usuário
```

### 7.2 Referência em Código
```javascript
// Agentes referenciam por ID + versão
const framework = await frameworkLibrary.load('ANALISE_DE_RISCO', '1.2');

// Sistema valida compatibilidade de versão
// Se versão não especificada, usa versão mais recente estável
```

### 7.3 Cache Local
- Agentes fazem cache dos frameworks carregados durante a missão
- Cache é limpo ao final da missão
- Reduz latência de carregamento repetido

---

## 8. VERSIONAMENTO E EVOLUÇÃO

### 8.1 Ciclo de Vida
1. **Criação:** Framework novo é criado com versão `1.0`
2. **Melhorias:** Ajustes incrementais aumentam minor (`1.1`, `1.2`, ...)
3. **Breaking Changes:** Mudanças estruturais incrementam major (`2.0`)
4. **Deprecação:** Frameworks obsoletos são marcados mas mantidos para retrocompatibilidade
5. **Remoção:** Após 6 meses de deprecação, podem ser removidos

### 8.2 Log de Uso
Sistema registra:
- Qual framework foi usado em cada missão
- Versão específica utilizada
- Coordenador que usou
- Timestamp de uso
- Outcome da missão (sucesso/falha)

**Finalidade:** Análise de eficácia dos frameworks ao longo do tempo

### 8.3 A/B Testing
- Sistema pode testar novas versões de frameworks em paralelo
- % das missões usa versão antiga, % usa versão nova
- Métricas de performance determinam qual versão se torna padrão

---

## 9. GOVERNANÇA

### 9.1 Adição de Novos Frameworks
**Processo:**
1. Proposta documentada (objetivo, premissas, etapas)
2. Revisão por especialista financeiro
3. Validação técnica da estrutura
4. Testes em ambiente controlado
5. Aprovação e adição à biblioteca
6. Documentação atualizada

### 9.2 Modificação de Frameworks Existentes
**Minor (1.x → 1.y):**
- Ajustes de thresholds
- Novas métricas opcionais
- Melhorias de performance
- Documentação expandida

**Major (1.x → 2.0):**
- Mudança de estrutura
- Novos campos obrigatórios
- Remoção de campos
- Mudança de critérios fundamentais

### 9.3 Revisão Periódica
- Trimestral: Análise de uso e eficácia
- Semestral: Revisão de frameworks pouco usados
- Anual: Atualização completa da taxonomia

---

## 10. INTEGRAÇÃO COM AGENTES

### 10.1 Sistema de Carregamento
Arquivo: `server/src/agents/shared/framework-loader.js`
```javascript
class FrameworkLoader {
  async loadLevel1() { /* Retorna frameworks centrais */ }
  async loadLevel2(centralId) { /* Retorna secundários */ }
  async loadLevel3(secondaryId, version) { /* Retorna completo */ }
  async getLatestVersion(frameworkId) { /* Versão mais recente */ }
}
```

### 10.2 Validação
Sistema valida:
- Framework existe na biblioteca
- Versão é válida
- Coordenador tem permissão para usar aquele framework
- Estrutura do framework está completa

### 10.3 Fallback
Se framework não disponível:
1. Tenta versão anterior estável
2. Se não houver, tenta framework similar
3. Se falhar, coordenador opera sem framework (modo manual)

---

## 11. MÉTRICAS E ANALYTICS

### 11.1 Métricas Coletadas
- **Taxa de uso:** Quantas vezes cada framework foi usado
- **Taxa de sucesso:** % de missões bem-sucedidas usando o framework
- **Tempo médio:** Tempo de execução médio com o framework
- **Coordenador:** Qual coordenador mais usa cada framework
- **Combinações:** Quais frameworks são frequentemente usados juntos

### 11.2 Dashboard (Futuro)
- Visualização de uso de frameworks
- Ranking de eficácia
- Identificação de frameworks subutilizados
- Análise de tendências ao longo do tempo

---

## 12. ARQUIVO DE BIBLIOTECA

### Localização
`server/src/agents/shared/frameworks-library.json`

### Estrutura
```json
{
  "metadata": {
    "version": "1.0",
    "last_updated": "2026-01-23",
    "total_frameworks": 32
  },
  "frameworks_nivel_1": [...],
  "frameworks_nivel_2": [...],
  "frameworks_nivel_3": [...],
  "deprecated": [...]
}
```

---

**Versão do Documento:** 1.0  
**Última Atualização:** 23 de Janeiro de 2026  
**Próxima Revisão:** Abril de 2026
