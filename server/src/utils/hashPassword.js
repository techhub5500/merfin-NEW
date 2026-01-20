/*
  Arquivo: hashPassword.js
  Responsável por: fornecer utilitários para hashing e verificação de senhas.
  Aqui entra tudo relacionado com: geração de hash seguro (salt + bcrypt) e comparação entre senha em texto plano e hash armazenado.
  Exporta funções reutilizáveis: `hashPassword(password)` e `comparePassword(password, hashedPassword)`.
*/
const bcrypt = require('bcryptjs');

/**
 * Gera hash da senha
 * @param {string} password - Senha em texto plano
 * @returns {Promise<string>} - Senha hashada
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compara senha em texto plano com hash
 * @param {string} password - Senha em texto plano
 * @param {string} hashedPassword - Senha hashada
 * @returns {Promise<boolean>} - True se as senhas coincidem
 */
async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

module.exports = {
  hashPassword,
  comparePassword
};
