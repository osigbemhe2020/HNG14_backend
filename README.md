# Insighta Labs+ — Backend API

The backend for the Insighta Labs+ Profile Intelligence System. Built with Node.js and Express, deployed on Northflank. Powers both the CLI tool and the web portal.

---

## Live URL

```
https://site--hng14-backend--nlrjqkv9zhwn.code.run
```

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Authentication Flow](#authentication-flow)
- [Token Handling](#token-handling)
- [Role Enforcement](#role-enforcement)
- [API Versioning](#api-versioning)
- [CLI Usage](#cli-usage)
- [Natural Language Parsing](#natural-language-parsing)
- [API Reference](#api-reference)
- [Running Locally](#running-locally)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Insighta Labs+                           │
├───────────────────┬─────────────────────┬───────────────────────┤
│   CLI Tool        │   Web Portal        │   Backend API         │
│   (Local)         │   (Vercel)          │   (Northflank)        │
│                   │                     │                       │
│  insighta login   │  Next.js App Router │  Express.js           │
│  insighta profiles│  HTTP-only cookies  │  MongoDB Atlas        │
│  insighta export  │  Server-side auth   │  JWT tokens           │
│                   │                     │  Rate limiting        │
│  ~/.insighta/     │  /auth/callback     │  RBAC middleware      │
│  credentials.json │  (token exchange)   │  NL query parser      │
└───────────────────┴─────────────────────┴───────────────────────┘
```

**Data flow:**
- CLI → talks directly to backend via Bearer token in Authorization header
- Web portal → talks to backend via HTTP-only cookies set server-side
- Both → same backend, same database, same JWT validation

---

## Authentication Flow

### Web Portal Flow

```
1. User clicks "Continue with GitHub" on portal
2. Portal redirects to GET /auth/github on backend
3. Backend generates PKCE (code_verifier + code_challenge) and state
4. Backend stores state + code_verifier in short-lived HTTP-only cookies
5. Backend redirects browser to GitHub OAuth authorization page
6. User approves on GitHub
7. GitHub redirects to GET /auth/github/callback on backend
8. Backend validates state cookie to prevent CSRF
9. Backend exchanges code + code_verifier with GitHub for access token
10. Backend fetches GitHub user profile and emails
11. Backend upserts user in MongoDB (creates if new, updates if existing)
12. Backend generates JWT access token (3 min) + refresh token (5 min)
13. Backend stores refresh token JTI in MongoDB
14. Backend generates a one-time token (60 second expiry) stored in memory
15. Backend redirects portal to /auth/callback?token=<one-time-token>
16. Next.js route.js (server-side) calls GET /auth/exchange?token=xxx
17. Backend returns real JWT tokens, deletes one-time token immediately
18. Next.js sets HTTP-only cookies on the portal domain
19. User lands on /dashboard — authenticated
```

### CLI Flow

```
1. User runs: insighta login
2. CLI generates PKCE (code_verifier + code_challenge) and state locally
3. CLI starts local HTTP server on random port (e.g. 9876)
4. CLI fetches GitHub Client ID from GET /auth/github/client-id
5. CLI builds GitHub OAuth URL directly with localhost:9876/callback as redirect_uri
6. CLI opens browser to GitHub OAuth authorization page
7. User approves on GitHub
8. GitHub redirects to http://localhost:9876/callback
9. CLI local server captures the code and state
10. CLI validates state matches what it generated
11. CLI sends code + code_verifier + redirect_uri to POST /auth/github/token
12. Backend exchanges code + code_verifier with GitHub
13. Backend upserts user, generates JWT tokens, stores refresh token
14. Backend returns tokens + user info as JSON
15. CLI saves to ~/.insighta/credentials.json with permissions 600
```

---

## Token Handling

### Token Types

| Token | Expiry | Purpose | Storage |
|---|---|---|---|
| Access token | 3 minutes | Authenticate API requests | CLI: credentials.json / Web: HTTP-only cookie |
| Refresh token | 5 minutes | Obtain new token pair | CLI: credentials.json / Web: HTTP-only cookie |

### Token Structure (JWT payload)

```json
// Access token
{
  "sub": "019dd96f-6865-7687-916b-a74a109feb21",
  "role": "analyst",
  "type": "access",
  "iat": 1234567890,
  "exp": 1234568070
}

// Refresh token
{
  "sub": "019dd96f-6865-7687-916b-a74a109feb21",
  "role": "analyst",
  "type": "refresh",
  "jti": "a1b2c3d4e5f6...",
  "iat": 1234567890,
  "exp": 1234568190
}
```

### Two separate secrets

Access tokens are signed with `JWT_ACCESS_SECRET` and refresh tokens with `JWT_REFRESH_SECRET`. This means a stolen refresh token cannot be used as an access token — the server rejects it with a signature error.

### Refresh token rotation

Every time a refresh token is used, it is immediately invalidated in MongoDB and a new token pair is issued. If an already-used refresh token is presented, the server returns 401. This prevents replay attacks.

### Token revocation

Refresh tokens are stored in MongoDB with a `used` boolean and `expiresAt` date. MongoDB TTL index automatically deletes expired tokens — no manual cleanup needed.

---

## Role Enforcement

Two roles exist: `admin` and `analyst`. All new users are assigned `analyst` by default. Role is embedded in the JWT payload and re-validated on every request.

### Endpoint permissions

| Endpoint | Method | Required Role |
|---|---|---|
| `/api/profiles` | POST | admin |
| `/api/profiles/:id` | DELETE | admin |
| `/api/profiles` | GET | analyst, admin |
| `/api/profiles/:id` | GET | analyst, admin |
| `/api/profiles/search` | GET | analyst, admin |
| `/api/profiles/export` | GET | analyst, admin |

### How it works

```
Request → verifyToken middleware → checkRole middleware → controller

verifyToken:
  1. Extract Bearer token from Authorization header
  2. Verify JWT signature with JWT_ACCESS_SECRET
  3. Check user exists in DB and is_active = true
  4. Attach user to req.user

checkRole(['admin']):
  1. Read req.user.role
  2. If role not in allowed list → 403 Insufficient permissions
  3. Otherwise → next()
```

### Promoting a user to admin

There is no API endpoint for role promotion — it must be done directly in MongoDB to prevent privilege escalation:

```js
db.users.updateOne(
  { username: "target-username" },
  { $set: { role: "admin" } }
)
```

---

## API Versioning

All `/api/*` routes require the `X-API-Version` header. Missing or unsupported versions return 400.

```bash
# Correct
curl -H "X-API-Version: 1" https://your-backend.com/api/profiles

# Missing header → 400
curl https://your-backend.com/api/profiles
```

Supported versions: `1`

---

## CLI Usage

Install and use the Insighta CLI:

```bash
# Install globally
git clone https://github.com/your-username/insighta-cli.git
cd insighta-cli && npm install && npm link

# Set backend URL
export INSIGHTA_API_URL=https://site--hng14-backend--nlrjqkv9zhwn.code.run
```

### Auth commands

```bash
insighta login       # GitHub OAuth login — opens browser
insighta whoami      # Show current user info
insighta logout      # Logout and clear credentials
```

### Profile commands

```bash
# List profiles
insighta profiles list
insighta profiles list --gender male --country NG --page 2 --limit 20
insighta profiles list --age-group adult --sort-by age --order asc

# Get single profile
insighta profiles get <id>

# Natural language search
insighta profiles search "young males from nigeria"
insighta profiles search "adult women from kenya above 30"

# Create profile (admin only)
insighta profiles create "John"

# Delete profile (admin only)
insighta profiles delete <id>

# Export to CSV
insighta profiles export
insighta profiles export --gender female --output women.csv
insighta profiles export --country NG --output nigeria.csv
```

### Auto token refresh

The CLI automatically refreshes expired access tokens before every API call. If the refresh token is also expired, the user is prompted to run `insighta login` again.

---

## Natural Language Parsing

`GET /api/profiles/search?q=<query>`

The search endpoint accepts plain English queries and converts them to MongoDB filters using a rule-based parser (`NlqueryParser.js`). No AI or LLMs are used.

### Parsing pipeline

```
Raw query → normalize → [gender] → [age group] → [young] → [above/below] → [country] → MongoDB query
```

### Supported filters

**Gender**

| Query terms | Filter |
|---|---|
| male, man, men, boy, boys, gentleman | `gender: "male"` |
| female, woman, women, girl, girls, lady | `gender: "female"` |

**Age group**

| Query terms | Filter |
|---|---|
| child, children, kid, kids | `age_group: "child"` |
| teenager, teen, adolescent | `age_group: "teenager"` |
| adult, adults | `age_group: "adult"` |
| senior, elderly, elder, old, aged | `age_group: "senior"` |

**Age modifiers**

| Pattern | Filter |
|---|---|
| `above N`, `over N`, `older than N` | `age: { $gte: N }` |
| `below N`, `under N`, `younger than N` | `age: { $lte: N }` |
| `young`, `youth` | `age: { $gte: 16, $lte: 24 }` |

**Country** — ~150 country names mapped to ISO 3166-1 alpha-2 codes. Longest-match-first to avoid partial collisions.

### Query examples

| Query | Filters applied |
|---|---|
| `young males from nigeria` | gender=male, min_age=16, max_age=24, country_id=NG |
| `adult women from kenya` | gender=female, age_group=adult, country_id=KE |
| `females above 30` | gender=female, min_age=30 |
| `senior males` | gender=male, age_group=senior |
| `people from ghana` | country_id=GH |
| `young males above 20 from nigeria` | gender=male, min_age=20, max_age=24, country_id=NG |

### Limitations

- No negation (`not from nigeria` is not supported)
- No OR logic (`males from kenya OR females from ghana`)
- No city, region, or continent names — country names only
- No demonyms (`Nigerian males` will not match — use `males from nigeria`)
- No fuzzy matching — typos are not corrected
- `between X and Y` age range syntax not supported

---

## API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| GET | `/auth/github` | Initiate GitHub OAuth (web portal) |
| GET | `/auth/github/callback` | GitHub OAuth callback (web portal) |
| GET | `/auth/github/client-id` | Get CLI OAuth client ID |
| POST | `/auth/github/token` | CLI token exchange |
| GET | `/auth/exchange` | One-time token exchange (portal) |
| POST | `/auth/refresh` | Rotate token pair |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/auth/me` | Get current user |

### Profiles (all require `X-API-Version: 1` and Bearer token)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | `/api/profiles` | admin | Create profile |
| GET | `/api/profiles` | any | List with filters + pagination |
| GET | `/api/profiles/search` | any | Natural language search |
| GET | `/api/profiles/export` | any | Export as CSV |
| GET | `/api/profiles/:id` | any | Get single profile |
| DELETE | `/api/profiles/:id` | admin | Delete profile |

### Pagination response shape

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2027,
  "total_pages": 203,
  "links": {
    "self": "/api/profiles?page=1&limit=10",
    "next": "/api/profiles?page=2&limit=10",
    "prev": null,
    "first": "/api/profiles?page=1&limit=10",
    "last": "/api/profiles?page=203&limit=10"
  },
  "data": [...]
}
```

---

## Running Locally

```bash
git clone https://github.com/your-username/HNG14_backend.git
cd HNG14_backend
npm install
cp .env.example .env
# Fill in .env values
npm run dev
```

Server starts on `http://localhost:3002`

---

## Environment Variables

```env
# Server
PORT=3002
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://...

# JWT
JWT_ACCESS_SECRET=<64-byte-hex-string>
JWT_REFRESH_SECRET=<64-byte-hex-string>

# GitHub OAuth — Backend App (web portal)
GITHUB_CLIENT_ID=<backend-oauth-app-client-id>
GITHUB_CLIENT_SECRET=<backend-oauth-app-client-secret>
GITHUB_REDIRECT_URI=http://localhost:3002/auth/github/callback

# GitHub OAuth — CLI App
GITHUB_CLI_CLIENT_ID=<cli-oauth-app-client-id>

# URLs
BASE_URL=http://localhost:3002
WEB_PORTAL_URL=http://localhost:3000
```

---

## Project Structure

```
├── controllers/
│   ├── auth.controller.js      # OAuth, token exchange, refresh, logout, whoami
│   └── stage1.controller.js    # Profile CRUD, search, export
├── middlewares/
│   ├── auth.middleware.js       # JWT verification + user attachment
│   ├── role.middleware.js       # RBAC — admin/analyst enforcement
│   ├── apiVersion.middleware.js # X-API-Version header validation
│   ├── rateLimit.middleware.js  # 10/min auth, 60/min API
│   ├── logger.middleware.js     # Morgan request logging
│   └── csrf.middleware.js       # CSRF token validation
├── models/
│   ├── user.model.js            # User schema (id, github_id, role, is_active)
│   ├── profiles.model.js        # Profile schema with all enrichment fields
│   └── refreshToken.model.js    # Refresh token store with TTL index
├── routes/
│   ├── auth.route.js            # All auth endpoints
│   └── stage1.route.js          # All profile endpoints
├── services/
│   ├── auth.service.js          # PKCE, GitHub API, JWT generation, token DB ops
│   ├── profile.service.js       # External API calls (Genderize, Agify, Nationalize)
│   ├── profiles.service.js      # DB queries, filtering, pagination, CSV export
│   └── NlqueryParser.js         # Natural language → MongoDB filter parser
├── config/
│   └── db.js                    # MongoDB connection
├── app.js                       # Express app setup, middleware chain
├── server.js                    # Server entry point
└── stage0.js                    # Stage 0 classify endpoint
```
