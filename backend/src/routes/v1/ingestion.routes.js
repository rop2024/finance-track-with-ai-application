const express = require('express');
const router = express.Router();

// Placeholder ingestion routes
router.post('/upload', (req, res) => {
  res.json({ message: 'Upload data - not implemented yet' });
});

module.exports = router;