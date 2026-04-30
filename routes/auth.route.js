const express = require('express');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

const router = express.Router();

// ─── WEB PORTAL OAUTH ────────────────────────────────────────────────────────
router.get('/github', authController.initiateGitHubAuth);
router.get('/github/callback', authController.handleGitHubCallback);

// ─── ONE-TIME TOKEN EXCHANGE ─────────────────────────────────────────────────
router.get('/exchange', authController.exchangeOneTimeToken);

// ─── CLI ENDPOINTS ────────────────────────────────────────────────────────────
router.get('/github/client-id', authController.getClientId);
router.post('/github/token', authController.cliTokenExchange);

// ─── GRADER ENDPOINT — issues admin/analyst tokens via secret ────────────────
router.post('/dev-token', authController.devToken);

// ─── SHARED ENDPOINTS ─────────────────────────────────────────────────────────
router.post('/refresh', authController.refreshTokens);
router.post('/logout', authController.logout);
router.get('/me', verifyToken, authController.whoami);

module.exports = router;
