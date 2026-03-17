const express = require('express');
const router = express.Router();

// Placeholder auth routes
router.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint - not implemented yet' });
});

router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint - not implemented yet' });
});

router.get('/me', (req, res) => {
  res.json({ message: 'Get current user - not implemented yet' });
});

module.exports = router;