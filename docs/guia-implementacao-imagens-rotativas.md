# Sistema de Imagens Rotativas - Guia de Implementação

## Visão Geral

Este sistema permite gerenciar imagens de fundo rotativas para as páginas index, dash e invest. As imagens são armazenadas no MongoDB em formato Base64 e rotacionadas automaticamente a cada 24 horas.

## Arquitetura

### Componentes

1. **Schema MongoDB** (`background-images-schema.js`)
   - Armazena imagens em Base64
   - Controla rotação e exibição
   - Rastreia estatísticas de uso

2. **API REST** (`backgroundImageRoutes.js`)
   - Endpoints para CRUD de imagens
   - Lógica de rotação automática
   - Proteção com autenticação

3. **Cliente JavaScript** (`main.js`)
   - Classe `BackgroundImageManager`
   - Cache local (24 horas)
   - Carregamento automático

## Como Inserir Imagens no MongoDB

### Opção 1: Via API REST (Recomendado)

#### Passo 1: Autenticar-se

```bash
# Login para obter token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu@email.com",
    "password": "suasenha"
  }'
```

Resposta:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

Salve o token para usar nas próximas requisições.

#### Passo 2: Converter Imagem para Base64

**Usando Node.js:**

```javascript
const fs = require('fs');
const path = require('path');

// Ler arquivo de imagem
const imagePath = './minha-imagem.jpg';
const imageBuffer = fs.readFileSync(imagePath);
const base64Image = imageBuffer.toString('base64');

console.log('Base64:', base64Image);
console.log('Tamanho:', imageBuffer.length, 'bytes');
```

**Usando Python:**

```python
import base64

with open('minha-imagem.jpg', 'rb') as image_file:
    base64_image = base64.b64encode(image_file.read()).decode('utf-8')
    
print(f'Base64: {base64_image[:100]}...')
print(f'Tamanho: {len(base64_image)} caracteres')
```

**Online:**
- https://base64.guru/converter/encode/image
- https://www.base64-image.de/

#### Passo 3: Enviar Imagem para API

```bash
curl -X POST http://localhost:3000/api/backgrounds \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "name": "Vista da Montanha",
    "page": "dash",
    "imageData": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "mimeType": "image/jpeg",
    "order": 1,
    "description": "Paisagem de montanha ao pôr do sol",
    "tags": ["natureza", "montanha", "pôr do sol"],
    "metadata": {
      "width": 1920,
      "height": 1080,
      "uploadedBy": "admin",
      "source": "unsplash"
    }
  }'
```

**Campos do Payload:**

- `name` (obrigatório): Nome identificador da imagem
- `page` (obrigatório): Página onde será exibida (`index`, `dash` ou `invest`)
- `imageData` (obrigatório): Imagem em Base64 (pode incluir prefixo `data:image/...;base64,`)
- `mimeType` (obrigatório): Tipo da imagem (`image/jpeg`, `image/png`, `image/webp`)
- `order` (opcional): Ordem de prioridade (padrão: 0)
- `description` (opcional): Descrição da imagem
- `tags` (opcional): Array de tags para organização
- `metadata` (opcional): Metadados adicionais

**Resposta de Sucesso:**

```json
{
  "success": true,
  "message": "Imagem criada com sucesso",
  "data": {
    "id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "name": "Vista da Montanha",
    "page": "dash",
    "mimeType": "image/jpeg",
    "order": 1,
    "size": 2456789,
    "displayCount": 0,
    "createdAt": "2026-01-31T10:30:00.000Z"
  }
}
```

### Opção 2: Script Node.js Automatizado

Crie um arquivo `upload-background.js`:

```javascript
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // ou use fetch nativo no Node 18+

async function uploadBackgroundImage(config) {
  const {
    imagePath,
    page,
    name,
    description,
    order,
    tags,
    apiUrl,
    token
  } = config;

  try {
    // Ler e converter imagem
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    
    // Determinar MIME type
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    // Preparar payload
    const payload = {
      name: name || path.basename(imagePath, ext),
      page,
      imageData: base64Image,
      mimeType,
      order: order || 0,
      description,
      tags: tags || [],
      metadata: {
        uploadedBy: 'script',
        originalFilename: path.basename(imagePath),
        uploadDate: new Date().toISOString()
      }
    };

    // Enviar para API
    const response = await fetch(`${apiUrl}/api/backgrounds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Imagem enviada com sucesso!');
      console.log('ID:', result.data.id);
      console.log('Nome:', result.data.name);
      console.log('Tamanho:', (result.data.size / 1024 / 1024).toFixed(2), 'MB');
    } else {
      console.error('❌ Erro:', result.message);
    }

    return result;
  } catch (error) {
    console.error('❌ Erro ao enviar imagem:', error.message);
    throw error;
  }
}

// Exemplo de uso
const config = {
  imagePath: './imagens/view-3.jpg',
  page: 'dash',
  name: 'Dashboard Background 1',
  description: 'Imagem de fundo para página de finanças',
  order: 1,
  tags: ['finanças', 'dashboard'],
  apiUrl: 'http://localhost:3000',
  token: 'SEU_TOKEN_AQUI'
};

uploadBackgroundImage(config)
  .then(() => console.log('Processo concluído!'))
  .catch(err => console.error('Falha:', err));
```

**Executar:**

```bash
node upload-background.js
```

### Opção 3: Script Python Automatizado

Crie um arquivo `upload_background.py`:

```python
import base64
import json
import requests
from pathlib import Path

def upload_background_image(
    image_path: str,
    page: str,
    name: str,
    token: str,
    api_url: str = 'http://localhost:3000',
    description: str = '',
    order: int = 0,
    tags: list = None
):
    """
    Envia uma imagem de fundo para a API
    
    Args:
        image_path: Caminho para o arquivo de imagem
        page: Página de destino (index, dash, invest)
        name: Nome da imagem
        token: Token de autenticação
        api_url: URL base da API
        description: Descrição opcional
        order: Ordem de prioridade
        tags: Lista de tags
    """
    try:
        # Ler e converter imagem
        with open(image_path, 'rb') as image_file:
            image_data = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Determinar MIME type
        ext = Path(image_path).suffix.lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        }
        mime_type = mime_types.get(ext, 'image/jpeg')
        
        # Preparar payload
        payload = {
            'name': name,
            'page': page,
            'imageData': image_data,
            'mimeType': mime_type,
            'order': order,
            'description': description,
            'tags': tags or [],
            'metadata': {
                'uploadedBy': 'python-script',
                'originalFilename': Path(image_path).name
            }
        }
        
        # Enviar requisição
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        response = requests.post(
            f'{api_url}/api/backgrounds',
            headers=headers,
            json=payload
        )
        
        result = response.json()
        
        if result.get('success'):
            print('✅ Imagem enviada com sucesso!')
            print(f"ID: {result['data']['id']}")
            print(f"Nome: {result['data']['name']}")
            print(f"Tamanho: {result['data']['size'] / 1024 / 1024:.2f} MB")
        else:
            print(f"❌ Erro: {result.get('message')}")
        
        return result
    
    except Exception as e:
        print(f'❌ Erro ao enviar imagem: {str(e)}')
        raise

# Exemplo de uso
if __name__ == '__main__':
    upload_background_image(
        image_path='./imagens/view-3.jpg',
        page='dash',
        name='Dashboard Background 1',
        token='SEU_TOKEN_AQUI',
        description='Imagem de fundo para página de finanças',
        order=1,
        tags=['finanças', 'dashboard']
    )
```

**Executar:**

```bash
python upload_background.py
```

## Endpoints da API

### 1. Obter Imagem Atual do Dia

```
GET /api/backgrounds/:page/current
```

**Parâmetros:**
- `page`: Nome da página (`index`, `dash`, `invest`)

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "65a1b2c3d4e5f6g7h8i9j0k1",
    "name": "Vista da Montanha",
    "dataURL": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "description": "Paisagem de montanha",
    "displayCount": 5,
    "lastDisplayed": "2026-01-31T00:00:00.000Z"
  }
}
```

### 2. Listar Imagens de uma Página

```
GET /api/backgrounds/:page/list
Authorization: Bearer TOKEN
```

### 3. Criar Nova Imagem

```
POST /api/backgrounds
Authorization: Bearer TOKEN
Content-Type: application/json
```

### 4. Atualizar Imagem

```
PUT /api/backgrounds/:id
Authorization: Bearer TOKEN
```

### 5. Desativar Imagem

```
DELETE /api/backgrounds/:id
Authorization: Bearer TOKEN
```

### 6. Reativar Imagem

```
POST /api/backgrounds/:id/activate
Authorization: Bearer TOKEN
```

### 7. Estatísticas

```
GET /api/backgrounds/stats
Authorization: Bearer TOKEN
```

## Boas Práticas

### Tamanho das Imagens

- **Tamanho máximo:** 7MB por imagem
- **Resolução recomendada:** 1920x1080 ou 2560x1440
- **Formato preferido:** JPEG (melhor compressão) ou WebP (moderna)
- **Qualidade JPEG:** 80-90% (bom equilíbrio)

### Otimização de Imagens

**Usando ImageMagick:**

```bash
convert input.jpg -resize 1920x1080^ -quality 85 output.jpg
```

**Usando Sharp (Node.js):**

```javascript
const sharp = require('sharp');

sharp('input.jpg')
  .resize(1920, 1080, { fit: 'cover' })
  .jpeg({ quality: 85 })
  .toFile('output.jpg');
```

### Estratégia de Rotação

1. **Uma imagem por dia:** Configure várias imagens com `order` diferente
2. **Priorização:** Imagens com `order` menor são exibidas primeiro
3. **Rotação automática:** Sistema escolhe a imagem menos exibida recentemente
4. **Cache:** Cliente mantém imagem em cache por 24h para performance

### Organização

- Use `tags` para categorizar imagens
- Use `description` para facilitar busca
- Use `order` para controlar sequência
- Use `metadata` para informações extras

## Troubleshooting

### Problema: Imagem não aparece

**Verificar:**
1. Imagem está ativa? (`isActive: true`)
2. Página está correta? (`index`, `dash`, `invest`)
3. Cache local? Limpe com `window.BackgroundImageManager.clearCache()`
4. Console do navegador tem erros?

### Problema: Erro de tamanho

**Solução:**
- Reduza resolução da imagem
- Aumente compressão JPEG
- Use formato WebP

### Problema: Imagem não rotaciona

**Verificar:**
1. Existem múltiplas imagens para a página?
2. Campo `lastDisplayed` está sendo atualizado?
3. Cache está sendo limpo após 24h?

## Exemplos Práticos

### Migrar Imagens Existentes

```javascript
// Script para migrar imagens locais para MongoDB
const fs = require('fs');
const path = require('path');

const imagesToMigrate = [
  { file: 'view-1.jpg', page: 'index', name: 'Home Background' },
  { file: 'view-3.jpg', page: 'dash', name: 'Dashboard Background' },
  { file: 'view-4.jpg', page: 'invest', name: 'Investment Background' }
];

for (const img of imagesToMigrate) {
  await uploadBackgroundImage({
    imagePath: `./client/imagens/${img.file}`,
    page: img.page,
    name: img.name,
    order: 0,
    apiUrl: 'http://localhost:3000',
    token: 'SEU_TOKEN'
  });
}
```

### Agendar Limpeza de Cache

```javascript
// No cliente, agendar limpeza diária do cache
setInterval(() => {
  const bgManager = window.BackgroundImageManager;
  if (bgManager) {
    bgManager.clearCache();
    bgManager.loadBackground();
  }
}, 24 * 60 * 60 * 1000); // 24 horas
```

## Segurança

- Apenas usuários autenticados podem criar/atualizar imagens
- Validação de tipo MIME no servidor
- Limite de tamanho de 7MB por imagem
- Sanitização de campos de entrada
- Proteção contra injeção de código

## Performance

- Cache local de 24 horas
- Lazy loading de Base64
- Compressão de imagens recomendada
- Índices MongoDB otimizados
- Paginação em listagens

---

**Última atualização:** 31 de Janeiro de 2026
**Versão:** 1.0.0
