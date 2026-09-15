const { createClient } = require('@libsql/client');
const path = require('path');

// ─── Turso (libSQL) client ─────────────────────────────────────────────────
// Local dev (no TURSO_DATABASE_URL set): falls back to a local SQLite file,
// so `npm run dev` still works without a Turso account.
// Production (Vercel): set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN as env vars,
// because Vercel Functions have no persistent disk — a local file DB would
// reset/be inconsistent between requests.
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, 'quiz.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ─── better-sqlite3-compatible wrapper ──────────────────────────────────────
// The rest of the codebase was written against better-sqlite3's synchronous
// db.prepare(sql).get/all/run(...args) API. libSQL's client is async, so this
// wrapper keeps the same call shape (db.prepare(sql).get(...)) but returns
// Promises — call sites use `await`.
function rowToObject(row, columns) {
  const obj = {};
  columns.forEach((col, i) => {
    obj[col] = row[i];
  });
  return obj;
}

function prepare(sql) {
  return {
    async get(...args) {
      const res = await client.execute({ sql, args });
      return res.rows.length ? rowToObject(res.rows[0], res.columns) : undefined;
    },
    async all(...args) {
      const res = await client.execute({ sql, args });
      return res.rows.map((row) => rowToObject(row, res.columns));
    },
    async run(...args) {
      const res = await client.execute({ sql, args });
      return {
        lastInsertRowid:
          res.lastInsertRowid !== undefined && res.lastInsertRowid !== null
            ? Number(res.lastInsertRowid)
            : undefined,
        changes: res.rowsAffected,
      };
    },
  };
}

// Run several INSERT/UPDATE/DELETE statements as one atomic transaction.
// statements: Array<{ sql: string, args: any[] }>
async function batch(statements) {
  if (!statements.length) return;
  await client.batch(
    statements.map((s) => ({ sql: s.sql, args: s.args || [] })),
    'write'
  );
}

// ─── Schema ─────────────────────────────────────────────────────────────────
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    material_filename TEXT,
    material_text TEXT,
    num_questions INTEGER DEFAULT 30,
    timer_minutes INTEGER,
    difficulty TEXT DEFAULT 'sedang',
    question_types TEXT DEFAULT '["pilihan_ganda","benar_salah","essay"]',
    is_published INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    options TEXT,
    correct_answer TEXT,
    explanation TEXT,
    order_num INTEGER DEFAULT 0,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    answers TEXT NOT NULL,
    score REAL DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    time_taken INTEGER,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`;

// Runs once per cold start (and once locally on startup). Idempotent thanks
// to "IF NOT EXISTS", so it's safe to await this at the top of every request
// too (see server.js) without re-creating anything on warm invocations.
let readyPromise = null;
function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await client.execute('PRAGMA foreign_keys = ON;');
      await client.executeMultiple(SCHEMA);
      console.log('Database ready (', process.env.TURSO_DATABASE_URL ? 'Turso' : 'local file', ')');
    })();
  }
  return readyPromise;
}

module.exports = { prepare, batch, ready, raw: client };
