const express = require("express");
const cors = require('cors');
const stage0 = require('./stage0');
const stage1Routes = require('./routes/stage1.route');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api', stage0);
app.use('/api', stage1Routes);

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    statusCode: 500,
    message: 'Internal server error',
    data: null,
  });
});

module.exports = app;