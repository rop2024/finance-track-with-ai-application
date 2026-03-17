const express = require('express');
const router = express.Router();

// Placeholder transaction routes
router.get('/', (req, res) => {
  res.json({ message: 'Get transactions - not implemented yet' });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create transaction - not implemented yet' });
});

module.exports = router;