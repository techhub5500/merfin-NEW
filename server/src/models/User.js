/*
  Arquivo: User.js
  Responsável por: definir o schema do usuário no MongoDB usando Mongoose.
  Aqui entra tudo relacionado com: estrutura de dados do usuário (campos como `username`, `email`, `password`, `createdAt`, `lastLogin`),
  validações de campo no nível do schema (required, minlength, match) e índices/uniqueness.
  Não contém lógica de negócio (essa fica em `services/`).
*/
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Nome de usuário é obrigatório'],
    unique: true,
    trim: true,
    minlength: [3, 'Nome de usuário deve ter no mínimo 3 caracteres'],
    maxlength: [30, 'Nome de usuário deve ter no máximo 30 caracteres']
  },
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Por favor, insira um email válido']
  },
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter no mínimo 6 caracteres']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

module.exports = mongoose.model('User', userSchema);
