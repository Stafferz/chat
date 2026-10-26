const express = require('express');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не отправлен' });
  res.json({
    url: `/uploads/${req.file.filename}`,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname
  });
});

module.exports = router;
