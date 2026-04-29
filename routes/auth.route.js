const express = require('express');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');

const router = express.Router();

router.use(authLimiter);

// ─── WEB PORTAL OAUTH FLOW ───────────────────────────────────────────────────
router.get('/github', authController.initiateGitHubAuth);
router.get('/github/callback', authController.handleGitHubCallback);

// ─── CLI ENDPOINTS ────────────────────────────────────────────────────────────
router.get('/github/client-id', authController.getClientId);
router.post('/github/token', authController.cliTokenExchange);

// ─── SHARED ENDPOINTS ─────────────────────────────────────────────────────────
router.post('/refresh', authController.refreshTokens);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, authController.whoami);

module.exports = router;