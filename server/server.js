/*
  Arquivo: server.js
  Responsável por: inicializar e configurar o servidor Express, conectar ao MongoDB,
  registrar middlewares globais, servir os arquivos estáticos do frontend e montar as rotas da API.
  Aqui entra tudo relacionado com: bootstrapping da aplicação (conexão `mongoose.connect`),
  logs de inicialização, tratamento global de erros e eventos do processo.
*/
const path = require('path');
// Forçar carregamento do .env na raiz do projeto quando o server é executado a partir de /server
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - Allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (Postman, mobile apps, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend
app.use(express.static('../client'));

// Servir index.html que está em client/html quando o usuário acessar a raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/html/index.html'));
});

// Rotas da API
app.use('/api/auth', authRoutes);

// Rota raiz
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API de Autenticação está funcionando',
    version: '1.0.0'
  });
});

// Tratamento de erro 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada'
  });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Conectar ao MongoDB e iniciar servidor
async function startServer() {
  try {
    // Conectar ao MongoDB
    // Observação: options `useNewUrlParser` e `useUnifiedTopology` são deprecated para o driver atual.
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('✅ MongoDB conectado com sucesso');

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📍 API disponível em: http://localhost:${PORT}/api`);
      console.log(`🌐 Frontend disponível em: http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB:', error.message);
    process.exit(1);
  }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Erro não tratado:', err);
  process.exit(1);
});

startServer();
