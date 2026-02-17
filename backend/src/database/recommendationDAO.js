/**
 * Budget Recommendation Data Access Object
 * AI 추천 캐싱 로직
 */

const { v4: uuidv4 } = require('uuid');

/**
 * 추천 저장 (캐싱)
 */
function saveRecommendation(db, recommendationData) {
  const {
    projectId,
    category,
    recommendations,
    cacheKey,
    aiProvider = 'gemini',
    ttlHours = 24
  } = recommendationData;

  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  const stmt = db.prepare(`
    INSERT INTO budget_recommendations (
      id, project_id, category, recommendations,
      cache_key, ai_provider, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    projectId,
    category,
    JSON.stringify(recommendations),
    cacheKey,
    aiProvider,
    now.toISOString(),
    expiresAt.toISOString()
  );

  return getRecommendation(db, id);
}

/**
 * 추천 조회 (단일)
 */
function getRecommendation(db, recommendationId) {
  const stmt = db.prepare('SELECT * FROM budget_recommendations WHERE id = ?');
  const row = stmt.get(recommendationId);

  if (row && row.recommendations) {
    row.recommendations = JSON.parse(row.recommendations);
  }

  return row;
}

/**
 * 캐시 조회 (캐시 키로)
 */
function getRecommendationByCache(db, cacheKey) {
  const stmt = db.prepare(`
    SELECT * FROM budget_recommendations
    WHERE cache_key = ?
    AND datetime(expires_at) > datetime('now')
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const row = stmt.get(cacheKey);

  if (row && row.recommendations) {
    row.recommendations = JSON.parse(row.recommendations);
  }

  return row;
}

/**
 * 프로젝트별 추천 목록 조회
 */
function getRecommendationsByProject(db, projectId, category = null) {
  let query = `
    SELECT * FROM budget_recommendations
    WHERE project_id = ?
    AND datetime(expires_at) > datetime('now')
  `;
  const params = [projectId];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);

  return rows.map(row => {
    if (row.recommendations) {
      row.recommendations = JSON.parse(row.recommendations);
    }
    return row;
  });
}

/**
 * 만료된 캐시 삭제
 */
function deleteExpiredRecommendations(db) {
  const stmt = db.prepare(`
    DELETE FROM budget_recommendations
    WHERE datetime(expires_at) <= datetime('now')
  `);

  const result = stmt.run();
  return result.changes;
}

/**
 * 추천 삭제
 */
function deleteRecommendation(db, recommendationId) {
  const stmt = db.prepare('DELETE FROM budget_recommendations WHERE id = ?');
  const result = stmt.run(recommendationId);
  return result.changes > 0;
}

/**
 * 캐시 키 생성
 */
function generateCacheKey(projectId, category, params = {}) {
  const paramsStr = JSON.stringify(params);
  return `${projectId}_${category}_${Buffer.from(paramsStr).toString('base64').substring(0, 20)}`;
}

module.exports = {
  saveRecommendation,
  getRecommendation,
  getRecommendationByCache,
  getRecommendationsByProject,
  deleteExpiredRecommendations,
  deleteRecommendation,
  generateCacheKey
};
