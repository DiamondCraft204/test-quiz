const { Pool } = require('pg');

let pool = null;

const getPool = () => {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('⚠️ DATABASE_URL belum dikonfigurasi di environment variables.');
    return null;
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });

  return pool;
};

/**
 * Execute a query with parameters
 * @param {string} text 
 * @param {Array} params 
 * @returns {Promise<{ rows: Array, rowCount: number }>}
 */
const query = async (text, params) => {
  const p = getPool();
  if (!p) {
    throw new Error('DATABASE_URL belum dikonfigurasi. Tambahkan connection string Supabase di file .env atau Environment Variables Vercel.');
  }
  return p.query(text, params);
};

/**
 * Get a client from the pool (useful for transactions)
 */
const getClient = async () => {
  const p = getPool();
  if (!p) {
    throw new Error('DATABASE_URL belum dikonfigurasi.');
  }
  return p.connect();
};

/**
 * Initialize table schema in Supabase PostgreSQL
 */
const initDB = async () => {
  const p = getPool();
  if (!p) return;

  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      material_filename TEXT,
      material_text TEXT,
      num_questions INT DEFAULT 30,
      timer_minutes INT,
      difficulty TEXT DEFAULT 'sedang',
      question_types TEXT DEFAULT '["pilihan_ganda","benar_salah","essay"]',
      is_published INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT,
      explanation TEXT,
      order_num INT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answers TEXT NOT NULL,
      score REAL DEFAULT 0,
      total_questions INT DEFAULT 0,
      correct_count INT DEFAULT 0,
      time_taken INT,
      cheat_violations INT DEFAULT 0,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE submissions ADD COLUMN IF NOT EXISTS cheat_violations INT DEFAULT 0;
  `;

  try {
    await p.query(schemaSql);
    console.log('✅ Supabase PostgreSQL schema initialized successfully.');
  } catch (err) {
    console.error('❌ Gagal inisialisasi skema database Supabase:', err.message);
  }
};

// Initialize schema on load
initDB();

module.exports = {
  query,
  getClient,
  getPool,
  initDB,
};
