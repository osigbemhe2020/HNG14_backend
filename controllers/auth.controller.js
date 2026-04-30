const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || 'http://localhost:3000';
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── COOKIE HELPER ────────────────────────────────────────────────────────────

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'none' : 'lax',
  ...(maxAge && { maxAge }),
  path: '/'
});

// ─── ONE-TIME TOKEN STORE ─────────────────────────────────────────────────────
// Short-lived in-memory store for cross-origin portal token handoff
// Each token expires after 60 seconds and is deleted after first use

const oneTimeTokenStore = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of oneTimeTokenStore.entries()) {
    if (value.expires < now) oneTimeTokenStore.delete(key);
  }
}, 60 * 1000);

// ─── GET GITHUB CLIENT ID ─────────────────────────────────────────────────────

exports.getClientId = (req, res) => {
  return res.status(200).json({
    client_id: process.env.GITHUB_CLI_CLIENT_ID
  });
};

// ─── INITIATE GITHUB OAUTH (Web portal) ──────────────────────────────────────

exports.initiateGitHubAuth = (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = authService.generatePKCE();
    const state = authService.generateState();

    res.cookie('oauth_state', state, cookieOptions(10 * 60 * 1000));
    res.cookie('oauth_code_verifier', codeVerifier, cookieOptions(10 * 60 * 1000));

    const redirectUrl = authService.buildGitHubAuthUrl(state, codeChallenge);
    return res.redirect(redirectUrl);

  } catch (error) {
    console.error('initiateGitHubAuth error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication initialization failed'
    });
  }
};

// ─── HANDLE GITHUB CALLBACK (Web portal) ─────────────────────────────────────

exports.handleGitHubCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: error_description || 'GitHub OAuth failed'
    });
  }

  const savedState = req.cookies?.oauth_state;
  const codeVerifier = req.cookies?.oauth_code_verifier;

  if (!state || !savedState || state !== savedState) {
    return res.status(403).json({
      status: 'error',
      message: 'Invalid state parameter — possible CSRF attack'
    });
  }

  if (!codeVerifier) {
    return res.status(403).json({
      status: 'error',
      message: 'Missing code verifier — please restart the login flow'
    });
  }

  res.clearCookie('oauth_state', cookieOptions());
  res.clearCookie('oauth_code_verifier', cookieOptions());

  try {
    const { access_token, token_type } = await authService.exchangeCodeForToken(
      code,
      codeVerifier,
      process.env.GITHUB_REDIRECT_URI
    );

    const [githubUser, emails] = await Promise.all([
      authService.fetchGitHubUser(access_token, token_type),
      authService.fetchGitHubEmails(access_token, token_type)
    ]);

    const primaryEmail = authService.getPrimaryEmail(emails);
    const user = await authService.findOrCreateUser(githubUser, primaryEmail);

    if (!user.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Your account has been deactivated.'
      });
    }

    const { accessToken, refreshToken, jti } = authService.generateTokens(user.id, user.role);
    await authService.saveRefreshToken(user.id, jti);

    // Generate one-time token for cross-origin portal handoff
    const oneTimeToken = crypto.randomBytes(32).toString('hex');
    oneTimeTokenStore.set(oneTimeToken, {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires: Date.now() + 60 * 1000 // 60 seconds to use it
    });

    // Redirect portal to /auth/callback?token=xxx
    return res.redirect(`${WEB_PORTAL_URL}/auth/callback?token=${oneTimeToken}`);

  } catch (error) {
    console.error('handleGitHubCallback error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to complete authentication'
    });
  }
};

// ─── EXCHANGE ONE-TIME TOKEN ──────────────────────────────────────────────────
// GET /auth/exchange?token=xxx
// Called server-side by Next.js /auth/callback route

exports.exchangeOneTimeToken = (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ status: 'error', message: 'Token required' });
  }

  const stored = oneTimeTokenStore.get(token);

  if (!stored || stored.expires < Date.now()) {
    oneTimeTokenStore.delete(token);
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token — please log in again'
    });
  }

  // Delete immediately — one-time use only
  oneTimeTokenStore.delete(token);

  return res.status(200).json({
    status: 'success',
    data: {
      access_token: stored.access_token,
      refresh_token: stored.refresh_token
    }
  });
};

// ─── CLI TOKEN EXCHANGE ───────────────────────────────────────────────────────

exports.cliTokenExchange = async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body;

  if (!code || !code_verifier || !redirect_uri) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: code, code_verifier, redirect_uri'
    });
  }

  try {
    const { access_token, token_type } = await authService.exchangeCodeForToken(
      code,
      code_verifier,
      redirect_uri
    );

    const [githubUser, emails] = await Promise.all([
      authService.fetchGitHubUser(access_token, token_type),
      authService.fetchGitHubEmails(access_token, token_type)
    ]);

    const primaryEmail = authService.getPrimaryEmail(emails);
    const user = await authService.findOrCreateUser(githubUser, primaryEmail);

    if (!user.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Your account has been deactivated.'
      });
    }

    const { accessToken, refreshToken, jti } = authService.generateTokens(user.id, user.role);
    await authService.saveRefreshToken(user.id, jti);

    return res.status(200).json({
      status: 'success',
      message: 'Authentication successful',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar_url: user.avatar_url
        }
      }
    });

  } catch (error) {
    console.error('cliTokenExchange error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to complete authentication'
    });
  }
};

// ─── REFRESH TOKENS ───────────────────────────────────────────────────────────

exports.refreshTokens = async (req, res) => {
  const incomingRefreshToken =
    req.body?.refresh_token || req.cookies?.refresh_token;

  if (!incomingRefreshToken) {
    return res.status(401).json({ status: 'error', message: 'Refresh token required' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        status: 'error',
        message: err.name === 'TokenExpiredError'
          ? 'Refresh token has expired — please log in again'
          : 'Invalid refresh token'
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ status: 'error', message: 'Invalid token type' });
    }

    const { accessToken, refreshToken } = await authService.rotateRefreshToken(
      decoded.jti,
      decoded.sub,
      decoded.role
    );

    if (req.body?.refresh_token) {
      return res.status(200).json({
        status: 'success',
        data: { access_token: accessToken, refresh_token: refreshToken }
      });
    }

    res.cookie('access_token', accessToken, cookieOptions(3 * 60 * 1000));
    res.cookie('refresh_token', refreshToken, cookieOptions(5 * 60 * 1000));

    return res.status(200).json({
      status: 'success',
      message: 'Tokens refreshed successfully'
    });

  } catch (error) {
    console.error('refreshTokens error:', error.message);
    if (error.message === 'Invalid or already used refresh token') {
      return res.status(401).json({
        status: 'error',
        message: 'Refresh token already used — please log in again'
      });
    }
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

exports.logout = async (req, res) => {
  const incomingRefreshToken =
    req.body?.refresh_token || req.cookies?.refresh_token;

  if (incomingRefreshToken) {
    try {
      const decoded = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
      await authService.revokeRefreshToken(decoded.jti);
    } catch (_) {}
  }

  res.clearCookie('access_token', cookieOptions());
  res.clearCookie('refresh_token', cookieOptions());

  return res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
};

// ─── WHOAMI ───────────────────────────────────────────────────────────────────

exports.whoami = (req, res) => {
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
};
// ─── SET COOKIES FOR CROSS-ORIGIN ─────────────────────────────────────────────
// POST /auth/set-cookies
// Called by Vercel route.js to set cookies on the backend domain

exports.setCookies = (req, res) => {
  const { access_token, refresh_token } = req.body;

  if (!access_token || !refresh_token) {
    return res.status(400).json({ status: 'error', message: 'Tokens required' });
  }

  res.cookie('access_token', access_token, cookieOptions(3 * 60 * 1000));
  res.cookie('refresh_token', refresh_token, cookieOptions(5 * 60 * 1000));

  return res.status(200).json({ status: 'success', message: 'Cookies set' });
};
