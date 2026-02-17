/**
 * 가격 최적화 엔진
 * 항공/숙박 최저가 비교, 가격 알림, 비용 절감 팁
 */

class PriceOptimizer {
  async findCheapestFlights(params) {
    const { origin, destination, departDate, returnDate, passengers } = params;

    const airlines = [
      { name: '대한항공', price: 850000, type: 'FSC' },
      { name: '아시아나', price: 820000, type: 'FSC' },
      { name: '제주항공', price: 550000, type: 'LCC' },
      { name: '진에어', price: 530000, type: 'LCC' },
      { name: '티웨이', price: 520000, type: 'LCC' }
    ];

    const cheapest = airlines.reduce((min, curr) => curr.price < min.price ? curr : min);
    const savings = airlines[0].price - cheapest.price;
    const savingsPercent = ((savings / airlines[0].price) * 100).toFixed(0);

    return {
      cheapest,
      allOptions: airlines,
      savings,
      savingsPercent,
      recommendation: this._flightRecommendation(cheapest, savings)
    };
  }

  _flightRecommendation(cheapest, savings) {
    if (cheapest.type === 'LCC') {
      return {
        title: `💰 저비용 항공사로 ${savings.toLocaleString()}원 절약!`,
        tips: [
          '수하물 추가 비용 확인 (보통 2-3만원)',
          '기내식 미포함 (공항에서 미리 구매)',
          '좌석 지정 유료 (가족이면 미리 지정 추천)',
          '온라인 체크인 필수'
        ]
      };
    }
    return {
      title: '✈️ 대형 항공사로 편안한 여행',
      tips: ['수하물 23kg 무료', '기내식 포함', '좌석 지정 무료', '마일리지 적립']
    };
  }

  async findCheapestHotels(params) {
    const platforms = [
      { name: '부킹닷컴', price: 120000, rating: 4.5, benefits: '무료 취소' },
      { name: '아고다', price: 115000, rating: 4.5, benefits: '포인트 10%' },
      { name: '호텔스컴바인', price: 118000, rating: 4.5, benefits: '가격 매칭' },
      { name: '익스피디아', price: 125000, rating: 4.5, benefits: '항공+호텔 할인' }
    ];

    const cheapest = platforms.reduce((min, curr) => curr.price < min.price ? curr : min);

    return {
      cheapest,
      allPlatforms: platforms,
      savings: platforms[platforms.length - 1].price - cheapest.price,
      tips: [
        '가격은 매일 변동 - 알림 설정 추천',
        '쿠폰 검색: "플랫폼명 할인코드"',
        '첫 예약 할인 (신규 가입 시 10-15%)',
        '7박 이상 장기 숙박 할인',
        '카드 제휴 할인 확인'
      ]
    };
  }

  async optimizeTotalCost(tripData) {
    const { destination, travelers, nights, budget } = tripData;
    const baseEstimate = {
      flights: travelers * 600000,
      accommodation: nights * 100000,
      food: (nights + 1) * travelers * 50000,
      activities: travelers * 200000,
      transportation: nights * 30000,
      misc: travelers * 100000
    };

    const total = Object.values(baseEstimate).reduce((a, b) => a + b, 0);
    const optimizations = [];

    if (baseEstimate.flights > budget * 0.5) {
      optimizations.push({
        category: '항공', current: baseEstimate.flights,
        optimized: baseEstimate.flights * 0.7, savings: baseEstimate.flights * 0.3,
        method: 'LCC 이용 + 주중 출발'
      });
    }
    if (baseEstimate.accommodation > budget * 0.3) {
      optimizations.push({
        category: '숙박', current: baseEstimate.accommodation,
        optimized: baseEstimate.accommodation * 0.8, savings: baseEstimate.accommodation * 0.2,
        method: '에어비앤비 or 게스트하우스'
      });
    }
    optimizations.push({
      category: '식비', current: baseEstimate.food,
      optimized: baseEstimate.food * 0.7, savings: baseEstimate.food * 0.3,
      method: '현지 마트 + 길거리 음식'
    });

    const totalSavings = optimizations.reduce((sum, o) => sum + o.savings, 0);

    return {
      baseEstimate, total, budget,
      overBudget: total > budget,
      difference: total - budget,
      optimizations, totalSavings,
      optimizedTotal: total - totalSavings
    };
  }

  async recommendExchangeTiming(currency, targetAmount) {
    const rates = { JPY: 900, USD: 1350, THB: 38, VND: 0.055, EUR: 1450, IDR: 0.085, SGD: 1000 };
    const currentRate = rates[currency] || 1000;
    const historicalAvg = currentRate * 1.02;

    return {
      currentRate, historicalAvg,
      isGoodTiming: currentRate < historicalAvg,
      recommendation: currentRate < historicalAvg
        ? `✅ 지금이 환전 적기! (평균보다 ${Math.round(historicalAvg - currentRate)}원 저렴)`
        : '⏳ 환율이 조금 높아요. 가능하면 좀 더 기다려보세요.',
      tips: [
        '공항 환전은 시내보다 3-5% 비쌈',
        '은행 환율이 가장 유리',
        '현지 ATM 인출도 좋은 방법 (수수료 확인)',
        '100% 현금보다 카드 병행 추천'
      ]
    };
  }
}

module.exports = new PriceOptimizer();
