const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3001);
const { startScheduler } = require('./jobs/scheduler');

// Required when running behind ngrok/reverse proxies so rate limiting and protocol detection are accurate.
app.set('trust proxy', 1);

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3002',
];

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_URLS || '').split(','),
    ...defaultAllowedOrigins,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 250,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Mental health backend is running',
    docs: '/health',
  });
});

app.use('/api/journal', require('./routes/journal'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/copilot', require('./routes/copilot'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/call', require('./routes/call'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const server = app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
  if (String(process.env.ENABLE_SCHEDULER || 'true').toLowerCase() === 'true') {
    startScheduler();
    console.log('Scheduler started');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing process or change PORT in .env.`);
    process.exit(1);
  }

  console.error('Failed to start backend server:', err);
  process.exit(1);
});
