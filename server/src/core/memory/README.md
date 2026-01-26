# Sistema de Memória - Arquitetura Simplificada

## Estrutura de Pastas

```
memory/
├── conversational/          # ✅ NOVO SISTEMA (ATIVO)
│   ├── conversational-memory.js
│   └── README.md
├── memory-integration-new.js # ✅ Integração simplificada
├── memory-integration.js     # ⚠️ DEPRECIADO
├── episodic/                 # ⚠️ DEPRECIADO
├── longTerm/                 # ⚠️ DEPRECIADO
├── working/                  # ⚠️ DEPRECIADO
└── shared/                   # ⚠️ DEPRECIADO
```

## Sistema Ativo

### Memória Conversacional (`conversational/`)

Sistema automático que mantém contexto relevante respeitando limite de **3.000 tokens**.

#### Funcionamento:
1. **Últimos 4 ciclos**: preservados integralmente
2. **Ciclos anteriores**: comprimidos progressivamente (25% por camada)
3. **Resumos inteligentes**: usando LLM para extrair essência

#### Arquivos:
- `conversational-memory.js` - Lógica de ciclos e compressão
- `../memory-integration-new.js` - API para agentes

## Módulos Depreciados

> ⚠️ Os módulos abaixo foram substituídos pelo novo sistema conversacional.
> Mantidos temporariamente para referência.

- `episodic/` - Memória por chat (substituído por ciclos)
- `longTerm/` - Memória de longo prazo (substituído por resumos progressivos)
- `working/` - Memória de sessão (não mais necessário)
- `shared/` - Utilitários compartilhados (inline no novo sistema)
- `memory-integration.js` - Antiga integração complexa

## Migração

O JuniorAgent agora usa:
```javascript
const memoryIntegration = require('../../../core/memory/memory-integration-new');
```

## Benefícios do Novo Sistema

| Antes | Depois |
|-------|--------|
| 3 tipos de memória | 1 sistema unificado |
| Múltiplas camadas de abstração | Código direto e simples |
| Dependências complexas | Módulo autocontido |
| Bugs frequentes | Fluxo previsível |
| Custo alto de IA para curadoria | IA apenas para resumos |

## Uso

```javascript
const memoryIntegration = require('./memory-integration-new');

// Construir contexto
const context = await memoryIntegration.buildAgentContext(sessionId, chatId, userId);

// Usar em prompt
const prompt = memoryIntegration.formatContextForPrompt(context);
```
