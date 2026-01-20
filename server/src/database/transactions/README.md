# 💼 Transações ACID

## Propósito
Gerencia transações ACID do MongoDB para garantir consistência em operações financeiras críticas.

## Arquivos que devem estar aqui
- `transaction-manager.js` - Gerenciador principal de transações
- `account-transactions.js` - Transações envolvendo contas
- `transfer-transactions.js` - Transações de transferência entre contas
- `investment-transactions.js` - Transações de investimentos
- `rollback-handler.js` - Tratamento de rollbacks

## Responsabilidades
1. Iniciar sessões do MongoDB
2. Executar operações dentro de transações
3. Commitar transações bem-sucedidas
4. Fazer rollback em caso de erro
5. Logar todas as transações no audit_log
6. Garantir atomicidade (tudo ou nada)

## Quando Usar Transações
**OBRIGATÓRIO para:**
- Modificar saldo de conta
- Criar/atualizar transação que afeta saldo
- Transferências entre contas
- Operações que envolvem múltiplos documentos
- Qualquer operação financeira crítica

**NÃO necessário para:**
- Consultas (read-only)
- Operações em documento único
- Logs

## Template de Transação
```javascript
const session = client.startSession();
try {
  session.startTransaction({
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
    readPreference: 'primary'
  });
  
  // Operações...
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  // Log erro
  throw error;
} finally {
  await session.endSession();
}
```

## Configuração
- readConcern: 'snapshot' (isolamento total)
- writeConcern: 'majority' (maioria dos nodes)
- readPreference: 'primary' (sempre ler do primário)
