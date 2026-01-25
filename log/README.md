# 📋 Sistema de Logging

Este diretório contém os arquivos de log do sistema em formato **Markdown** (`.md`) para melhor visualização e análise.

## 🎯 Características

### Formato dos Arquivos
- **Nomenclatura**: `log_YYYY-MM-DD_HH-MM-SS.md`
- **Formato**: Markdown com HTML/CSS inline para estilização
- **Auto-limpeza**: Arquivos deletados automaticamente após **5 minutos**

### Conteúdo Capturado

O logger intercepta **TODOS** os logs da aplicação:
- `console.log()` → **LOG**
- `console.error()` → **ERROR**
- `console.warn()` → **WARN**
- `console.info()` → **INFO**

### Estrutura de um Log Entry

Cada entrada de log contém:

```markdown
### 2026-01-24 22:30:50.123 — **LOG**

Mensagem de texto aqui

```json
{
  "objeto": "formatado",
  "automaticamente": true
}
```
```

## 🔍 Logs do Sistema de Memórias

O sistema captura **todas** as operações de memória com detalhes:

### Working Memory (Memória de Trabalho)
- ✅ `[WorkingMemory] ✅ Entry APPROVED` - Item aprovado para armazenamento
- ❌ `[WorkingMemory] Entry rejected` - Item rejeitado pela curadoria AI
- 💾 `[WorkingMemory] 💾 Salvando no MongoDB` - Salvamento iniciado
- ✅ `[WorkingMemory] ✅ MongoDB save SUCCESS` - Salvamento confirmado

### Episodic Memory (Memória Episódica)
- 📝 `[EpisodicMemory] 📝 UPDATE iniciado` - Atualização de memória do chat
- ✅ `[EpisodicMemory] ✅ Salvo no MongoDB` - Persistência confirmada
- 🗜️ Logs de compressão quando necessário

### Long-Term Memory (Memória de Longo Prazo)
- 📊 `[LongTermMemory] 📊 PROPOSTA recebida` - Novo candidato para LTM
- ✅ `[LTM] Memory stored` - Memória armazenada com sucesso
- 🔍 Logs de busca e relevância

### Memory Integration (Integração)
- 🚀 `[MemoryProcessor] 🚀 INÍCIO` - Processamento iniciado
- ✅ `[MemoryProcessor] ✅ FIM` - Processamento concluído
- 🎯 `[MemoryIntegration] 🎯 Contexto COMPLETO` - Contexto montado para agente

### JuniorAgent (Agente de Chat)
- 📥 Recebimento de mensagens
- 🧠 Contexto de memória carregado
- 📤 Resposta gerada

## 🎛️ Modos de Operação

### Modo Silencioso (Padrão)
```env
DEBUG_MODE=false
```
- Nada aparece no terminal
- Tudo é salvo nos arquivos `.md`
- **Ideal para produção e análise pós-execução**

### Modo Debug
```env
DEBUG_MODE=true
```
- Logs aparecem no terminal **E** nos arquivos
- **Útil para desenvolvimento ativo**

## 📊 Visualização dos Logs

### No VS Code
1. Abra qualquer arquivo `.md` deste diretório
2. Pressione `Ctrl+Shift+V` (Preview) para ver formatação
3. Use `Ctrl+F` para buscar termos específicos

### Busca Rápida
- Buscar por emoji: `🚀`, `✅`, `❌`, `💾`, `🎯`
- Buscar por tipo: `[WorkingMemory]`, `[EpisodicMemory]`, `[LTM]`
- Buscar por operação: `INÍCIO`, `FIM`, `SUCCESS`, `APPROVED`

## 🗑️ Auto-Limpeza

- **Verificação**: A cada 1 minuto
- **Deleção**: Arquivos com mais de 5 minutos
- **Exceção**: O arquivo de log atual NUNCA é deletado

## 📝 Exemplo de Uso

Para analisar o fluxo de memória:

1. **Reinicie o servidor** para criar novo log
2. **Execute operações** (enviar mensagens, etc)
3. **Abra o log mais recente** em `log/`
4. **Busque por**:
   - `🚀 INÍCIO` para ver onde começou
   - `✅ FIM` para ver resultado
   - `❌` para ver erros
   - `💾 Salvando` para ver persistências

## 🔧 Funcionalidades Avançadas

### API do Logger
```javascript
const { getLogger } = require('./src/utils/logger');

// Obter informações dos logs
const info = getLogger().getLogInfo();
console.log(info);
// {
//   currentLogFile: 'C:\\...\\log\\log_2026-01-24_22-30-50.md',
//   logDir: 'C:\\...\\log',
//   debugMode: false,
//   totalLogFiles: 3,
//   logFiles: [...]
// }

// Alternar modo debug em tempo real
getLogger().toggleDebugMode(true);  // Ativa terminal
getLogger().toggleDebugMode(false); // Desativa terminal
```

---

**Última atualização**: 2026-01-24  
**Sistema**: Logger v1.0 com Markdown
