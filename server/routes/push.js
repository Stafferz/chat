const express = require('express');
const { pushSubscriptions } = require('../store');

const router = express.Router();

router.post('/subscribe', (req, res) => {
  const { userId, subscription } = req.body;
  if (!userId || !subscription) return res.status(400).json({ error: 'Missing data' });
  pushSubscriptions.set(userId, subscription);
  res.json({ ok: true });
});

module.exports = router;
