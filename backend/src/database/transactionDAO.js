/**
 * Transaction Data Access Object
 * 거래 내역 CRUD 로직
 */

const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/destinations.db');

/**
 * 거래 추가
 */
function createTransaction(db, transactionData) {
  const {
    projectId,
    category,
    amount,
    currency = 'KRW',
    originalAmount,
    exchangeRate,
    transactionDate,
    memo,
    bookingStatus = 'pending',
    bookingRef,
    bookingUrl,
    receiptId
  } = transactionData;

  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO budget_transactions (
      id, project_id, category, amount, currency,
      original_amount, exchange_rate, transaction_date,
      memo, booking_status, booking_ref, booking_url,
      receipt_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, projectId, category, amount, currency,
    originalAmount, exchangeRate, transactionDate,
    memo, bookingStatus, bookingRef, bookingUrl,
    receiptId, now, now
  );

  return getTransaction(db, id);
}

/**
 * 거래 조회 (단일)
 */
function getTransaction(db, transactionId) {
  const stmt = db.prepare('SELECT * FROM budget_transactions WHERE id = ?');
  return stmt.get(transactionId);
}

/**
 * 거래 목록 조회 (프로젝트별, 카테고리 필터링 가능)
 */
function getTransactions(db, projectId, category = null) {
  let query = 'SELECT * FROM budget_transactions WHERE project_id = ?';
  const params = [projectId];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY transaction_date DESC, created_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

/**
 * 거래 수정
 */
function updateTransaction(db, transactionId, updates) {
  const allowedFields = [
    'category', 'amount', 'currency', 'original_amount', 'exchange_rate',
    'transaction_date', 'memo', 'booking_status', 'booking_ref', 'booking_url', 'receipt_id'
  ];

  const updateFields = [];
  const updateValues = [];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = ?`);
      updateValues.push(updates[key]);
    }
  });

  if (updateFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  updateFields.push('updated_at = ?');
  updateValues.push(new Date().toISOString());
  updateValues.push(transactionId);

  const query = `UPDATE budget_transactions SET ${updateFields.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  stmt.run(...updateValues);

  return getTransaction(db, transactionId);
}

/**
 * 거래 삭제
 */
function deleteTransaction(db, transactionId) {
  const stmt = db.prepare('DELETE FROM budget_transactions WHERE id = ?');
  const result = stmt.run(transactionId);
  return result.changes > 0;
}

/**
 * 프로젝트의 총 지출 계산 (카테고리별)
 */
function getProjectSpending(db, projectId) {
  const stmt = db.prepare(`
    SELECT
      category,
      SUM(amount) as total_spent,
      COUNT(*) as transaction_count,
      currency
    FROM budget_transactions
    WHERE project_id = ?
    GROUP BY category, currency
  `);

  return stmt.all(projectId);
}

/**
 * 거래 요약 (프로젝트별)
 */
function getTransactionSummary(db, projectId, category = null) {
  let query = `
    SELECT
      COUNT(*) as count,
      SUM(amount) as total_spent,
      currency
    FROM budget_transactions
    WHERE project_id = ?
  `;
  const params = [projectId];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' GROUP BY currency';

  const stmt = db.prepare(query);
  const results = stmt.all(...params);

  // 통화별 지출을 객체로 변환
  const byCurrency = {};
  let totalCount = 0;
  let totalSpentKRW = 0;

  results.forEach(row => {
    byCurrency[row.currency] = row.total_spent;
    totalCount += row.count;

    // KRW 기준 총액 계산 (환율 적용된 금액이므로 amount 사용)
    if (row.currency === 'KRW') {
      totalSpentKRW += row.total_spent;
    }
  });

  return {
    totalSpent: totalSpentKRW,
    count: totalCount,
    byCurrency
  };
}

module.exports = {
  createTransaction,
  getTransaction,
  getTransactions,
  updateTransaction,
  deleteTransaction,
  getProjectSpending,
  getTransactionSummary
};
