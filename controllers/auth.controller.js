const authService = require('../services/auth.service');
const jwt = require('jsonwebtoken');

const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || 'http://localhost:3000';

// ─── GET GITHUB CLIENT ID (CLI needs this to build OAuth URL itself) ──────────
// GET /auth/github/client-id

exports.getClientId = (req, res) => {
  return res.status(200).json({
    client_id: process.env.GITHUB_CLI_CLIENT_ID
  });
};

// ─── INITIATE GITHUB OAUTH (Web portal only) ──────────────────────────────────
// GET /auth/github
// CLI does NOT use this — CLI builds the GitHub URL itself

exports.initiateGitHubAuth = (req, res) => {
  try {
    const { codeVerifier, codeChallenge } = authService.generatePKCE();
    const state = authService.generateState();

    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/'
    });

    res.cookie('oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/'
    });

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

// ─── HANDLE GITHUB CALLBACK (Web portal only) ─────────────────────────────────
// GET /auth/github/callback
// CLI does NOT use this — CLI captures its own callback on localhost

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

  res.clearCookie('oauth_state');
  res.clearCookie('oauth_code_verifier');

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
        message: 'Your account has been deactivated. Contact an administrator.'
      });
    }

    const { accessToken, refreshToken, jti } = authService.generateTokens(user.id, user.role);
    await authService.saveRefreshToken(user.id, jti);

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3 * 60 * 1000
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 5 * 60 * 1000
    });

    return res.redirect(`${WEB_PORTAL_URL}/dashboard`);

  } catch (error) {
    console.error('handleGitHubCallback error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to complete authentication'
    });
  }
};

// ─── CLI TOKEN EXCHANGE ───────────────────────────────────────────────────────
// POST /auth/github/token
// CLI calls this after capturing the GitHub callback on localhost
// Body: { code, code_verifier, redirect_uri }

exports.cliTokenExchange = async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body;

  console.log('cliTokenExchange received:', { code: code?.slice(0,10), code_verifier: code_verifier?.slice(0,10), redirect_uri });

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
    return res.status(401).json({
      status: 'error',
      message: 'Refresh token required'
    });
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

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3 * 60 * 1000
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 5 * 60 * 1000
    });

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

  res.clearCookie('access_token');
  res.clearCookie('refresh_token');

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