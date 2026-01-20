/*
  Arquivo: authController.js
  Responsável por: receber requisições HTTP relacionadas à autenticação e devolver respostas.
  Aqui entra tudo relacionado com: extração de dados de `req` (body/params/query), chamadas aos serviços
  (ex.: `authService`) que contêm a lógica de negócio, e a formatação de respostas HTTP (`res.status`, `res.json`).
  Deve manter-se focado em entrada/saída HTTP; regras complexas ficam em `services/`.
*/
const authService = require('../services/authService');

class AuthController {
  async register(req, res) {
    try {
      const { username, email, password, confirmPassword } = req.body;

      // Validação básica de entrada
      if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Todos os campos são obrigatórios'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'As senhas não coincidem'
        });
      }

      const result = await authService.registerUser({
        username,
        email,
        password
      });

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: result
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  async login(req, res) {
    try {
      const { usernameOrEmail, password } = req.body;

      // Validação básica de entrada
      if (!usernameOrEmail || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nome de usuário/email e senha são obrigatórios'
        });
      }

      const result = await authService.loginUser({
        usernameOrEmail,
        password
      });

      res.status(200).json({
        success: true,
        message: 'Login realizado com sucesso',
        data: result
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  async verifyToken(req, res) {
    try {
      // Se chegou aqui, o token já foi validado pelo middleware
      res.status(200).json({
        success: true,
        message: 'Token válido',
        data: {
          userId: req.userId,
          username: req.username
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
  }
}

module.exports = new AuthController();
