# 📋 Schemas do MongoDB

## Propósito
Definições de schemas com validações rígidas para todas as collections do MongoDB.

## Arquivos que devem estar aqui
- `accounts-schema.js` - Schema de contas ✅
- `transactions-schema.js` - Schema de transações ✅
- `users-schema.js` - Schema de usuários ✅
- `credit-card-schema.js` - Schema de cartões de crédito ✅ (NOVO)
- `debt-schema.js` - Schema de dívidas ✅ (NOVO)
- `audit-log-schema.js` - Schema de auditoria (imutável) ✅
- `episodic-memory-schema.js` - Schema de memória episódica
- `long-term-memory-schema.js` - Schema de memória de longo prazo
- `investments-schema.js` - Schema de investimentos (futuro)
- `error-log-schema.js` - Schema de logs de erro (futuro)
- `indexes.js` - Definição de todos os índices (futuro)

## Responsabilidades
1. Definir schema validation usando $jsonSchema
2. Especificar campos obrigatórios
3. Definir tipos de dados permitidos
4. Estabelecer validações (enums, min/max, etc)
5. Configurar validationLevel: "strict"
6. Configurar validationAction: "error"

## Collections Principais
- **accounts** - Contas bancárias/investimento
- **transactions** - Transações financeiras
- **users** - Perfis de usuários
- **investments** - Investimentos ativos
- **audit_log** - Log imutável de auditoria
- **error_log** - Logs de erros do sistema

## Validações Críticas
- Saldo não pode ser negativo (exceto conta crédito)
- Valor de transação deve ser >= 0.01
- Datas não podem ser futuras (exceto pendentes)
- Status deve ser enum válido
- Currency deve ser enum válido (BRL, USD, EUR)
