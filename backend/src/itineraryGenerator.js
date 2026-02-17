/**
 * Day별 일정 생성기
 * AI 기반 또는 Mock 기반으로 시간대별 액티비티/맛집/이동 생성
 */

const { getDestinationById, getDestinationByName } = require('./destinationDB');

// 목적지별 Mock 일정 데이터
const itineraryTemplates = {
  osaka: {
    arrival: [
      { time: '09:00', type: 'flight', icon: '✈️', title: '인천공항 출발', location: '인천국제공항', cost: 0, notes: '2시간 전 도착' },
      { time: '11:00', type: 'flight', icon: '🛬', title: '간사이공항 도착', location: '간사이국제공항', cost: 0, notes: '입국심사 30-40분' },
      { time: '12:00', type: 'transport', icon: '🚃', title: '난카이 라피트 → 난바', location: '간사이공항역', cost: 15000, notes: '약 40분 소요' },
      { time: '13:00', type: 'food', icon: '🍜', title: '이치란 라멘', location: '도톤보리', cost: 12000, notes: '줄 서기 20-30분 예상' },
      { time: '14:30', type: 'hotel', icon: '🏨', title: '호텔 체크인', location: '난바역 근처', cost: 120000, notes: '짐 맡기고 외출' },
      { time: '15:30', type: 'activity', icon: '🏯', title: '도톤보리 산책', location: '도톤보리', cost: 0, notes: '글리코 사인 포토 스팟' },
      { time: '17:00', type: 'shopping', icon: '🛍️', title: '신사이바시 쇼핑', location: '신사이바시스지', cost: 50000, notes: '돈키호테, 드럭스토어' },
      { time: '19:00', type: 'food', icon: '🐙', title: '타코야키 & 오코노미야키', location: '도톤보리', cost: 15000, notes: '쿠쿠루 타코야키 추천' },
      { time: '21:00', type: 'activity', icon: '🌃', title: '도톤보리 야경', location: '에비스바시', cost: 0, notes: '네온사인 포토타임' }
    ],
    usj: [
      { time: '07:30', type: 'food', icon: '🥐', title: '호텔 조식 / 편의점', location: '호텔', cost: 5000, notes: '가볍게 먹기' },
      { time: '08:30', type: 'transport', icon: '🚃', title: '유니버셜시티역 이동', location: 'JR', cost: 3000, notes: '니시쿠조 환승' },
      { time: '09:00', type: 'activity', icon: '🎢', title: 'USJ 오픈 입장', location: 'USJ', cost: 85000, notes: '익스프레스 패스 필수' },
      { time: '09:15', type: 'activity', icon: '🧙', title: '해리포터 위저딩 월드', location: 'USJ', cost: 0, notes: '오픈런 추천 구역' },
      { time: '11:00', type: 'activity', icon: '🦖', title: '쥬라기 파크 라이드', location: 'USJ', cost: 0, notes: '비옷 준비' },
      { time: '12:30', type: 'food', icon: '🍔', title: 'USJ 내 점심', location: 'USJ', cost: 15000, notes: '레스토랑 예약 추천' },
      { time: '14:00', type: 'activity', icon: '🎮', title: '슈퍼 닌텐도 월드', location: 'USJ', cost: 0, notes: '정리권 확인' },
      { time: '16:00', type: 'activity', icon: '🎠', title: '자유 어트랙션', location: 'USJ', cost: 0, notes: '플라잉 다이노소어, 할리우드 드림' },
      { time: '18:00', type: 'activity', icon: '🎆', title: '퍼레이드 & 쇼', location: 'USJ', cost: 0, notes: '저녁 퍼레이드 자리잡기' },
      { time: '20:00', type: 'food', icon: '🍱', title: '유니버셜시티워크 저녁', location: '시티워크', cost: 15000, notes: '다양한 레스토랑' },
      { time: '21:30', type: 'transport', icon: '🚃', title: '호텔 복귀', location: 'JR', cost: 3000, notes: '' }
    ],
    culture: [
      { time: '08:00', type: 'food', icon: '☕', title: '카페 모닝', location: '호텔 근처', cost: 8000, notes: '일본식 모닝 세트' },
      { time: '09:30', type: 'activity', icon: '🏯', title: '오사카성 관람', location: '오사카성공원', cost: 8000, notes: '천수각 전망대 포함' },
      { time: '11:30', type: 'activity', icon: '🌸', title: '오사카성 공원 산책', location: '오사카성공원', cost: 0, notes: '포토스팟 다수' },
      { time: '12:30', type: 'food', icon: '🍣', title: '구로몬 시장 투어', location: '구로몬시장', cost: 20000, notes: '참치, 성게, 딸기' },
      { time: '14:30', type: 'transport', icon: '🚃', title: 'JR로 교토 이동', location: 'JR 오사카역', cost: 8000, notes: '약 30분' },
      { time: '15:30', type: 'activity', icon: '⛩️', title: '후시미 이나리 신사', location: '교토', cost: 0, notes: '천 개의 도리이' },
      { time: '17:30', type: 'activity', icon: '🎋', title: '기온 거리 산책', location: '교토', cost: 0, notes: '게이샤 만남 가능' },
      { time: '19:00', type: 'food', icon: '🍖', title: '교토역 저녁', location: '교토역 빌딩', cost: 15000, notes: '규카츠, 라멘' },
      { time: '20:30', type: 'transport', icon: '🚃', title: 'JR로 오사카 복귀', location: 'JR 교토역', cost: 8000, notes: '' }
    ],
    shopping: [
      { time: '09:00', type: 'food', icon: '🥞', title: '팬케이크 브런치', location: '아메리카무라', cost: 12000, notes: '인기 카페' },
      { time: '10:30', type: 'activity', icon: '🏙️', title: '아베노 하루카스 전망대', location: '텐노지', cost: 15000, notes: '300m 전망' },
      { time: '12:00', type: 'activity', icon: '🏮', title: '신세카이 산책', location: '신세카이', cost: 0, notes: '츠텐카쿠 타워' },
      { time: '13:00', type: 'food', icon: '🍢', title: '쿠시카츠 점심', location: '신세카이', cost: 12000, notes: '소스 2번 찍기 금지!' },
      { time: '14:30', type: 'shopping', icon: '🛍️', title: '텐진바시스지 상점가', location: '텐진바시', cost: 30000, notes: '일본 최장 상점가 2.6km' },
      { time: '16:30', type: 'activity', icon: '🎡', title: 'HEP FIVE 관람차', location: '우메다', cost: 8000, notes: '빨간 관람차' },
      { time: '17:30', type: 'shopping', icon: '🏬', title: '우메다 백화점 쇼핑', location: '우메다', cost: 50000, notes: '한큐, 한신 백화점' },
      { time: '19:00', type: 'food', icon: '🥩', title: '야키니쿠 저녁', location: '우메다', cost: 25000, notes: '와규 맛집' },
      { time: '21:00', type: 'activity', icon: '🌃', title: '우메다 스카이빌딩 야경', location: '우메다', cost: 15000, notes: '공중정원 전망대' }
    ],
    departure: [
      { time: '08:00', type: 'food', icon: '🍳', title: '호텔 조식', location: '호텔', cost: 0, notes: '체크아웃 준비' },
      { time: '09:30', type: 'hotel', icon: '🧳', title: '체크아웃 & 짐 보관', location: '호텔', cost: 0, notes: '코인락커 활용' },
      { time: '10:00', type: 'shopping', icon: '🛍️', title: '마지막 쇼핑', location: '난바', cost: 30000, notes: '기념품, 과자' },
      { time: '11:30', type: 'food', icon: '🍛', title: '마지막 점심', location: '난바', cost: 12000, notes: '카레 or 규동' },
      { time: '13:00', type: 'transport', icon: '🚃', title: '난카이 라피트 → 공항', location: '난바역', cost: 15000, notes: '40분 소요' },
      { time: '14:00', type: 'shopping', icon: '🏪', title: '면세점 쇼핑', location: '간사이공항', cost: 30000, notes: '면세 한도 확인' },
      { time: '16:00', type: 'flight', icon: '✈️', title: '간사이공항 출발', location: '간사이국제공항', cost: 0, notes: '약 2시간 비행' },
      { time: '18:00', type: 'flight', icon: '🛬', title: '인천공항 도착', location: '인천국제공항', cost: 0, notes: '수고하셨습니다! 🎉' }
    ]
  },
  tokyo: {
    arrival: [
      { time: '09:00', type: 'flight', icon: '✈️', title: '인천공항 출발', location: '인천국제공항', cost: 0, notes: '' },
      { time: '11:30', type: 'flight', icon: '🛬', title: '나리타/하네다 도착', location: '공항', cost: 0, notes: '입국심사' },
      { time: '13:00', type: 'transport', icon: '🚃', title: '시내 이동', location: '공항', cost: 30000, notes: '스카이라이너 or 리무진버스' },
      { time: '14:30', type: 'hotel', icon: '🏨', title: '호텔 체크인', location: '신주쿠/시부야', cost: 130000, notes: '' },
      { time: '15:30', type: 'activity', icon: '🏙️', title: '시부야 스크램블 교차로', location: '시부야', cost: 0, notes: '스타벅스에서 감상' },
      { time: '17:00', type: 'shopping', icon: '🛍️', title: '하라주쿠 타케시타 거리', location: '하라주쿠', cost: 30000, notes: '' },
      { time: '19:00', type: 'food', icon: '🍜', title: '이자카야 저녁', location: '신주쿠', cost: 20000, notes: '오모이데 요코초' },
      { time: '21:00', type: 'activity', icon: '🌃', title: '가부키초 야경', location: '신주쿠', cost: 0, notes: '' }
    ],
    culture: [
      { time: '08:00', type: 'activity', icon: '⛩️', title: '메이지 신궁', location: '하라주쿠', cost: 0, notes: '아침 산책' },
      { time: '10:00', type: 'activity', icon: '🏯', title: '센소지 & 나카미세', location: '아사쿠사', cost: 0, notes: '' },
      { time: '12:00', type: 'food', icon: '🍣', title: '츠키지 아우터 마켓', location: '츠키지', cost: 15000, notes: '해산물 투어' },
      { time: '14:00', type: 'activity', icon: '🗼', title: '도쿄타워', location: '시바공원', cost: 10000, notes: '' },
      { time: '16:00', type: 'activity', icon: '🎌', title: '아키하바라 탐방', location: '아키하바라', cost: 20000, notes: '오타쿠 문화' },
      { time: '18:00', type: 'food', icon: '🥘', title: '스키야키 저녁', location: '긴자', cost: 30000, notes: '' },
      { time: '20:00', type: 'activity', icon: '🌃', title: '오다이바 야경', location: '오다이바', cost: 0, notes: '레인보우 브릿지' }
    ]
  },
  danang: {
    arrival: [
      { time: '10:00', type: 'flight', icon: '✈️', title: '인천공항 출발', location: '인천국제공항', cost: 0, notes: '' },
      { time: '13:30', type: 'flight', icon: '🛬', title: '다낭공항 도착', location: '다낭국제공항', cost: 0, notes: '약 4.5시간' },
      { time: '14:30', type: 'transport', icon: '🚕', title: '그랩으로 호텔 이동', location: '공항', cost: 5000, notes: '20분 소요' },
      { time: '15:30', type: 'hotel', icon: '🏨', title: '리조트 체크인', location: '미케비치', cost: 100000, notes: '풀빌라 추천' },
      { time: '16:30', type: 'activity', icon: '🏖️', title: '미케비치 수영', location: '미케비치', cost: 0, notes: '선베드 무료' },
      { time: '18:30', type: 'food', icon: '🍜', title: '쌀국수 저녁', location: '미케비치', cost: 5000, notes: '포보 or 분짜' },
      { time: '20:00', type: 'activity', icon: '🌉', title: '용다리 야경', location: '한강', cost: 0, notes: '주말 불쇼 21시' }
    ],
    banahills: [
      { time: '07:30', type: 'food', icon: '🥐', title: '호텔 조식', location: '호텔', cost: 0, notes: '' },
      { time: '08:30', type: 'transport', icon: '🚕', title: '바나힐 이동', location: '그랩', cost: 10000, notes: '약 40분' },
      { time: '09:30', type: 'activity', icon: '🚡', title: '바나힐 케이블카', location: '바나힐', cost: 40000, notes: '세계 최장 케이블카' },
      { time: '10:30', type: 'activity', icon: '🌉', title: '골든 브릿지', location: '바나힐', cost: 0, notes: '포토스팟 필수' },
      { time: '12:00', type: 'food', icon: '🍽️', title: '바나힐 뷔페 점심', location: '바나힐', cost: 15000, notes: '' },
      { time: '13:30', type: 'activity', icon: '🎢', title: '판타지파크 놀이공원', location: '바나힐', cost: 0, notes: '입장권 포함' },
      { time: '16:00', type: 'transport', icon: '🚕', title: '호이안 이동', location: '그랩', cost: 15000, notes: '약 1시간' },
      { time: '17:30', type: 'activity', icon: '🏮', title: '호이안 올드타운', location: '호이안', cost: 8000, notes: '유네스코 유산' },
      { time: '19:00', type: 'food', icon: '🥟', title: '까오라우 & 화이트로즈', location: '호이안', cost: 8000, notes: '호이안 3대 음식' },
      { time: '20:30', type: 'activity', icon: '🏮', title: '랜턴 야경 & 소원등', location: '호이안', cost: 3000, notes: '투본강 보트' },
      { time: '22:00', type: 'transport', icon: '🚕', title: '다낭 복귀', location: '그랩', cost: 15000, notes: '' }
    ],
    beach: [
      { time: '08:00', type: 'food', icon: '🥐', title: '리조트 조식', location: '호텔', cost: 0, notes: '뷔페 포함' },
      { time: '09:30', type: 'activity', icon: '🏖️', title: '미케비치 수영 & 선베드', location: '미케비치', cost: 0, notes: '선크림 필수' },
      { time: '11:30', type: 'activity', icon: '🏄', title: '서핑 체험 / 바나나보트', location: '미케비치', cost: 20000, notes: '현지 업체 예약' },
      { time: '12:30', type: 'food', icon: '🦐', title: '씨푸드 점심', location: '미케비치', cost: 15000, notes: '해산물 레스토랑' },
      { time: '14:00', type: 'activity', icon: '💆', title: '스파 & 마사지', location: '한시장 근처', cost: 15000, notes: '2시간 풀코스' },
      { time: '16:30', type: 'activity', icon: '⛰️', title: '마블 마운틴(오행산)', location: '마블 마운틴', cost: 5000, notes: '석회암 동굴 탐험' },
      { time: '18:30', type: 'food', icon: '🍜', title: '분짜 & 반쎄오', location: '다낭 시내', cost: 5000, notes: '현지인 맛집' },
      { time: '20:00', type: 'activity', icon: '🌉', title: '용다리 야경 산책', location: '한강', cost: 0, notes: '토-일 21시 불쇼' },
      { time: '21:30', type: 'food', icon: '🍺', title: '루프탑 바', location: '미케비치', cost: 10000, notes: '야경과 맥주' }
    ]
  },
  bali: {
    arrival: [
      { time: '07:00', type: 'flight', icon: '✈️', title: '인천공항 출발', location: '인천국제공항', cost: 0, notes: '' },
      { time: '14:00', type: 'flight', icon: '🛬', title: '응우라라이 공항 도착', location: '발리', cost: 0, notes: '약 7시간' },
      { time: '15:30', type: 'transport', icon: '🚕', title: '호텔 이동', location: '공항', cost: 10000, notes: '사전예약 추천' },
      { time: '17:00', type: 'hotel', icon: '🏨', title: '리조트 체크인', location: '스미냑/쿠타', cost: 80000, notes: '풀빌라' },
      { time: '18:00', type: 'activity', icon: '🌅', title: '비치 선셋', location: '쿠타비치', cost: 0, notes: '맥주 한 잔과 함께' },
      { time: '19:30', type: 'food', icon: '🍛', title: '나시고렝 저녁', location: '스미냑', cost: 8000, notes: '현지식 추천' }
    ],
    ubud: [
      { time: '08:00', type: 'food', icon: '🥣', title: '스무디 볼 조식', location: '호텔', cost: 10000, notes: '' },
      { time: '09:00', type: 'transport', icon: '🚕', title: '우붓 이동', location: '그랩', cost: 15000, notes: '약 1.5시간' },
      { time: '10:30', type: 'activity', icon: '🌾', title: '뜨갈랄랑 라이스테라스', location: '우붓', cost: 5000, notes: '계단식 논' },
      { time: '12:00', type: 'food', icon: '🥗', title: '라이스테라스 뷰 카페', location: '우붓', cost: 15000, notes: '경치 최고' },
      { time: '13:30', type: 'activity', icon: '🐒', title: '원숭이 숲', location: '우붓', cost: 5000, notes: '소지품 주의' },
      { time: '15:30', type: 'activity', icon: '🏛️', title: '우붓 왕궁', location: '우붓', cost: 0, notes: '' },
      { time: '17:00', type: 'activity', icon: '💆', title: '발리 전통 마사지', location: '우붓', cost: 15000, notes: '2시간' },
      { time: '19:30', type: 'food', icon: '🍖', title: '바비굴링 저녁', location: '우붓', cost: 10000, notes: '발리식 돼지구이' }
    ]
  },
  jeju: {
    arrival: [
      { time: '08:00', type: 'flight', icon: '✈️', title: '김포/김해 출발', location: '공항', cost: 0, notes: '약 1시간' },
      { time: '09:30', type: 'flight', icon: '🛬', title: '제주공항 도착', location: '제주', cost: 0, notes: '' },
      { time: '10:00', type: 'transport', icon: '🚗', title: '렌터카 픽업', location: '공항', cost: 50000, notes: '1일 기준' },
      { time: '11:00', type: 'food', icon: '🐷', title: '흑돼지 브런치', location: '제주시', cost: 20000, notes: '돔베고기' },
      { time: '13:00', type: 'activity', icon: '🌊', title: '협재해수욕장', location: '한림', cost: 0, notes: '에메랄드빛 바다' },
      { time: '15:30', type: 'activity', icon: '🏝️', title: '오설록 티뮤지엄', location: '서귀포', cost: 0, notes: '녹차 아이스크림' },
      { time: '17:00', type: 'hotel', icon: '🏨', title: '숙소 체크인', location: '서귀포', cost: 100000, notes: '' },
      { time: '18:30', type: 'food', icon: '🐟', title: '갈치조림 저녁', location: '서귀포', cost: 25000, notes: '중문 맛집' }
    ]
  },
  turkey: {
    arrival: [
      { time: '22:00', type: 'flight', icon: '✈️', title: '인천공항 출발', location: '인천국제공항', cost: 0, notes: '터키항공 직항 11시간' },
      { time: '04:00', type: 'flight', icon: '🛬', title: '이스탄불 공항 도착', location: '이스탄불 공항', cost: 0, notes: '시차 -6시간' },
      { time: '06:00', type: 'transport', icon: '🚐', title: '호텔 이동 & 체크인', location: '술탄아흐메트', cost: 50000, notes: '공항 셔틀 이용' },
      { time: '09:00', type: 'food', icon: '🫖', title: '터키식 아침식사', location: '술탄아흐메트', cost: 15000, notes: '시밋, 차이, 치즈, 올리브' },
      { time: '10:00', type: 'activity', icon: '🕌', title: '아야 소피아', location: '술탄아흐메트', cost: 40000, notes: '비잔틴+오스만 건축의 걸작' },
      { time: '13:00', type: 'food', icon: '🥙', title: '케밥 점심', location: '술탄아흐메트', cost: 20000, notes: '이스켄데르 케밥 추천' },
      { time: '14:30', type: 'activity', icon: '🕌', title: '블루 모스크', location: '술탄아흐메트', cost: 0, notes: '무료 입장, 복장 주의' },
      { time: '16:00', type: 'activity', icon: '🏛️', title: '지하 궁전 (바실리카 시스턴)', location: '술탄아흐메트', cost: 30000, notes: '메두사 머리 기둥' },
      { time: '18:00', type: 'food', icon: '🍦', title: '터키 아이스크림 & 바클라바', location: '술탄아흐메트', cost: 8000, notes: '마라쉬 도돈두르마' }
    ],
    bazaar: [
      { time: '09:00', type: 'food', icon: '🫖', title: '호텔 조식', location: '호텔', cost: 0, notes: '포함' },
      { time: '10:00', type: 'activity', icon: '🏪', title: '그랜드 바자르', location: '베야지트', cost: 100000, notes: '세계 최대 재래시장, 흥정 필수!' },
      { time: '12:30', type: 'food', icon: '🍖', title: '터키식 점심 (쾨프테)', location: '그랜드 바자르 근처', cost: 18000, notes: '미트볼 전문점' },
      { time: '14:00', type: 'activity', icon: '🕌', title: '톱카프 궁전', location: '술탄아흐메트', cost: 40000, notes: '오스만 제국 술탄의 궁전' },
      { time: '16:30', type: 'activity', icon: '🌊', title: '보스포루스 크루즈', location: '에미뇌뉘', cost: 35000, notes: '유럽↔아시아 해협 크루즈' },
      { time: '19:00', type: 'food', icon: '🐟', title: '갈라타 다리 생선구이', location: '갈라타', cost: 15000, notes: '발릭 에크멕 (생선 샌드위치)' },
      { time: '20:30', type: 'activity', icon: '🌃', title: '갈라타 타워 야경', location: '갈라타', cost: 25000, notes: '이스탄불 360도 파노라마' }
    ],
    cappadocia: [
      { time: '05:00', type: 'activity', icon: '🎈', title: '카파도키아 열기구 투어', location: '괴레메', cost: 250000, notes: '일출 열기구, 사전예약 필수!' },
      { time: '08:00', type: 'food', icon: '🥐', title: '동굴 호텔 조식', location: '괴레메', cost: 0, notes: '포함' },
      { time: '10:00', type: 'activity', icon: '🏔️', title: '괴레메 오픈에어 박물관', location: '괴레메', cost: 20000, notes: '암벽 교회 프레스코화' },
      { time: '12:30', type: 'food', icon: '🍲', title: '터키식 항아리 케밥', location: '괴레메', cost: 25000, notes: '도자기에서 요리하는 케밥' },
      { time: '14:00', type: 'activity', icon: '🐴', title: 'ATV 또는 승마 투어', location: '카파도키아', cost: 60000, notes: '기암괴석 사이 투어' },
      { time: '17:00', type: 'activity', icon: '🌅', title: '로즈밸리 선셋 하이킹', location: '카파도키아', cost: 0, notes: '일몰 포토스팟' },
      { time: '19:00', type: 'food', icon: '🍷', title: '카파도키아 와인 디너', location: '괴레메', cost: 35000, notes: '현지 와이너리 와인' }
    ],
    pamukkale: [
      { time: '08:00', type: 'food', icon: '🫖', title: '호텔 조식', location: '호텔', cost: 0, notes: '포함' },
      { time: '09:00', type: 'transport', icon: '🚐', title: '파묵칼레 이동', location: '버스/국내선', cost: 80000, notes: '국내선 1시간 또는 버스 10시간' },
      { time: '13:00', type: 'food', icon: '🥙', title: '현지 점심', location: '파묵칼레', cost: 15000, notes: '로컬 식당' },
      { time: '14:00', type: 'activity', icon: '♨️', title: '파묵칼레 석회암 온천', location: '파묵칼레', cost: 15000, notes: '새하얀 석회암 계단, 맨발 필수' },
      { time: '16:00', type: 'activity', icon: '🏛️', title: '히에라폴리스 고대 유적', location: '파묵칼레', cost: 0, notes: '입장권 포함' },
      { time: '17:30', type: 'activity', icon: '🏊', title: '클레오파트라 온천풀', location: '파묵칼레', cost: 15000, notes: '고대 로마 기둥 사이 수영' },
      { time: '19:00', type: 'food', icon: '🍖', title: '터키식 저녁', location: '파묵칼레', cost: 20000, notes: '구운 고기 & 에즈메' }
    ],
    departure: [
      { time: '08:00', type: 'food', icon: '🫖', title: '마지막 터키 조식', location: '호텔', cost: 0, notes: '여유롭게' },
      { time: '09:30', type: 'shopping', icon: '🛍️', title: '이집션 바자르 (스파이스 마켓)', location: '에미뇌뉘', cost: 50000, notes: '향신료, 터키쉬 딜라이트, 차' },
      { time: '11:30', type: 'food', icon: '🥙', title: '마지막 케밥', location: '에미뇌뉘', cost: 15000, notes: '' },
      { time: '13:00', type: 'transport', icon: '🚐', title: '공항 이동', location: '이스탄불 공항', cost: 50000, notes: '3시간 전 도착' },
      { time: '17:00', type: 'flight', icon: '✈️', title: '이스탄불 출발', location: '이스탄불 공항', cost: 0, notes: '터키항공 직항' },
      { time: '09:00', type: 'flight', icon: '🛬', title: '인천공항 도착 (익일)', location: '인천국제공항', cost: 0, notes: '수고하셨습니다!' }
    ]
  }
};

// 기본 일정 패턴 (DB에 없는 목적지용)
const defaultDayPatterns = ['arrival', 'culture', 'shopping', 'departure'];

function generateMockItinerary(destination, duration, travelers, budget, startDateStr) {
  let dest = typeof destination === 'string'
    ? getDestinationById(destination) || getDestinationByName(destination)
    : destination;

  // DB에 없는 목적지인 경우 기본 정보로 생성
  if (!dest && typeof destination === 'string') {
    const name = destination.replace(/^[a-z]+-/, '');
    dest = { id: destination, name, country: '', flag: '🌍', highlights: [], sampleItinerary: { days: duration || 4 } };
  }

  if (!dest) return null;

  const templates = itineraryTemplates[dest.id];
  const nights = parseInt(duration) || dest.sampleItinerary?.days || 4;
  const days = [];

  // 시작 날짜: 전달받은 날짜 또는 현재+45일
  const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
  if (!startDateStr) startDate.setDate(startDate.getDate() + 45);

  for (let i = 0; i < nights; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;

    let slots;
    let title;

    if (templates) {
      if (i === 0) {
        slots = templates.arrival || templates[Object.keys(templates)[0]];
        title = '출발 & 도착';
      } else if (i === nights - 1) {
        slots = templates.departure || generateDepartureSlots(dest);
        title = '마지막 날 & 귀국';
      } else {
        const keys = Object.keys(templates).filter(k => k !== 'arrival' && k !== 'departure');
        const key = keys[(i - 1) % keys.length];
        slots = templates[key];
        title = getSlotTitle(key);
      }
    } else {
      slots = generateGenericSlots(dest, i, nights);
      if (i === 0) {
        title = '출발 & 도착';
      } else if (i === nights - 1) {
        title = '마지막 날 & 귀국';
      } else {
        // 하이라이트/관광 테마 기반 제목
        const highlights = dest.highlights || [];
        const themes = getDayThemes(dest.name);
        if (highlights[i - 1]) {
          title = highlights[i - 1];
        } else if (themes[i - 1]) {
          title = themes[i - 1];
        } else {
          title = `${dest.name} 자유일정`;
        }
      }
    }

    const dayCost = slots.reduce((sum, s) => sum + (s.cost || 0), 0);

    days.push({
      dayNumber: i + 1,
      date: dateStr,
      title,
      slots: slots.map(s => ({ ...s })),
      totalCost: dayCost
    });
  }

  const totalCost = days.reduce((sum, d) => sum + d.totalCost, 0);

  return {
    destination: { id: dest.id, name: dest.name, flag: dest.flag, country: dest.country },
    duration: `${nights - 1}박${nights}일`,
    days,
    totalCost,
    perPersonCost: Math.round(totalCost / (travelers || 1)),
    tips: [
      `${dest.name} 베스트 시즌: ${dest.bestSeason || '연중'}`,
      ...(dest.pros || []).slice(0, 2).map(p => `✅ ${p}`)
    ]
  };
}

// 목적지별 일별 테마 (Day2, Day3, ... 순서)
function getDayThemes(destName) {
  const themes = {
    '이스탄불': ['아야 소피아 & 블루 모스크', '그랜드 바자르 & 스파이스 마켓', '보스포루스 해협 크루즈', '톱카프 궁전 & 고고학 박물관', '아시아 사이드 카디쾨이', '파묵칼레/카파도키아 근교'],
    '도쿄': ['아사쿠사 & 스카이트리', '시부야 & 하라주쿠', '아키하바라 & 우에노', '오다이바 & 도요스 시장', '디즈니/지브리 테마파크'],
    '오사카': ['도톤보리 & 신사이바시', 'USJ 유니버셜 풀데이', '교토 후시미이나리 & 기온', '오사카성 & 구로몬 시장', '나라 사슴공원 당일치기'],
    '방콕': ['왕궁 & 왓포 사원', '차투착 주말시장', '아유타야 역사 투어', '수상시장 & 마사지', '쇼핑 & 루프탑바'],
    '다낭': ['바나힐 & 골든브릿지', '호이안 올드타운', '미케 비치 & 해산물', '오행산 & 참 박물관'],
    '파리': ['에펠탑 & 트로카데로', '루브르 박물관 풀데이', '몽마르뜨 & 사크레쾨르', '베르사유 궁전 당일치기', '개선문 & 샹젤리제'],
    '발리': ['우붓 라이스테라스', '울루와뚜 사원 & 일몰', '스미냑 비치 & 서핑', '누사 페니다 당일치기'],
    '싱가포르': ['마리나베이 & 가든스', '센토사 유니버셜', '차이나타운 & 리틀인디아', '오차드로드 쇼핑'],
    '하와이': ['와이키키 비치 & 다이아몬드헤드', '노스쇼어 & 할레이와', '진주만 역사투어', '쿠알로아 랜치 액티비티'],
    '제주도': ['성산일출봉 & 우도', '중문관광단지', '한라산 트레킹', '서귀포 올레길']
  };
  return themes[destName] || [];
}

function getSlotTitle(key) {
  const titles = {
    usj: 'USJ 풀데이',
    culture: '문화 탐방',
    shopping: '쇼핑 & 관광',
    banahills: '바나힐 & 호이안',
    ubud: '우붓 데이트립'
  };
  return titles[key] || '자유 일정';
}

// 편도 비행시간 (시간 단위, 직항 기준)
const flightHoursMap = {
  '도쿄': 2.5, '오사카': 2, '후쿠오카': 1.5, '삿포로': 3.5, '오키나와': 2.5,
  '방콕': 5.5, '다낭': 4.5, '호치민': 5.5, '나트랑': 5,
  '싱가포르': 6.5, '발리': 7, '세부': 4.5,
  '타이베이': 2.5, '홍콩': 3.5,
  '괌': 4.5, '사이판': 4.5, '하와이': 9,
  '파리': 12, '런던': 12, '로마': 11.5, '바르셀로나': 12,
  '이스탄불': 11,
  '뉴욕': 14, 'LA': 12, '시드니': 10.5,
  '제주도': 1
};

// 시간 숫자 → "HH:MM" 포맷
function formatTime(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.round((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 비행시간 텍스트
function flightDurationText(hours) {
  if (!hours) return '';
  if (hours % 1 === 0) return `약 ${hours}시간 비행`;
  return `약 ${Math.floor(hours)}시간 ${Math.round((hours % 1) * 60)}분 비행`;
}

function generateDepartureSlots(dest) {
  const fh = flightHoursMap[dest.name] || 3;
  // 시차 (한국 기준 도착 시간 계산)
  const timeDiffMap = { '도쿄': 0, '오사카': 0, '방콕': -2, '이스탄불': -6, '파리': -8, '런던': -9, '뉴욕': -14, 'LA': -17, '하와이': -19, '시드니': 1, '발리': -1 };
  const timeDiff = timeDiffMap[dest.name] || 0;
  const departHour = 17; // 현지 17시 출발
  const arriveKoreaHour = departHour + fh - timeDiff; // 한국 시간 도착

  return [
    { time: '08:00', type: 'food', icon: '🍳', title: '호텔 조식', location: '호텔', cost: 0, notes: '' },
    { time: '09:30', type: 'hotel', icon: '🧳', title: '체크아웃', location: '호텔', cost: 0, notes: '' },
    { time: '10:00', type: 'shopping', icon: '🛍️', title: '마지막 쇼핑', location: dest.name, cost: 30000, notes: '기념품' },
    { time: '12:00', type: 'food', icon: '🍽️', title: '마지막 점심', location: dest.name, cost: 15000, notes: '' },
    { time: '14:00', type: 'transport', icon: '🚕', title: '공항 이동', location: dest.name, cost: 15000, notes: '' },
    { time: '15:00', type: 'shopping', icon: '🏪', title: '면세점', location: '공항', cost: 30000, notes: '' },
    { time: formatTime(departHour), type: 'flight', icon: '✈️', title: `귀국 출발`, location: '공항', cost: 0, notes: flightDurationText(fh) },
    { time: formatTime(arriveKoreaHour), type: 'flight', icon: '🛬', title: '인천공항 도착', location: '인천', cost: 0, notes: '한국시간 기준 · 수고하셨습니다! 🎉' }
  ];
}

function generateGenericSlots(dest, dayIdx, totalDays) {
  if (dayIdx === 0) {
    const fh = flightHoursMap[dest.name] || 3;
    const timeDiffMap = { '도쿄': 0, '오사카': 0, '방콕': -2, '이스탄불': -6, '파리': -8, '런던': -9, '뉴욕': -14, 'LA': -17, '하와이': -19, '시드니': 1, '발리': -1 };
    const timeDiff = timeDiffMap[dest.name] || 0;
    const departKorea = 9; // 한국 09시 출발
    const arriveLocalHour = departKorea + fh + timeDiff; // 현지 시간 도착
    const checkinHour = arriveLocalHour + 2; // 도착 2시간 후 체크인

    return [
      { time: formatTime(departKorea), type: 'flight', icon: '✈️', title: '출발', location: '인천공항', cost: 0, notes: flightDurationText(fh) },
      { time: formatTime(arriveLocalHour), type: 'flight', icon: '🛬', title: `${dest.name} 도착`, location: '공항', cost: 0, notes: '현지시간 기준' },
      { time: formatTime(checkinHour), type: 'hotel', icon: '🏨', title: '호텔 체크인', location: dest.name, cost: 100000, notes: '' },
      { time: formatTime(checkinHour + 1.5), type: 'activity', icon: '🏙️', title: '주변 산책', location: dest.name, cost: 0, notes: '' },
      { time: formatTime(checkinHour + 3.5), type: 'food', icon: '🍽️', title: '현지 맛집 저녁', location: dest.name, cost: 20000, notes: '' },
      { time: formatTime(checkinHour + 5.5), type: 'activity', icon: '🌃', title: '야경 감상', location: dest.name, cost: 0, notes: '' }
    ];
  }
  if (dayIdx === totalDays - 1) {
    return generateDepartureSlots(dest);
  }
  // 일별 테마에 따라 활동/비용 다양화
  const themes = getDayThemes(dest.name);
  const dayTheme = themes[dayIdx - 1] || '';
  const highlight1 = dest.highlights?.[dayIdx - 1] || dayTheme.split('&')[0]?.trim() || '관광지';
  const highlight2 = dest.highlights?.[dayIdx] || dayTheme.split('&')[1]?.trim() || '액티비티';

  // 비용 변동 (입장료 있는 날 vs 산책/무료 관광)
  const costVariants = [
    { activity1: 25000, activity2: 15000, shopping: 40000, dinner: 25000, night: 10000 },
    { activity1: 0, activity2: 30000, shopping: 20000, dinner: 20000, night: 15000 },
    { activity1: 35000, activity2: 20000, shopping: 50000, dinner: 30000, night: 0 },
    { activity1: 15000, activity2: 10000, shopping: 30000, dinner: 15000, night: 20000 },
    { activity1: 20000, activity2: 25000, shopping: 0, dinner: 25000, night: 10000 },
  ];
  const cv = costVariants[(dayIdx - 1) % costVariants.length];

  return [
    { time: '08:00', type: 'food', icon: '☕', title: '조식', location: '호텔', cost: 8000, notes: '' },
    { time: '09:30', type: 'activity', icon: '🏛️', title: `${highlight1} 방문`, location: dest.name, cost: cv.activity1, notes: '' },
    { time: '12:00', type: 'food', icon: '🍜', title: '점심', location: dest.name, cost: 12000, notes: '' },
    { time: '14:00', type: 'activity', icon: '🎯', title: `${highlight2}`, location: dest.name, cost: cv.activity2, notes: '' },
    { time: '16:30', type: 'shopping', icon: '🛍️', title: cv.shopping > 0 ? '쇼핑 & 카페' : '현지 산책', location: dest.name, cost: cv.shopping, notes: '' },
    { time: '18:30', type: 'food', icon: '🍖', title: '저녁', location: dest.name, cost: cv.dinner, notes: '' },
    { time: '20:30', type: 'activity', icon: '🌃', title: cv.night > 0 ? '야간 활동' : '호텔 휴식', location: dest.name, cost: cv.night, notes: '' }
  ];
}

async function generateWithAI(geminiModel, destination, duration, travelers, budget, context, startDateStr) {
  let dest = typeof destination === 'string'
    ? getDestinationById(destination) || getDestinationByName(destination)
    : destination;

  // DB에 없는 목적지 (AI 추천)인 경우, context에서 정보를 가져오거나 기본값 생성
  if (!dest && typeof destination === 'string') {
    dest = {
      name: destination.replace(/^[a-z]+-/, ''), // 'custom-호놀룰루' → '호놀룰루'
      country: context?.country || '',
      highlights: context?.highlights || [],
      styles: context?.styles || [],
      sampleItinerary: { days: duration || 4 }
    };
  }

  if (!dest) return null;
  if (!geminiModel) return generateMockItinerary(destination, duration, travelers, budget, startDateStr);

  try {
    const prompt = `당신은 ${dest.name}(${dest.country}) 전문 여행 플래너입니다.

다음 조건의 여행 일정을 JSON으로 생성하세요:
- 목적지: ${dest.name} (${dest.country})
- 기간: ${duration || dest.sampleItinerary?.days + '일'}
- 여행자: ${travelers || 2}명
- 예산: ${budget ? budget.toLocaleString() + '원' : '보통'}
- 여행 스타일: ${context?.preferences?.join(', ') || (dest.styles || []).join(', ') || '자유여행'}

## 필수 포함
- 대표 관광지: ${(dest.highlights || []).join(', ') || dest.name}
- 현지 맛집 (아침/점심/저녁)
- 이동 수단과 시간
- 각 항목 예상 비용 (원화)

## 응답 JSON 형식
{
  "days": [
    {
      "dayNumber": 1,
      "title": "도착 & 첫 탐험",
      "slots": [
        {"time": "09:00", "type": "flight", "icon": "✈️", "title": "인천공항 출발", "location": "인천", "cost": 0, "notes": "2시간 전 도착"}
      ]
    }
  ]
}

type 종류: flight, transport, hotel, food, activity, shopping
icon은 적절한 이모지를 사용하세요.
cost는 원화 숫자만 (숫자만, 단위 없이).
반드시 유효한 JSON만 응답하세요.`;

    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date();
      if (!startDateStr) startDate.setDate(startDate.getDate() + 45);

      const days = parsed.days.map((day, i) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
        const dayCost = day.slots.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
        return { dayNumber: day.dayNumber, date: dateStr, title: day.title, slots: day.slots, totalCost: dayCost };
      });

      const totalCost = days.reduce((sum, d) => sum + d.totalCost, 0);

      return {
        destination: { id: dest.id, name: dest.name, flag: dest.flag, country: dest.country },
        duration: `${days.length - 1}박${days.length}일`,
        days, totalCost,
        perPersonCost: Math.round(totalCost / (travelers || 1)),
        tips: [`${dest.name} 베스트 시즌: ${dest.bestSeason || '연중'}`, ...(dest.pros || []).slice(0, 2).map(p => `✅ ${p}`)]
      };
    }
  } catch (err) {
    console.error('AI itinerary generation failed:', err.message);
  }

  return generateMockItinerary(destination, duration, travelers, budget, startDateStr);
}

module.exports = {
  generateMockItinerary,
  generateWithAI
};
