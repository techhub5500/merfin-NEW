# Config - Configurações do Sistema

Esta pasta contém arquivos de configuração para serviços externos e integrações utilizadas pelo sistema de agentes e módulos de memória.

## Arquivos e Responsabilidades

### deepseek-config.js
Arquivo responsável por configurar e gerenciar a integração com a API da DeepSeek v3, modelo de linguagem utilizado para operações de raciocínio de IA no sistema, especialmente em tarefas relacionadas à memória.

Este arquivo centraliza toda a configuração necessária para chamar a DeepSeek: chave de API (carregada de variável de ambiente), URL base, nome do modelo, parâmetros padrão de requisição (temperatura, tokens máximos, top_p), timeouts e configurações de retry. A temperatura é mantida baixa (0.3) para garantir respostas consistentes e previsíveis, essencial para tarefas de curadoria de memória.

Oferece três funções principais: `callDeepSeek()` para chamadas padrão de chat com retry automático em caso de falha (até 3 tentativas com delay progressivo), `callDeepSeekJSON()` para chamadas que esperam resposta estruturada em JSON (com limpeza automática de markdown e validação de JSON) e `testConnection()` para verificar se a API está acessível.

A DeepSeek foi escolhida por ser uma solução custo-efetiva e rápida, suficiente para tarefas de curadoria e análise de memória. É utilizada por componentes como memory curator (para decidir quais memórias manter ou descartar), impact scorer (para avaliar relevância de eventos) e todas as operações de raciocínio de IA do sistema de memória.

O arquivo implementa tratamento robusto de erros, logging de tentativas falhadas e parsing inteligente de respostas JSON que podem vir envoltas em blocos de código markdown. Todas as chamadas têm timeout de 15 segundos para prevenir bloqueios.
