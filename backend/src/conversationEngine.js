/**
 * 대화형 AI 컨설팅 엔진
 * 상태 머신: GREETING → GATHERING → DEEPENING → RECOMMENDING → SELECTING → COMPLETE
 */

const { destinations, findDestinations } = require('./destinationDB');
const { generateAIResponse, getActiveProvider } = require('./ai/aiProvider');

// 대화 상태
const STATES = {
  GREETING: 'GREETING',
  GATHERING: 'GATHERING',
  DEEPENING: 'DEEPENING',
  RECOMMENDING: 'RECOMMENDING',
  SELECTING: 'SELECTING',
  COMPLETE: 'COMPLETE'
};

// 세션 저장소
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      state: STATES.GREETING,
      messageCount: 0,
      context: {
        travelType: null,  // 'package' | 'free' | null
        travelStyle: null,
        budget: null,
        budgetAmount: null,
        travelers: null,
        travelerDetails: null,
        duration: null,
        flightTime: null,
        purpose: null,
        preferences: [],
        constraints: [],
        keywords: []
      },
      history: [],
      recommendations: []
    });
  }
  return sessions.get(sessionId);
}

function buildSystemPrompt(session) {
  const ctx = session.context;
  const travelerCount = ctx.travelerCount || 2;

  // 거주 도시 정보
  let homeCityGuidance = '';
  if (session.homeCity || session.homeCountry) {
    homeCityGuidance = `
## 🏠 사용자 거주 정보
- 거주 국가: ${session.homeCountry || '알 수 없음'}
- 거주 도시: ${session.homeCity || '알 수 없음'}
- **사용자의 거주 도시(${session.homeCity})는 절대 여행지로 추천하지 마세요**
- **거주 국가가 ${session.homeCountry}이면, 해당 국가 내 여행은 국내 여행으로 처리하세요**`;
  }

  // 예산 정보를 명확하게 계산
  let budgetGuidance = '';
  if (ctx.budgetAmount) {
    const perPersonBudget = Math.floor(ctx.budgetAmount / travelerCount);
    const totalBudget = ctx.budgetAmount;
    budgetGuidance = `
## 🚨 중요: 예산 제약
- 사용자가 입력한 총 예산: ${totalBudget.toLocaleString()}원
- 여행 인원: ${travelerCount}명
- **1인당 예산: ${perPersonBudget.toLocaleString()}원**
- **반드시 1인당 ${perPersonBudget.toLocaleString()}원 이하의 여행지만 추천하세요**
- 예산을 초과하는 여행지는 절대 추천하지 마세요`;
  }

  return `당신은 "여행이"라는 이름의 전문 AI 여행 컨설턴트입니다.

## 역할
- 자연스럽고 친근한 대화로 사용자의 여행 니즈를 파악합니다
- 한 번에 너무 많은 질문을 하지 말고, 2-3개씩 자연스럽게 물어보세요
- 사용자 답변에서 핵심 정보를 추출합니다
- 충분한 정보가 모이면 **전 세계 어디든** 최적의 목적지를 추천합니다
- **DB에 제한되지 않습니다. 사용자 니즈에 가장 잘 맞는 곳이면 어디든 추천하세요**
- 🚨 **사용자가 특정 국가/도시를 명확히 언급하면 반드시 그 지역만 추천하세요** (예: "터키"라고 하면 터키만, "일본"이라고 하면 일본만)
- 🚨 **사용자가 원하지 않은 국가/도시는 절대 추천하지 마세요**
${homeCityGuidance}
${budgetGuidance}

## 대화에서 파악할 정보 (중요도순)
1. 여행 형태: 패키지 여행 vs 자유여행 (이걸 먼저 파악하거나 자연스럽게 물어보세요)
2. 여행 목적/스타일 (힐링, 맛집, 관광, 액티비티 등)
3. 동행인 (혼자, 커플, 가족, 친구) + 가족이면 구성원 상세
4. 예산 범위
5. 여행 기간
6. 선호/비선호 사항

## 패키지 vs 자유여행 차이
- 패키지: 항공+숙소+식사+관광 일괄 포함, 가이드 동행, 가격 저렴하지만 일정 고정
- 자유여행: 항공/숙소/활동 개별 예약, 일정 자유, 비용 더 들 수 있지만 유연함
- 추천 시 사용자가 선택한 형태에 맞춰 비용과 일정을 다르게 제안하세요
- 패키지는 "1인 패키지 비용"으로, 자유여행은 "항공+숙소+활동 분리 비용"으로 안내

## 현재 대화 상태: ${session.state}
## 파악된 컨텍스트: ${JSON.stringify(session.context)}
## 대화 횟수: ${session.messageCount}회

## 응답 규칙 🚨 중요
- **반드시 100% 한국어로만 답변하세요** (중국어, 일본어, 영어 절대 금지)
- **한자(漢字)를 절대 사용하지 마세요. 순수 한글만 사용하세요**
- 이모지 적절히 사용
- 답변은 2-4문장으로 간결하게
- 질문은 한 번에 2-3개 이하

## 상태별 행동
- GREETING: 반갑게 인사 + 여행 계획에 대해 자유롭게 질문
- GATHERING: 핵심 정보 수집 (여행 스타일, 동행인, 예산)
- DEEPENING: 세부 사항 파악 (기간, 선호도, 제약사항)
- RECOMMENDING: 3개 목적지 추천 (반드시 아래 JSON 형식으로 끝에 추가)

## 추천 시 JSON 형식 (RECOMMENDING 상태에서만)
**🚨 중요: 사용자가 특정 국가/도시를 언급했다면, 반드시 그 국가/도시 내에서만 3개 목적지를 추천하세요.**
**예시: "터키 여행"이라고 하면 → 이스탄불, 카파도키아, 안탈리아 (모두 터키 내)**
**예시: "일본 여행"이라고 하면 → 도쿄, 오사카, 교토 (모두 일본 내)**
**사용자가 국가를 지정하지 않았을 때만 전 세계 어디든 추천 가능합니다.**
DB나 기존 데이터에 제한되지 마세요. 창의적으로 최적의 여행지를 선정하세요.

대화 답변 뒤에 반드시 다음 JSON을 추가하세요:
\`\`\`json
{"recommendations": [
  {"id": "turkey", "name": "이스탄불", "country": "튀르키예", "flag": "🇹🇷", "matchScore": 95, "reason": "맞춤 추천 이유", "estimatedCost": 1500000, "estimatedCostUSD": 1150, "packageCost": 1200000, "packageCostUSD": 920, "highlights": ["카파도키아 열기구", "아야 소피아", "그랜드 바자르", "파묵칼레"], "bestSeason": "4-6월, 9-11월", "currency": "TRY"},
  {"id": "santorini", "name": "산토리니", "country": "그리스", "flag": "🇬🇷", "matchScore": 88, "reason": "맞춤 추천 이유", "estimatedCost": 2000000, "estimatedCostUSD": 1540, "packageCost": 1600000, "packageCostUSD": 1230, "highlights": ["이아 석양", "블루돔 교회", "화산섬 투어"], "bestSeason": "5-10월", "currency": "EUR"},
  {"id": "danang", "name": "다낭", "country": "베트남", "flag": "🇻🇳", "matchScore": 82, "reason": "맞춤 추천 이유", "estimatedCost": 700000, "estimatedCostUSD": 540, "packageCost": 550000, "packageCostUSD": 420, "highlights": ["미케비치", "바나힐", "호이안"], "bestSeason": "2-5월", "currency": "VND"}
]}
\`\`\`
- id: 영문 소문자 (도시명 기반)
- name: 한글 도시명
- country: 한글 국가명
- flag: 국기 이모지
- estimatedCost: 자유여행 1인 예상비용(원화, 숫자만) ${ctx.budgetAmount ? `**예산: 1인당 ${Math.floor(ctx.budgetAmount / travelerCount).toLocaleString()}원 이하로 설정할 것**` : ''}
- estimatedCostUSD: 자유여행 1인 예상비용(달러, 숫자만)
- packageCost: 패키지 1인 예상비용(원화, 숫자만). 보통 자유여행보다 15-25% 저렴
- packageCostUSD: 패키지 1인 예상비용(달러, 숫자만)
- highlights: 주요 명소 3-4개
- bestSeason: 추천 여행 시기
- currency: 현지 통화 코드 (USD, EUR, JPY, VND 등)`;
}

function extractContext(message, context) {
  const lower = message.toLowerCase();
  const updated = { ...context };

  // 여행 스타일 추출
  const styleMap = {
    '바다': 'beach', '해변': 'beach', '비치': 'beach', '수영': 'beach',
    '힐링': 'relaxation', '휴양': 'relaxation', '쉬고': 'relaxation', '편히': 'relaxation',
    '맛집': 'food', '먹방': 'food', '음식': 'food', '먹을거리': 'food', '맛있': 'food',
    '쇼핑': 'shopping', '면세': 'shopping',
    '관광': 'city', '도시': 'city', '구경': 'city',
    '자연': 'nature', '산': 'nature', '숲': 'nature', '트레킹': 'nature',
    '놀거리': 'adventure', '액티비티': 'adventure', '체험': 'adventure', '놀이': 'adventure',
    '문화': 'culture', '역사': 'culture', '사원': 'culture', '박물관': 'culture'
  };
  for (const [keyword, style] of Object.entries(styleMap)) {
    if (lower.includes(keyword)) {
      if (!updated.preferences.includes(style)) updated.preferences.push(style);
      if (!updated.travelStyle) updated.travelStyle = style;
    }
  }

  // 여행 형태 추출 (패키지 vs 자유여행)
  if (/패키지|단체.*여행|투어.*상품|여행사|가이드/.test(lower)) {
    updated.travelType = 'package';
  } else if (/자유.*여행|자유.*일정|개별.*여행|배낭|직접.*예약|에어비앤비/.test(lower)) {
    updated.travelType = 'free';
  }

  // 동행인 추출
  if (/가족|아이|아들|딸|부모님|엄마|아빠|자녀|어른|초등|중등|고등|유아|영아/.test(lower)) {
    updated.travelers = 'family';
  } else if (/커플|여자친구|남자친구|신혼|둘이/.test(lower)) {
    updated.travelers = 'couple';
  } else if (/친구|동료|단체/.test(lower)) {
    updated.travelers = 'friends';
  } else if (/혼자|나홀로|솔로/.test(lower)) {
    updated.travelers = 'solo';
  }

  // 인원수 추출 (예: "4명", "가족 4명") - 마지막 언급된 인원수를 사용
  // 예: "처음에는 9명이었는데 4명만 가게 됐어" → 4명 추출
  const memberMatches = lower.match(/(\d+)\s*명/g);
  if (memberMatches && memberMatches.length > 0) {
    // 가장 마지막 언급된 인원수 사용 (사용자의 최종 의도 반영)
    const lastMatch = memberMatches[memberMatches.length - 1];
    const numMatch = lastMatch.match(/(\d+)/);
    if (numMatch) {
      const count = parseInt(numMatch[1]);
      // 합리적인 범위인지 확인 (1~20명)
      if (count >= 1 && count <= 20) {
        updated.travelerCount = count;
        console.log(`📊 인원수 추출: ${count}명 (from "${lastMatch}")`);
        if (count >= 3) updated.travelers = updated.travelers || 'family';
      }
    }
  }

  // 여행자 상세 추출 (어른, 고등학생, 초등학생 등)
  if (/어른|성인|고등|중학|초등|유치원|살|학년|학생/.test(lower)) {
    updated.travelerDetails = message;
    // "어른 2명, 고등학생 1명, 초등학생 1명" 패턴에서 인원수 합산
    // 주의: "초등6학년"에서 6은 학년이지 인원수가 아님 → "N명" 패턴만 인식
    const detailMatches = lower.match(/(?:어른|성인|고등학생?|중학생?|초등학생?|유치원생?|아이|유아|영아|학생)\s*\d*\s*(?:학년\s*)?(\d+)\s*명/g);
    if (detailMatches) {
      let total = 0;
      detailMatches.forEach(n => {
        // "초등6학년 1명" → 마지막 숫자+명 패턴에서 인원수만 추출
        const m = n.match(/(\d+)\s*명/);
        if (m) total += parseInt(m[1]);
      });
      if (total > 0) {
        updated.travelerCount = total;
        if (total >= 3) updated.travelers = 'family';
        console.log(`📊 상세 인원수 추출: ${total}명 (from detail parsing)`);
      }
    }
  }

  // 예산 추출 - 다양한 패턴 지원
  // "300만원", "300만", "총 800", "800", "예산 500"
  const budgetMatch1 = lower.match(/(\d+)\s*만\s*원?/);  // 300만원, 300만
  const budgetMatch2 = lower.match(/(?:총|예산|비용|돈|budget)\s*(\d+)/);  // 총 800, 예산 500
  const budgetMatch3 = lower.match(/^(\d{2,4})$/);  // 숫자만 입력 (800, 1000)

  if (budgetMatch1) {
    const amount = parseInt(budgetMatch1[1]) * 10000;
    updated.budgetAmount = amount;
  } else if (budgetMatch2) {
    const num = parseInt(budgetMatch2[1]);
    // 100 이상이면 만원 단위로 해석 (800 → 800만원)
    const amount = num >= 100 ? num * 10000 : num * 10000;
    updated.budgetAmount = amount;
  } else if (budgetMatch3) {
    const num = parseInt(budgetMatch3[1]);
    const amount = num * 10000;
    updated.budgetAmount = amount;
  }

  if (updated.budgetAmount) {
    if (updated.budgetAmount <= 1000000) updated.budget = 'low';
    else if (updated.budgetAmount <= 3000000) updated.budget = 'medium';
    else updated.budget = 'high';
  }
  if (/저렴|싸게|가성비|알뜰/.test(lower)) updated.budget = 'low';
  if (/럭셔리|호화|비싸도|프리미엄/.test(lower)) updated.budget = 'high';

  // 기간 추출 - 더 다양한 패턴
  const durationMatch1 = lower.match(/(\d+)\s*박\s*(\d+)\s*일/);  // 3박4일
  const durationMatch2 = lower.match(/(\d+)\s*[박]/);  // 3박
  const durationMatch3 = lower.match(/(\d+)\s*[일]/);  // 8일
  if (durationMatch1) {
    updated.duration = durationMatch1[0];
  } else if (durationMatch2) {
    updated.duration = durationMatch2[0];
  } else if (durationMatch3) {
    updated.duration = durationMatch3[0];
  }
  if (/짧게|당일|주말/.test(lower)) updated.flightTime = 'short';
  if (/멀어도|장거리/.test(lower)) updated.flightTime = 'long';

  // 목적지 감지 - DB의 목적지명과 매칭
  const destNames = ['도쿄', '오사카', '후쿠오카', '삿포로', '오키나와', '교토', '방콕', '다낭', '호치민', '나트랑', '싱가포르', '발리', '세부', '타이베이', '홍콩', '괌', '사이판', '하와이', '파리', '런던', '로마', '바르셀로나', '이스탄불', '뉴욕', '시드니', '제주도', '부산', '강릉', '여수', '경주', '전주', '속초', '통영', '산토리니', '프라하', '비엔나', '뮌헨', '취리히', '두바이', '몰디브', '호이안', '푸켓', '치앙마이', '쿠알라룸푸르', '카파도키아'];
  for (const name of destNames) {
    if (lower.includes(name.toLowerCase())) {
      updated.destination = name;
      break;
    }
  }
  // "결정", "갈래", "거기로" 등 확정 표현 + 이전에 언급된 목적지
  if (/결정|확정|갈래|거기로|그곳으로|가자|가고싶|로 할게/.test(lower) && !updated.destination && context.destination) {
    updated.destination = context.destination;
  }

  // 키워드 수집
  const keywords = message.match(/[가-힣]{2,}/g) || [];
  updated.keywords = [...new Set([...updated.keywords, ...keywords])];

  return updated;
}

function determineNextState(session) {
  const ctx = session.context;
  const gathered = [ctx.travelStyle, ctx.travelers, ctx.budget, ctx.duration]
    .filter(Boolean).length;

  // 목적지를 이미 결정한 경우 바로 추천
  if (ctx.destination && session.messageCount >= 2) {
    return STATES.RECOMMENDING;
  }
  // 정보가 충분하면 빠르게 추천 (최소 2회 대화 + 2개 정보)
  if (session.messageCount >= 2 && gathered >= 2) {
    return STATES.RECOMMENDING;
  }
  // 또는 3회 대화 + 1개 정보면 추천
  if (session.messageCount >= 3 && gathered >= 1) {
    return STATES.RECOMMENDING;
  }
  if (session.messageCount >= 1 && gathered >= 1) {
    return STATES.DEEPENING;
  }
  if (session.messageCount >= 1) {
    return STATES.GATHERING;
  }
  return STATES.GREETING;
}

async function generateMockResponse(session, userMessage) {
  const ctx = session.context;
  const state = session.state;
  const lower = userMessage.toLowerCase();
  const msgCount = session.messageCount;

  // ─── GATHERING: 컨텍스트 인식 자연스러운 응답 ─────────
  if (state === STATES.GATHERING) {
    return generateGatheringResponse(ctx, lower, msgCount);
  }

  // ─── DEEPENING: 파악된 정보 기반 심화 질문 ────────────
  if (state === STATES.DEEPENING) {
    return generateDeepeningResponse(ctx, lower, msgCount);
  }

  // ─── RECOMMENDING: 추천 ────────────────────────────
  if (state === STATES.RECOMMENDING) {
    const recs = await generateMockRecommendations(ctx);
    session.recommendations = recs;

    // 컨텍스트에 맞는 추천 멘트
    let intro = '말씀하신 내용을 종합해서 분석해봤어요! 🔍\n\n';
    if (ctx.travelers === 'family') {
      intro += '가족 모두가 즐길 수 있는 곳으로 골라봤습니다 👨‍👩‍👧‍👦\n\n';
    } else if (ctx.travelers === 'couple') {
      intro += '둘이서 로맨틱한 시간을 보낼 수 있는 곳이에요 💑\n\n';
    } else if (ctx.preferences.includes('beach')) {
      intro += '바다가 아름다운 곳 위주로 추천드려요 🏖️\n\n';
    } else if (ctx.preferences.includes('food')) {
      intro += '맛집이 많은 곳들로 엄선했어요 🍽️\n\n';
    }

    const count = ctx.travelerCount || 2;
    const recText = recs.map((r, i) => {
      const medal = ['🥇', '🥈', '🥉'][i];
      const total = (r.estimatedCost * count).toLocaleString();
      const perPerson = r.estimatedCost.toLocaleString();
      return `${medal} **${r.flag} ${r.name}** (매칭 ${r.matchScore}%)\n${r.reason}\n💰 ${count}인 총 ${total}원 (1인 ${perPerson}원)`;
    }).join('\n\n');

    // 예산 정보 추가
    let budgetNote = '';
    if (ctx.budgetAmount) {
      const maxPerPerson = Math.floor(ctx.budgetAmount / count);
      budgetNote = `\n\n💡 입력하신 예산: ${count}인 총 ${ctx.budgetAmount.toLocaleString()}원 (1인 ${maxPerPerson.toLocaleString()}원)\n   위 추천은 모두 예산 내에서 가능한 여행지예요!`;
    }

    return `${intro}${recText}${budgetNote}\n\n마음에 드는 곳이 있으면 알려주세요! 선택하시면 바로 세부 일정을 짜드릴게요 ✨`;
  }

  // ─── 기본 (GREETING 등) ────────────────────────────
  return `안녕하세요! 저는 **여행이**, AI 여행 컨설턴트예요 ✈️\n\n어떤 여행을 꿈꾸고 계세요? 자유롭게 이야기해 주세요! 😊`;
}

// ─── GATHERING 상태 응답 생성 ─────────────────────────
function generateGatheringResponse(ctx, lower, msgCount) {
  const parts = [];

  // 1) 사용자 입력에 대한 리액션 (공감/확인)
  if (ctx.preferences.includes('beach') || ctx.preferences.includes('relaxation')) {
    parts.push(pick([
      '바다에서 힐링하는 여행, 너무 좋죠! 🌊',
      '파도 소리 들으며 쉬는 거, 상상만 해도 좋네요 🏖️',
      '해변 여행이라니 벌써 설레요! ☀️'
    ]));
  } else if (ctx.preferences.includes('food')) {
    parts.push(pick([
      '맛있는 거 먹으러 가는 여행, 최고죠! 🤤',
      '미식 여행이라니 저도 군침 돕니다 🍜',
      '현지 음식 탐방이 여행의 꽃이죠! 😋'
    ]));
  } else if (ctx.preferences.includes('shopping')) {
    parts.push(pick([
      '쇼핑 여행! 면세점 털 준비 되셨나요? 🛍️',
      '쇼핑 리스트 미리 준비하면 효율 200%예요 💳'
    ]));
  } else if (ctx.preferences.includes('adventure') || ctx.preferences.includes('nature')) {
    parts.push(pick([
      '액티비티를 좋아하시는군요! 모험가시네요 🏄',
      '자연 속에서 즐기는 여행, 정말 좋은 선택이에요 🌿'
    ]));
  } else if (ctx.preferences.includes('culture')) {
    parts.push(pick([
      '문화 탐방 여행, 깊이 있는 여행이 되겠네요 🏛️',
      '역사와 문화를 느끼는 여행, 멋져요! ⛩️'
    ]));
  } else if (ctx.travelers === 'family') {
    parts.push(pick([
      '가족 여행! 아이들이랑 추억 만들기 딱이죠 👨‍👩‍👧‍👦',
      '가족이 함께하는 여행은 특별하죠! 온 가족이 다 즐길 수 있게 준비해볼게요 🥰'
    ]));
  } else if (ctx.travelers === 'couple') {
    parts.push(pick([
      '둘이서 떠나는 여행, 로맨틱하겠네요 💕',
      '커플 여행이면 분위기 좋은 곳으로 추천해드릴게요 💑'
    ]));
  } else if (ctx.travelers === 'friends') {
    parts.push(pick([
      '친구들이랑 여행! 신나겠다 🎉',
      '친구들과 함께면 어디든 재밌죠! 🤜🤛'
    ]));
  } else {
    parts.push(pick([
      '오, 좋은 계획이에요! 👍',
      '재밌는 여행이 될 것 같아요! ✨',
      '알겠어요, 좋은 곳 찾아드릴게요! 😊'
    ]));
  }

  // 2) 빠진 정보를 자연스럽게 질문
  parts.push('');  // 줄바꿈

  if (!ctx.travelers && !ctx.budget && !ctx.duration) {
    // 아직 핵심 정보 없음 → 넓게 질문
    parts.push(pick([
      '좀 더 알려주시면 딱 맞는 곳을 찾아드릴 수 있어요!\n• 누구랑 가세요? 혼자? 가족? 친구?\n• 대략 예산은 어느 정도 생각하세요?',
      '맞춤 추천을 위해 몇 가지만 더 알려주세요 🙏\n• 같이 가는 분이 있으세요?\n• 예산 범위가 있으면 알려주세요!',
    ]));
  } else if (!ctx.travelers) {
    parts.push(pick([
      '혹시 누구랑 함께 가시나요? 혼자, 커플, 가족, 친구... 동행자에 따라 추천이 달라져요!',
      '같이 가시는 분이 있으세요? 동행 인원을 알면 더 잘 맞춰드릴 수 있어요 😊'
    ]));
  } else if (!ctx.budget) {
    parts.push(pick([
      '예산은 어느 정도 생각하세요? 대략적으로만 알려주셔도 돼요! (예: 100만원, 가성비, 럭셔리...)',
      '혹시 1인당 예산이 있으세요? 맞춤 추천에 큰 도움이 돼요 💰'
    ]));
  } else if (!ctx.duration) {
    parts.push(pick([
      '며칠 정도 여행하실 계획이에요? 짧게 주말 여행도 좋고, 길게 일주일도 좋죠!',
      '여행 기간은 어떻게 되세요? 기간에 따라 추천 목적지가 달라져요 📅'
    ]));
  } else {
    // 핵심 다 있음 → 선호도 질문
    parts.push(pick([
      '거의 파악됐어요! 😄 혹시 이전에 가봤던 해외여행 중 좋았던 곳이 있어요?',
      '좋아요, 잘 정리되고 있어요! 꼭 하고 싶은 활동이 있으면 알려주세요 (수영, 쇼핑, 맛집 등)',
    ]));
  }

  return parts.join('\n');
}

// ─── DEEPENING 상태 응답 생성 ─────────────────────────
function generateDeepeningResponse(ctx, lower, msgCount) {
  const parts = [];

  // 파악된 정보 요약
  const summary = [];
  if (ctx.travelStyle) {
    const styleNames = { beach: '바다/해변', relaxation: '힐링', food: '맛집', shopping: '쇼핑', city: '도시관광', nature: '자연', adventure: '액티비티', culture: '문화/역사' };
    summary.push(`여행 스타일: ${ctx.preferences.map(p => styleNames[p] || p).join(', ')}`);
  }
  if (ctx.travelers) {
    const travelerNames = { family: '가족', couple: '커플', friends: '친구', solo: '혼자' };
    summary.push(`동행: ${travelerNames[ctx.travelers]}`);
  }
  if (ctx.budgetAmount) summary.push(`예산: ${(ctx.budgetAmount / 10000).toLocaleString()}만원`);
  else if (ctx.budget) {
    const budgetNames = { low: '가성비', medium: '보통', high: '럭셔리' };
    summary.push(`예산: ${budgetNames[ctx.budget]}`);
  }
  if (ctx.duration) summary.push(`기간: ${ctx.duration}`);

  parts.push(`지금까지 파악한 내용을 정리해볼게요 📋\n${summary.map(s => `✅ ${s}`).join('\n')}`);
  parts.push('');

  // 동행인 유형별 심화 질문
  if (ctx.travelers === 'family') {
    if (!ctx.travelerDetails) {
      parts.push(pick([
        '가족 여행이면 구성원에 따라 추천이 많이 달라져요!\n• 아이들이 있다면 나이가 어떻게 되나요?\n• 어르신도 함께 가시나요?',
        '가족 구성원을 좀 더 알려주세요 😊\n• 아이들이 몇 살인지, 총 몇 명인지 알려주시면\n  맞춤 일정을 짜드릴게요!'
      ]));
    } else {
      parts.push(pick([
        '아이들과 함께라면 이런 것도 중요해요:\n• 리조트 수영장이 있으면 좋을까요? 🏊\n• 아이들이 좋아하는 특별한 활동이 있나요? (워터파크, 수족관 등)',
        '좋아요! 마지막으로 하나만 더:\n• 비행시간이 너무 길면 힘들까요? ✈️\n• 숙소는 리조트/호텔 중 어떤 게 편하세요?'
      ]));
    }
  } else if (ctx.travelers === 'couple') {
    parts.push(pick([
      '커플 여행이면 분위기가 중요하죠! 💕\n• 로맨틱한 레스토랑이나 야경 좋은 곳이 필요하세요?\n• 액티비티도 좋아하세요, 아니면 편하게 쉬는 게 좋으세요?',
      '둘만의 특별한 여행을 만들어봐요! ✨\n• 기념일이나 특별한 날인가요?\n• 사진 찍기 좋은 곳을 선호하세요?'
    ]));
  } else if (ctx.travelers === 'friends') {
    parts.push(pick([
      '친구들이랑이면 밤 문화도 중요하죠! 🌙\n• 다 같이 즐길 수 있는 액티비티가 좋을까요?\n• 클럽/바 같은 나이트라이프도 괜찮으세요?',
      '친구들 취향도 중요해요!\n• 다들 비슷한 취향이에요? 아니면 각자 하고 싶은 게 다른가요?\n• 총 몇 명이서 가시나요?'
    ]));
  } else {
    parts.push(pick([
      '거의 다 준비됐어요! 마지막 체크 🔍\n• 이전에 해외여행 가봤던 곳이 있어요?\n• 비행시간은 길어도 괜찮으세요?',
      '좋아요, 거의 다 왔어요! 😄\n• 꼭 피하고 싶은 게 있으면 알려주세요 (더위, 물가 비싼 곳 등)\n• 특별히 해보고 싶은 경험이 있나요?'
    ]));
  }

  return parts.join('\n');
}

// ─── 랜덤 선택 헬퍼 ──────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 여행자 타입에 따른 예산 계산
function calculateEstimatedCost(baseCost, travelers) {
  const multipliers = {
    'family': 4,     // 가족 4인 기준
    'couple': 2,     // 커플 2인
    'friends': 3,    // 친구 3인
    'solo': 1        // 혼자 1인
  };
  const multiplier = multipliers[travelers] || 2;
  return Math.round(baseCost * multiplier);
}

async function generateMockRecommendations(context) {
  // 키워드에서 국가/도시명 추출
  const keywords = context.keywords || [];
  const keywordStr = keywords.join(' ').toLowerCase();

  // 키워드 매칭 맵 (더 많은 여행지 지원)
  const keywordMap = {
    '터키': ['turkey-istanbul', 'turkey-cappadocia', 'turkey-antalya'],
    '이스탄불': ['turkey-istanbul'],
    '카파도키아': ['turkey-cappadocia'],
    '일본': ['japan-tokyo', 'japan-osaka', 'japan-kyoto', 'japan-hokkaido', 'japan-okinawa'],
    '도쿄': ['japan-tokyo'],
    '오사카': ['japan-osaka'],
    '교토': ['japan-kyoto'],
    '홋카이도': ['japan-hokkaido'],
    '오키나와': ['japan-okinawa'],
    '태국': ['thailand-bangkok', 'thailand-phuket', 'thailand-chiangmai'],
    '방콕': ['thailand-bangkok'],
    '푸켓': ['thailand-phuket'],
    '치앙마이': ['thailand-chiangmai'],
    '베트남': ['vietnam-danang', 'vietnam-hanoi', 'vietnam-hochiminh'],
    '다낭': ['vietnam-danang'],
    '하노이': ['vietnam-hanoi'],
    '호치민': ['vietnam-hochiminh'],
    '프랑스': ['france-paris', 'france-nice'],
    '파리': ['france-paris'],
    '이탈리아': ['italy-rome', 'italy-venice', 'italy-florence'],
    '로마': ['italy-rome'],
    '베네치아': ['italy-venice'],
    '피렌체': ['italy-florence'],
    '스페인': ['spain-barcelona', 'spain-madrid'],
    '바르셀로나': ['spain-barcelona'],
    '그리스': ['greece-santorini', 'greece-athens'],
    '산토리니': ['greece-santorini'],
    '미국': ['usa-newyork', 'usa-losangeles', 'usa-sanfrancisco'],
    '뉴욕': ['usa-newyork'],
    'la': ['usa-losangeles'],
    '호주': ['australia-sydney', 'australia-melbourne'],
    '시드니': ['australia-sydney'],
    '싱가포르': ['singapore'],
    '홍콩': ['hongkong'],
    '대만': ['taiwan-taipei'],
    '필리핀': ['philippines-boracay', 'philippines-cebu'],
    '인도네시아': ['indonesia-bali', 'indonesia-jakarta'],
    '발리': ['indonesia-bali'],
    '말레이시아': ['malaysia-kualalumpur'],
    '스위스': ['switzerland-zurich'],
    '영국': ['uk-london'],
    '런던': ['uk-london'],
    '독일': ['germany-berlin'],
    '체코': ['czech-prague'],
    '프라하': ['czech-prague'],
    '이집트': ['egypt-cairo'],
    '뉴질랜드': ['newzealand-auckland'],
    '두바이': ['uae-dubai'],
    '몰디브': ['maldives'],
    '하와이': ['usa-hawaii']
  };

  // 키워드 매칭
  let matchedDestIds = [];
  for (const [keyword, destIds] of Object.entries(keywordMap)) {
    if (keywordStr.includes(keyword)) {
      matchedDestIds.push(...destIds);
    }
  }

  // 매칭된 여행지가 있으면 DB에서 찾아서 반환
  if (matchedDestIds.length > 0) {
    const matchedDests = matchedDestIds
      .map(id => destinations.find(d => d.id === id))
      .filter(d => d); // null 제거

    if (matchedDests.length > 0) {
      // 예산 제약 적용
      const travelerCount = context.travelerCount || 2;
      const maxBudgetPerPerson = context.budgetAmount ? Math.floor(context.budgetAmount / travelerCount) : Infinity;

      // 최대 3개 반환
      return matchedDests.slice(0, 3).map((dest, i) => {
        // 1인당 비용이 예산을 초과하지 않도록 조정
        let estimatedCost = dest.avgCost;
        if (estimatedCost > maxBudgetPerPerson) {
          estimatedCost = Math.floor(maxBudgetPerPerson * 0.9); // 예산의 90% 이하로 조정
        }

        return {
          id: dest.id,
          name: dest.name,
          flag: dest.flag,
          country: dest.country,
          matchScore: 95 - i * 5,
          reason: `${dest.pros.slice(0, 2).join(', ')} - ${dest.description}`,
          estimatedCost: estimatedCost,
          highlights: dest.highlights || [],
          bestSeason: dest.bestSeason || '연중'
        };
      });
    }
  }

  // 키워드 매칭 실패 시, 선호 스타일/예산/여행자 타입 기반 추천
  const criteria = {
    styles: context.preferences.length > 0 ? context.preferences : ['relaxation', 'food'],
    budget: context.budget,
    travelers: context.travelers,
    flightTime: context.flightTime
  };

  const matched = (await findDestinations(criteria)).slice(0, 5);
  const top3 = matched.length >= 3 ? matched.slice(0, 3) : [...matched, ...destinations.slice(0, 3 - matched.length)];

  // 예산 제약 적용
  const travelerCount = context.travelerCount || 2;
  const maxBudgetPerPerson = context.budgetAmount ? Math.floor(context.budgetAmount / travelerCount) : Infinity;

  return top3.map((dest, i) => {
    // 1인당 비용이 예산을 초과하지 않도록 조정
    let estimatedCost = dest.avgCost;
    if (estimatedCost > maxBudgetPerPerson) {
      estimatedCost = Math.floor(maxBudgetPerPerson * 0.9); // 예산의 90% 이하로 조정
    }

    return {
      id: dest.id,
      name: dest.name,
      flag: dest.flag,
      country: dest.country,
      matchScore: 95 - i * 7,
      reason: `${dest.pros.slice(0, 2).join(', ')} - ${dest.description}`,
      estimatedCost: estimatedCost,
      highlights: dest.highlights,
      bestSeason: dest.bestSeason
    };
  });
}

async function processMessage(sessionId, userMessage, userSettings) {
  const session = getSession(sessionId);
  session.messageCount++;

  // 사용자 설정 저장 (거주 도시 정보)
  if (userSettings) {
    session.homeCity = userSettings.homeCity || '';
    session.homeCountry = userSettings.homeCountry || '대한민국';
  }

  // 컨텍스트 추출
  session.context = extractContext(userMessage, session.context);

  // 상태 전이
  const nextState = determineNextState(session);
  if (session.state !== STATES.RECOMMENDING || nextState === STATES.RECOMMENDING) {
    session.state = nextState;
  }

  // 히스토리 추가
  session.history.push({ role: 'user', content: userMessage });

  let responseText;
  let recommendations = null;
  let usedProvider = 'mock';

  // Claude.ai Playwright 세션 사용 (우선순위 1, 비활성화 기본)
  const usePythonScript = process.env.USE_CLAUDE_AI_SESSION === 'true';

  if (usePythonScript) {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      console.log('🐍 Claude.ai Python 세션 호출...');

      const scriptPath = require('path').join(__dirname, '..', 'claude_ai_chat.py');
      const command = `python3 "${scriptPath}" "${userMessage.replace(/"/g, '\\"')}" "${sessionId}"`;

      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });

      if (stderr) console.error('Python stderr:', stderr);

      const result = JSON.parse(stdout);
      responseText = result.response;
      usedProvider = 'claude-ai-session';

      // JSON에서 추천 추출 시도
      if (result.recommendations) {
        recommendations = result.recommendations;
      }

      console.log('✅ Claude.ai 세션 응답 성공');
    } catch (err) {
      console.error('Claude.ai Python 세션 에러:', err);
      // 실패 시 폴백
      responseText = await generateMockResponse(session, userMessage);
    }
  } else {
    // Multi AI Provider 사용 (Groq → Gemini → Together → Mock)
    try {
      const systemPrompt = buildSystemPrompt(session);
      const conversationHistory = session.history.slice(0, -1)
        .map(h => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.content}`)
        .join('\n');

      const fullPrompt = `${systemPrompt}\n\n${conversationHistory ? `이전 대화:\n${conversationHistory}\n\n` : ''}사용자: ${userMessage}\n\nAI:`;

      const aiResult = await generateAIResponse(fullPrompt);
      usedProvider = aiResult.provider;

      if (aiResult.response) {
        responseText = aiResult.response;

        // JSON 추천 추출
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.recommendations) {
              // 예산 제약 적용
              const travelerCount = session.context.travelerCount || 2;
              const maxBudgetPerPerson = session.context.budgetAmount
                ? Math.floor(session.context.budgetAmount / travelerCount)
                : Infinity;

              recommendations = parsed.recommendations.map(r => {
                // DB에 있으면 DB 데이터 보완, 없으면 AI 응답 데이터 직접 사용
                const dest = destinations.find(d => d.id === r.id);
                let estimatedCost = r.estimatedCost || (dest && dest.avgCost) || 1000000;

                // 환율 자동 보정: AI가 외화 금액을 KRW로 잘못 보낸 경우
                const exchangeRates = { EUR: 1450, USD: 1350, GBP: 1700, AUD: 900, CNY: 190, TRY: 45 };
                if (estimatedCost < 100000 && r.currency && exchangeRates[r.currency]) {
                  console.warn(`⚠️ AI sent ${r.name} estimatedCost ${estimatedCost} (too small). Applying ${r.currency} exchange rate (x${exchangeRates[r.currency]}).`);
                  estimatedCost = Math.round(estimatedCost * exchangeRates[r.currency]);
                }

                // 예산 초과 시 조정
                if (estimatedCost > maxBudgetPerPerson) {
                  console.warn(`⚠️ AI recommended ${r.name} at ${estimatedCost.toLocaleString()}원 (over budget ${maxBudgetPerPerson.toLocaleString()}원). Adjusting...`);
                  estimatedCost = Math.floor(maxBudgetPerPerson * 0.9);
                }

                return {
                  id: r.id,
                  name: r.name || (dest && dest.name) || r.id,
                  flag: r.flag || (dest && dest.flag) || '🌍',
                  country: r.country || (dest && dest.country) || '',
                  matchScore: r.matchScore,
                  reason: r.reason,
                  estimatedCost: estimatedCost,
                  highlights: r.highlights || (dest && dest.highlights) || [],
                  bestSeason: r.bestSeason || (dest && dest.bestSeason) || '',
                  currency: r.currency || 'KRW'
                };
              });
              session.recommendations = recommendations;
            }
            responseText = responseText.replace(/```json[\s\S]*?```/, '').trim();
          } catch (_) { /* JSON parse failed, ignore */ }
        }

        // RECOMMENDING 상태인데 AI가 추천 JSON을 반환하지 않은 경우 mock 추천으로 보완
        if (session.state === STATES.RECOMMENDING && !recommendations) {
          console.log(`⚠️ ${usedProvider} didn't return recommendations, using Mock mode`);
          await generateMockResponse(session, userMessage);
          recommendations = session.recommendations;
          usedProvider = 'mock';
        }
      } else {
        // 모든 AI Provider 실패, Mock 모드 사용
        console.log('⚠️ All AI providers failed, using Mock mode');
        responseText = await generateMockResponse(session, userMessage);
        if (session.state === STATES.RECOMMENDING) {
          recommendations = session.recommendations;
        }
        usedProvider = 'mock';
      }
    } catch (err) {
      console.error('AI Provider error:', err.message);
      responseText = await generateMockResponse(session, userMessage);
      if (session.state === STATES.RECOMMENDING) {
        recommendations = session.recommendations;
      }
      usedProvider = 'mock';
    }
  }

  session.history.push({ role: 'assistant', content: responseText });

  return {
    response: responseText,
    state: session.state,
    context: session.context,
    recommendations,
    messageCount: session.messageCount,
    provider: usedProvider  // 사용된 AI Provider 정보
  };
}

function selectDestination(sessionId, destinationId) {
  const session = getSession(sessionId);
  session.state = STATES.COMPLETE;
  const dest = destinations.find(d => d.id === destinationId);
  return {
    destination: dest,
    context: session.context,
    state: STATES.COMPLETE
  };
}

function getSessionState(sessionId) {
  return getSession(sessionId);
}

module.exports = {
  processMessage,
  selectDestination,
  getSessionState,
  STATES
};
