const express = require('express');
const router = express.Router();
const { register, login, getCurrentUser, logout } = require('../../controllers/auth.controller');
const { registerValidation, loginValidation, validate } = require('../../middleware/validation/auth.validation');
const { authenticate } = require('../../middleware/auth');

// Public routes
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);

// Protected routes
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);

module.exports = router;