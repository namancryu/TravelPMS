/**
 * Transaction Data Access Object - PostgreSQL
 */

const { v4: uuidv4 } = require('uuid');
const { getPool } = require('./init');

async function createTransaction(pool, transactionData) {
  const {
    projectId, category, amount, currency = 'KRW',
    originalAmount, exchangeRate, transactionDate,
    memo, bookingStatus = 'pending', bookingRef, bookingUrl, receiptId
  } = transactionData;

  const id = uuidv4();
  const now = new Date().toISOString();

  await pool.query(`
    INSERT INTO budget_transactions (
      id, project_id, category, amount, currency,
      original_amount, exchange_rate, transaction_date,
      memo, booking_status, booking_ref, booking_url,
      receipt_id, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
  `, [id, projectId, category, amount, currency,
      originalAmount, exchangeRate, transactionDate,
      memo, bookingStatus, bookingRef, bookingUrl, receiptId, now, now]);

  return getTransaction(pool, id);
}

async function getTransaction(pool, transactionId) {
  const { rows } = await pool.query('SELECT * FROM budget_transactions WHERE id = $1', [transactionId]);
  return rows[0] || null;
}

async function getTransactions(pool, projectId, category = null) {
  let query = 'SELECT * FROM budget_transactions WHERE project_id = $1';
  const params = [projectId];

  if (category) {
    query += ' AND category = $2';
    params.push(category);
  }
  query += ' ORDER BY transaction_date DESC, created_at DESC';

  const { rows } = await pool.query(query, params);
  return rows;
}

async function updateTransaction(pool, transactionId, updates) {
  const allowedFields = [
    'category', 'amount', 'currency', 'original_amount', 'exchange_rate',
    'transaction_date', 'memo', 'booking_status', 'booking_ref', 'booking_url', 'receipt_id'
  ];

  const fields = [];
  const values = [];
  let paramIdx = 1;

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = $${paramIdx++}`);
      values.push(updates[key]);
    }
  });

  if (fields.length === 0) throw new Error('No valid fields to update');

  fields.push(`updated_at = $${paramIdx++}`);
  values.push(new Date().toISOString());
  values.push(transactionId);

  await pool.query(`UPDATE budget_transactions SET ${fields.join(', ')} WHERE id = $${paramIdx}`, values);
  return getTransaction(pool, transactionId);
}

async function deleteTransaction(pool, transactionId) {
  const result = await pool.query('DELETE FROM budget_transactions WHERE id = $1', [transactionId]);
  return result.rowCount > 0;
}

async function getProjectSpending(pool, projectId) {
  const { rows } = await pool.query(`
    SELECT category, SUM(amount) as total_spent, COUNT(*) as transaction_count, currency
    FROM budget_transactions WHERE project_id = $1
    GROUP BY category, currency
  `, [projectId]);
  return rows;
}

async function getTransactionSummary(pool, projectId, category = null) {
  let query = 'SELECT COUNT(*) as count, SUM(amount) as total_spent, currency FROM budget_transactions WHERE project_id = $1';
  const params = [projectId];

  if (category) {
    query += ' AND category = $2';
    params.push(category);
  }
  query += ' GROUP BY currency';

  const { rows } = await pool.query(query, params);

  const byCurrency = {};
  let totalCount = 0, totalSpentKRW = 0;

  rows.forEach(row => {
    byCurrency[row.currency] = parseFloat(row.total_spent);
    totalCount += parseInt(row.count);
    if (row.currency === 'KRW') totalSpentKRW += parseFloat(row.total_spent);
  });

  return { totalSpent: totalSpentKRW, count: totalCount, byCurrency };
}

module.exports = {
  createTransaction, getTransaction, getTransactions,
  updateTransaction, deleteTransaction, getProjectSpending, getTransactionSummary
};
