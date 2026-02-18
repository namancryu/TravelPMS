/**
 * Budget Recommendation Data Access Object - PostgreSQL
 */

const { v4: uuidv4 } = require('uuid');

async function saveRecommendation(pool, recommendationData) {
  const { projectId, category, recommendations, cacheKey, aiProvider = 'gemini', ttlHours = 24 } = recommendationData;
  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  await pool.query(`
    INSERT INTO budget_recommendations (id, project_id, category, recommendations, cache_key, ai_provider, created_at, expires_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  `, [id, projectId, category, JSON.stringify(recommendations), cacheKey, aiProvider, now.toISOString(), expiresAt.toISOString()]);

  return getRecommendation(pool, id);
}

async function getRecommendation(pool, recommendationId) {
  const { rows } = await pool.query('SELECT * FROM budget_recommendations WHERE id = $1', [recommendationId]);
  if (rows[0] && rows[0].recommendations) rows[0].recommendations = JSON.parse(rows[0].recommendations);
  return rows[0] || null;
}

async function getRecommendationByCache(pool, cacheKey) {
  const { rows } = await pool.query(
    'SELECT * FROM budget_recommendations WHERE cache_key = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
    [cacheKey]
  );
  if (rows[0] && rows[0].recommendations) rows[0].recommendations = JSON.parse(rows[0].recommendations);
  return rows[0] || null;
}

async function getRecommendationsByProject(pool, projectId, category = null) {
  let query = 'SELECT * FROM budget_recommendations WHERE project_id = $1 AND expires_at > NOW()';
  const params = [projectId];
  if (category) { query += ' AND category = $2'; params.push(category); }
  query += ' ORDER BY created_at DESC';

  const { rows } = await pool.query(query, params);
  return rows.map(r => { if (r.recommendations) r.recommendations = JSON.parse(r.recommendations); return r; });
}

async function deleteExpiredRecommendations(pool) {
  const result = await pool.query('DELETE FROM budget_recommendations WHERE expires_at <= NOW()');
  return result.rowCount;
}

async function deleteRecommendation(pool, recommendationId) {
  const result = await pool.query('DELETE FROM budget_recommendations WHERE id = $1', [recommendationId]);
  return result.rowCount > 0;
}

function generateCacheKey(projectId, category, params = {}) {
  const paramsStr = JSON.stringify(params);
  return `${projectId}_${category}_${Buffer.from(paramsStr).toString('base64').substring(0, 20)}`;
}

module.exports = {
  saveRecommendation, getRecommendation, getRecommendationByCache,
  getRecommendationsByProject, deleteExpiredRecommendations, deleteRecommendation, generateCacheKey
};
