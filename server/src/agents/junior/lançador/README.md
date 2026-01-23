---
agente lançador:
## 3. Arquitetura conceitual do agente

O Agente Lançador opera como um **executor transacional direto** no sistema multi-agente, especializado em registrar transações financeiras no banco de dados. Ele não realiza análises, cálculos ou decisões - apenas identifica, valida e persiste informações de lançamentos financeiros de forma precisa e estruturada. É o agente responsável por manter o banco de dados atualizado com as movimentações do usuário.

### 📚 Especialização e Limites

O agente é ativado exclusivamente para queries de lançamento financeiro. Ele utiliza um sistema próprio de persistência transacional, separado do sistema de acesso a dados internos usado pelos outros agentes.

---

## 4. 🔀 Missão do Agente Lançador

### Definição Clara
Este agente é responsável por identificar prompts do usuário que representam lançamentos financeiros e registrá-los corretamente no banco de dados, seguindo rigorosamente o schema definido.

**Exemplo de prompt:** "Comprei R$ 250 no supermercado"

### ❌ Não é usado para:
- Consultas ou recuperações de dados
- Análises ou relatórios
- Cálculos financeiros
- Qualquer operação que não seja registro de transação

### ✅ É usado quando:
- Usuário informa uma transação ocorrida
- Prompt contém valor, categoria e contexto financeiro
- É necessário registrar receita ou despesa
- Dados precisam ser persistidos para futuras consultas

---

## 5. 🧠 Processo de Lançamento

O Agente Lançador segue um processo rigoroso de extração e validação:

### 📥 ETAPA 1 — Recebimento e Análise
- Recebe query do Agente Junior via Message Bus
- Identifica que se trata de um lançamento financeiro
- Analisa o prompt natural do usuário

### 🔍 ETAPA 2 — Extração de Informações
Extrai sistematicamente todas as informações relevantes:

- **Valor:** Quantia monetária (R$ 250,00)
- **Tipo:** Receita ou Despesa
- **Categoria:** Supermercado, Alimentação, Transporte, etc.
- **Subcategoria:** Se aplicável (ex.: Combustível dentro de Transporte)
- **Data:** Quando ocorreu (hoje, ontem, data específica)
- **Forma de Pagamento:** À vista, parcelado, cartão, etc.
- **Parcelas:** Se parcelado, número de parcelas
- **Descrição:** Contexto adicional fornecido

### ✅ ETAPA 3 — Validação e Padronização
- Valida consistência dos dados extraídos
- Padroniza formatos (datas, valores, categorias)
- Aplica regras de negócio básicas
- Prepara estrutura para persistência

### 💾 ETAPA 4 — Registro no Banco de Dados
- Utiliza sistema próprio de persistência transacional
- Registra conforme schema do banco de dados
- Garante atomicidade da operação
- Retorna confirmação de sucesso

### 📤 ETAPA 5 — Confirmação e Diálogo Interativo
- Fornece feedback claro do que foi registrado
- **Diálogo para Dúvidas:** Pode conversar com o usuário apenas para esclarecer informações faltantes
- **Confirmação de Operação:** Sempre confirma quando o lançamento é realizado
- Retorna ao Junior com status da conversa

---

## 9. 💬 Sistema de Diálogo Interativo

O Agente Lançador pode manter um diálogo limitado com o usuário para completar informações necessárias ao lançamento:

### 🎯 Quando Iniciar Diálogo
- Informações insuficientes no prompt inicial
- Dados ambíguos ou incompletos
- Necessidade de confirmação de valores/categorias

### ❓ Tipos de Dúvidas Permitidas
- "Qual o valor exato da transação?"
- "Em qual categoria isso se encaixa?"
- "Quando isso ocorreu?"
- "Foi à vista ou parcelado?"
- "Quantas parcelas?"
- "Pode me dar mais detalhes sobre essa despesa/receita?"

### 🔄 Processo de Diálogo
1. **Identifica lacuna:** Agente percebe informação faltante
2. **Pergunta específica:** Formula pergunta clara e direta
3. **Marca contexto:** Sistema registra que resposta deve ir direto para Lançador
4. **Espera resposta:** Usuário responde
5. **Processa resposta:** Integra informação e continua ou finaliza
6. **Confirma operação:** Registra e confirma sucesso

### 📝 Exemplo de Diálogo

**Usuário:** "Gastei 450 reais"

**Lançador:** Identifica valor mas falta categoria e data
**Pergunta:** "Em que você gastou os R$ 450? E quando foi isso?"

**Sistema:** Marca contexto como "diálogo com Lançador"

**Usuário responde:** "No supermercado, hoje"

**Junior:** Detecta contexto ativo → encaminha direto para Lançador

**Lançador:** Registra despesa completa → "Registrado! Despesa de R$ 450,00 em Supermercado hoje."

### 🚫 Limites do Diálogo
- **Apenas dúvidas técnicas:** Não conversa sobre análise ou planejamento
- **Máximo 3 trocas:** Se não resolver em 3 perguntas, sugere reformular
- **Foco no lançamento:** Toda conversa visa completar o registro
- **Saída permitida:** Usuário pode dizer "esquece" ou mudar para análise complexa

---

## 10. 💾 Sistema de Memória

O Agente Lançador **não recebe memória** (nem do sistema de contexto de chat, nem da memória interna dos processos). Opera de forma independente e direta, focado exclusivamente em registro transacional, sem necessidade de contexto histórico ou processos anteriores.

### 🔄 Transição para Complexidade
Se usuário responder algo que indica mudança de escopo:
- "Esquece isso, faça uma análise das minhas finanças"
- Sistema detecta → reseta contexto → volta à triagem normal
- Lançador encerra diálogo e passa controle

---

## 6. 📋 Estrutura de Extração de Dados

O agente identifica e classifica múltiplas camadas de informação:

### 🔢 Valor
- Identificação: Números precedidos de R$, reais, etc.
- Formatação: Padronização para formato decimal
- Validação: Verificação de plausibilidade

### 📊 Tipo (Receita/Despesa)
- **Receita:** Entradas positivas (salário, vendas, investimentos)
- **Despesa:** Saídas negativas (compras, contas, pagamentos)

### 🏷️ Categoria e Subcategoria
- **Categorias principais:** Alimentação, Transporte, Saúde, Lazer, etc.
- **Subcategorias:** Detalhamento (ex.: Supermercado dentro de Alimentação)
- **Padronização:** Mapeamento para taxonomia fixa

### 📅 Período e Data
- **Data específica:** "ontem", "15/01/2026", "mês passado"
- **Conversão:** Transformação para formato ISO
- **Validação:** Datas plausíveis (não futuras para despesas passadas)

### 💳 Forma de Pagamento
- **À vista:** Pagamento único
- **Parcelado:** Número de parcelas identificado
- **Cartão:** Crédito, débito, específico
- **Outros:** PIX, transferência, dinheiro

### 📝 Descrição Adicional
- Contexto fornecido pelo usuário
- Detalhes complementares
- Notas especiais

---

## 7. 🔀 Exemplos de Lançamentos

### Exemplo 1: Despesa Simples
**Prompt:** "Comprei R$ 250 no supermercado"

**Extração:**
- Valor: R$ 250,00
- Tipo: Despesa
- Categoria: Alimentação
- Subcategoria: Supermercado
- Data: Hoje
- Forma: Não especificada (assume à vista)

**Registro:** Confirmação de lançamento

### Exemplo 2: Receita com Detalhes
**Prompt:** "Recebi meu salário de R$ 5.000,00 hoje via PIX"

**Extração:**
- Valor: R$ 5.000,00
- Tipo: Receita
- Categoria: Salário
- Data: Hoje
- Forma: PIX

### Exemplo 3: Despesa Parcelada
**Prompt:** "Comprei um celular de R$ 2.400 em 12x no cartão"

**Extração:**
- Valor: R$ 2.400,00
- Tipo: Despesa
- Categoria: Eletrônicos
- Subcategoria: Celular
- Parcelas: 12x
- Forma: Cartão de crédito

### Exemplo 4: Despesa com Data Específica
**Prompt:** "Paguei a conta de luz de dezembro, R$ 180"

**Extração:**
- Valor: R$ 180,00
- Tipo: Despesa
- Categoria: Contas
- Subcategoria: Energia
- Data: Dezembro (mês específico)
- Período: Histórico

---

## 8. 🔧 Sistema Próprio de Persistência

O Agente Lançador utiliza um **sistema dedicado de persistência transacional**, separado do sistema de acesso a dados internos:

- **Isolamento:** Não interfere com consultas dos outros agentes
- **Atomicidade:** Garante que lançamentos sejam completos ou rejeitados
- **Schema Compliance:** Segue rigorosamente a estrutura do banco de dados
- **Validação:** Regras de negócio aplicadas no momento do registro
- **Auditoria:** Logs de todas as operações para rastreabilidade

**Nota:** Este sistema será desenvolvido separadamente e integrado ao agente.

---

## Colaboração com Outros Agentes

O Agente Lançador é chamado diretamente pelo Agente Junior para queries de lançamento:

- **Chamado por:** Agente Junior (único caminho)
- **Como estruturar requisição:** Via Message Bus com prompt natural do usuário
- **Integração:** Registra transações que serão posteriormente consultadas pelos outros agentes
- **Cenários comuns:** Registro diário de receitas e despesas, manutenção do histórico financeiro

Este agente garante que o banco de dados financeiro do usuário esteja sempre atualizado e preciso, servindo como base para todas as análises e consultas do sistema multi-agente.

## 💾 Sistema de Memória

O Agente Lançador **NÃO recebe memória de contexto** (nem Working Memory, nem Episodic Memory, nem Long-Term Memory). Opera de forma completamente independente, focado exclusivamente em registro transacional.

**Exceção:** Durante diálogos de esclarecimento iniciados pelo próprio Lançador, o sistema mantém um flag de `diálogo_ativo` temporário que permite respostas do usuário serem roteadas diretamente ao Lançador sem retriagem. Este flag não constitui acesso a memória histórica.

**O que o Lançador recebe:**
- `userId` - Identificador do usuário
- `sessionId` - Identificador da sessão
- `query_original` - Query do usuário
- `diálogo_ativo` (flag) - Se há diálogo em andamento (apenas para roteamento)

**O que o Lançador NÃO recebe:**
- `workingMemory` (memória de contexto)
- `episodicSummary` (histórico de conversas)
- `longTermMemory` (perfil do usuário)

**Justificativa:** Isolamento total garante que lançamentos transacionais sejam rápidos, seguros e não dependam de contexto histórico que poderia causar inconsistências.

