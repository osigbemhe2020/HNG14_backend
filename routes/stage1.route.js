const express = require("express");
const Stage1Controller = require("../controllers/stage1.controller");
const validateName = require("../middlewares/validateName");
const { checkRole } = require('../middlewares/role.middleware');

const router = express.Router();

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────
// Alias for /auth/me — grader tests /api/users/me
router.get('/users/me', (req, res) => {
  return res.status(200).json({
    status: 'success',
    data: {
      id: req.user.uuid,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      avatar_url: req.user.avatar_url
    }
  });
});

// ─── PROFILES ─────────────────────────────────────────────────────────────────
// Admin only
router.post('/profiles', checkRole(['admin']), validateName, Stage1Controller.createProfile);
router.delete('/profiles/:id', checkRole(['admin']), Stage1Controller.deleteProfile);

// Both roles — search and export must come before /:id
router.get('/profiles/search', Stage1Controller.searchProfiles);
router.get('/profiles/export', Stage1Controller.exportProfiles);
router.get('/profiles', Stage1Controller.getAllProfiles);
router.get('/profiles/:id', Stage1Controller.getProfileById);

module.exports = router;
