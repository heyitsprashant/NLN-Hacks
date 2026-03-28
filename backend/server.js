const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3001);
const { startScheduler } = require('./jobs/scheduler');

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(helmet());
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
app.use('/api/voice', require('./routes/voice'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
  if (String(process.env.ENABLE_SCHEDULER || 'true').toLowerCase() === 'true') {
    startScheduler();
    console.log('Scheduler started');
  }
});
