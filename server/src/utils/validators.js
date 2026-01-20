/*
  Arquivo: validators.js
  Responsável por: agrupar funções de validação reutilizáveis para entrada de usuário.
  Aqui entra tudo relacionado com: validação de formato de email, regras mínimas de senha e validação de username.
  Funções exportadas padrão: `validateEmail`, `validatePasswordStrength`, `validateUsername`.
*/
/**
 * Valida formato de email
 * @param {string} email - Email a ser validado
 * @returns {boolean} - True se o email é válido
 */
function validateEmail(email) {
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email);
}

/**
 * Valida força da senha
 * @param {string} password - Senha a ser validada
 * @returns {object} - Objeto com isValid e mensagem
 */
function validatePasswordStrength(password) {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (password.length < minLength) {
    return {
      isValid: false,
      message: `Senha deve ter no mínimo ${minLength} caracteres`
    };
  }

  return {
    isValid: true,
    message: 'Senha válida'
  };
}

/**
 * Valida nome de usuário
 * @param {string} username - Nome de usuário a ser validado
 * @returns {boolean} - True se o username é válido
 */
function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

module.exports = {
  validateEmail,
  validatePasswordStrength,
  validateUsername
};
