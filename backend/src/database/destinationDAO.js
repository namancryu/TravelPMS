/**
 * Destination Data Access Object - PostgreSQL
 */

const { getPool } = require('./init');

async function getAllDestinations() {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM destinations ORDER BY rating DESC');
  return rows.map(parseDestination);
}

async function getDestinationById(id) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM destinations WHERE id = $1', [id]);
  return rows.length > 0 ? parseDestination(rows[0]) : null;
}

async function getDestinationByName(name) {
  const pool = getPool();
  // 정확한 매칭
  let { rows } = await pool.query('SELECT * FROM destinations WHERE name = $1', [name]);
  if (rows.length > 0) return parseDestination(rows[0]);

  // 부분 매칭
  ({ rows } = await pool.query(
    'SELECT * FROM destinations WHERE name LIKE $1 OR id LIKE $1 ORDER BY rating DESC LIMIT 1',
    [`%${name}%`]
  ));
  return rows.length > 0 ? parseDestination(rows[0]) : null;
}

async function findDestinations(criteria) {
  const pool = getPool();
  let query = 'SELECT * FROM destinations WHERE 1=1';
  const params = [];
  let paramIdx = 1;

  if (criteria.budget) {
    query += ` AND budget_range LIKE $${paramIdx++}`;
    params.push(`%"${criteria.budget}"%`);
  }
  if (criteria.flightTime) {
    query += ` AND flight_time = $${paramIdx++}`;
    params.push(criteria.flightTime);
  }
  if (criteria.travelers) {
    query += ` AND best_for LIKE $${paramIdx++}`;
    params.push(`%"${criteria.travelers}"%`);
  }
  if (criteria.styles && criteria.styles.length > 0) {
    const conditions = criteria.styles.map(() => `styles LIKE $${paramIdx++}`).join(' OR ');
    query += ` AND (${conditions})`;
    criteria.styles.forEach(style => params.push(`%"${style}"%`));
  }

  query += ' ORDER BY rating DESC LIMIT 20';
  const { rows } = await pool.query(query, params);
  return rows.map(parseDestination);
}

async function getDestinationsByCountry(country) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM destinations WHERE country = $1 ORDER BY rating DESC', [country]);
  return rows.map(parseDestination);
}

async function getTopRatedDestinations(limit = 10) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM destinations ORDER BY rating DESC LIMIT $1', [limit]);
  return rows.map(parseDestination);
}

async function getDestinationsByBudget(minCost, maxCost) {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM destinations WHERE avg_cost BETWEEN $1 AND $2 ORDER BY avg_cost ASC',
    [minCost, maxCost]
  );
  return rows.map(parseDestination);
}

async function searchDestinations(keyword) {
  const pool = getPool();
  const pattern = `%${keyword}%`;
  const { rows } = await pool.query(
    'SELECT * FROM destinations WHERE name LIKE $1 OR country LIKE $1 OR description LIKE $1 ORDER BY rating DESC LIMIT 20',
    [pattern]
  );
  return rows.map(parseDestination);
}

function parseDestination(row) {
  const safeJSON = (val) => { try { return val ? JSON.parse(val) : null; } catch { return val; } };
  return {
    id: row.id, name: row.name, country: row.country, flag: row.flag,
    styles: safeJSON(row.styles), budgetRange: safeJSON(row.budget_range),
    bestFor: safeJSON(row.best_for), flightTime: row.flight_time,
    avgCost: row.avg_cost, rating: row.rating, bestSeason: row.best_season,
    pros: safeJSON(row.pros), cons: safeJSON(row.cons),
    description: row.description, highlights: safeJSON(row.highlights),
    sampleItinerary: safeJSON(row.sample_itinerary)
  };
}

module.exports = {
  getAllDestinations, getDestinationById, getDestinationByName,
  findDestinations, getDestinationsByCountry, getTopRatedDestinations,
  getDestinationsByBudget, searchDestinations
};
