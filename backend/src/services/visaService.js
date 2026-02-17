/**
 * Visa Service - 비자 정보 조회
 * 한국 여권 기준 비자 필요 여부
 * 자체 DB (VisaDB API 대안 - 안정적 운영을 위해 로컬 DB 사용)
 */

const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시

// 한국 여권 기준 비자 정보 DB (2026년 기준)
const VISA_DB = {
  // 무비자
  '일본': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '태국': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '베트남': { required: false, duration: '45일', note: '무비자 관광 (2025년부터 45일)', type: '무비자' },
  '싱가포르': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '인도네시아': { required: false, duration: '30일', note: '무비자 관광', type: '무비자' },
  '필리핀': { required: false, duration: '30일', note: '무비자 관광', type: '무비자' },
  '말레이시아': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '대만': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '홍콩': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '마카오': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '프랑스': { required: false, duration: '90일', note: '솅겐조약 (90일/180일)', type: '무비자' },
  '독일': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '이탈리아': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '스페인': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '영국': { required: false, duration: '180일', note: '무비자 관광', type: '무비자' },
  '스위스': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '오스트리아': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '네덜란드': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '벨기에': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '포르투갈': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '그리스': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '체코': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '폴란드': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '헝가리': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '크로아티아': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '덴마크': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '스웨덴': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '노르웨이': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '핀란드': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '아이슬란드': { required: false, duration: '90일', note: '솅겐조약', type: '무비자' },
  '미국': { required: true, duration: '90일', note: 'ESTA 필수 (전자여행허가)', type: 'ESTA', link: 'https://esta.cbp.dhs.gov' },
  '캐나다': { required: true, duration: '180일', note: 'eTA 필수 (전자여행허가)', type: 'eTA', link: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html' },
  '호주': { required: true, duration: '90일', note: 'ETA 필수 (전자여행허가)', type: 'ETA', link: 'https://immi.homeaffairs.gov.au' },
  '뉴질랜드': { required: true, duration: '90일', note: 'NZeTA 필수 (전자여행허가)', type: 'NZeTA' },
  '튀르키예': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '아랍에미리트': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '이스라엘': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '브라질': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '멕시코': { required: false, duration: '180일', note: '무비자 관광', type: '무비자' },
  '페루': { required: false, duration: '183일', note: '무비자 관광', type: '무비자' },
  '칠레': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '아르헨티나': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '남아프리카공화국': { required: false, duration: '30일', note: '무비자 관광', type: '무비자' },
  '모로코': { required: false, duration: '90일', note: '무비자 관광', type: '무비자' },
  '러시아': { required: true, duration: '60일', note: '전자비자(e-Visa) 필요', type: 'e-Visa' },
  '인도': { required: true, duration: '60일', note: '전자비자(e-Visa) 필요', type: 'e-Visa', link: 'https://indianvisaonline.gov.in' },
  '중국': { required: true, duration: '30일', note: '비자 필요 (15일 경유무비자 가능)', type: '비자', link: 'https://www.visaforchina.cn' },
  '캄보디아': { required: true, duration: '30일', note: '도착비자 또는 e-Visa ($30)', type: '도착비자', link: 'https://www.evisa.gov.kh' },
  '미얀마': { required: true, duration: '28일', note: 'e-Visa 필요 ($50)', type: 'e-Visa' },
  '라오스': { required: false, duration: '15일', note: '무비자 관광 (15일)', type: '무비자' },
  '몽골': { required: false, duration: '30일', note: '무비자 관광', type: '무비자' },
  '네팔': { required: true, duration: '90일', note: '도착비자 ($30)', type: '도착비자' },
  '스리랑카': { required: true, duration: '30일', note: 'ETA 필요 ($50)', type: 'ETA' },
  '이집트': { required: true, duration: '30일', note: '도착비자 ($25)', type: '도착비자' },
  '요르단': { required: true, duration: '30일', note: '도착비자', type: '도착비자' },
  '한국': { required: false, duration: '-', note: '국내여행', type: '불필요' },
  '대한민국': { required: false, duration: '-', note: '국내여행', type: '불필요' },
  // 태평양
  '괌': { required: true, duration: '45일', note: 'ESTA 필수 (미국령)', type: 'ESTA', link: 'https://esta.cbp.dhs.gov' },
  '사이판': { required: false, duration: '45일', note: 'CNMI 무비자 (45일)', type: '무비자' },
  '하와이': { required: true, duration: '90일', note: 'ESTA 필수 (미국령)', type: 'ESTA', link: 'https://esta.cbp.dhs.gov' },
  '팔라우': { required: false, duration: '30일', note: '무비자 관광', type: '무비자' },
  '피지': { required: false, duration: '120일', note: '무비자 관광', type: '무비자' },
  '몰디브': { required: false, duration: '30일', note: '도착 시 무료 관광비자', type: '무비자' }
};

/**
 * 비자 정보 조회
 * @param {string} country - 국가명
 * @returns {Object} 비자 정보
 */
function getVisaInfo(country) {
  const info = VISA_DB[country];
  if (info) {
    return {
      country,
      ...info,
      source: 'TravelPMS DB',
      lastUpdated: '2026-02'
    };
  }

  // DB에 없는 국가
  return {
    country,
    required: null,
    duration: '확인 필요',
    note: '외교부 해외안전여행 사이트에서 확인하세요',
    type: '미확인',
    link: 'https://www.0404.go.kr',
    source: 'unknown',
    lastUpdated: null
  };
}

/**
 * 여러 국가 비자 정보 일괄 조회
 */
function getMultipleVisaInfo(countries) {
  return countries.map(c => getVisaInfo(c));
}

module.exports = {
  getVisaInfo,
  getMultipleVisaInfo,
  VISA_DB
};
