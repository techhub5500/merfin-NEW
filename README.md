# Sistema de Autenticação - Finance Dashboard

Sistema completo de login e cadastro integrado ao frontend e backend, com modal centralizado e autenticação via JWT.

## 🚀 Tecnologias Utilizadas

### Backend
- **Node.js** + **Express** - Servidor HTTP
- **MongoDB** + **Mongoose** - Banco de dados
- **JWT (jsonwebtoken)** - Autenticação via tokens
- **bcryptjs** - Criptografia de senhas
- **dotenv** - Variáveis de ambiente
- **CORS** - Compartilhamento de recursos

### Frontend
- **HTML5** - Estrutura semântica
- **CSS3** - Estilização moderna com animações
- **JavaScript ES6+** - Lógica de autenticação
- **Lucide Icons** - Ícones SVG

## 📁 Estrutura do Projeto

```
project/
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── authController.js      # Recebe requisições e retorna respostas
│   │   ├── models/
│   │   │   └── User.js                # Schema do MongoDB
│   │   ├── routes/
│   │   │   └── authRoutes.js          # Endpoints da API
│   │   ├── services/
│   │   │   └── authService.js         # Lógica de negócio
│   │   ├── middlewares/
│   │   │   └── authMiddleware.js      # Validação de tokens
│   │   └── utils/
│   │       ├── hashPassword.js        # Criptografia de senhas
│   │       ├── tokenUtils.js          # Geração e validação de JWT
│   │       └── validators.js          # Validação de dados
│   ├── server.js                      # Servidor principal
│   └── package.json                   # Dependências do backend
├── client/
│   ├── html/
│   │   └── index.html                 # Página principal com modal
│   ├── css/
│   │   ├── login.css                  # Estilos do modal de autenticação
│   │   └── style.css                  # Estilos gerais
│   └── js/
│       ├── auth.js                    # Lógica de autenticação
│       └── main.js                    # Scripts principais
└── .env                               # Variáveis de ambiente
```

## ⚙️ Instalação e Configuração

### 1. Instalar Dependências do Backend

```bash
cd server
npm install
```

### 2. Configurar Variáveis de Ambiente

O arquivo `.env` já está configurado com:

```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=sua_chave_secreta_super_segura_mude_em_producao_123456789
PORT=3000
```

⚠️ **IMPORTANTE**: Em produção, altere o `JWT_SECRET` para uma chave única e segura!

### 3. Iniciar o Servidor

```bash
# Modo desenvolvimento (com nodemon)
npm run dev

# Modo produção
npm start
```

O servidor estará disponível em:
- **API**: http://localhost:3000/api
- **Frontend**: http://localhost:3000

## 🔐 Endpoints da API

### POST /api/auth/register
Cria uma nova conta de usuário.

**Body:**
```json
{
  "username": "usuario123",
  "email": "usuario@email.com",
  "password": "senha123",
  "confirmPassword": "senha123"
}
```

**Resposta (201):**
```json
{
  "success": true,
  "message": "Usuário criado com sucesso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "65f123...",
      "username": "usuario123",
      "email": "usuario@email.com"
    }
  }
}
```

### POST /api/auth/login
Realiza login na plataforma.

**Body:**
```json
{
  "usernameOrEmail": "usuario123",
  "password": "senha123"
}
```

**Resposta (200):**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "65f123...",
      "username": "usuario123",
      "email": "usuario@email.com"
    }
  }
}
```

### GET /api/auth/verify
Verifica se o token JWT é válido (rota protegida).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Resposta (200):**
```json
{
  "success": true,
  "message": "Token válido",
  "data": {
    "userId": "65f123...",
    "username": "usuario123"
  }
}
```

## 🎨 Funcionalidades do Frontend

### Modal de Autenticação
- **Aparece automaticamente** se o usuário não estiver autenticado
- **Centralizado** na tela com overlay
- **Duas abas**: Login e Cadastro
- **Validação em tempo real** dos campos
- **Micro-interações**: animações de entrada/saída, feedback visual
- **Acessibilidade**: navegação por teclado, ARIA labels

### Validações
- ✅ Email válido
- ✅ Senha com mínimo de 6 caracteres
- ✅ Usuário entre 3 e 30 caracteres
- ✅ Confirmação de senha
- ✅ Mensagens de erro específicas

### Recursos Visuais
- 🎨 Gradientes modernos
- ✨ Animações suaves
- 🌊 Backdrop blur no overlay
- 🔄 Loading spinner nos botões
- 👁️ Toggle para mostrar/ocultar senha
- 📱 Totalmente responsivo

## 🔒 Segurança

### Backend
- ✅ Senhas criptografadas com bcrypt (salt de 10 rounds)
- ✅ Tokens JWT com expiração de 7 dias
- ✅ Validação de dados no servidor
- ✅ Middleware de autenticação
- ✅ CORS configurado
- ✅ Tratamento de erros global

### Frontend
- ✅ Token armazenado no localStorage
- ✅ Validação de campos antes do envio
- ✅ Proteção contra XSS
- ✅ Headers de autorização corretos

## 🧪 Como Testar

### 1. Criar uma Conta
1. Abra http://localhost:3000
2. O modal aparecerá automaticamente
3. Clique na aba "Cadastro"
4. Preencha os campos:
   - Nome de usuário (3-30 caracteres)
   - Email válido
   - Senha (mínimo 6 caracteres)
   - Confirme a senha
5. Clique em "Criar Conta"
6. Se sucesso, você será autenticado e o modal fechará

### 2. Fazer Login
1. Clique na aba "Login"
2. Digite seu usuário ou email
3. Digite sua senha
4. Clique em "Entrar"
5. Se as credenciais estiverem corretas, você será autenticado

### 3. Verificar Autenticação
- Ao recarregar a página, se você estiver autenticado, o modal **não aparecerá**
- O token é validado automaticamente no backend
- Para fazer logout, execute no console: `authSystem.logout()`

## 🐛 Solução de Problemas

### Erro: "Erro de conexão. Verifique se o servidor está rodando"
- Certifique-se de que o servidor está rodando: `npm run dev` na pasta `server/`
- Verifique se a porta 3000 está livre

### Erro: "Email já cadastrado" ou "Nome de usuário já existe"
- O sistema não permite duplicatas
- Tente com outro email ou nome de usuário

### Modal não aparece
- Verifique o console do navegador para erros
- Certifique-se de que o arquivo `auth.js` está carregando
- Limpe o localStorage: `localStorage.clear()`

### Token inválido
- O token expira em 7 dias
- Faça logout e login novamente

## 📚 Arquitetura e Padrões

### Backend - Separação de Responsabilidades

#### Routes (authRoutes.js)
- Define apenas os endpoints
- Não contém lógica de negócio
- Aponta para os controllers

#### Controllers (authController.js)
- Recebem `req` e retornam `res`
- Extraem dados da requisição
- Chamam os services
- Retornam resposta formatada

#### Services (authService.js)
- Contêm toda a lógica de negócio
- Validam regras complexas
- Chamam os models
- Não sabem sobre HTTP

#### Models (User.js)
- Definem schemas do MongoDB
- Validações básicas de schema
- Não contêm lógica de negócio

#### Middlewares (authMiddleware.js)
- Executam antes das rotas
- Validação de tokens
- Adicionam dados ao `req`

#### Utils (hashPassword.js, tokenUtils.js, validators.js)
- Funções reutilizáveis
- Podem ser usadas em qualquer projeto
- Sem dependência de contexto

### Frontend - Classe Única

#### AuthSystem (auth.js)
- Padrão Singleton
- Gerencia todo o ciclo de autenticação
- Validação, requisições, UI
- Eventos e interações

## 🎯 Melhorias Futuras

- [ ] Recuperação de senha via email
- [ ] Autenticação de dois fatores (2FA)
- [ ] Login social (Google, GitHub)
- [ ] Rate limiting para prevenir ataques
- [ ] Refresh tokens
- [ ] Logs de auditoria
- [ ] Testes automatizados

## 📄 Licença

Este projeto é de uso educacional e livre para modificação.

---

**Desenvolvido com ❤️ usando Node.js, Express e MongoDB**
