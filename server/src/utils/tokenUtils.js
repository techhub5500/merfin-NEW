/*
  Arquivo: tokenUtils.js
  Responsável por: gerar e verificar tokens JWT usados na autenticação.
  Aqui entra tudo relacionado com: assinatura de payloads (`generateToken(payload)`), verificação/decodificação
  (`verifyToken(token)`), e leitura de `process.env.JWT_SECRET` para segurança. Reutilizável em `services/` e `middlewares/`.
*/
const jwt = require('jsonwebtoken');

/**
 * Gera token JWT
 * @param {object} payload - Dados a serem incluídos no token
 * @returns {string} - Token JWT
 */
function generateToken(payload) {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'seu_secret_super_seguro',
    { expiresIn: '7d' } // Token expira em 7 dias
  );
}

/**
 * Verifica e decodifica token JWT
 * @param {string} token - Token a ser verificado
 * @returns {object} - Payload decodificado
 */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'seu_secret_super_seguro');
}

module.exports = {
  generateToken,
  verifyToken
};
