/**
 * Price Crawler Service (대안 A: 기준 가격 DB)
 * 목적지별 기준 가격 데이터베이스 및 검증 로직
 */

// ─── 기준 가격 DB (2024년 2월 기준) ─────────────────────────────────────────
const PRICE_DB = {
  // 국내 주요 도시
  '부산': {
    country: '한국',
    accommodation: {
      '게스트하우스': { min: 30000, max: 60000, avg: 45000 },
      '모텔': { min: 40000, max: 80000, avg: 60000 },
      '3성급': { min: 60000, max: 120000, avg: 80000 },
      '4성급': { min: 120000, max: 250000, avg: 150000 },
      '5성급': { min: 250000, max: 500000, avg: 350000 }
    },
    food: {
      '간단한 식사': { min: 8000, max: 15000, avg: 10000 },
      '일반 식사': { min: 12000, max: 25000, avg: 15000 },
      '고급 식당': { min: 30000, max: 80000, avg: 50000 },
      '카페': { min: 5000, max: 15000, avg: 8000 }
    },
    transportation: {
      'KTX': { min: 50000, max: 60000, avg: 55000 },
      '항공': { min: 40000, max: 150000, avg: 80000 },
      '버스': { min: 20000, max: 35000, avg: 28000 },
      '렌터카': { min: 50000, max: 150000, avg: 80000 }
    },
    activities: {
      '입장료': { min: 5000, max: 30000, avg: 15000 },
      '체험': { min: 20000, max: 80000, avg: 40000 },
      '투어': { min: 30000, max: 100000, avg: 50000 }
    }
  },
  '제주': {
    country: '한국',
    accommodation: {
      '게스트하우스': { min: 40000, max: 80000, avg: 55000 },
      '펜션': { min: 80000, max: 200000, avg: 120000 },
      '3성급': { min: 80000, max: 150000, avg: 100000 },
      '4성급': { min: 150000, max: 300000, avg: 180000 },
      '5성급': { min: 300000, max: 600000, avg: 400000 }
    },
    food: {
      '간단한 식사': { min: 10000, max: 18000, avg: 12000 },
      '일반 식사': { min: 15000, max: 30000, avg: 20000 },
      '해산물': { min: 25000, max: 60000, avg: 40000 },
      '흑돼지': { min: 20000, max: 40000, avg: 28000 }
    },
    transportation: {
      '항공': { min: 50000, max: 200000, avg: 100000 },
      '렌터카': { min: 40000, max: 120000, avg: 70000 },
      '버스': { min: 1000, max: 5000, avg: 2000 },
      '택시': { min: 10000, max: 50000, avg: 25000 }
    },
    activities: {
      '입장료': { min: 5000, max: 50000, avg: 20000 },
      '체험': { min: 30000, max: 100000, avg: 50000 },
      '투어': { min: 50000, max: 150000, avg: 80000 }
    }
  },
  '서울': {
    country: '한국',
    accommodation: {
      '게스트하우스': { min: 25000, max: 50000, avg: 35000 },
      '호스텔': { min: 30000, max: 60000, avg: 40000 },
      '3성급': { min: 70000, max: 150000, avg: 100000 },
      '4성급': { min: 150000, max: 300000, avg: 200000 },
      '5성급': { min: 300000, max: 800000, avg: 450000 }
    },
    food: {
      '간단한 식사': { min: 8000, max: 15000, avg: 10000 },
      '일반 식사': { min: 12000, max: 25000, avg: 15000 },
      '고급 식당': { min: 40000, max: 150000, avg: 80000 }
    },
    transportation: {
      '지하철': { min: 1400, max: 3000, avg: 2000 },
      '버스': { min: 1400, max: 2500, avg: 1800 },
      '택시': { min: 5000, max: 30000, avg: 15000 }
    },
    activities: {
      '입장료': { min: 3000, max: 30000, avg: 12000 },
      '체험': { min: 20000, max: 100000, avg: 50000 }
    }
  },
  '강릉': {
    country: '한국',
    accommodation: {
      '펜션': { min: 80000, max: 200000, avg: 120000 },
      '3성급': { min: 70000, max: 130000, avg: 90000 },
      '4성급': { min: 130000, max: 250000, avg: 160000 }
    },
    food: {
      '일반 식사': { min: 12000, max: 25000, avg: 15000 },
      '해산물': { min: 20000, max: 50000, avg: 30000 },
      '커피': { min: 5000, max: 10000, avg: 7000 }
    },
    transportation: {
      'KTX': { min: 25000, max: 35000, avg: 28000 },
      '버스': { min: 15000, max: 25000, avg: 18000 },
      '렌터카': { min: 50000, max: 120000, avg: 70000 }
    },
    activities: {
      '입장료': { min: 3000, max: 20000, avg: 10000 },
      '체험': { min: 20000, max: 60000, avg: 35000 }
    }
  },
  '경주': {
    country: '한국',
    accommodation: {
      '한옥': { min: 80000, max: 200000, avg: 120000 },
      '3성급': { min: 60000, max: 120000, avg: 80000 },
      '4성급': { min: 120000, max: 220000, avg: 150000 }
    },
    food: {
      '일반 식사': { min: 10000, max: 20000, avg: 12000 },
      '한정식': { min: 20000, max: 50000, avg: 30000 }
    },
    transportation: {
      'KTX': { min: 20000, max: 30000, avg: 25000 },
      '버스': { min: 1500, max: 5000, avg: 2500 },
      '자전거': { min: 5000, max: 15000, avg: 10000 }
    },
    activities: {
      '입장료': { min: 3000, max: 15000, avg: 8000 },
      '체험': { min: 15000, max: 50000, avg: 25000 }
    }
  },

  // 해외 주요 도시
  '도쿄': {
    country: '일본',
    accommodation: {
      '호스텔': { min: 40000, max: 80000, avg: 55000 },
      '비즈니스호텔': { min: 80000, max: 150000, avg: 100000 },
      '3성급': { min: 100000, max: 200000, avg: 140000 },
      '4성급': { min: 200000, max: 400000, avg: 280000 },
      '5성급': { min: 400000, max: 1000000, avg: 600000 }
    },
    food: {
      '라멘': { min: 10000, max: 20000, avg: 12000 },
      '일반 식사': { min: 15000, max: 30000, avg: 20000 },
      '스시': { min: 30000, max: 100000, avg: 50000 },
      '편의점': { min: 5000, max: 10000, avg: 7000 }
    },
    transportation: {
      '항공': { min: 200000, max: 600000, avg: 350000 },
      '지하철': { min: 2000, max: 8000, avg: 4000 },
      'JR패스': { min: 200000, max: 400000, avg: 280000 }
    },
    activities: {
      '입장료': { min: 10000, max: 50000, avg: 25000 },
      '체험': { min: 30000, max: 150000, avg: 70000 }
    }
  },
  '오사카': {
    country: '일본',
    accommodation: {
      '호스텔': { min: 35000, max: 70000, avg: 50000 },
      '비즈니스호텔': { min: 70000, max: 130000, avg: 90000 },
      '3성급': { min: 90000, max: 180000, avg: 120000 },
      '4성급': { min: 180000, max: 350000, avg: 240000 }
    },
    food: {
      '오코노미야키': { min: 10000, max: 20000, avg: 15000 },
      '일반 식사': { min: 12000, max: 25000, avg: 18000 },
      '고급 식당': { min: 40000, max: 100000, avg: 60000 }
    },
    transportation: {
      '항공': { min: 180000, max: 500000, avg: 300000 },
      '지하철': { min: 2000, max: 6000, avg: 3500 }
    },
    activities: {
      '입장료': { min: 15000, max: 60000, avg: 30000 },
      '체험': { min: 30000, max: 120000, avg: 60000 }
    }
  },
  '방콕': {
    country: '태국',
    accommodation: {
      '호스텔': { min: 15000, max: 40000, avg: 25000 },
      '3성급': { min: 50000, max: 100000, avg: 70000 },
      '4성급': { min: 100000, max: 200000, avg: 140000 },
      '5성급': { min: 150000, max: 400000, avg: 250000 }
    },
    food: {
      '길거리음식': { min: 3000, max: 8000, avg: 5000 },
      '일반 식사': { min: 8000, max: 20000, avg: 12000 },
      '고급 식당': { min: 30000, max: 80000, avg: 50000 }
    },
    transportation: {
      '항공': { min: 300000, max: 700000, avg: 450000 },
      'BTS/MRT': { min: 1000, max: 4000, avg: 2000 },
      '택시': { min: 3000, max: 15000, avg: 8000 }
    },
    activities: {
      '입장료': { min: 5000, max: 30000, avg: 15000 },
      '마사지': { min: 15000, max: 50000, avg: 25000 }
    }
  },
  '다낭': {
    country: '베트남',
    accommodation: {
      '호스텔': { min: 15000, max: 35000, avg: 22000 },
      '3성급': { min: 40000, max: 80000, avg: 55000 },
      '4성급': { min: 80000, max: 150000, avg: 100000 },
      '리조트': { min: 150000, max: 400000, avg: 220000 }
    },
    food: {
      '쌀국수': { min: 5000, max: 12000, avg: 8000 },
      '일반 식사': { min: 8000, max: 20000, avg: 12000 },
      '해산물': { min: 20000, max: 50000, avg: 30000 }
    },
    transportation: {
      '항공': { min: 250000, max: 600000, avg: 400000 },
      '그랩': { min: 3000, max: 15000, avg: 7000 }
    },
    activities: {
      '입장료': { min: 5000, max: 25000, avg: 12000 },
      '투어': { min: 30000, max: 100000, avg: 50000 }
    }
  }
};

// ─── 가격 조회 함수 ─────────────────────────────────────────────────────────

/**
 * 목적지별 가격 범위 조회
 * @param {string} destination - 목적지 이름
 * @param {string} category - accommodation, food, transportation, activities
 * @param {string} subCategory - 세부 카테고리 (선택)
 * @returns {object|null} { min, max, avg } 또는 null
 */
function getPriceRange(destination, category, subCategory = null) {
  const destData = PRICE_DB[destination];
  if (!destData) {
    console.warn(`⚠️ 가격 DB에 ${destination} 정보 없음`);
    return null;
  }

  const catData = destData[category];
  if (!catData) {
    console.warn(`⚠️ ${destination}의 ${category} 카테고리 없음`);
    return null;
  }

  if (subCategory && catData[subCategory]) {
    return catData[subCategory];
  }

  // 서브카테고리가 없으면 전체 범위 계산
  const allRanges = Object.values(catData);
  return {
    min: Math.min(...allRanges.map(r => r.min)),
    max: Math.max(...allRanges.map(r => r.max)),
    avg: Math.round(allRanges.reduce((sum, r) => sum + r.avg, 0) / allRanges.length)
  };
}

/**
 * AI 가격을 DB 기준으로 검증
 * @param {number} aiPrice - AI가 생성한 가격
 * @param {string} destination - 목적지
 * @param {string} category - 카테고리
 * @param {string} subCategory - 세부 카테고리 (선택)
 * @returns {object} { valid, price, reason, range }
 */
function validatePriceWithDB(aiPrice, destination, category, subCategory = null) {
  const range = getPriceRange(destination, category, subCategory);

  if (!range) {
    return {
      valid: false,
      price: aiPrice,
      reason: 'no_data',
      message: `${destination}/${category} 가격 데이터 없음`
    };
  }

  // 범위 내에 있는지 확인
  if (aiPrice >= range.min && aiPrice <= range.max) {
    return {
      valid: true,
      price: aiPrice,
      range,
      message: '정상 범위'
    };
  }

  // 범위 밖이면 평균가로 대체
  console.warn(`⚠️ AI 가격 ${aiPrice}원이 ${destination}/${category} 범위(${range.min}~${range.max}) 밖`);

  return {
    valid: false,
    price: range.avg,
    originalPrice: aiPrice,
    reason: aiPrice < range.min ? 'too_low' : 'too_high',
    range,
    message: `가격이 ${aiPrice < range.min ? '너무 낮음' : '너무 높음'}, 평균가 ${range.avg}원으로 대체`
  };
}

/**
 * 목적지 정보 조회
 */
function getDestinationInfo(destination) {
  return PRICE_DB[destination] || null;
}

/**
 * 지원 목적지 목록
 */
function getSupportedDestinations() {
  return Object.keys(PRICE_DB);
}

/**
 * 국내 여행 여부 확인
 */
function isDomesticDestination(destination) {
  const destData = PRICE_DB[destination];
  return destData?.country === '한국';
}

module.exports = {
  PRICE_DB,
  getPriceRange,
  validatePriceWithDB,
  getDestinationInfo,
  getSupportedDestinations,
  isDomesticDestination
};
