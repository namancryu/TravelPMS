/**
 * Weather Service - Open-Meteo API
 * 완전 무료, API키 불필요, 일 10,000콜
 * https://open-meteo.com/
 */

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 1800 }); // 30분 캐시

// 주요 여행지 좌표 DB
const CITY_COORDS = {
  '도쿄': { lat: 35.6762, lon: 139.6503 }, '오사카': { lat: 34.6937, lon: 135.5023 },
  '후쿠오카': { lat: 33.5902, lon: 130.4017 }, '삿포로': { lat: 43.0618, lon: 141.3545 },
  '오키나와': { lat: 26.3344, lon: 127.8056 }, '방콕': { lat: 13.7563, lon: 100.5018 },
  '다낭': { lat: 16.0544, lon: 108.2022 }, '호치민': { lat: 10.8231, lon: 106.6297 },
  '나트랑': { lat: 12.2388, lon: 109.1967 }, '싱가포르': { lat: 1.3521, lon: 103.8198 },
  '발리': { lat: -8.3405, lon: 115.0920 }, '세부': { lat: 10.3157, lon: 123.8854 },
  '타이베이': { lat: 25.0330, lon: 121.5654 }, '홍콩': { lat: 22.3193, lon: 114.1694 },
  '괌': { lat: 13.4443, lon: 144.7937 }, '사이판': { lat: 15.1900, lon: 145.7545 },
  '하와이': { lat: 21.3069, lon: -157.8583 }, '파리': { lat: 48.8566, lon: 2.3522 },
  '런던': { lat: 51.5074, lon: -0.1278 }, '로마': { lat: 41.9028, lon: 12.4964 },
  '바르셀로나': { lat: 41.3874, lon: 2.1686 }, '이스탄불': { lat: 41.0082, lon: 28.9784 },
  '뉴욕': { lat: 40.7128, lon: -74.0060 }, 'LA': { lat: 34.0522, lon: -118.2437 },
  '시드니': { lat: -33.8688, lon: 151.2093 }, '제주': { lat: 33.4996, lon: 126.5312 },
  '제주도': { lat: 33.4996, lon: 126.5312 }, '부산': { lat: 35.1796, lon: 129.0756 },
  '경주': { lat: 35.8562, lon: 129.2248 }, '전주': { lat: 35.8242, lon: 127.1480 },
  '강릉': { lat: 37.7519, lon: 128.8760 }, '속초': { lat: 38.2070, lon: 128.5918 },
  '여수': { lat: 34.7604, lon: 127.6622 }, '프라하': { lat: 50.0755, lon: 14.4378 },
  '빈': { lat: 48.2082, lon: 16.3738 }, '아테네': { lat: 37.9838, lon: 23.7275 },
  '취리히': { lat: 47.3769, lon: 8.5417 }, '두바이': { lat: 25.2048, lon: 55.2708 },
  '쿠알라룸푸르': { lat: 3.1390, lon: 101.6869 }, '마닐라': { lat: 14.5995, lon: 120.9842 },
  '치앙마이': { lat: 18.7883, lon: 98.9853 }, '푸켓': { lat: 7.8804, lon: 98.3923 }
};

// WMO 날씨 코드 → 한글 설명 + 아이콘
const WEATHER_CODES = {
  0: { desc: '맑음', icon: '☀️' }, 1: { desc: '대체로 맑음', icon: '🌤️' },
  2: { desc: '구름 약간', icon: '⛅' }, 3: { desc: '흐림', icon: '☁️' },
  45: { desc: '안개', icon: '🌫️' }, 48: { desc: '짙은 안개', icon: '🌫️' },
  51: { desc: '이슬비', icon: '🌦️' }, 53: { desc: '이슬비', icon: '🌦️' },
  55: { desc: '이슬비', icon: '🌦️' }, 61: { desc: '약한 비', icon: '🌧️' },
  63: { desc: '보통 비', icon: '🌧️' }, 65: { desc: '강한 비', icon: '🌧️' },
  71: { desc: '약한 눈', icon: '🌨️' }, 73: { desc: '보통 눈', icon: '🌨️' },
  75: { desc: '강한 눈', icon: '❄️' }, 80: { desc: '소나기', icon: '🌦️' },
  81: { desc: '보통 소나기', icon: '🌧️' }, 82: { desc: '강한 소나기', icon: '⛈️' },
  95: { desc: '뇌우', icon: '⛈️' }, 96: { desc: '우박 뇌우', icon: '⛈️' },
  99: { desc: '강한 우박', icon: '⛈️' }
};

/**
 * 도시명으로 좌표 조회
 */
function getCityCoords(destName) {
  return CITY_COORDS[destName] || null;
}

/**
 * Open-Meteo 날씨 예보 조회
 * @param {string} destName - 목적지 이름
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {number} days - 예보 일수 (최대 16)
 */
async function getWeatherForecast(destName, startDate, days = 7) {
  const cacheKey = `weather_${destName}_${startDate}_${days}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const coords = getCityCoords(destName);
  if (!coords) {
    return { error: '좌표 정보 없음', destName };
  }

  try {
    // 날짜가 16일 이내면 forecast, 아니면 과거 데이터 기반 기후 정보
    const now = new Date();
    const start = new Date(startDate);
    const diffDays = Math.ceil((start - now) / (1000 * 60 * 60 * 24));

    let url;
    if (diffDays <= 16 && diffDays >= 0) {
      // 16일 이내: 실시간 예보
      url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=${Math.min(days, 16)}`;
    } else {
      // 16일 이후: 과거 동일 기간 기후 데이터 (작년 데이터 활용)
      const lastYear = new Date(start);
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      const endDate = new Date(lastYear);
      endDate.setDate(endDate.getDate() + days - 1);
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${lastYear.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo API returned ${response.status}`);
    const data = await response.json();

    if (!data.daily || !data.daily.time) {
      throw new Error('No daily data returned');
    }

    const forecast = data.daily.time.map((date, i) => {
      const code = data.daily.weather_code[i];
      const weatherInfo = WEATHER_CODES[code] || { desc: '정보 없음', icon: '❓' };
      return {
        date,
        weatherCode: code,
        description: weatherInfo.desc,
        icon: weatherInfo.icon,
        tempMax: Math.round(data.daily.temperature_2m_max[i]),
        tempMin: Math.round(data.daily.temperature_2m_min[i]),
        precipitation: data.daily.precipitation_sum?.[i] || 0,
        precipProbability: data.daily.precipitation_probability_max?.[i] || null,
        windSpeed: Math.round(data.daily.wind_speed_10m_max?.[i] || 0)
      };
    });

    const result = {
      destName,
      coords,
      forecast,
      isHistorical: diffDays > 16,
      provider: 'open-meteo.com',
      timestamp: new Date().toISOString()
    };

    cache.set(cacheKey, result);
    console.log(`🌤️ 날씨 조회: ${destName} (${forecast.length}일, ${result.isHistorical ? '기후데이터' : '실시간예보'})`);
    return result;
  } catch (err) {
    console.error(`날씨 조회 실패 (${destName}):`, err.message);
    return { error: err.message, destName };
  }
}

module.exports = {
  getWeatherForecast,
  getCityCoords,
  CITY_COORDS
};
