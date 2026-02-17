/**
 * Database Initialization
 * SQLite 데이터베이스 스키마 생성
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/destinations.db');

// data 디렉토리 자동 생성
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function initDatabase() {
  const db = new Database(DB_PATH);

  // 스키마 생성
  db.exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_country ON destinations(country);
    CREATE INDEX IF NOT EXISTS idx_rating ON destinations(rating);
    CREATE INDEX IF NOT EXISTS idx_avg_cost ON destinations(avg_cost);
    CREATE INDEX IF NOT EXISTS idx_flight_time ON destinations(flight_time);
    CREATE INDEX IF NOT EXISTS idx_project_created ON projects(created_at);
    CREATE INDEX IF NOT EXISTS idx_project_destination ON projects(destination_id);

    -- 거래 내역 테이블
    CREATE TABLE IF NOT EXISTS budget_transactions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- 영수증 파일 테이블
    CREATE TABLE IF NOT EXISTS receipt_files (
      id TEXT PRIMARY KEY,
      transaction_id TEXT,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      filesize INTEGER NOT NULL,
      mimetype TEXT NOT NULL,
      ocr_amount REAL,
      ocr_date TEXT,
      ocr_raw_text TEXT,
      ocr_status TEXT DEFAULT 'pending',
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- AI 추천 캐시 테이블
    CREATE TABLE IF NOT EXISTS budget_recommendations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      category TEXT NOT NULL,
      recommendations TEXT NOT NULL,
      cache_key TEXT NOT NULL,
      ai_provider TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_project ON budget_transactions(project_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON budget_transactions(category);
    CREATE INDEX IF NOT EXISTS idx_receipts_transaction ON receipt_files(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_project ON receipt_files(project_id);
    CREATE INDEX IF NOT EXISTS idx_recommendations_cache ON budget_recommendations(cache_key);
    CREATE INDEX IF NOT EXISTS idx_recommendations_project ON budget_recommendations(project_id);
  `);

  console.log('✅ Database schema initialized (3 new tables: budget_transactions, receipt_files, budget_recommendations)');
  return db;
}

module.exports = { initDatabase, DB_PATH };
