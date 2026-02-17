/**
 * Exchange Rate Service
 * 실시간 환율 조회 및 변환
 * Primary: Frankfurter API (무제한, 키 불필요)
 * Fallback: exchangerate-api.com → hardcoded rates
 */

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 }); // 1시간 캐시

// Fallback rates (2026년 기준 예상 환율)
const FALLBACK_RATES = {
  'USD_KRW': 1320, 'JPY_KRW': 9.5, 'EUR_KRW': 1450, 'CNY_KRW': 185,
  'GBP_KRW': 1680, 'AUD_KRW': 880, 'CAD_KRW': 980, 'THB_KRW': 38,
  'VND_KRW': 0.055, 'SGD_KRW': 980, 'TWD_KRW': 42, 'PHP_KRW': 23,
  'IDR_KRW': 0.085, 'MYR_KRW': 295, 'NZD_KRW': 810, 'CHF_KRW': 1500,
  'SEK_KRW': 125, 'NOK_KRW': 120, 'DKK_KRW': 195, 'HKD_KRW': 170,
  'TRY_KRW': 40, 'CZK_KRW': 57, 'HUF_KRW': 3.5, 'PLN_KRW': 330,
  'KRW_USD': 1/1320, 'KRW_JPY': 1/9.5, 'KRW_EUR': 1/1450, 'KRW_CNY': 1/185
};

/**
 * Frankfurter API로 환율 조회 (무제한, 키 불필요)
 */
async function fetchFromFrankfurter(from, to) {
  const url = `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Frankfurter API returned ${response.status}`);
  const data = await response.json();
  if (!data.rates || !data.rates[to]) throw new Error(`Rate not found: ${from} → ${to}`);
  return { rate: data.rates[to], provider: 'frankfurter.dev' };
}

/**
 * exchangerate-api.com으로 환율 조회 (fallback)
 */
async function fetchFromExchangeRateApi(from, to) {
  const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
  if (!response.ok) throw new Error(`ExchangeRate API returned ${response.status}`);
  const data = await response.json();
  if (!data.rates || !data.rates[to]) throw new Error(`Rate not found: ${from} → ${to}`);
  return { rate: data.rates[to], provider: 'exchangerate-api.com' };
}

/**
 * 환율 조회 (캐싱 적용, 다중 API 폴백)
 */
async function getExchangeRate(from, to) {
  const cacheKey = `${from}_${to}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  // 1차: Frankfurter API
  try {
    const { rate, provider } = await fetchFromFrankfurter(from, to);
    const result = { from, to, rate, timestamp: new Date().toISOString(), provider };
    cache.set(cacheKey, result);
    console.log(`💰 환율 조회: ${from} → ${to} = ${rate} (${provider})`);
    return result;
  } catch (err) {
    console.warn('Frankfurter API failed:', err.message);
  }

  // 2차: exchangerate-api.com
  try {
    const { rate, provider } = await fetchFromExchangeRateApi(from, to);
    const result = { from, to, rate, timestamp: new Date().toISOString(), provider };
    cache.set(cacheKey, result);
    console.log(`💰 환율 조회: ${from} → ${to} = ${rate} (${provider})`);
    return result;
  } catch (err) {
    console.warn('ExchangeRate API failed:', err.message);
  }

  // 3차: Fallback hardcoded rates
  const fallbackRate = FALLBACK_RATES[`${from}_${to}`] || 1;
  const fallbackResult = {
    from, to, rate: fallbackRate,
    timestamp: new Date().toISOString(), provider: 'fallback'
  };
  cache.set(cacheKey, fallbackResult, 300); // 5분
  return fallbackResult;
}

/**
 * 주요 통화 일괄 조회 (프론트엔드용)
 */
async function getAllRatesForKRW() {
  const cacheKey = 'all_rates_krw';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const currencies = ['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'CNY', 'THB', 'VND', 'SGD', 'TWD', 'PHP', 'IDR', 'TRY', 'CHF', 'HKD'];
  const rates = {};

  // Frankfurter로 일괄 조회 시도
  try {
    const symbols = currencies.filter(c => c !== 'KRW').join(',');
    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=KRW&symbols=${symbols}`);
    if (response.ok) {
      const data = await response.json();
      // KRW 기준 → 각 통화 1단위당 KRW 로 변환
      for (const [currency, rate] of Object.entries(data.rates || {})) {
        rates[currency] = Math.round((1 / rate) * 100) / 100;
      }
    }
  } catch (err) {
    console.warn('Frankfurter bulk fetch failed:', err.message);
  }

  // 누락된 통화는 fallback으로 보충
  for (const currency of currencies) {
    if (!rates[currency]) {
      rates[currency] = FALLBACK_RATES[`${currency}_KRW`] || null;
    }
  }

  const result = {
    base: 'KRW',
    rates,
    timestamp: new Date().toISOString(),
    provider: Object.keys(rates).length > 5 ? 'frankfurter.dev' : 'fallback'
  };
  cache.set(cacheKey, result, 1800); // 30분 캐시
  return result;
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
  getAllRatesForKRW,
  getCacheStats
};
