# 📋 LOG DE OBSERVABILIDADE

**Data/Hora:** 27/01/2026, 15:41:33  
**Modo:** OBSERVABILIDADE  
**Filtro:** BOUNDARY | DECISION | STATE | SUMMARY | COST | AI_PROMPT

---

**27/01/2026, 15:41:33,682** [INFO] 📋 Sistema de logging inicializado (modo observabilidade) `{"debugMode":false,"autoCleanup":"5 minutos","aiPromptLogging":"ATIVO"}`

# 📋 LOG DE OBSERVABILIDADE

**Data/Hora:** 27/01/2026, 15:41:33  
**Modo:** OBSERVABILIDADE  
**Filtro:** BOUNDARY | DECISION | STATE | SUMMARY | COST | AI_PROMPT

---

**27/01/2026, 15:41:33,685** [INFO] 📋 Sistema de logging inicializado (modo observabilidade) `{"debugMode":false,"autoCleanup":"5 minutos","aiPromptLogging":"ATIVO"}`

**27/01/2026, 15:45:16,803** [LOG] [SERVER] 📥 POST /api/chat/process - Campos extraídos: ```json
{
  "message": "Como posso melhorar minhas finanças?",
  "sessionId": "session_1769543114415_769iverzh",
  "historyLength": 0,
  "userId": "6976a5068cc1f4002a9fc768",
  "chatId": "697915ccce8daeb39a1b45f9"
}
```

**27/01/2026, 15:45:19,741** [LOG] [JuniorAgent] 🔵 Classificação bem-sucedida: complexa

**27/01/2026, 15:45:19,743** [LOG] [JuniorAgent] 🔵 Categoria identificada: complexa

**27/01/2026, 15:45:19,751** [LOG] [JuniorAgent] 🟠 Fluxo COMPLEXA

**27/01/2026, 15:45:20,056** [LOG] [JuniorAgent] 💾 Memória carregada para análise: `{"hasSummary":false,"recentWindowSize":0}`

**27/01/2026, 15:45:24,247** [LOG] [JuniorAgent] 🟠 Análise secundária concluída: ```json
{
  "dominio": "planejamento_financeiro_integrado",
  "coordenador": "coord_planejamentos",
  "prompts": [
    "p_plano_passo_a_passo"
  ],
  "justificativa": "Pedido é abrangente — usuário quer melhorar finanças de forma integrada; coordenador de planejamento entrega metas e cronograma acionável."
}
```

**27/01/2026, 15:45:24,269** [LOG] [JuniorAgent] 📦 Montando pacote de handover...

**27/01/2026, 15:45:24,283** [LOG] [JuniorAgent] 📤 Roteando para: coord_planejamentos

**27/01/2026, 15:45:24,284** [LOG] [JuniorAgent] 🚀 Enviando para coordenador...

**27/01/2026, 15:45:45,493** [LOG] [JuniorAgent] ✅ Resposta do coord_planejamentos recebida em 21200ms

**27/01/2026, 15:45:45,495** [LOG] [JuniorAgent] 💰 Tokens consumidos pelo coordenador: ```json
{
  "prompt_tokens": 373,
  "completion_tokens": 1500,
  "total_tokens": 1873,
  "prompt_tokens_details": {
    "cached_tokens": 0,
    "audio_tokens": 0
  },
  "completion_tokens_details": {
    "reasoning_tokens": 1500,
    "audio_tokens": 0,
    "accepted_prediction_tokens": 0,
    "rejected_prediction_tokens": 0
  }
}
```

**27/01/2026, 15:45:45,496** [WARN] [JuniorAgent] ⚠️ Resposta vazia recebida do coordenador

**27/01/2026, 15:45:45,497** [ERROR] [JuniorAgent] ❌ Erro no roteamento para coord_planejamentos: Coordenador retornou resposta vazia

**27/01/2026, 15:45:45,517** [LOG] [CHAT] Enviando resposta para o cliente: {
  "status": "success",
  "response": "Desculpe, houve um erro ao processar sua solicitação complexa. Por favor, tente reformular sua pergunta.",
  "sessionId": "session_1769543114415_769iverzh",
  "timestamp": "2026-01-27T19:45:45.499Z",
  "error": "Coordenador retornou resposta vazia",
  "metadata": {
    "coordenador": "coord_planejamentos",
    "fluxo": "complexa",
    "status": "error"
  },
  "chatId": "697915ccce8daeb39a1b45f9"
}

