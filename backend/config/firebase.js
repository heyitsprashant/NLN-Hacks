const admin = require('firebase-admin');

let db = null;

function initFirebase() {
  if (db) {
    return db;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('Firebase env vars missing; backend will fail on DB operations until configured.');
    return null;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  db = admin.firestore();
  return db;
}

module.exports = {
  getDb: initFirebase,
  admin,
};
