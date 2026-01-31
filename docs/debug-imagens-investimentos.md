# Debug - Imagens de Investimentos Não Carregam

## Problema Identificado

A página `invest.html` possui subpáginas com hash (`#carteira`, `#fiscal`), mas todas compartilham o mesmo arquivo HTML. A imagem deve ser a mesma em todas as subpáginas.

## Verificações Rápidas

### 1. Abrir o Console do Navegador (F12)

**Na aba "Console"**, você verá mensagens como:

```
[BackgroundImageManager] Detectando página: { pathname: '/client/html/invest.html', href: 'http://localhost:3000/client/html/invest.html' }
[BackgroundImageManager] Página detectada: invest
[BackgroundImageManager] Carregando imagem para página: invest
[BackgroundImageManager] Buscando da API: /api/backgrounds/invest/current
[BackgroundImageManager] Resposta da API: { success: true, data: { ... } }
[BackgroundImageManager] Imagem obtida com sucesso: [Nome da Imagem]
```

### 2. Verificar se a Imagem Existe no MongoDB

**No terminal**, execute:

```bash
curl http://localhost:3000/api/backgrounds/invest/current
```

**Resposta esperada:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Nome da Imagem",
    "dataURL": "data:image/jpeg;base64,...",
    "description": "Descrição",
    "displayCount": 0,
    "lastDisplayed": null
  }
}
```

Se retornar erro 404, significa que **não há imagem para invest** no banco de dados.

### 3. Verificar Cache do Navegador

No console, execute:

```javascript
// Ver cache da página invest
console.log(localStorage.getItem('bg_image_cache_invest'));

// Limpar cache
localStorage.removeItem('bg_image_cache_invest');

// Recarregar a página
window.location.reload();
```

### 4. Verificar CSS

A classe `.invest-bg` deve estar presente no `<body>`:

```html
<body class="invest-bg invest-page">
```

E o CSS de `invest.css` deve ter:

```css
body.invest-bg {
	background: linear-gradient(180deg, #000000 0%, #050505 100%);
	background-size: cover;
	background-position: center center;
	background-repeat: no-repeat;
	background-attachment: fixed;
}
```

## Passo a Passo para Resolver

### Passo 1: Adicionar a Imagem via Dashboard Admin

1. Acesse **http://localhost:3000/admin**
2. Selecione uma imagem
3. **Importante:** Selecione `invest` na dropdown de "Página"
4. Clique em "Enviar"
5. Aguarde a mensagem de sucesso

### Passo 2: Verificar no Console (F12)

- Abra a aba "Console"
- Vá para `invest.html`
- Procure por mensagens `[BackgroundImageManager]`
- Se houver erro de 404, a imagem não foi adicionada com a página correta

### Passo 3: Limpar Cache

```javascript
// No console da página invest.html
localStorage.removeItem('bg_image_cache_invest');
location.reload();
```

### Passo 4: Verificar em Todas as Subpáginas

As subpáginas usam hash:
- `invest.html` → Dashboard
- `invest.html#carteira` → Carteira Detalhada
- `invest.html#fiscal` → Fiscal e Eventos

Todas devem mostrar a **mesma imagem**, pois compartilham o mesmo HTML.

## Possíveis Problemas

### Problema: Imagem não aparece, mas não há erro no console

**Solução:**
1. Verifique se a imagem está em `invest` no MongoDB:
   ```bash
   curl http://localhost:3000/api/admin/backgrounds/list
   ```
   Procure por um objeto com `"page": "invest"`

2. Se não existir, adicione via admin dashboard

### Problema: Erro 404 ao buscar /api/backgrounds/invest/current

**Solução:**
1. Adicione uma imagem para a página `invest` no admin
2. Limpe o cache: `localStorage.removeItem('bg_image_cache_invest')`
3. Recarregue a página: `location.reload()`

### Problema: Imagem diferente em cada subpágina

**Aviso:** Isso não deve acontecer, pois todas as subpáginas usam o mesmo arquivo `invest.html`

Se isso ocorrer, o problema é a estrutura da página (verifique se há múltiplos HTMLs carregados).

## Informações Técnicas

### Fluxo de Carregamento

1. **Página carrega** (`invest.html`)
2. **main.js é executado**
3. **BackgroundImageManager detecta página**: `invest` ✅
4. **Checa localStorage** (`bg_image_cache_invest`)
   - Se válido (< 24h) → usa cache
   - Se inválido ou não existe → busca API
5. **Requisição GET** `/api/backgrounds/invest/current`
6. **API retorna** imagem com `dataURL` em Base64
7. **JavaScript aplica** ao `document.body.style.backgroundImage`
8. **CSS exibe** com `background-size: cover`

### URLs por Página

| Página | Pathname | Cache Key |
|--------|----------|-----------|
| Home | `/client/html/index.html` ou `/` | `bg_image_cache_index` |
| Dashboard | `/client/html/dash.html` | `bg_image_cache_dash` |
| Investimentos | `/client/html/invest.html` | `bg_image_cache_invest` |

## Teste Completo

```javascript
// Cole no console da página invest.html

// 1. Verificar detecção
console.log('Página detectada:', window.BackgroundImageManager.getCurrentPage());

// 2. Limpar cache
localStorage.removeItem('bg_image_cache_invest');

// 3. Forçar atualização
window.BackgroundImageManager.forceRefresh().then(() => {
    console.log('✅ Atualização concluída');
});

// 4. Verificar em 3 segundos
setTimeout(() => {
    console.log('Background:', document.body.style.backgroundImage.substring(0, 100) + '...');
}, 3000);
```

## Se Ainda Não Funcionar

1. **Verifique server.js:** Certifique-se de que as rotas estão montadas:
   ```javascript
   app.use('/api/admin/backgrounds', require('./src/routes/adminBackgroundRoutes'));
   app.use('/api/backgrounds', require('./src/routes/backgroundImageRoutes'));
   ```

2. **Reinicie o servidor:**
   ```bash
   npm start
   ```

3. **Verifique MongoDB:** Conecte ao MongoDB Compass e veja se há documentos em `background_images`

4. **Verifique cache do navegador:** 
   - Ctrl+Shift+Delete (Chrome)
   - Limpe cookies e cache
   - Recarregue a página

---

**Última atualização:** 31 de Janeiro de 2026
**Versão:** 1.0.0
