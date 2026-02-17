/**
 * Destination Data Access Object (DAO)
 * SQLite 조회 로직 + 외부 API 연동 준비
 */

const Database = require('better-sqlite3');
const { DB_PATH } = require('./init');

let db = null;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
  }
  return db;
}

/**
 * 모든 목적지 조회
 */
function getAllDestinations() {
  const dbInstance = getDB();
  const rows = dbInstance.prepare('SELECT * FROM destinations ORDER BY rating DESC').all();
  return rows.map(parseDestination);
}

/**
 * ID로 목적지 조회
 */
function getDestinationById(id) {
  const dbInstance = getDB();
  const row = dbInstance.prepare('SELECT * FROM destinations WHERE id = ?').get(id);
  return row ? parseDestination(row) : null;
}

/**
 * 이름으로 목적지 조회 (정확한 매칭 또는 부분 매칭)
 */
function getDestinationByName(name) {
  const dbInstance = getDB();
  // 정확한 매칭 시도
  let row = dbInstance.prepare('SELECT * FROM destinations WHERE name = ?').get(name);
  if (row) return parseDestination(row);

  // 부분 매칭 시도 (이름에 포함되거나 ID에 포함)
  row = dbInstance.prepare('SELECT * FROM destinations WHERE name LIKE ? OR id LIKE ? ORDER BY rating DESC LIMIT 1').get(`%${name}%`, `%${name}%`);
  return row ? parseDestination(row) : null;
}

/**
 * 조건에 맞는 목적지 검색
 * @param {Object} criteria - { styles: [], budget: '', travelers: '', flightTime: '' }
 */
function findDestinations(criteria) {
  const dbInstance = getDB();
  let query = 'SELECT * FROM destinations WHERE 1=1';
  const params = [];

  // 예산 필터
  if (criteria.budget) {
    query += ` AND budget_range LIKE ?`;
    params.push(`%"${criteria.budget}"%`);
  }

  // 비행시간 필터
  if (criteria.flightTime) {
    query += ` AND flight_time = ?`;
    params.push(criteria.flightTime);
  }

  // 여행자 타입 필터
  if (criteria.travelers) {
    query += ` AND best_for LIKE ?`;
    params.push(`%"${criteria.travelers}"%`);
  }

  // 스타일 필터 (여러 개 매칭)
  if (criteria.styles && criteria.styles.length > 0) {
    const styleConditions = criteria.styles.map(() => 'styles LIKE ?').join(' OR ');
    query += ` AND (${styleConditions})`;
    criteria.styles.forEach(style => params.push(`%"${style}"%`));
  }

  query += ' ORDER BY rating DESC LIMIT 20';

  const rows = dbInstance.prepare(query).all(...params);
  return rows.map(parseDestination);
}

/**
 * 국가별 목적지 조회
 */
function getDestinationsByCountry(country) {
  const dbInstance = getDB();
  const rows = dbInstance.prepare('SELECT * FROM destinations WHERE country = ? ORDER BY rating DESC').all(country);
  return rows.map(parseDestination);
}

/**
 * 평점 높은 목적지 Top N
 */
function getTopRatedDestinations(limit = 10) {
  const dbInstance = getDB();
  const rows = dbInstance.prepare('SELECT * FROM destinations ORDER BY rating DESC LIMIT ?').all(limit);
  return rows.map(parseDestination);
}

/**
 * 가격대별 목적지 조회
 */
function getDestinationsByBudget(minCost, maxCost) {
  const dbInstance = getDB();
  const rows = dbInstance.prepare(
    'SELECT * FROM destinations WHERE avg_cost BETWEEN ? AND ? ORDER BY avg_cost ASC'
  ).all(minCost, maxCost);
  return rows.map(parseDestination);
}

/**
 * 검색어로 목적지 찾기 (이름, 국가, 설명)
 */
function searchDestinations(keyword) {
  const dbInstance = getDB();
  const pattern = `%${keyword}%`;
  const rows = dbInstance.prepare(`
    SELECT * FROM destinations
    WHERE name LIKE ? OR country LIKE ? OR description LIKE ?
    ORDER BY rating DESC
    LIMIT 20
  `).all(pattern, pattern, pattern);
  return rows.map(parseDestination);
}

/**
 * DB 행 데이터를 JavaScript 객체로 변환
 */
function parseDestination(row) {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    flag: row.flag,
    styles: JSON.parse(row.styles),
    budgetRange: JSON.parse(row.budget_range),
    bestFor: JSON.parse(row.best_for),
    flightTime: row.flight_time,
    avgCost: row.avg_cost,
    rating: row.rating,
    bestSeason: row.best_season,
    pros: JSON.parse(row.pros),
    cons: JSON.parse(row.cons),
    description: row.description,
    highlights: JSON.parse(row.highlights),
    sampleItinerary: JSON.parse(row.sample_itinerary)
  };
}

module.exports = {
  getAllDestinations,
  getDestinationById,
  getDestinationByName,
  findDestinations,
  getDestinationsByCountry,
  getTopRatedDestinations,
  getDestinationsByBudget,
  searchDestinations
};
