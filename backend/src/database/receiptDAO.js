/**
 * Receipt Data Access Object
 * 영수증 파일 CRUD 로직
 */

const { v4: uuidv4 } = require('uuid');

/**
 * 영수증 추가
 */
function createReceipt(db, receiptData) {
  const {
    transactionId = null,
    projectId,
    filename,
    filepath,
    filesize,
    mimetype
  } = receiptData;

  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO receipt_files (
      id, transaction_id, project_id, filename, filepath,
      filesize, mimetype, ocr_status, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, transactionId, projectId, filename, filepath,
    filesize, mimetype, 'pending', now
  );

  return getReceipt(db, id);
}

/**
 * 영수증 조회 (단일)
 */
function getReceipt(db, receiptId) {
  const stmt = db.prepare('SELECT * FROM receipt_files WHERE id = ?');
  return stmt.get(receiptId);
}

/**
 * 영수증 목록 조회 (프로젝트별)
 */
function getReceipts(db, projectId) {
  const stmt = db.prepare(`
    SELECT * FROM receipt_files
    WHERE project_id = ?
    ORDER BY uploaded_at DESC
  `);
  return stmt.all(projectId);
}

/**
 * 영수증 OCR 결과 업데이트
 */
function updateOcrResult(db, receiptId, ocrData) {
  const { amount, date, rawText, status = 'completed' } = ocrData;
  const stmt = db.prepare(`
    UPDATE receipt_files
    SET ocr_amount = ?, ocr_date = ?, ocr_raw_text = ?, ocr_status = ?
    WHERE id = ?
  `);

  stmt.run(amount, date, rawText, status, receiptId);
  return getReceipt(db, receiptId);
}

/**
 * 영수증 거래 연결
 */
function linkToTransaction(db, receiptId, transactionId) {
  const stmt = db.prepare(`
    UPDATE receipt_files
    SET transaction_id = ?
    WHERE id = ?
  `);

  stmt.run(transactionId, receiptId);
  return getReceipt(db, receiptId);
}

/**
 * 영수증 삭제
 */
function deleteReceipt(db, receiptId) {
  const stmt = db.prepare('DELETE FROM receipt_files WHERE id = ?');
  const result = stmt.run(receiptId);
  return result.changes > 0;
}

module.exports = {
  createReceipt,
  getReceipt,
  getReceipts,
  updateOcrResult,
  linkToTransaction,
  deleteReceipt
};
