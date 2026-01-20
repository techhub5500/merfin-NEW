# Estrutura do Projeto

Árvore de diretórios e arquivos do workspace (raiz: "Nova pasta"):

```text
Nova pasta/
├── .gitignore
├── LOGIN.md
├── README.md
├── docs/
│   ├── ESTRUTURA_PROJETO.md
│   └── PLANO_IMPLEMENTACAO.md
├── client/
│   ├── css/
│   │   ├── dash.css
│   │   ├── invest.css
│   │   ├── login.css
│   │   ├── profile.css
│   │   └── style.css
│   ├── html/
│   │   ├── dash.html
│   │   ├── index.html
│   │   ├── invest.html
│   │   └── profile.html
│   └── js/
│       ├── auth.js
│       ├── dash.js
│       ├── invest.js
│       ├── main.js
│       └── profile.js
├── server/
│   ├── .env.example
│   ├── CORREÇÕES_APLICADAS.md
│   ├── package-lock.json
│   ├── package.json
│   ├── serverAgent.js
│   ├── server.js
│   ├── logs/
│   │   └── README.md
│   └── src/
│       ├── api/
│       │   └── routes/
│       │       └── README.md
│       ├── agents/
│       │   ├── README.md
│       │   ├── analyst/
│       │   │   └── README.md
│       │   ├── data/
│       │   │   ├── README.md
│       │   │   ├── account-queries.js
│       │   │   ├── cache-manager.js
│       │   │   ├── data-agent.js
│       │   │   ├── data-validator.js
│       │   │   ├── transaction-queries.js
│       │   │   └── user-queries.js
│       │   ├── orchestrator/
│       │   │   └── README.md
│       │   ├── research/
│       │   │   └── README.md
│       │   ├── shared/
│       │   │   ├── README.md
│       │   │   ├── base-agent.js
│       │   │   ├── constants.js
│       │   │   ├── contracts.js
│       │   │   ├── error-handler.js
│       │   │   ├── logger.js
│       │   │   └── response-formatter.js
│       │   ├── strategist/
│       │   │   └── README.md
│       │   ├── transaction/
│       │   │   └── README.md
│       │   └── validator/
│       │       └── README.md
│       ├── config/
│       │   ├── README.md
│       │   └── deepseek-config.js
│       ├── controllers/
│       │   └── authController.js
│       ├── core/
│       │   ├── README.md
│       │   ├── streaming/
│       │   │   ├── README.md
│       │   │   ├── event-emitter.js
│       │   │   ├── event-types.js
│       │   │   └── stream-formatter.js
│       │   ├── toolContext/
│       │   │   ├── README.md
│       │   │   ├── index.js
│       │   │   ├── tool-context.js
│       │   │   └── ttl-manager.js
│       │   └── memory/
│       │       ├── README.md
│       │       ├── episodic/
│       │       │   ├── README.md
│       │       │   ├── chat-state-manager.js
│       │       │   ├── compression-engine.js
│       │       │   ├── episodic-memory.js
│       │       │   └── relevance-scorer.js
│       │       ├── longTerm/
│       │       │   ├── README.md
│       │       │   ├── long-term-memory.js
│       │       │   ├── memory-curator.js
│       │       │   ├── memory-merger.js
│       │       │   ├── profile-manager.js
│       │       │   ├── relevance-calculator.js
│       │       │   └── vector-store.js
│       │       ├── shared/
│       │       │   ├── README.md
│       │       │   ├── embedding-generator.js
│       │       │   ├── hard-rules.js
│       │       │   ├── memory-compressor.js
│       │       │   ├── memory-types.js
│       │       │   ├── memory-validator.js
│       │       │   └── word-counter.js
│       │       └── working/
│       │           ├── README.md
│       │           ├── context-builder.js
│       │           ├── session-store.js
│       │           └── working-memory.js
│       ├── database/
│       │   ├── README.md
│       │   ├── schemas/
│       │   │   ├── README.md
│       │   │   ├── accounts-schema.js
│       │   │   ├── audit-log-schema.js
│       │   │   ├── episodic-memory-schema.js
│       │   │   ├── long-term-memory-schema.js
│       │   │   ├── transactions-schema.js
│       │   │   └── users-schema.js
│       │   └── transactions/
│       │       ├── README.md
│       │       ├── account-transactions.js
│       │       └── transaction-manager.js
│       ├── external/
│       │   ├── README.md
│       │   ├── llm/
│       │   │   └── README.md
│       │   ├── serper/
│       │   │   └── README.md
│       │   └── tavily/
│       │       └── README.md
│       ├── middlewares/
│       │   └── authMiddleware.js
│       ├── models/
│       │   └── User.js
│       ├── routes/
│       │   └── authRoutes.js
│       ├── services/
│       │   └── authService.js
│       └── utils/
│           ├── hashPassword.js
│           ├── tokenUtils.js
│           └── validators.js
└── (outros arquivos e pastas conforme acima)

```

Observações:
- A árvore foi gerada a partir dos arquivos presentes no workspace no momento da verificação.
- Se você quiser que eu inclua também tamanhos de arquivos, datas ou links relativos, diga e atualizo.

