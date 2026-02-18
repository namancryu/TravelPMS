/**
 * Receipt Data Access Object - PostgreSQL
 */

const { v4: uuidv4 } = require('uuid');

async function createReceipt(pool, receiptData) {
  const { transactionId = null, projectId, filename, filepath, filesize, mimetype } = receiptData;
  const id = uuidv4();
  const now = new Date().toISOString();

  await pool.query(`
    INSERT INTO receipt_files (id, transaction_id, project_id, filename, filepath, filesize, mimetype, ocr_status, uploaded_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  `, [id, transactionId, projectId, filename, filepath, filesize, mimetype, 'pending', now]);

  return getReceipt(pool, id);
}

async function getReceipt(pool, receiptId) {
  const { rows } = await pool.query('SELECT * FROM receipt_files WHERE id = $1', [receiptId]);
  return rows[0] || null;
}

async function getReceipts(pool, projectId) {
  const { rows } = await pool.query('SELECT * FROM receipt_files WHERE project_id = $1 ORDER BY uploaded_at DESC', [projectId]);
  return rows;
}

async function updateOcrResult(pool, receiptId, ocrData) {
  const { amount, date, rawText, status = 'completed' } = ocrData;
  await pool.query('UPDATE receipt_files SET ocr_amount=$1, ocr_date=$2, ocr_raw_text=$3, ocr_status=$4 WHERE id=$5',
    [amount, date, rawText, status, receiptId]);
  return getReceipt(pool, receiptId);
}

async function linkToTransaction(pool, receiptId, transactionId) {
  await pool.query('UPDATE receipt_files SET transaction_id=$1 WHERE id=$2', [transactionId, receiptId]);
  return getReceipt(pool, receiptId);
}

async function deleteReceipt(pool, receiptId) {
  const result = await pool.query('DELETE FROM receipt_files WHERE id = $1', [receiptId]);
  return result.rowCount > 0;
}

module.exports = { createReceipt, getReceipt, getReceipts, updateOcrResult, linkToTransaction, deleteReceipt };
