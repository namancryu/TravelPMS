/**
 * Flight Price Service
 * Kiwi.com Tequila API (무료 등록, 실시간 항공 검색)
 * Fallback: 하드코딩 가격표
 */

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // 1시간 캐시

// 도시명 → IATA 공항코드 매핑
const AIRPORT_CODES = {
  '도쿄': 'TYO', '오사카': 'KIX', '후쿠오카': 'FUK', '삿포로': 'CTS', '오키나와': 'OKA',
  '방콕': 'BKK', '다낭': 'DAD', '호치민': 'SGN', '나트랑': 'CXR',
  '싱가포르': 'SIN', '발리': 'DPS', '세부': 'CEB',
  '타이베이': 'TPE', '홍콩': 'HKG',
  '괌': 'GUM', '사이판': 'SPN', '하와이': 'HNL',
  '파리': 'CDG', '런던': 'LHR', '로마': 'FCO', '바르셀로나': 'BCN',
  '이스탄불': 'IST', '뉴욕': 'JFK', 'LA': 'LAX', '시드니': 'SYD',
  '제주도': 'CJU', '제주': 'CJU', '부산': 'PUS',
  '프라하': 'PRG', '빈': 'VIE', '아테네': 'ATH',
  '두바이': 'DXB', '쿠알라룸푸르': 'KUL', '마닐라': 'MNL',
  '치앙마이': 'CNX', '푸켓': 'HKT'
};

// 출발지 공항코드
const DEPARTURE_AIRPORTS = {
  'ICN': 'ICN', 'GMP': 'GMP', 'PUS': 'PUS', 'CJU': 'CJU',
  'TAE': 'TAE', 'KWJ': 'KWJ', 'CJJ': 'CJJ'
};

// Fallback 가격표 (1인 왕복, 성수기 기준, KRW)
const FALLBACK_PRICES = {
  '도쿄': { price: 500000, hours: 2.5 }, '오사카': { price: 500000, hours: 2 },
  '후쿠오카': { price: 400000, hours: 1.5 }, '삿포로': { price: 550000, hours: 3.5 },
  '오키나와': { price: 500000, hours: 2.5 }, '방콕': { price: 600000, hours: 5.5 },
  '다낭': { price: 500000, hours: 4.5 }, '호치민': { price: 550000, hours: 5.5 },
  '나트랑': { price: 550000, hours: 5 }, '싱가포르': { price: 650000, hours: 6.5 },
  '발리': { price: 750000, hours: 7 }, '세부': { price: 450000, hours: 4.5 },
  '타이베이': { price: 400000, hours: 2.5 }, '홍콩': { price: 450000, hours: 3.5 },
  '괌': { price: 700000, hours: 4.5 }, '사이판': { price: 700000, hours: 4.5 },
  '하와이': { price: 1200000, hours: 9 }, '파리': { price: 1300000, hours: 12 },
  '런던': { price: 1300000, hours: 12 }, '로마': { price: 1200000, hours: 11.5 },
  '바르셀로나': { price: 1200000, hours: 12 }, '이스탄불': { price: 1000000, hours: 11 },
  '뉴욕': { price: 1500000, hours: 14 }, 'LA': { price: 1300000, hours: 12 },
  '시드니': { price: 1100000, hours: 10.5 }, '제주도': { price: 200000, hours: 1 },
  '제주': { price: 200000, hours: 1 }, '부산': { price: 0, hours: 0 },
  '프라하': { price: 1100000, hours: 11 }, '빈': { price: 1100000, hours: 11 },
  '아테네': { price: 1100000, hours: 11.5 }, '두바이': { price: 900000, hours: 9 },
  '쿠알라룸푸르': { price: 600000, hours: 6.5 }, '마닐라': { price: 450000, hours: 4 },
  '치앙마이': { price: 550000, hours: 5 }, '푸켓': { price: 600000, hours: 6 }
};

/**
 * Kiwi.com Tequila API로 실시간 항공 검색
 */
async function searchKiwi(departure, destination, dateFrom, dateTo) {
  if (!process.env.KIWI_API_KEY) return null;

  const depCode = DEPARTURE_AIRPORTS[departure] || 'ICN';
  const destCode = AIRPORT_CODES[destination];
  if (!destCode) return null;

  try {
    const url = `https://api.tequila.kiwi.com/v2/search?fly_from=${depCode}&fly_to=${destCode}&date_from=${dateFrom}&date_to=${dateTo}&return_from=${dateFrom}&return_to=${dateTo}&flight_type=round&adults=1&curr=KRW&locale=ko&limit=5&sort=price`;

    const response = await fetch(url, {
      headers: { 'apikey': process.env.KIWI_API_KEY }
    });

    if (!response.ok) throw new Error(`Kiwi API: ${response.status}`);
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      const cheapest = data.data[0];
      return {
        price: Math.round(cheapest.price),
        airline: cheapest.airlines?.join(', ') || '미확인',
        duration: Math.round(cheapest.duration?.total / 3600 * 10) / 10,
        deepLink: cheapest.deep_link,
        provider: 'kiwi.com'
      };
    }
  } catch (err) {
    console.warn(`Kiwi API failed for ${destination}:`, err.message);
  }
  return null;
}

/**
 * 항공권 가격 조회 (캐싱 + 폴백)
 * @param {string} destination - 목적지명
 * @param {string} departure - 출발 공항코드 (기본: ICN)
 * @param {string} dateFrom - 출발일 (DD/MM/YYYY for Kiwi)
 * @param {string} dateTo - 귀국일
 */
async function getFlightPrice(destination, departure = 'ICN', dateFrom, dateTo) {
  const cacheKey = `flight_${departure}_${destination}_${dateFrom}_${dateTo}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 1차: Kiwi.com 실시간 검색
  if (dateFrom && dateTo && process.env.KIWI_API_KEY) {
    const kiwiResult = await searchKiwi(departure, destination, dateFrom, dateTo);
    if (kiwiResult) {
      const result = {
        destination,
        departure,
        ...kiwiResult,
        fallback: false
      };
      cache.set(cacheKey, result);
      console.log(`✈️ 항공 실시간: ${departure}→${destination} = ${kiwiResult.price.toLocaleString()}원`);
      return result;
    }
  }

  // 2차: Fallback 가격표
  const fallback = FALLBACK_PRICES[destination];
  if (fallback) {
    const result = {
      destination,
      departure,
      price: fallback.price,
      hours: fallback.hours,
      provider: 'fallback',
      fallback: true
    };
    cache.set(cacheKey, result, 1800);
    return result;
  }

  return {
    destination,
    departure,
    price: null,
    hours: null,
    provider: 'unknown',
    fallback: true,
    error: '가격 정보 없음'
  };
}

/**
 * 전체 가격표 조회 (프론트엔드용)
 */
function getAllFlightPrices() {
  const result = {};
  for (const [dest, info] of Object.entries(FALLBACK_PRICES)) {
    result[dest] = { price: info.price, hours: info.hours };
  }
  return result;
}

module.exports = {
  getFlightPrice,
  getAllFlightPrices,
  AIRPORT_CODES,
  FALLBACK_PRICES
};
