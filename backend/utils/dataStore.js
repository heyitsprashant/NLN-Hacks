const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'app-data.json');

const emptyDb = {
  users: {},
  journal_entries: [],
  patterns: [],
  alerts: [],
  chat_messages: [],
  calls: [],
  voice_history: [],
};

let writeQueue = Promise.resolve();

function ensureDbFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(emptyDb, null, 2), 'utf8');
  }
}

function readDb() {
  ensureDbFile();
  const content = fs.readFileSync(dataFile, 'utf8');
  try {
    const parsed = JSON.parse(content || '{}');
    return {
      ...emptyDb,
      ...parsed,
      users: parsed.users || {},
      journal_entries: Array.isArray(parsed.journal_entries) ? parsed.journal_entries : [],
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      chat_messages: Array.isArray(parsed.chat_messages) ? parsed.chat_messages : [],
      calls: Array.isArray(parsed.calls) ? parsed.calls : [],
      voice_history: Array.isArray(parsed.voice_history) ? parsed.voice_history : [],
    };
  } catch {
    return { ...emptyDb };
  }
}

function writeDb(db) {
  ensureDbFile();
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2), 'utf8');
}

function updateDb(mutator) {
  writeQueue = writeQueue.then(() => {
    const db = readDb();
    mutator(db);
    writeDb(db);
  });
  return writeQueue;
}

function getUserId(req) {
  return (
    req.header('x-user-id')
    || req.query.user_id
    || req.body?.user_id
    || 'local-user'
  );
}

function ensureUser(db, userId) {
  if (!db.users[userId]) {
    db.users[userId] = {
      id: userId,
      email: `${userId}@app.local`,
      timezone: 'UTC',
      notifications: { email: true, push: false },
      trusted_contacts: [],
      settings: {
        alerts_enabled: true,
        alert_sensitivity: 'medium',
        burnoutRisk: true,
        anxietyPattern: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      },
      privacy: {
        dataCollectionEnabled: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return db.users[userId];
}

function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

module.exports = {
  readDb,
  updateDb,
  getUserId,
  ensureUser,
  newId,
};
