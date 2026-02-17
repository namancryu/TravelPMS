/**
 * 목적지 데이터베이스 (하이브리드 모드)
 * SQLite DB (105개 여행지) + 외부 API 연동
 */

const dao = require('./database/destinationDAO');
const { enrichDestinationData } = require('./api/externalAPIs');

// ========================================
// 기존 하드코딩 데이터 (폴백용, Deprecated)
// ========================================
const legacyDestinations = [
  {
    id: 'turkey-istanbul',
    name: '이스탄불',
    country: '튀르키예',
    flag: '🇹🇷',
    styles: ['culture', 'food', 'city', 'history'],
    budgetRange: ['medium'],
    bestFor: ['couple', 'friends', 'solo'],
    flightTime: 'long',
    avgCost: 1500000,
    rating: 4.9,
    bestSeason: '4월-6월, 9월-11월',
    pros: ['동서양 문화 융합', '음식 매우 맛있음', '역사 유적 풍부', '가성비 좋음'],
    cons: ['비행시간 길다', '여름 매우 더움'],
    description: '동서양이 만나는 곳! 역사, 미식, 자연이 어우러진 매력적인 여행지',
    highlights: ['카파도키아 열기구', '아야 소피아', '그랜드 바자르', '파묵칼레', '보스포루스 크루즈'],
    sampleItinerary: { days: 7, perDayCost: 200000, mustDo: ['카파도키아 열기구 투어', '그랜드 바자르 쇼핑', '보스포루스 선셋 크루즈'] }
  },
  {
    id: 'greece-santorini',
    name: '산토리니',
    country: '그리스',
    flag: '🇬🇷',
    styles: ['beach', 'relaxation', 'culture'],
    budgetRange: ['high'],
    bestFor: ['couple'],
    flightTime: 'long',
    avgCost: 2000000,
    rating: 4.8,
    bestSeason: '5월-10월',
    pros: ['환상적인 석양', '화이트&블루 마을', '로맨틱 분위기'],
    cons: ['물가 비쌈', '비행 환승 필요'],
    description: '하얀 건물과 푸른 바다가 만나는 로맨틱한 섬',
    highlights: ['이아 석양', '블루돔 교회', '화산섬 투어', '와이너리'],
    sampleItinerary: { days: 5, perDayCost: 400000, mustDo: ['이아 석양 감상', '블루돔 사진', '와인 투어'] }
  },
  {
    id: 'italy-rome',
    name: '로마',
    country: '이탈리아',
    flag: '🇮🇹',
    styles: ['culture', 'food', 'city', 'history'],
    budgetRange: ['medium', 'high'],
    bestFor: ['couple', 'friends', 'family'],
    flightTime: 'long',
    avgCost: 1800000,
    rating: 4.8,
    bestSeason: '4월-6월, 9월-10월',
    pros: ['역사 유적 풍부', '음식 천국', '예술과 문화'],
    cons: ['관광객 많음', '소매치기 주의'],
    description: '2000년 역사가 살아 숨쉬는 영원의 도시',
    highlights: ['콜로세움', '바티칸 시국', '트레비 분수', '판테온'],
    sampleItinerary: { days: 5, perDayCost: 350000, mustDo: ['콜로세움 투어', '바티칸 박물관', '트레비 분수'] }
  },
  {
    id: 'france-paris',
    name: '파리',
    country: '프랑스',
    flag: '🇫🇷',
    styles: ['culture', 'city', 'food'],
    budgetRange: ['high'],
    bestFor: ['couple', 'solo'],
    flightTime: 'long',
    avgCost: 2200000,
    rating: 4.7,
    bestSeason: '4월-6월, 9월-10월',
    pros: ['로맨틱한 분위기', '예술과 문화', '미식의 도시'],
    cons: ['물가 매우 비쌈', '영어 잘 안 통함'],
    description: '로맨스와 예술의 도시, 세계 문화의 중심',
    highlights: ['에펠탑', '루브르 박물관', '몽마르트 언덕', '샹젤리제'],
    sampleItinerary: { days: 5, perDayCost: 450000, mustDo: ['에펠탑 야경', '루브르 관람', '세느강 크루즈'] }
  },
  {
    id: 'spain-barcelona',
    name: '바르셀로나',
    country: '스페인',
    flag: '🇪🇸',
    styles: ['culture', 'beach', 'city', 'food'],
    budgetRange: ['medium'],
    bestFor: ['couple', 'friends', 'family'],
    flightTime: 'long',
    avgCost: 1600000,
    rating: 4.8,
    bestSeason: '5월-10월',
    pros: ['가우디 건축', '해변과 도시 모두', '음식 맛있음'],
    cons: ['소매치기 많음', '여름 관광객 폭주'],
    description: '가우디의 예술과 지중해가 만나는 곳',
    highlights: ['사그라다 파밀리아', '구엘 공원', '람블라스 거리', '바르셀로네타 해변'],
    sampleItinerary: { days: 5, perDayCost: 320000, mustDo: ['사그라다 파밀리아', '구엘공원', '타파스 투어'] }
  },

  // === 아시아 ===
  {
    id: 'tokyo',
    name: '도쿄',
    country: '일본',
    flag: '🇯🇵',
    styles: ['shopping', 'city', 'food'],
    budgetRange: ['low', 'medium'],
    bestFor: ['solo', 'couple', 'friends'],
    flightTime: 'short',
    avgCost: 800000,
    rating: 4.8,
    bestSeason: '봄(3-5월), 가을(9-11월)',
    pros: ['가까워서 편함', '음식 맛있음', '대중교통 편리', '안전함'],
    cons: ['물가 조금 비쌈', '사람 많음'],
    description: '쇼핑과 미식의 천국! 편의점 음식도 맛있고, 볼거리 가득한 도시',
    highlights: ['시부야 스크램블', '센소지', '아키하바라', '츠키지 시장'],
    sampleItinerary: {
      days: 4,
      perDayCost: 200000,
      mustDo: ['하라주쿠 거리 산책', '스카이트리 전망', '이자카야 투어']
    }
  },
  {
    id: 'osaka',
    name: '오사카',
    country: '일본',
    flag: '🇯🇵',
    styles: ['food', 'city', 'shopping', 'family'],
    budgetRange: ['low', 'medium'],
    bestFor: ['solo', 'couple', 'friends', 'family'],
    flightTime: 'short',
    avgCost: 750000,
    rating: 4.7,
    bestSeason: '봄(3-5월), 가을(9-11월)',
    pros: ['먹거리 천국', '도쿄보다 저렴', '사람들 친절', '교토 근처'],
    cons: ['관광지는 도쿄보다 적음'],
    description: '일본의 부엌! 길거리 음식과 타코야키의 성지',
    highlights: ['도톤보리', 'USJ', '오사카성', '신세카이'],
    sampleItinerary: {
      days: 4,
      perDayCost: 180000,
      mustDo: ['도톤보리 야경', 'USJ 풀데이', '구로몬 시장 투어']
    }
  },
  {
    id: 'bangkok',
    name: '방콕',
    country: '태국',
    flag: '🇹🇭',
    styles: ['relaxation', 'food', 'city', 'shopping'],
    budgetRange: ['low'],
    bestFor: ['couple', 'friends', 'family'],
    flightTime: 'medium',
    avgCost: 600000,
    rating: 4.6,
    bestSeason: '11월-2월 (건기)',
    pros: ['저렴함', '음식 맛있음', '마사지 천국', '야시장 재미'],
    cons: ['더움', '습함', '교통 혼잡'],
    description: '가성비 최고! 저렴하게 즐기는 동남아 여행',
    highlights: ['왕궁', '카오산 로드', '짜뚜짝 시장', '왓 아룬'],
    sampleItinerary: {
      days: 4,
      perDayCost: 100000,
      mustDo: ['수상시장 투어', '루프탑 바', '태국 마사지']
    }
  },
  {
    id: 'danang',
    name: '다낭',
    country: '베트남',
    flag: '🇻🇳',
    styles: ['relaxation', 'nature', 'food', 'beach'],
    budgetRange: ['low'],
    bestFor: ['couple', 'family'],
    flightTime: 'medium',
    avgCost: 700000,
    rating: 4.5,
    bestSeason: '2월-5월',
    pros: ['해변 아름다움', '저렴함', '음식 맛있음', '한국인 많아 편함'],
    cons: ['영어 잘 안 통함', '비오는 날 많음'],
    description: '힐링 해변 여행! 아름다운 바다와 저렴한 물가',
    highlights: ['미케비치', '바나힐', '호이안 야경', '마블 마운틴'],
    sampleItinerary: {
      days: 4,
      perDayCost: 120000,
      mustDo: ['바나힐 골든 브릿지', '호이안 랜턴 축제', '미케비치 선셋']
    }
  },
  {
    id: 'paris',
    name: '파리',
    country: '프랑스',
    flag: '🇫🇷',
    styles: ['city', 'culture', 'food', 'shopping'],
    budgetRange: ['high'],
    bestFor: ['couple', 'solo'],
    flightTime: 'long',
    avgCost: 2000000,
    rating: 4.9,
    bestSeason: '4월-6월, 9월-10월',
    pros: ['로맨틱함', '문화/예술 최고', '음식 일품', '볼거리 많음'],
    cons: ['비쌈', '소매치기 조심', '영어 잘 안 통함'],
    description: '로맨스의 도시! 에펠탑과 루브르가 있는 꿈의 여행지',
    highlights: ['에펠탑', '루브르 박물관', '몽마르뜨', '샹젤리제'],
    sampleItinerary: {
      days: 5,
      perDayCost: 350000,
      mustDo: ['에펠탑 야경', '루브르 반나절', '세느강 크루즈']
    }
  },
  {
    id: 'bali',
    name: '발리',
    country: '인도네시아',
    flag: '🇮🇩',
    styles: ['relaxation', 'nature', 'adventure', 'beach'],
    budgetRange: ['low', 'medium'],
    bestFor: ['couple', 'friends'],
    flightTime: 'medium',
    avgCost: 900000,
    rating: 4.7,
    bestSeason: '4월-10월 (건기)',
    pros: ['힐링 최고', '리조트 저렴', '자연 아름다움', '서핑 가능'],
    cons: ['우기엔 비 많음', '교통 불편'],
    description: '신들의 섬! 힐링과 액티비티를 동시에',
    highlights: ['우붓 라이스테라스', '따나롯 사원', '누사페니다', '짐바란 비치'],
    sampleItinerary: {
      days: 5,
      perDayCost: 150000,
      mustDo: ['우붓 원숭이숲', '스노클링', '선셋 디너']
    }
  },
  {
    id: 'jeju',
    name: '제주도',
    country: '한국',
    flag: '🇰🇷',
    styles: ['nature', 'relaxation', 'food', 'family'],
    budgetRange: ['low', 'medium'],
    bestFor: ['family', 'couple', 'friends'],
    flightTime: 'short',
    avgCost: 500000,
    rating: 4.4,
    bestSeason: '4월-6월, 9월-11월',
    pros: ['가까움', '언어 편함', '자연 좋음', '음식 맛있음'],
    cons: ['날씨 변덕', '렌터카 필수'],
    description: '부담없는 국내 여행! 한라산과 바다를 동시에',
    highlights: ['한라산', '성산일출봉', '우도', '협재해수욕장'],
    sampleItinerary: {
      days: 3,
      perDayCost: 150000,
      mustDo: ['성산일출봉 일출', '우도 사이클링', '흑돼지 맛집']
    }
  },
  {
    id: 'okinawa',
    name: '오키나와',
    country: '일본',
    flag: '🇯🇵',
    styles: ['beach', 'nature', 'relaxation', 'family'],
    budgetRange: ['medium'],
    bestFor: ['family', 'couple'],
    flightTime: 'short',
    avgCost: 1000000,
    rating: 4.6,
    bestSeason: '4월-6월, 9월-11월',
    pros: ['깨끗한 바다', '가족 친화', '미군기지 문화', '수족관 최고'],
    cons: ['렌터카 필수', '태풍 시즌 주의'],
    description: '일본의 하와이! 에메랄드빛 바다와 독특한 류큐 문화',
    highlights: ['추라우미 수족관', '만좌모', '아메리칸 빌리지', '나하 국제거리'],
    sampleItinerary: {
      days: 4,
      perDayCost: 200000,
      mustDo: ['추라우미 수족관', '블루 케이브 스노클링', '나하 거리 산책']
    }
  },
  {
    id: 'singapore',
    name: '싱가포르',
    country: '싱가포르',
    flag: '🇸🇬',
    styles: ['city', 'food', 'family', 'shopping'],
    budgetRange: ['medium', 'high'],
    bestFor: ['family', 'couple', 'friends'],
    flightTime: 'medium',
    avgCost: 1200000,
    rating: 4.7,
    bestSeason: '연중 가능 (건기: 2-4월)',
    pros: ['깨끗함', '안전함', '영어 통함', '다양한 문화'],
    cons: ['물가 비쌈', '작은 도시'],
    description: '도시국가의 매력! 깨끗하고 안전한 가족 여행지',
    highlights: ['마리나베이 샌즈', '가든스 바이 더 베이', '센토사', 'USS'],
    sampleItinerary: {
      days: 4,
      perDayCost: 250000,
      mustDo: ['마리나베이 야경', '센토사 USS', '호커센터 맛집 투어']
    }
  },
  {
    id: 'hawaii',
    name: '하와이',
    country: '미국',
    flag: '🇺🇸',
    styles: ['beach', 'nature', 'relaxation', 'adventure'],
    budgetRange: ['high'],
    bestFor: ['couple', 'family', 'friends'],
    flightTime: 'long',
    avgCost: 2500000,
    rating: 4.8,
    bestSeason: '4월-10월',
    pros: ['천혜의 자연', '다양한 액티비티', '한국어 가능', '쇼핑'],
    cons: ['비쌈', '비행시간 긺', '시차 큼'],
    description: '꿈의 휴양지! 완벽한 해변과 다채로운 액티비티',
    highlights: ['와이키키 비치', '다이아몬드 헤드', '노스쇼어', '쿠알로아 랜치'],
    sampleItinerary: {
      days: 5,
      perDayCost: 400000,
      mustDo: ['다이아몬드 헤드 하이킹', '쿠알로아 랜치 투어', '선셋 크루즈']
    }
  },
  {
    id: 'turkey',
    name: '이스탄불',
    country: '튀르키예',
    flag: '🇹🇷',
    styles: ['culture', 'food', 'city', 'nature', 'adventure'],
    budgetRange: ['medium'],
    bestFor: ['couple', 'family', 'friends', 'solo'],
    flightTime: 'long',
    avgCost: 1500000,
    rating: 4.7,
    bestSeason: '4월-6월, 9월-11월',
    pros: ['동서양 문화 융합', '음식 매우 맛있음', '물가 저렴', '볼거리 풍부', '열기구 체험'],
    cons: ['비행시간 긺 (11시간)', '언어 소통 어려움', '택시 바가지 주의'],
    description: '동서양이 만나는 곳! 역사, 미식, 자연이 어우러진 매력적인 여행지',
    highlights: ['카파도키아 열기구', '아야 소피아', '그랜드 바자르', '파묵칼레'],
    sampleItinerary: {
      days: 7,
      perDayCost: 180000,
      mustDo: ['카파도키아 열기구 투어', '아야 소피아 & 블루 모스크', '보스포루스 크루즈', '파묵칼레 석회암 온천']
    }
  }
];

// ========================================
// 하이브리드 조회 함수
// ========================================

/**
 * 모든 목적지 조회 (DB 우선, 폴백: 하드코딩)
 */
function getAllDestinations() {
  try {
    return dao.getAllDestinations();
  } catch (err) {
    console.warn('⚠️ DB 조회 실패, 레거시 데이터 사용:', err.message);
    return legacyDestinations;
  }
}

/**
 * ID로 목적지 조회
 */
function getDestinationById(id) {
  try {
    return dao.getDestinationById(id);
  } catch (err) {
    console.warn('⚠️ DB 조회 실패, 레거시 데이터 사용');
    return legacyDestinations.find(d => d.id === id);
  }
}

/**
 * 이름으로 목적지 조회
 */
function getDestinationByName(name) {
  try {
    return dao.getDestinationByName(name);
  } catch (err) {
    console.warn('⚠️ DB 조회 실패, 레거시 데이터 사용');
    return legacyDestinations.find(d => d.name === name);
  }
}

/**
 * 조건 검색
 */
function findDestinations(criteria) {
  try {
    return dao.findDestinations(criteria);
  } catch (err) {
    console.warn('⚠️ DB 조회 실패, 레거시 로직 사용');
    // 레거시 폴백
    return legacyDestinations.filter(dest => {
      let score = 0;
      if (criteria.styles) {
        const matched = criteria.styles.filter(s => dest.styles.includes(s));
        score += matched.length * 2;
      }
      if (criteria.budget && dest.budgetRange.includes(criteria.budget)) score += 3;
      if (criteria.travelers && dest.bestFor.includes(criteria.travelers)) score += 2;
      if (criteria.flightTime && dest.flightTime === criteria.flightTime) score += 1;
      return score > 0;
    }).sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      if (criteria.styles) {
        scoreA = criteria.styles.filter(s => a.styles.includes(s)).length;
        scoreB = criteria.styles.filter(s => b.styles.includes(s)).length;
      }
      return scoreB - scoreA;
    });
  }
}

/**
 * 외부 API 데이터 보강 (옵션)
 * @param {String} id - 목적지 ID
 * @param {Object} options - { includePlaces: true, includePOI: false }
 */
async function getEnrichedDestination(id, options = {}) {
  const dest = getDestinationById(id);
  if (!dest) return null;

  return await enrichDestinationData(dest, options);
}

module.exports = {
  destinations: legacyDestinations, // 하위 호환성
  getAllDestinations,
  getDestinationById,
  getDestinationByName,
  findDestinations,
  getEnrichedDestination // 새로운 함수: 외부 API 보강
};
