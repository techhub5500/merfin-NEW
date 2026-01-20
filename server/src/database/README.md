# 🗃️ Camada de Banco de Dados

## Propósito
Centraliza toda a lógica de acesso ao MongoDB. Garante validações rígidas, transações ACID e auditoria completa.

## Estrutura
- **schemas/** - Definições de schemas e validações
- **transactions/** - Gerenciamento de transações ACID

## Responsabilidades
1. Definir schemas rígidos com validação no MongoDB
2. Criar índices para performance
3. Gerenciar transações ACID para operações críticas
4. Manter auditoria imutável (audit_log)
5. Garantir integridade referencial
6. Implementar queries otimizadas

## Princípios
- **MongoDB deve se comportar como PostgreSQL**
- Validações rígidas (strict mode)
- Transações para operações financeiras
- Constraints de integridade
- Audit log imutável (nunca deletar)
