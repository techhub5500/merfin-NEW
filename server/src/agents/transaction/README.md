# 💸 Agente de Lançamentos

## Propósito
Agente responsável por parsing, validação e **EXECUÇÃO** de transações financeiras. Converte linguagem natural em lançamentos estruturados e executa automaticamente. Usuário pode desfazer posteriormente.

## Arquivos que devem estar aqui
- `transaction-agent.js` - Classe principal do agente
- `intent-parser.js` - Parse de intenção em linguagem natural
- `transaction-validator.js` - Validação de dados de transação
- `duplicate-detector.js` - Detecção de lançamentos duplicados
- `category-suggester.js` - Sugestão automática de categorias
- `nlp-extractor.js` - Extração de entidades (valor, data, descrição)
- `transaction-executor.js` - Execução da transação no banco via Data Agent
- `undo-manager.js` - Gerenciamento de operações reversíveis

## Responsabilidades
1. Fazer parsing de frases como "Recebi R$ 5000 de salário hoje"
2. Extrair entidades: tipo (income/expense), valor, data, descrição
3. Validar dados obrigatórios
4. Detectar possíveis duplicatas (janela de 7 dias)
5. Sugerir categoria baseado em histórico do usuário
6. Calcular score de confiança do parsing
7. **EXECUTAR transação automaticamente** após validações
8. Armazenar estado pré-execução para permitir desfazer
9. Fornecer mecanismo de undo (desfazer) ao usuário

## Tools Implementadas
- `parse_transaction_intent` - Parse de linguagem natural
- `validate_transaction` - Validação completa
- `detect_duplicates` - Detecção de duplicatas
- `categorize_transaction` - Sugestão de categoria
- `execute_transaction` - Executa transação no banco (NOVA)
- `undo_transaction` - Desfaz transação executada (NOVA)

## Workflow
1. Parse da intenção → 2. Valida dados → 3. Detecta duplicatas → 4. Categoriza → 5. **EXECUTA transação** → 6. Retorna sucesso com ID da transação → 7. Usuário pode desfazer via botão/comando

## Mecanismo de Undo
- Cada transação executada gera um registro de undo
- Estado anterior é armazenado (saldo antes, dados da transação)
- Usuário tem janela de tempo para desfazer (ex: 24 horas)
- Undo executa operação reversa usando transação ACID
- Após janela, undo expira mas transação fica no histórico
