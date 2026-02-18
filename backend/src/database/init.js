/**
 * Database Initialization - PostgreSQL
 * DATABASE_URL 환경변수로 연결, 없으면 SQLite 폴백
 */

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn('⚠️ DATABASE_URL 환경변수가 설정되지 않았습니다 (로컬 모드: DB 기능 비활성화)');
      // DB 없이도 서버가 동작하도록 더미 pool 반환
      pool = { query: async () => ({ rows: [] }), end: async () => {} };
      return pool;
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000
    });
  }
  return pool;
}

async function initDatabase() {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS destinations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      flag TEXT,
      styles TEXT,
      budget_range TEXT,
      best_for TEXT,
      flight_time TEXT,
      avg_cost INTEGER,
      rating REAL,
      best_season TEXT,
      pros TEXT,
      cons TEXT,
      description TEXT,
      highlights TEXT,
      sample_itinerary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      travel_type TEXT,
      destination_id TEXT,
      destination_data TEXT,
      dates TEXT,
      travelers INTEGER,
      budget TEXT,
      milestones TEXT,
      tasks TEXT,
      itinerary TEXT,
      consulting_context TEXT,
      recommendations TEXT,
      departure TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budget_transactions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'KRW',
      original_amount REAL,
      exchange_rate REAL,
      transaction_date TEXT NOT NULL,
      memo TEXT,
      booking_status TEXT DEFAULT 'pending',
      booking_ref TEXT,
      booking_url TEXT,
      receipt_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receipt_files (
      id TEXT PRIMARY KEY,
      transaction_id TEXT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      filesize INTEGER NOT NULL,
      mimetype TEXT NOT NULL,
      ocr_amount REAL,
      ocr_date TEXT,
      ocr_raw_text TEXT,
      ocr_status TEXT DEFAULT 'pending',
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budget_recommendations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      recommendations TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      ai_provider TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP
    );
  `);

  // 인덱스 (이미 존재하면 무시)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_country ON destinations(country)',
    'CREATE INDEX IF NOT EXISTS idx_rating ON destinations(rating)',
    'CREATE INDEX IF NOT EXISTS idx_avg_cost ON destinations(avg_cost)',
    'CREATE INDEX IF NOT EXISTS idx_project_created ON projects(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_project_destination ON projects(destination_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_project ON budget_transactions(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_category ON budget_transactions(category)',
    'CREATE INDEX IF NOT EXISTS idx_receipts_project ON receipt_files(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_recommendations_project ON budget_recommendations(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_recommendations_cache ON budget_recommendations(cache_key)'
  ];

  for (const idx of indexes) {
    await p.query(idx);
  }

  console.log('✅ PostgreSQL schema initialized');
  return p;
}

module.exports = { initDatabase, getPool };
