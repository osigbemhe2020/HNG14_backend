const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom morgan token for response time in ms
morgan.token('response-ms', (req, res) => {
  const time = res.getHeader('X-Response-Time');
  return time ? `${time}ms` : '-';
});

// Custom morgan token for user id (if authenticated)
morgan.token('user-id', (req) => {
  return req.user ? req.user.uuid : 'guest';
});

// Dev format — colourful, readable in terminal
const devFormat =
  ':method :url :status :response-time ms — user::user-id — :remote-addr';

// Production format — JSON, one line per request, easy to parse
const prodFormat = (tokens, req, res) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    method: tokens.method(req, res),
    endpoint: tokens.url(req, res),
    status: parseInt(tokens.status(req, res)),
    responseTime: `${tokens['response-time'](req, res)}ms`,
    userId: req.user ? req.user.uuid : 'guest',
    ip: tokens['remote-addr'](req, res),
    userAgent: tokens['user-agent'](req, res),
    contentLength: tokens.res(req, res, 'content-length') || 0
  });
};

const setupMorgan = () => {
  if (process.env.NODE_ENV === 'production') {
    const accessLogStream = fs.createWriteStream(
      path.join(logsDir, 'access.log'),
      { flags: 'a' }
    );
    return morgan(prodFormat, { stream: accessLogStream });
  }
  return morgan(devFormat);
};

module.exports = { setupMorgan };