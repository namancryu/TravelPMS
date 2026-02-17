/**
 * Exchange Rate Service
 * 실시간 환율 조회 및 변환
 */

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // 1시간 캐시

/**
 * 환율 조회 (캐싱 적용)
 * @param {string} from - 출발 통화 (예: 'USD')
 * @param {string} to - 도착 통화 (예: 'KRW')
 * @returns {Promise<Object>} - { from, to, rate, timestamp, provider }
 */
async function getExchangeRate(from, to) {
  const cacheKey = `${from}_${to}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    console.log(`💰 Exchange rate cache hit: ${from} → ${to}`);
    return cached;
  }

  try {
    // API: https://api.exchangerate-api.com/v4/latest/{base}
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);

    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.rates || !data.rates[to]) {
      throw new Error(`Exchange rate not found: ${from} → ${to}`);
    }

    const rate = data.rates[to];
    const result = {
      from,
      to,
      rate,
      timestamp: new Date().toISOString(),
      provider: 'exchangerate-api.com'
    };

    cache.set(cacheKey, result);
    console.log(`💰 Exchange rate fetched: ${from} → ${to} = ${rate}`);

    return result;
  } catch (err) {
    console.error('Exchange rate API failed:', err.message);

    // Fallback to hardcoded rates (2026년 2월 기준 예상 환율)
    const fallbackRates = {
      'USD_KRW': 1320,
      'JPY_KRW': 9.5,
      'EUR_KRW': 1450,
      'CNY_KRW': 185,
      'GBP_KRW': 1680,
      'AUD_KRW': 880,
      'CAD_KRW': 980,
      'THB_KRW': 38,
      'VND_KRW': 0.055,
      'SGD_KRW': 980,
      // 역방향
      'KRW_USD': 1 / 1320,
      'KRW_JPY': 1 / 9.5,
      'KRW_EUR': 1 / 1450,
      'KRW_CNY': 1 / 185
    };

    const fallbackRate = fallbackRates[`${from}_${to}`] || 1;
    const fallbackResult = {
      from,
      to,
      rate: fallbackRate,
      timestamp: new Date().toISOString(),
      provider: 'fallback'
    };

    // Fallback도 캐시 (짧은 시간만)
    cache.set(cacheKey, fallbackResult, 300); // 5분

    return fallbackResult;
  }
}

/**
 * 통화 변환
 * @param {number} amount - 변환할 금액
 * @param {string} from - 출발 통화
 * @param {string} to - 도착 통화
 * @returns {Promise<number>} - 변환된 금액
 */
async function convertCurrency(amount, from, to) {
  if (from === to) return amount;

  const { rate } = await getExchangeRate(from, to);
  return Math.round(amount * rate);
}

/**
 * 여러 통화 일괄 조회
 * @param {string} base - 기준 통화
 * @param {string[]} targets - 대상 통화 배열
 * @returns {Promise<Object>} - { base, rates: { USD: 1320, ... }, timestamp }
 */
async function getMultipleRates(base, targets) {
  const rates = {};
  const timestamp = new Date().toISOString();

  for (const target of targets) {
    try {
      const result = await getExchangeRate(base, target);
      rates[target] = result.rate;
    } catch (err) {
      console.warn(`Failed to get rate for ${base} → ${target}:`, err.message);
      rates[target] = null;
    }
  }

  return { base, rates, timestamp };
}

/**
 * 캐시 통계
 */
function getCacheStats() {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    hitRate: (cache.getStats().hits / (cache.getStats().hits + cache.getStats().misses) * 100).toFixed(2) + '%'
  };
}

module.exports = {
  getExchangeRate,
  convertCurrency,
  getMultipleRates,
  getCacheStats
};
