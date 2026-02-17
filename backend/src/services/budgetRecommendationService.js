/**
 * Budget Recommendation Service
 * AI 기반 예산 카테고리별 추천 (실제 데이터 기반)
 */

const { generateWithAI } = require('../ai/aiProvider');
const { validatePriceWithDB, getPriceRange, isDomesticDestination } = require('./priceCrawlerService');

// ─── 가격 가이드라인 (대안 B: AI 프롬프트 강화) ─────────────────────────────
const PRICE_GUIDANCE_PROMPT = `
## 가격 가이드라인 (반드시 준수)

### 국내 여행 가격 범위 (1인 기준)
- 숙소 (1박):
  - 게스트하우스/모텔: 4만~8만원
  - 3성급 호텔: 8만~15만원
  - 4성급 호텔: 15만~25만원
  - 5성급 호텔: 25만~50만원

- 식비 (1끼):
  - 간단한 식사: 8천~1.5만원
  - 일반 식사: 1.5만~3만원
  - 고급 식당: 3만~10만원

- 교통:
  - KTX (서울↔부산): 5만~6만원
  - 국내선 항공: 4만~15만원
  - 렌터카 (1일): 5만~15만원

- 활동:
  - 입장료: 1만~5만원
  - 체험 프로그램: 3만~10만원

### 해외 여행 가격 범위 (1인 기준)
- 숙소 (1박):
  - 게스트하우스: 5만~10만원
  - 3성급 호텔: 10만~20만원
  - 4성급 호텔: 20만~40만원
  - 5성급 호텔: 40만~100만원

- 식비 (1끼):
  - 간단한 식사: 1만~2만원
  - 일반 식사: 2만~5만원
  - 고급 식당: 5만~20만원

### 절대 금지 사항
❌ 1만원 미만의 숙소 가격 제시 금지
❌ 5천원 미만의 식사 가격 제시 금지
❌ 1천원 미만의 어떤 가격도 제시 금지
❌ 숫자만 제시하지 말고 반드시 "원" 단위 포함

### 가격 표시 형식
✅ 올바른 예: pricePerNight: 150000, price: 50000
✅ 숫자는 반드시 원 단위 정수로 표기 (150000, 50000 등)
❌ 잘못된 예: 1544, 15.44, "15만원"
`;

// ─── 가격 검증 함수 ─────────────────────────────────────────────────────────
const PRICE_RANGES = {
  accommodation: {
    domestic: { min: 40000, max: 500000 },
    international: { min: 50000, max: 1000000 }
  },
  food: {
    domestic: { min: 8000, max: 100000 },
    international: { min: 10000, max: 200000 }
  },
  activities: {
    domestic: { min: 10000, max: 200000 },
    international: { min: 20000, max: 500000 }
  },
  transportation: {
    domestic: { min: 10000, max: 200000 },
    international: { min: 50000, max: 500000 }
  }
};

/**
 * AI 가격 검증 및 보정
 * @param {number|string} price - AI가 반환한 가격
 * @param {string} category - 'accommodation' | 'food' | 'activities' | 'transportation'
 * @param {boolean} isDomestic - 국내 여행 여부
 * @returns {number} 보정된 가격 (원 단위)
 */
function validateAndCorrectAIPrice(price, category, isDomestic = true) {
  // 1. 숫자 추출
  let numericPrice = typeof price === 'string'
    ? parseFloat(price.replace(/[,원만]/g, ''))
    : price;

  if (isNaN(numericPrice) || numericPrice <= 0) {
    console.error('⚠️ AI 가격이 유효하지 않음:', price);
    return PRICE_RANGES[category]?.[isDomestic ? 'domestic' : 'international']?.min || 50000;
  }

  const range = PRICE_RANGES[category]?.[isDomestic ? 'domestic' : 'international'];
  if (!range) {
    console.warn(`⚠️ 카테고리 ${category} 범위 미정의`);
    return numericPrice;
  }

  let correctedPrice = numericPrice;

  // 2. 단위 판단 및 보정
  if (numericPrice < 1000) {
    // 1000 미만 → 만원 단위로 해석
    console.log(`💰 가격 보정: ${numericPrice} → ${numericPrice * 10000}원 (만원 단위로 해석)`);
    correctedPrice = numericPrice * 10000;
  } else if (numericPrice < 10000) {
    // 1000~10000 → 범위로 판단
    const as백원 = numericPrice * 100;
    const as만원 = numericPrice * 10000;

    if (as백원 >= range.min && as백원 <= range.max) {
      console.log(`💰 가격 보정: ${numericPrice} → ${as백원}원 (백원 단위로 해석)`);
      correctedPrice = as백원;
    } else if (as만원 >= range.min && as만원 <= range.max) {
      console.log(`💰 가격 보정: ${numericPrice} → ${as만원}원 (만원 단위로 해석)`);
      correctedPrice = as만원;
    } else {
      // 범위 내 평균값 사용
      correctedPrice = Math.round((range.min + range.max) / 2);
      console.warn(`💰 가격 보정 불가: ${numericPrice} → 평균값 ${correctedPrice}원 사용`);
    }
  }

  // 3. 범위 검증
  if (correctedPrice < range.min) {
    console.warn(`⚠️ 가격 범위 미만: ${correctedPrice}원 < ${range.min}원 → 최소값으로 조정`);
    correctedPrice = range.min;
  } else if (correctedPrice > range.max) {
    console.warn(`⚠️ 가격 범위 초과: ${correctedPrice}원 > ${range.max}원 → 최대값으로 조정`);
    correctedPrice = range.max;
  }

  return Math.round(correctedPrice);
}

/**
 * AI 응답의 가격 필드 검증 (단위 보정 + DB 검증)
 * @param {Array} recommendations - AI 추천 목록
 * @param {string} category - 카테고리
 * @param {boolean} isDomestic - 국내 여행 여부
 * @param {string} destinationName - 목적지 이름 (DB 검증용)
 */
function validateRecommendationPrices(recommendations, category, isDomestic, destinationName = null) {
  if (!recommendations || !Array.isArray(recommendations)) return recommendations;

  return recommendations.map(rec => {
    const validated = { ...rec };

    // 숙소 가격
    if (rec.pricePerNight !== undefined) {
      let price = validateAndCorrectAIPrice(rec.pricePerNight, 'accommodation', isDomestic);
      // DB 검증 (목적지 정보가 있는 경우)
      if (destinationName) {
        const dbValidation = validatePriceWithDB(price, destinationName, 'accommodation');
        if (!dbValidation.valid && dbValidation.reason !== 'no_data') {
          console.log(`🔄 DB 검증 보정: ${price}원 → ${dbValidation.price}원`);
          price = dbValidation.price;
        }
      }
      validated.pricePerNight = price;
    }
    // 식비 가격
    if (rec.pricePerPerson !== undefined) {
      let price = validateAndCorrectAIPrice(rec.pricePerPerson, 'food', isDomestic);
      if (destinationName) {
        const dbValidation = validatePriceWithDB(price, destinationName, 'food');
        if (!dbValidation.valid && dbValidation.reason !== 'no_data') {
          console.log(`🔄 DB 검증 보정: ${price}원 → ${dbValidation.price}원`);
          price = dbValidation.price;
        }
      }
      validated.pricePerPerson = price;
    }
    // 일반 가격
    if (rec.price !== undefined) {
      let price = validateAndCorrectAIPrice(rec.price, category, isDomestic);
      if (destinationName) {
        const dbValidation = validatePriceWithDB(price, destinationName, category);
        if (!dbValidation.valid && dbValidation.reason !== 'no_data') {
          console.log(`🔄 DB 검증 보정: ${price}원 → ${dbValidation.price}원`);
          price = dbValidation.price;
        }
      }
      validated.price = price;
    }
    // 총 예상 비용
    if (rec.totalEstimate !== undefined) {
      validated.totalEstimate = validateAndCorrectAIPrice(rec.totalEstimate, category, isDomestic);
    }

    return validated;
  });
}

/**
 * 숙소 추천 (실제 호텔/숙박 정보)
 */
async function recommendAccommodation(projectData) {
  const { destination, budget, travelers, dates } = projectData;
  const isDomestic = destination?.country === '한국' || destination?.country === '대한민국' || destination?.country === 'Korea';

  const prompt = `당신은 여행 전문가입니다. 다음 여행 계획에 맞는 실제 숙소를 3개 추천해주세요.

${PRICE_GUIDANCE_PROMPT}

여행 정보:
- 목적지: ${destination?.name || destination} (${destination?.country || ''})
- 예산: ${budget?.categories?.accommodation?.allocated || budget?.total || '미정'}원
- 인원: ${travelers}명
- 기간: ${dates?.start || '미정'} ~ ${dates?.end || '미정'}

요구사항:
1. 실제 존재하는 호텔/숙소 이름과 위치를 추천해주세요
2. 각 숙소에 대해:
   - 정확한 숙소 이름과 위치 (구체적인 지역/거리)
   - 1박 평균 가격 (원화, 원 단위 정수로 표기. 예: 150000)
   - 추천 이유 (위치, 시설, 가성비 등)
   - 실제 사용자 리뷰 2-3개 (구체적이고 현실적인 내용)
   - 예약 가능 사이트 (Booking.com, Agoda, 에어비앤비 등)

JSON 형식으로 응답해주세요:
{
  "recommendations": [
    {
      "name": "호텔/숙소 이름",
      "location": "구체적인 위치 (지역/거리)",
      "pricePerNight": 150000,
      "totalEstimate": 450000,
      "rating": 4.5,
      "reason": "추천 이유 (2-3문장)",
      "reviews": [
        {"user": "사용자이름", "rating": 5, "comment": "리뷰 내용", "date": "2026-01"},
        {"user": "사용자이름", "rating": 4, "comment": "리뷰 내용", "date": "2026-01"}
      ],
      "bookingUrl": "예약 사이트 URL 또는 사이트명",
      "features": ["무료 와이파이", "조식 포함", "공항 픽업"]
    }
  ]
}`;

  try {
    const response = await generateWithAI(prompt, { useJSON: true });
    const parsed = JSON.parse(response);

    // 가격 검증 및 보정 (단위 + DB 검증)
    if (parsed.recommendations) {
      const destName = destination?.name || destination;
      parsed.recommendations = validateRecommendationPrices(
        parsed.recommendations,
        'accommodation',
        isDomestic,
        destName
      );
    }

    return parsed;
  } catch (err) {
    console.error('AI 숙소 추천 실패:', err);
    throw new Error('숙소 추천을 생성할 수 없습니다');
  }
}

/**
 * 식비 추천 (실제 레스토랑/맛집 정보)
 */
async function recommendFood(projectData) {
  const { destination, budget, travelers, dates } = projectData;
  const isDomestic = destination?.country === '한국' || destination?.country === '대한민국' || destination?.country === 'Korea';

  const prompt = `당신은 현지 맛집 전문가입니다. 다음 여행 계획에 맞는 실제 레스토랑/맛집을 3개 추천해주세요.

${PRICE_GUIDANCE_PROMPT}

여행 정보:
- 목적지: ${destination?.name || destination} (${destination?.country || ''})
- 예산: ${budget?.categories?.food?.allocated || budget?.total || '미정'}원
- 인원: ${travelers}명
- 기간: ${dates?.start || '미정'} ~ ${dates?.end || '미정'}

요구사항:
1. 실제 존재하는 레스토랑/맛집 이름과 위치를 추천해주세요
2. 각 식당에 대해:
   - 정확한 식당 이름과 위치 (구체적인 지역/거리)
   - 1인 평균 가격 (원화, 원 단위 정수로 표기. 예: 15000)
   - 대표 메뉴 3가지
   - 추천 이유 (맛, 분위기, 현지 특색 등)
   - 실제 사용자 리뷰 2-3개 (구체적이고 현실적인 음식 후기)
   - 운영 시간 및 예약 필요 여부

JSON 형식으로 응답해주세요:
{
  "recommendations": [
    {
      "name": "레스토랑 이름",
      "location": "구체적인 위치",
      "pricePerPerson": 15000,
      "totalEstimate": 60000,
      "cuisine": "음식 종류 (예: 이탈리안, 현지 요리)",
      "rating": 4.5,
      "reason": "추천 이유 (2-3문장)",
      "signature": ["대표메뉴1", "대표메뉴2", "대표메뉴3"],
      "reviews": [
        {"user": "사용자이름", "rating": 5, "comment": "음식 후기", "date": "2026-01"},
        {"user": "사용자이름", "rating": 4, "comment": "음식 후기", "date": "2026-01"}
      ],
      "hours": "영업시간 (예: 11:00-22:00)",
      "reservation": true
    }
  ]
}`;

  try {
    const response = await generateWithAI(prompt, { useJSON: true });
    const parsed = JSON.parse(response);

    // 가격 검증 및 보정 (단위 + DB 검증)
    if (parsed.recommendations) {
      const destName = destination?.name || destination;
      parsed.recommendations = validateRecommendationPrices(
        parsed.recommendations,
        'food',
        isDomestic,
        destName
      );
    }

    return parsed;
  } catch (err) {
    console.error('AI 식비 추천 실패:', err);
    throw new Error('식비 추천을 생성할 수 없습니다');
  }
}

/**
 * 활동 추천 (실제 관광지/체험 정보)
 */
async function recommendActivity(projectData) {
  const { destination, budget, travelers, dates } = projectData;
  const isDomestic = destination?.country === '한국' || destination?.country === '대한민국' || destination?.country === 'Korea';

  const prompt = `당신은 여행 활동 전문가입니다. 다음 여행 계획에 맞는 실제 관광지/체험 활동을 3개 추천해주세요.

${PRICE_GUIDANCE_PROMPT}

여행 정보:
- 목적지: ${destination?.name || destination} (${destination?.country || ''})
- 예산: ${budget?.categories?.activities?.allocated || budget?.total || '미정'}원
- 인원: ${travelers}명
- 기간: ${dates?.start || '미정'} ~ ${dates?.end || '미정'}

요구사항:
1. 실제 존재하는 관광지/체험 활동 이름과 위치를 추천해주세요
2. 각 활동에 대해:
   - 정확한 장소/활동 이름과 위치
   - 입장료 또는 체험 비용 (원화, 원 단위 정수로 표기. 예: 30000)
   - 소요 시간
   - 추천 이유 (특색, 경험, 가치 등)
   - 실제 사용자 리뷰 2-3개 (구체적인 체험 후기)
   - 예약 방법 및 운영 시간

JSON 형식으로 응답해주세요:
{
  "recommendations": [
    {
      "name": "활동/관광지 이름",
      "location": "구체적인 위치",
      "price": 30000,
      "duration": "소요 시간 (예: 2-3시간)",
      "type": "활동 유형 (예: 문화체험, 자연관광, 액티비티)",
      "rating": 4.5,
      "reason": "추천 이유 (2-3문장)",
      "reviews": [
        {"user": "사용자이름", "rating": 5, "comment": "체험 후기", "date": "2026-01"},
        {"user": "사용자이름", "rating": 4, "comment": "체험 후기", "date": "2026-01"}
      ],
      "bookingMethod": "예약 방법 (현장 구매 / 온라인 예약 필수)",
      "hours": "운영시간",
      "tips": ["팁1", "팁2"]
    }
  ]
}`;

  try {
    const response = await generateWithAI(prompt, { useJSON: true });
    const parsed = JSON.parse(response);

    // 가격 검증 및 보정 (단위 + DB 검증)
    if (parsed.recommendations) {
      const destName = destination?.name || destination;
      parsed.recommendations = validateRecommendationPrices(
        parsed.recommendations,
        'activities',
        isDomestic,
        destName
      );
    }

    return parsed;
  } catch (err) {
    console.error('AI 활동 추천 실패:', err);
    throw new Error('활동 추천을 생성할 수 없습니다');
  }
}

/**
 * 교통 추천 (실제 이동 수단 정보)
 */
async function recommendTransportation(projectData) {
  const { destination, budget, travelers, dates } = projectData;
  const isDomestic = destination?.country === '한국' || destination?.country === '대한민국' || destination?.country === 'Korea';

  const prompt = `당신은 여행 교통 전문가입니다. 다음 여행 계획에 맞는 실제 교통 수단을 3가지 추천해주세요.

${PRICE_GUIDANCE_PROMPT}

여행 정보:
- 목적지: ${destination?.name || destination} (${destination?.country || ''})
- 예산: ${budget?.categories?.transportation?.allocated || budget?.total || '미정'}원
- 인원: ${travelers}명
- 기간: ${dates?.start || '미정'} ~ ${dates?.end || '미정'}

요구사항:
1. 현실적인 교통 수단을 추천해주세요 (항공, 렌터카, 대중교통 등)
2. 각 교통 수단에 대해:
   - 정확한 교통 수단 이름 (항공사, 렌터카 회사, 교통 패스 등)
   - 예상 비용 (원화, 원 단위 정수로 표기. 예: 55000)
   - 추천 이유 (편의성, 가성비, 자유도 등)
   - 실제 사용자 리뷰 2-3개 (구체적인 이용 후기)
   - 예약 방법 및 주의사항

JSON 형식으로 응답해주세요:
{
  "recommendations": [
    {
      "name": "교통수단 이름",
      "type": "항공/렌터카/기차/버스/택시",
      "price": 55000,
      "provider": "제공업체 (예: 대한항공, 허츠렌터카)",
      "rating": 4.5,
      "reason": "추천 이유 (2-3문장)",
      "reviews": [
        {"user": "사용자이름", "rating": 5, "comment": "이용 후기", "date": "2026-01"},
        {"user": "사용자이름", "rating": 4, "comment": "이용 후기", "date": "2026-01"}
      ],
      "bookingMethod": "예약 방법",
      "tips": ["팁1", "팁2"],
      "duration": "이동 시간 (해당시)"
    }
  ]
}`;

  try {
    const response = await generateWithAI(prompt, { useJSON: true });
    const parsed = JSON.parse(response);

    // 가격 검증 및 보정 (단위 + DB 검증)
    if (parsed.recommendations) {
      const destName = destination?.name || destination;
      parsed.recommendations = validateRecommendationPrices(
        parsed.recommendations,
        'transportation',
        isDomestic,
        destName
      );
    }

    return parsed;
  } catch (err) {
    console.error('AI 교통 추천 실패:', err);
    throw new Error('교통 추천을 생성할 수 없습니다');
  }
}

/**
 * 통합 추천 생성 (카테고리별)
 */
async function generateRecommendations(category, projectData) {
  let result;

  switch (category) {
    case 'accommodation':
    case '숙소':
      result = await recommendAccommodation(projectData);
      break;
    case 'food':
    case '식비':
      result = await recommendFood(projectData);
      break;
    case 'activities':
    case '활동':
      result = await recommendActivity(projectData);
      break;
    case 'transportation':
    case '교통':
      result = await recommendTransportation(projectData);
      break;
    default:
      throw new Error(`지원하지 않는 카테고리: ${category}`);
  }

  return {
    category,
    ...result,
    generatedAt: new Date().toISOString(),
    projectInfo: {
      destination: projectData.destination?.name || projectData.destination,
      budget: projectData.budget,
      travelers: projectData.travelers,
      dates: projectData.dates
    }
  };
}

module.exports = {
  recommendAccommodation,
  recommendFood,
  recommendActivity,
  recommendTransportation,
  generateRecommendations
};
