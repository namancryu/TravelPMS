/**
 * Database Seed Script
 * 105개 여행지 데이터 삽입
 */

const { initDatabase } = require('./init');
const destinationsData = require('./seedData');

function seedDatabase() {
  const db = initDatabase();

  // 기존 데이터 확인
  const count = db.prepare('SELECT COUNT(*) as count FROM destinations').get();

  if (count.count > 0) {
    console.log(`⚠️ Database already has ${count.count} destinations. Skipping seed.`);
    console.log('   To re-seed, delete backend/data/destinations.db and restart server.');
    return db;
  }

  // 데이터 삽입
  const insert = db.prepare(`
    INSERT INTO destinations (
      id, name, country, flag, styles, budget_range, best_for,
      flight_time, avg_cost, rating, best_season, pros, cons,
      description, highlights, sample_itinerary
    ) VALUES (
      @id, @name, @country, @flag, @styles, @budgetRange, @bestFor,
      @flightTime, @avgCost, @rating, @bestSeason, @pros, @cons,
      @description, @highlights, @sampleItinerary
    )
  `);

  const insertMany = db.transaction((destinations) => {
    for (const dest of destinations) {
      insert.run(dest);
    }
  });

  try {
    insertMany(destinationsData);
    console.log(`✅ Successfully seeded ${destinationsData.length} destinations`);
  } catch (err) {
    console.error('❌ Seed error:', err);
    throw err;
  }

  return db;
}

// CLI로 직접 실행 시
if (require.main === module) {
  seedDatabase();
  console.log('✅ Seed completed!');
  process.exit(0);
}

module.exports = { seedDatabase };
