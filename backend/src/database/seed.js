/**
 * Database Seed Script - PostgreSQL
 * 105개 여행지 데이터 삽입
 */

const { getPool } = require('./init');
const destinationsData = require('./seedData');

async function seedDatabase() {
  const pool = getPool();

  // 기존 데이터 확인
  const { rows } = await pool.query('SELECT COUNT(*) as count FROM destinations');
  const count = parseInt(rows[0].count);

  if (count > 0) {
    console.log(`⚠️ Database already has ${count} destinations. Skipping seed.`);
    return;
  }

  // 데이터 삽입
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const dest of destinationsData) {
      await client.query(`
        INSERT INTO destinations (
          id, name, country, flag, styles, budget_range, best_for,
          flight_time, avg_cost, rating, best_season, pros, cons,
          description, highlights, sample_itinerary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO NOTHING
      `, [
        dest.id, dest.name, dest.country, dest.flag,
        dest.styles, dest.budgetRange, dest.bestFor,
        dest.flightTime, dest.avgCost, dest.rating, dest.bestSeason,
        dest.pros, dest.cons, dest.description, dest.highlights, dest.sampleItinerary
      ]);
    }

    await client.query('COMMIT');
    console.log(`✅ Successfully seeded ${destinationsData.length} destinations`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { seedDatabase };
