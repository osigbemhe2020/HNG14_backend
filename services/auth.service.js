// HNG14 Backend/services/auth.service.js
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = 'http://localhost:3002/auth/github/callback';
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// ─── PKCE ─────────────────────────────────────────────────────────────────────

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const codeChallenge = crypto.createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// ─── GITHUB OAUTH ─────────────────────────────────────────────────────────────

function buildGitHubAuthUrl(state, codeChallenge) {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'read:user user:email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function exchangeCodeForToken(code, codeVerifier, redirectUri) {
  const response = await axios.post(
    'https://github.com/login/oauth/access_token',
    {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri || GITHUB_REDIRECT_URI,
      code_verifier: codeVerifier
    },
    { headers: { Accept: 'application/json' } }
  );

  if (!response.data.access_token) {
    throw new Error(response.data.error_description || 'No access token received from GitHub');
  }
  return response.data;
}

async function fetchGitHubUser(accessToken, tokenType = 'Bearer') {
  const response = await axios.get('https://api.github.com/user', {
    headers: { Authorization: `${tokenType} ${accessToken}`, Accept: 'application/json' }
  });
  return response.data;
}

async function fetchGitHubEmails(accessToken, tokenType = 'Bearer') {
  const response = await axios.get('https://api.github.com/user/emails', {
    headers: { Authorization: `${tokenType} ${accessToken}`, Accept: 'application/json' }
  });
  return response.data;
}

function getPrimaryEmail(emails) {
  return emails.find(e => e.primary && e.verified)?.email
    || emails.find(e => e.primary)?.email
    || emails[0]?.email
    || null;
}

// ─── USER UPSERT ──────────────────────────────────────────────────────────────

async function findOrCreateUser(githubUserData, primaryEmail) {
  const { id: github_id, login: username, avatar_url } = githubUserData;

  let user = await User.findOne({ github_id: String(github_id) });

  if (user) {
    // Update fields that may have changed on GitHub
    user.username = username;
    user.avatar_url = avatar_url;
    user.last_login_at = new Date();
    if (primaryEmail && !user.email) user.email = primaryEmail;
    await user.save();
  } else {
    user = await User.create({
      github_id: String(github_id),
      username,
      email: primaryEmail,
      avatar_url,
      last_login_at: new Date()
    });
  }

  return user;
}

// ─── JWT TOKENS ───────────────────────────────────────────────────────────────

function generateTokens(userId, role) {
  const accessToken = jwt.sign(
    { sub: userId, role, type: 'access' },
    JWT_ACCESS_SECRET,
    { expiresIn: '3m' }
  );

  const jti = crypto.randomBytes(16).toString('hex');
  const refreshToken = jwt.sign(
    { sub: userId, role, type: 'refresh', jti },
    JWT_REFRESH_SECRET,
    { expiresIn: '5m' }
  );

  return { accessToken, refreshToken, jti };
}

async function saveRefreshToken(userId, jti) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  await RefreshToken.create({ userId, jti, expiresAt });
}

async function rotateRefreshToken(oldJti, userId, role) {
  // Invalidate old token
  const old = await RefreshToken.findOneAndUpdate(
    { jti: oldJti, userId, used: false },
    { used: true }
  );

  if (!old) throw new Error('Invalid or already used refresh token');

  // Issue new pair
  const { accessToken, refreshToken, jti } = generateTokens(userId, role);
  await saveRefreshToken(userId, jti);

  return { accessToken, refreshToken };
}

async function revokeRefreshToken(jti) {
  await RefreshToken.findOneAndUpdate({ jti }, { used: true });
}

module.exports = {
  generatePKCE,
  generateState,
  buildGitHubAuthUrl,
  exchangeCodeForToken,
  fetchGitHubUser,
  fetchGitHubEmails,
  getPrimaryEmail,
  findOrCreateUser,
  generateTokens,
  saveRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken
};