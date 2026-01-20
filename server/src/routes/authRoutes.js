/*
	Arquivo: authRoutes.js
	Responsável por: definir os endpoints HTTP relacionados à autenticação e mapear cada rota para o controller correspondente.
	Aqui entra tudo relacionado com: declarações de rotas Express (ex.: `POST /register`, `POST /login`, `GET /verify`),
	uso de middlewares específicos por rota (ex.: `authMiddleware`) e nada de lógica de negócio.
*/
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rota de cadastro
router.post('/register', authController.register);

// Rota de login
router.post('/login', authController.login);

// Rota para verificar token (protegida)
router.get('/verify', authMiddleware, authController.verifyToken);

module.exports = router;
