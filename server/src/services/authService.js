/*
  Arquivo: authService.js
  Responsável por: conter a lógica de negócio da autenticação (registro e login).
  Aqui entra tudo relacionado com: regras de validação mais complexas, interação com `models/` (CRUD em `User`),
  hashing de senhas, verificação de credenciais, atualização de metadados (ex.: `lastLogin`) e geração de tokens.
  Deve ser testável isoladamente e não deve manipular `req`/`res` diretamente.
*/
const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/hashPassword');
const { generateToken } = require('../utils/tokenUtils');
const { validateEmail } = require('../utils/validators');
const Account = require('../database/schemas/accounts-schema');

class AuthService {
  async registerUser({ username, email, password }) {
    // Validar formato do email
    if (!validateEmail(email)) {
      throw new Error('Email inválido');
    }

    // Validar comprimento da senha
    if (password.length < 6) {
      throw new Error('Senha deve ter no mínimo 6 caracteres');
    }

    // Validar comprimento do username
    if (username.length < 3 || username.length > 30) {
      throw new Error('Nome de usuário deve ter entre 3 e 30 caracteres');
    }

    // Verificar se o usuário já existe
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new Error('Email já cadastrado');
      }
      if (existingUser.username === username) {
        throw new Error('Nome de usuário já existe');
      }
    }

    // Hash da senha
    const hashedPassword = await hashPassword(password);

    // Criar usuário
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    // Gerar token
    const token = generateToken({
      userId: user._id,
      username: user.username
    });

    // Criar conta padrão automaticamente após cadastro do usuário
    try {
      const account = new Account({
        userId: user._id
      });
      await account.save();

      return {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        },
        account: {
          id: account._id,
          currency: account.currency,
          balance: account.balance,
          status: account.status,
          createdAt: account.createdAt
        }
      };
    } catch (acctErr) {
      console.error('Erro ao criar conta padrão:', acctErr);
      return {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      };
    }
  }

  async loginUser({ usernameOrEmail, password }) {
    // Buscar usuário por email ou username
    const user = await User.findOne({
      $or: [
        { email: usernameOrEmail.toLowerCase() },
        { username: usernameOrEmail }
      ]
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar senha
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new Error('Senha incorreta');
    }

    // Atualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Gerar token
    const token = generateToken({
      userId: user._id,
      username: user.username
    });

    return {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    };
  }
}

module.exports = new AuthService();
