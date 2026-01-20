/*
  Arquivo: authMiddleware.js
  Responsável por: proteger rotas verificando tokens JWT antes que o controller seja executado.
  Aqui entra tudo relacionado com: leitura do header `Authorization`, validação do formato "Bearer <token>",
  verificação do JWT (`jwt.verify`) e, em caso de sucesso, anexar dados do usuário em `req` (ex.: `req.userId`, `req.username`).
  Não realiza lógica de negócio; apenas controle de acesso e tratamento de erros de autenticação.
*/
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Pegar token do header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Token não fornecido'
      });
    }

    // Formato esperado: "Bearer TOKEN"
    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
      return res.status(401).json({
        success: false,
        message: 'Formato de token inválido'
      });
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      return res.status(401).json({
        success: false,
        message: 'Token mal formatado'
      });
    }

    // Verificar token
    jwt.verify(token, process.env.JWT_SECRET || 'seu_secret_super_seguro', (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido ou expirado'
        });
      }

      // Adicionar informações do usuário na request
      req.userId = decoded.userId;
      req.username = decoded.username;
      
      return next();
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Erro ao validar token'
    });
  }
};

module.exports = authMiddleware;
