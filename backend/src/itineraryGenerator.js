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
      { time: '13:00', type: 'food', icon: '🍜', title: '이치란 라멘', location: '도톤보리', cost: 12000, notes: '줄 서기 20-30분 예상',
        detail: {
          description: '오사카 도착 첫 식사! 도톤보리 라멘 거리에서 현지 인기 라멘을 맛보세요.',
          options: [
            { name: '이치란 라멘 도톤보리점', category: '라멘', priceRange: '890~1290엔 (약 8,000~12,000원)', rating: 4.5, highlights: ['24시간 영업', '1인석 특화', '돈코츠 라멘 전문'], reason: '개인 부스에서 편하게 먹을 수 있어 가족 여행에 적합', mapQuery: '이치란 라멘 도톤보리' },
            { name: '킨류 라멘', category: '라멘', priceRange: '약 700엔 (약 6,500원)', rating: 4.3, highlights: ['도톤보리 랜드마크', '가성비 최고', '금용 간판'], reason: '도톤보리 상징인 금용 간판 아래 위치, 저렴하고 양 많음', mapQuery: '킨류라멘 도톤보리' },
            { name: '카무쿠라 라멘', category: '라멘', priceRange: '약 850엔 (약 7,800원)', rating: 4.2, highlights: ['담백한 맛', '여성 인기', '야채 라멘'], reason: '진한 돈코츠가 부담스러우면 담백한 카무쿠라 추천', mapQuery: '카무쿠라 난바' }
          ],
          tips: ['점심시간(11~13시) 피크 피하기', '쿠폰 자판기로 먼저 주문 후 착석'],
          duration: '약 40분',
          reservationNeeded: false,
          childFriendly: true
        }
      },
      { time: '14:30', type: 'hotel', icon: '🏨', title: '호텔 체크인', location: '난바역 근처', cost: 120000, notes: '짐 맡기고 외출',
        detail: {
          description: '난바역 도보 5분 이내 호텔 추천. 도톤보리/신사이바시 접근성 최고.',
          options: [
            { name: '크로스호텔 오사카', category: '디자인 호텔', priceRange: '1박 12~18만원', rating: 4.4, highlights: ['난바역 3분', '모던 인테리어', '루프탑 바'], reason: '도톤보리 바로 옆, 깔끔한 시설과 위치 최고', mapQuery: '크로스호텔 오사카' },
            { name: '도톤보리 호텔', category: '비즈니스 호텔', priceRange: '1박 8~12만원', rating: 4.1, highlights: ['도톤보리 위치', '가성비', '편의점 근처'], reason: '도톤보리 한복판, 가격 대비 위치가 뛰어남', mapQuery: '도톤보리 호텔' },
            { name: '스위소텔 난카이 오사카', category: '럭셔리', priceRange: '1박 20~35만원', rating: 4.6, highlights: ['난바역 직결', '고층 뷰', '수영장'], reason: '난카이 라피트 하차 후 바로 체크인 가능, 프리미엄 옵션', mapQuery: '스위소텔 난카이 오사카' }
          ],
          tips: ['체크인 전 짐은 프론트에 맡기기 가능', '난바역 직결 호텔이면 비 오는 날 편리'],
          duration: '약 20분',
          reservationNeeded: true,
          childFriendly: true
        }
      },
      { time: '15:30', type: 'activity', icon: '🏯', title: '도톤보리 산책', location: '도톤보리', cost: 0, notes: '글리코 사인 포토 스팟',
        detail: {
          description: '오사카의 상징 도톤보리! 글리코 사인, 거대 간판들, 운하를 따라 산책하세요.',
          options: [
            { name: '글리코 사인 포토스팟', category: '랜드마크', priceRange: '무료', rating: 4.7, highlights: ['오사카 대표 포토스팟', '에비스바시 위', '야경 필수'], reason: '오사카 여행 인증샷 필수 장소', mapQuery: '글리코 사인 도톤보리' },
            { name: '도톤보리 리버크루즈', category: '체험', priceRange: '약 900엔 (약 8,300원)', rating: 4.3, highlights: ['20분 운하 크루즈', '야경 감상', '사진 촬영'], reason: '운하에서 보는 도톤보리 네온 야경이 색다름', mapQuery: '도톤보리 리버크루즈' },
            { name: '호젠지 요코초', category: '골목', priceRange: '무료', rating: 4.4, highlights: ['전통 골목길', '이끼 부동명왕', '소원 빌기'], reason: '번화가 뒤편 숨겨진 전통 골목, 조용하고 분위기 있음', mapQuery: '호젠지 요코초 오사카' }
          ],
          tips: ['글리코 사인은 저녁에 조명 켜진 후 촬영 추천', '호젠지 요코초는 도톤보리 남쪽 골목'],
          duration: '약 1시간 30분',
          reservationNeeded: false,
          childFriendly: true
        }
      },
      { time: '17:00', type: 'shopping', icon: '🛍️', title: '신사이바시 쇼핑', location: '신사이바시스지', cost: 50000, notes: '돈키호테, 드럭스토어' },
      { time: '19:00', type: 'food', icon: '🐙', title: '타코야키 & 오코노미야키', location: '도톤보리', cost: 15000, notes: '쿠쿠루 타코야키 추천',
        detail: {
          description: '오사카의 소울푸드! 타코야키와 오코노미야키를 본고장에서 맛보세요.',
          options: [
            { name: '쿠쿠루 타코야키', category: '타코야키', priceRange: '약 600엔 (약 5,500원)', rating: 4.5, highlights: ['도톤보리 본점', '큰 문어 조각', '바삭한 식감'], reason: '관광객과 현지인 모두 인정하는 타코야키 맛집', mapQuery: '쿠쿠루 타코야키 도톤보리' },
            { name: '치보 오코노미야키', category: '오코노미야키', priceRange: '약 1,000~1,500엔 (약 9,200~13,800원)', rating: 4.4, highlights: ['1973년 창업', '도톤보리 본점', '돼지고기 믹스'], reason: '오사카식 오코노미야키 원조 맛을 경험', mapQuery: '치보 오코노미야키 도톤보리' },
            { name: '아지노야 타코야키', category: '타코야키', priceRange: '약 500엔 (약 4,600원)', rating: 4.2, highlights: ['소스 없이 먹는 스타일', '현지인 추천', '간식용'], reason: '소금만으로 먹는 담백한 타코야키, 현지인 단골집', mapQuery: '아지노야 타코야키' }
          ],
          tips: ['타코야키는 갓 나온 것이 매우 뜨거우니 주의', '오코노미야키는 직접 굽는 가게도 있음'],
          duration: '약 45분',
          reservationNeeded: false,
          childFriendly: true
        }
      },
      { time: '21:00', type: 'activity', icon: '🌃', title: '도톤보리 야경', location: '에비스바시', cost: 0, notes: '네온사인 포토타임' }
    ],
    usj: [
      { time: '07:30', type: 'food', icon: '🥐', title: '호텔 조식 / 편의점', location: '호텔', cost: 5000, notes: '가볍게 먹기' },
      { time: '08:30', type: 'transport', icon: '🚃', title: '유니버셜시티역 이동', location: 'JR', cost: 3000, notes: '니시쿠조 환승' },
      { time: '09:00', type: 'activity', icon: '🎢', title: 'USJ 오픈 입장', location: 'USJ', cost: 85000, notes: '익스프레스 패스 필수',
        detail: {
          description: '유니버셜 스튜디오 재팬! 해리포터, 닌텐도월드, 쥬라기파크 등 인기 어트랙션 가득.',
          options: [
            { name: '1데이 스튜디오 패스', category: '입장권', priceRange: '약 8,600엔~ (약 79,000원~)', rating: 4.7, highlights: ['전체 구역 입장', '날짜별 가격 변동', '온라인 사전 구매'], reason: '기본 입장권, 성수기에는 가격 상승', mapQuery: 'USJ 유니버셜 스튜디오 재팬' },
            { name: '익스프레스 패스 4', category: '패스트패스', priceRange: '약 7,800엔~ (약 71,800원~)', rating: 4.5, highlights: ['4개 어트랙션 우선탑승', '대기시간 단축', '한정판매'], reason: '인기 어트랙션 대기시간 1~2시간 절약', mapQuery: 'USJ 익스프레스 패스' }
          ],
          tips: ['공식 앱으로 대기시간 실시간 확인', '오픈 30분 전 도착 추천', '익스프레스 패스는 사전 온라인 구매 필수'],
          duration: '종일 (약 10~12시간)',
          reservationNeeded: true,
          childFriendly: true
        }
      },
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
      { time: '08:00', type: 'food', icon: '☕', title: '카페 모닝', location: '호텔 근처', cost: 8000, notes: '일본식 모닝 세트',
        detail: {
          description: '일본 특유의 모닝 세트 문화를 체험하세요. 음료 가격에 토스트+계란+샐러드가 포함!',
          options: [
            { name: '코메다 커피', category: '카페', priceRange: '약 500~800엔 (약 4,600~7,400원)', rating: 4.3, highlights: ['모닝 세트 무료', '두꺼운 토스트', '전국 체인'], reason: '11시까지 음료 주문 시 토스트+계란 무료 제공', mapQuery: '코메다 커피 난바' },
            { name: '호시노 커피', category: '카페', priceRange: '약 600~1,000엔 (약 5,500~9,200원)', rating: 4.4, highlights: ['핸드드립', '수플레 팬케이크', '분위기 좋음'], reason: '여유로운 아침을 원한다면 추천', mapQuery: '호시노 커피 오사카' }
          ],
          tips: ['11시 전에 방문해야 모닝 세트 이용 가능', '편의점 오니기리도 훌륭한 대안'],
          duration: '약 30분',
          reservationNeeded: false,
          childFriendly: true
        }
      },
      { time: '09:30', type: 'activity', icon: '🏯', title: '오사카성 관람', location: '오사카성공원', cost: 8000, notes: '천수각 전망대 포함',
        detail: {
          description: '도요토미 히데요시가 세운 일본 3대 명성. 천수각 전망대에서 오사카 시내를 한눈에!',
          options: [
            { name: '오사카성 천수각', category: '역사', priceRange: '600엔 (약 5,500원)', rating: 4.5, highlights: ['8층 전망대', '역사 전시', '갑옷 체험'], reason: '오사카의 상징, 전망대에서 도시 전경 감상', mapQuery: '오사카성 천수각' },
            { name: '니시노마루 정원', category: '정원', priceRange: '200엔 (약 1,800원)', rating: 4.3, highlights: ['벚꽃 명소', '오사카성 포토스팟', '잔디 광장'], reason: '성 서쪽에서 가장 아름다운 오사카성 사진 촬영 가능', mapQuery: '니시노마루 정원 오사카성' }
          ],
          tips: ['오전 10시 전 방문 시 한적함', '엘리베이터는 5층까지, 이후 계단'],
          duration: '약 1시간 30분',
          reservationNeeded: false,
          childFriendly: true
        }
      },
      { time: '11:30', type: 'activity', icon: '🌸', title: '오사카성 공원 산책', location: '오사카성공원', cost: 0, notes: '포토스팟 다수' },
      { time: '12:30', type: 'food', icon: '🍣', title: '구로몬 시장 투어', location: '구로몬시장', cost: 20000, notes: '참치, 성게, 딸기',
        detail: {
          description: '"오사카의 부엌" 구로몬시장에서 신선한 해산물과 과일을 맛보세요!',
          options: [
            { name: '구로몬 사시미 가게', category: '해산물', priceRange: '약 1,000~3,000엔 (약 9,200~27,600원)', rating: 4.6, highlights: ['참치회', '성게 알', '신선 사시미'], reason: '시장 내 즉석에서 써는 회가 최고 신선', mapQuery: '구로몬시장 사시미' },
            { name: '구로몬 딸기 가게', category: '과일', priceRange: '약 500~1,500엔 (약 4,600~13,800원)', rating: 4.4, highlights: ['이치고 다이후쿠', '딸기 꼬치', '시즌 과일'], reason: '일본 딸기의 달콤함을 현장에서 즉시 맛볼 수 있음', mapQuery: '구로몬시장 딸기' },
            { name: '다이와 스시', category: '스시', priceRange: '약 1,500~2,500엔 (약 13,800~23,000원)', rating: 4.5, highlights: ['참치 스시', '카운터석', '시장 분위기'], reason: '시장에서 바로 잡은 재료로 만든 스시', mapQuery: '다이와 스시 구로몬시장' }
          ],
          tips: ['현금 준비 (카드 안 되는 곳 많음)', '오후 3시 이후 문 닫는 가게 많으니 일찍 방문'],
          duration: '약 1시간 30분',
          reservationNeeded: false,
          childFriendly: true
        }
      },
      { time: '14:30', type: 'transport', icon: '🚃', title: 'JR로 교토 이동', location: 'JR 오사카역', cost: 8000, notes: '약 30분' },
      { time: '15:30', type: 'activity', icon: '⛩️', title: '후시미 이나리 신사', location: '교토', cost: 0, notes: '천 개의 도리이',
        detail: {
          description: '주홍색 도리이가 끝없이 이어지는 신비로운 신사. 교토 인기 1위 관광지!',
          options: [
            { name: '후시미 이나리 도리이 터널', category: '신사', priceRange: '무료', rating: 4.8, highlights: ['천본도리이', '24시간 개방', '정상 왕복 2시간'], reason: '교토 여행 필수 코스, 사진 촬영 명소', mapQuery: '후시미 이나리 타이샤' },
            { name: '이나리산 정상 하이킹', category: '하이킹', priceRange: '무료', rating: 4.5, highlights: ['왕복 2시간', '교토 전경', '운동'], reason: '체력이 된다면 정상까지 올라가면 교토 시내가 한눈에', mapQuery: '이나리산 정상' }
          ],
          tips: ['오전이나 해질 무렵이 사진 찍기 좋음', '정상까지 안 가도 중간 전망대에서 좋은 뷰'],
          duration: '약 1시간~2시간',
          reservationNeeded: false,
          childFriendly: true
        }
      },
      { time: '17:30', type: 'activity', icon: '🎋', title: '기온 거리 산책', location: '교토', cost: 0, notes: '게이샤 만남 가능' },
      { time: '19:00', type: 'food', icon: '🍖', title: '교토역 저녁', location: '교토역 빌딩', cost: 15000, notes: '규카츠, 라멘',
        detail: {
          description: '교토역 빌딩 10층 라멘 골목 또는 지하 레스토랑가에서 저녁!',
          options: [
            { name: '교토 규카츠 교토카츠규', category: '규카츠', priceRange: '약 1,500~2,500엔 (약 13,800~23,000원)', rating: 4.5, highlights: ['레어 규카츠', '셀프 조리', '교토 본점'], reason: '겉은 바삭 속은 레어한 규카츠를 돌판에서 직접 구워 먹기', mapQuery: '교토카츠규 교토역' },
            { name: '마스타니 라멘', category: '라멘', priceRange: '약 800엔 (약 7,400원)', rating: 4.3, highlights: ['교토 라멘', '닭뼈 육수', '진한 맛'], reason: '교토 스타일 닭뼈 라멘의 대표 맛집', mapQuery: '마스타니 라멘 교토역' },
            { name: '나카무라 우동', category: '우동', priceRange: '약 700엔 (약 6,400원)', rating: 4.2, highlights: ['교토식 우동', '가볍게 먹기', '다시 국물'], reason: '교토 특유의 담백한 다시 국물 우동', mapQuery: '나카무라 우동 교토역' }
          ],
          tips: ['교토역 10층 라멘 골목은 줄이 길 수 있음', '이세탄 지하 식품관도 도시락 선택지 풍부'],
          duration: '약 50분',
          reservationNeeded: false,
          childFriendly: true
        }
      },
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
      { time: '19:00', type: 'food', icon: '🍜', title: '이자카야 저녁', location: '신주쿠', cost: 20000, notes: '오모이데 요코초',
        detail: {
          description: '신주쿠 뒷골목 오모이데 요코초(추억의 골목)에서 일본 이자카야 문화 체험!',
          options: [
            { name: '오모이데 요코초 야키토리', category: '야키토리', priceRange: '약 1,000~2,000엔 (약 9,200~18,400원)', rating: 4.4, highlights: ['숯불 야키토리', '레트로 분위기', '현지인 맛집'], reason: '좁은 골목의 활기찬 분위기와 숯불 향이 매력적', mapQuery: '오모이데 요코초 신주쿠' },
            { name: '이세야 야키토리', category: '야키토리', priceRange: '약 800~1,500엔 (약 7,400~13,800원)', rating: 4.3, highlights: ['1928년 창업', '키치조지 본점', '저렴한 가격'], reason: '역사 깊은 야키토리 전문점', mapQuery: '이세야 야키토리 신주쿠' },
            { name: '토라후구테이 (복어)', category: '이자카야', priceRange: '약 3,000~5,000엔 (약 27,600~46,000원)', rating: 4.5, highlights: ['복어 회', '복어 냄비', '코스 요리'], reason: '특별한 저녁을 원한다면 복어 코스 추천', mapQuery: '토라후구테이 신주쿠' }
          ],
          tips: ['오모이데 요코초는 금연석 거의 없음', '현금만 받는 가게 많으니 현금 준비'],
          duration: '약 1시간',
          reservationNeeded: false,
          childFriendly: false
        }
      },
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
      { time: '18:30', type: 'food', icon: '🍜', title: '쌀국수 저녁', location: '미케비치', cost: 5000, notes: '포보 or 분짜',
        detail: {
          description: '베트남 대표 음식 쌀국수(포)와 분짜를 현지에서 맛보세요!',
          options: [
            { name: '포 29', category: '쌀국수', priceRange: '약 40,000~60,000동 (약 2,200~3,300원)', rating: 4.4, highlights: ['현지인 맛집', '가성비 최고', '소고기 쌀국수'], reason: '현지인들이 많이 찾는 진짜 베트남 쌀국수', mapQuery: '포 29 다낭' },
            { name: '반미 바', category: '반미', priceRange: '약 25,000~35,000동 (약 1,400~1,900원)', rating: 4.3, highlights: ['베트남 바게트 샌드위치', '다양한 속재료', '테이크아웃'], reason: '쌀국수와 함께 베트남 3대 음식 반미도 꼭 맛보기', mapQuery: '반미 바 다낭' },
            { name: '분짜 109', category: '분짜', priceRange: '약 50,000~70,000동 (약 2,800~3,900원)', rating: 4.5, highlights: ['숯불 고기', '느억맘 소스', '하노이 스타일'], reason: '달콤한 느억맘에 찍어 먹는 분짜가 중독적', mapQuery: '분짜 109 다낭' }
          ],
          tips: ['길거리 음식도 대부분 안전하고 맛있음', '빈 그룹 식당이 관광객에게 편리'],
          duration: '약 30분',
          reservationNeeded: false,
          childFriendly: true
        }
      },
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
      { time: '05:00', type: 'activity', icon: '🎈', title: '카파도키아 열기구 투어', location: '괴레메', cost: 250000, notes: '일출 열기구, 사전예약 필수!',
        detail: {
          description: '카파도키아의 하이라이트! 일출과 함께 기암괴석 위를 떠다니는 열기구 체험.',
          options: [
            { name: 'Royal Balloon', category: '열기구', priceRange: '약 200~300유로 (약 28~42만원)', rating: 4.8, highlights: ['프리미엄 업체', '소규모 바구니', '샴페인 서비스'], reason: '소규모 탑승(12~16인)으로 쾌적한 비행 경험', mapQuery: 'Royal Balloon Cappadocia' },
            { name: 'Butterfly Balloons', category: '열기구', priceRange: '약 180~250유로 (약 25~35만원)', rating: 4.7, highlights: ['경험 많은 파일럿', '사진 서비스', '중간 가격대'], reason: '안전하고 경치 좋은 루트로 유명', mapQuery: 'Butterfly Balloons Cappadocia' },
            { name: 'Voyager Balloons', category: '열기구', priceRange: '약 150~200유로 (약 21~28만원)', rating: 4.5, highlights: ['가성비', '호텔 픽업', '조식 포함'], reason: '합리적 가격에 호텔 픽업과 간단한 조식 포함', mapQuery: 'Voyager Balloons Cappadocia' }
          ],
          tips: ['최소 2주 전 예약 필수 (성수기 매진)', '기상 조건으로 취소될 수 있으니 일정 초반에 배치', '따뜻한 옷 준비 (새벽 고도 높으면 추움)'],
          duration: '약 1시간 (비행) + 픽업/이동 포함 3시간',
          reservationNeeded: true,
          childFriendly: false
        }
      },
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

async function generateMockItinerary(destination, duration, travelers, budget, startDateStr) {
  let dest = typeof destination === 'string'
    ? (await getDestinationById(destination)) || (await getDestinationByName(destination))
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

// 도시명 별칭 → 정규 이름 (비행시간/시차 매핑용)
const cityAliasMap = {
  '호놀룰루': '하와이', '오아후': '하와이', '오하우': '하와이', '와이키키': '하와이', '마우이': '하와이', '빅아일랜드': '하와이', '카우아이': '하와이',
  '동경': '도쿄', '나하': '오키나와',
  '덴파사르': '발리', '우붓': '발리',
  '사이공': '호치민', '호이안': '다낭', '후에': '다낭',
  '로스앤젤레스': 'LA', '엘에이': 'LA',
  '타이페이': '타이베이', '세부시티': '세부', '막탄': '세부',
  '앙카라': '이스탄불'
};
function resolveCity(name) { return cityAliasMap[name] || name; }

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
  const fh = flightHoursMap[resolveCity(dest.name)] || 3;
  // 시차 (한국 기준 도착 시간 계산)
  const timeDiffMap = { '도쿄': 0, '오사카': 0, '방콕': -2, '이스탄불': -6, '파리': -8, '런던': -9, '뉴욕': -14, 'LA': -17, '하와이': -19, '시드니': 1, '발리': -1 };
  const timeDiff = timeDiffMap[resolveCity(dest.name)] || 0;
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
    const fh = flightHoursMap[resolveCity(dest.name)] || 3;
    const timeDiffMap = { '도쿄': 0, '오사카': 0, '방콕': -2, '이스탄불': -6, '파리': -8, '런던': -9, '뉴욕': -14, 'LA': -17, '하와이': -19, '시드니': 1, '발리': -1 };
    const timeDiff = timeDiffMap[resolveCity(dest.name)] || 0;
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
    ? (await getDestinationById(destination)) || (await getDestinationByName(destination))
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

## 상세 정보 (detail 필드) 규칙
food(식사) 슬롯은 반드시 detail 포함:
- options: 실제 식당 2~3곳 (name, category, priceRange, rating, highlights 배열, reason)
- tips: 실용 팁 1~2개
- duration: 소요시간, reservationNeeded: 예약 필요 여부, childFriendly: 아이 동반 적합

activity(관광) 슬롯도 detail 포함:
- description: 명소 설명, options: 관련 명소/코스 2~3개 (name, priceRange, rating, highlights, reason)
- tips: 포토스팟, 주의사항

hotel(숙소) 슬롯도 detail 포함:
- options: 호텔 2~3곳 (name, category, priceRange, rating, highlights, reason)

transport(교통) 슬롯: detail 생략 가능.

## 응답 JSON 형식
{
  "days": [
    {
      "dayNumber": 1,
      "title": "도착 & 첫 탐험",
      "slots": [
        {
          "time": "09:00", "type": "flight", "icon": "✈️", "title": "인천공항 출발",
          "location": "인천", "cost": 0, "notes": "2시간 전 도착"
        },
        {
          "time": "13:00", "type": "food", "icon": "🍜", "title": "이치란 라멘",
          "location": "도톤보리", "cost": 12000, "notes": "줄 서기 20분 예상",
          "detail": {
            "description": "오사카 대표 라멘 거리에서 현지 인기 라멘 맛보기",
            "options": [
              {"name": "이치란 라멘 도톤보리점", "category": "라멘", "priceRange": "890~1290엔 (약 8,000~12,000원)", "rating": 4.5, "highlights": ["24시간 영업", "1인석 특화"], "reason": "개인 부스에서 편하게 식사 가능"},
              {"name": "킨류 라멘", "category": "라멘", "priceRange": "약 8,000원", "rating": 4.3, "highlights": ["도톤보리 랜드마크", "가성비"], "reason": "금용 간판이 유명한 맛집"}
            ],
            "tips": ["점심시간 피크 피하기", "쿠폰 자판기로 주문"],
            "duration": "약 40분",
            "reservationNeeded": false,
            "childFriendly": true
          }
        }
      ]
    }
  ]
}

type 종류: flight, transport, hotel, food, activity, shopping
icon은 적절한 이모지를 사용하세요.
cost는 원화 숫자만 (숫자만, 단위 없이).
food/activity/hotel 슬롯에는 반드시 detail 필드를 포함하세요.
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
