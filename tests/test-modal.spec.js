const { test, expect } = require('@playwright/test');
const BASE_URL = 'http://localhost:3000';
const PIN = '3512';

test('슬롯 상세 모달 테스트 - 프로젝트 생성부터', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('api')) console.log('CONSOLE ERROR:', msg.text());
  });

  // 1. PIN 로그인
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  for (const digit of PIN) {
    await page.locator(`button:has-text("${digit}")`).first().click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(2000);

  // 2. localStorage에 오사카 프로젝트 + 일정 직접 주입
  await page.evaluate(() => {
    const project = {
      id: 'test-osaka-' + Date.now(),
      title: '🇯🇵 오사카 자유여행',
      status: 'draft',
      travelType: 'free',
      destination: { id: 'osaka', name: '오사카', country: '일본', flag: '🇯🇵' },
      dates: { start: '2026-04-01', end: '2026-04-04' },
      travelers: 2,
      budget: { total: 2000000, categories: { accommodation: 600000, food: 400000, activity: 300000, transport: 300000, other: 400000 } },
      milestones: [],
      tasks: [
        { id: 't1', title: '숙소 예약', category: 'accommodation', priority: 'high', status: 'pending', milestone: 'd-45', estimatedCost: 360000, links: [] },
        { id: 't2', title: '항공권 예약', category: 'transportation', priority: 'high', status: 'pending', milestone: 'd-45', estimatedCost: 550000, links: [] }
      ],
      departure: 'ICN'
    };

    const itinerary = {
      destination: { id: 'osaka', name: '오사카', flag: '🇯🇵', country: '일본' },
      duration: '3박4일',
      days: [
        {
          dayNumber: 1, date: '4/1 (수)', title: '출발 & 도착', totalCost: 212000,
          slots: [
            { time: '09:00', type: 'flight', icon: '✈️', title: '인천공항 출발', location: '인천국제공항', cost: 0, notes: '2시간 전 도착' },
            { time: '11:00', type: 'flight', icon: '🛬', title: '간사이공항 도착', location: '간사이국제공항', cost: 0, notes: '입국심사 30-40분' },
            { time: '13:00', type: 'food', icon: '🍜', title: '이치란 라멘', location: '도톤보리', cost: 12000, notes: '줄 서기 20-30분',
              detail: {
                description: '오사카 도착 첫 식사! 도톤보리 라멘 거리에서 현지 인기 라멘을 맛보세요.',
                options: [
                  { name: '이치란 라멘 도톤보리점', category: '라멘', priceRange: '890~1290엔', rating: 4.5, highlights: ['24시간 영업', '1인석 특화', '돈코츠 라멘'], reason: '개인 부스에서 편하게 식사 가능', mapQuery: '이치란 라멘 도톤보리' },
                  { name: '킨류 라멘', category: '라멘', priceRange: '약 700엔', rating: 4.3, highlights: ['도톤보리 랜드마크', '가성비'], reason: '금용 간판이 유명한 맛집', mapQuery: '킨류라멘 도톤보리' },
                  { name: '카무쿠라 라멘', category: '라멘', priceRange: '약 850엔', rating: 4.2, highlights: ['담백한 맛', '여성 인기'], reason: '진한 돈코츠가 부담이면 추천', mapQuery: '카무쿠라 난바' }
                ],
                tips: ['점심 피크(11~13시) 피하기', '쿠폰 자판기로 주문'],
                duration: '약 40분',
                reservationNeeded: false,
                childFriendly: true
              }
            },
            { time: '14:30', type: 'hotel', icon: '🏨', title: '호텔 체크인', location: '난바역 근처', cost: 120000, notes: '짐 맡기고 외출' },
            { time: '15:30', type: 'activity', icon: '🏯', title: '도톤보리 산책', location: '도톤보리', cost: 0, notes: '글리코 사인 포토 스팟' },
            { time: '19:00', type: 'food', icon: '🐙', title: '타코야키', location: '도톤보리', cost: 15000, notes: '쿠쿠루 타코야키' }
          ]
        }
      ],
      totalCost: 212000,
      perPersonCost: 106000
    };

    const state = {
      _version: 3,
      stage: 'PLANNING',
      aiMode: 'gemini',
      quotaExceeded: false,
      resetTime: null,
      userSettings: { homeCity: '서울', homeCountry: '대한민국', defaultTravelers: 2, defaultBudget: 2000000, defaultDeparture: 'ICN' },
      consulting: { messages: [], sessionId: 'test', recommendations: [], state: 'GREETING', context: {} },
      project: project,
      itinerary: itinerary
    };

    localStorage.setItem('travelPMS_state', JSON.stringify(state));
    localStorage.setItem('travelPMS_nickname', '테스터');
    localStorage.setItem('travelPMS_lastProjectId', project.id);
  });

  // 3. 페이지 새로고침 (주입된 데이터 로드) - 리로드 후 PIN 없이 바로 프로젝트 진입됨
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // PIN 화면이 뜨면 다시 입력
  const pinBtn = page.locator('button:has-text("3")').first();
  if (await pinBtn.isVisible().catch(() => false)) {
    for (const digit of PIN) {
      await page.locator(`button:has-text("${digit}")`).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2000);
  }

  // 오사카 프로젝트가 보이면 클릭
  const osakaBtn = page.locator('text=오사카').first();
  if (await osakaBtn.isVisible().catch(() => false)) {
    await osakaBtn.click();
    await page.waitForTimeout(2000);
  }

  // 닉네임 모달 처리
  const nicknameModal = page.locator('text=함께 여행 계획해요');
  if (await nicknameModal.isVisible().catch(() => false)) {
    await page.locator('input[placeholder*="엄마"]').fill('테스터');
    await page.locator('button:has-text("시작하기")').click();
    await page.waitForTimeout(2000);
  }

  // 4. 일정표 탭 클릭
  console.log('\n=== 일정표 탭 클릭 ===');
  const itineraryTab = page.locator('text=📅 일정표');
  await expect(itineraryTab).toBeVisible({ timeout: 5000 });
  await itineraryTab.click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'test-results/modal-itinerary-tab.png', fullPage: true });

  // 5. enrichSlotDetail 함수 존재 확인
  const hasEnrichFn = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="text/babel"]');
    for (const s of scripts) {
      if (s.textContent.includes('enrichSlotDetail')) return true;
    }
    return false;
  });
  console.log(`enrichSlotDetail 함수 존재: ${hasEnrichFn}`);

  // 6. "상세보기" 텍스트 확인
  const detailBtns = page.locator('text=상세보기');
  const detailCount = await detailBtns.count();
  console.log(`"상세보기" 텍스트 개수: ${detailCount}`);

  // 7. 슬롯 카드 확인
  const allSlotCards = page.locator('[class*="rounded-lg border p-2.5"]');
  const totalSlots = await allSlotCards.count();
  console.log(`전체 슬롯 카드 수: ${totalSlots}`);

  // cursor-pointer 있는 슬롯 확인
  const clickableSlots = page.locator('[class*="cursor-pointer"][class*="rounded-lg"]');
  const clickableCount = await clickableSlots.count();
  console.log(`클릭 가능한(cursor-pointer) 슬롯: ${clickableCount}`);

  // 각 슬롯의 class 확인
  for (let i = 0; i < Math.min(totalSlots, 6); i++) {
    const card = allSlotCards.nth(i);
    const text = (await card.innerText()).substring(0, 50).replace(/\n/g, ' ');
    const cls = await card.getAttribute('class');
    const hasCursor = cls?.includes('cursor-pointer') || false;
    const hasDetail = cls?.includes('hover:shadow') || false;
    console.log(`  슬롯${i}: ${hasCursor ? '✅클릭OK' : '❌클릭X'} "${text}"`);
  }

  if (clickableCount > 0) {
    // 8. 첫 번째 클릭 가능 슬롯 클릭
    console.log('\n=== 클릭 가능 슬롯 클릭! ===');
    const firstClickable = clickableSlots.first();
    await firstClickable.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/modal-after-click.png', fullPage: true });

    // 9. 모달 확인
    const modal = page.locator('.slide-up-modal');
    const modalVisible = await modal.isVisible().catch(() => false);
    console.log(`모달 표시됨: ${modalVisible}`);

    if (modalVisible) {
      const modalText = await modal.innerText();
      console.log(`\n=== 모달 내용 ===`);
      console.log(modalText.substring(0, 600));

      const medals = await modal.locator('text=/🥇|🥈|🥉/').count();
      console.log(`\n추천 선택지(메달): ${medals}개`);

      const tips = await modal.locator('text=실용 팁').count();
      console.log(`실용 팁 섹션: ${tips > 0 ? '✅' : '❌'}`);

      await page.screenshot({ path: 'test-results/modal-open-success.png', fullPage: true });

      // 닫기
      await page.locator('button:has-text("✕")').click();
      await page.waitForTimeout(500);
      const closed = !(await modal.isVisible().catch(() => false));
      console.log(`모달 닫기: ${closed ? '✅' : '❌'}`);

      expect(modalVisible).toBeTruthy();
      expect(medals).toBeGreaterThan(0);
    } else {
      console.log('❌ 모달 안 뜸!');
      // 전체 HTML에서 SlotDetailModal 확인
      const html = await page.locator('#root').innerHTML();
      console.log('fixed z-50 포함:', html.includes('fixed inset-0 z-50'));
      console.log('slide-up-modal 포함:', html.includes('slide-up-modal'));
      await page.screenshot({ path: 'test-results/modal-failed.png', fullPage: true });
      expect(modalVisible).toBeTruthy();
    }
  } else {
    console.log('\n❌ 클릭 가능한 슬롯이 없음! detail 보강이 안 됨');
    await page.screenshot({ path: 'test-results/modal-no-clickable.png', fullPage: true });
    expect(clickableCount).toBeGreaterThan(0);
  }

  console.log(`\n페이지 에러: ${errors.length > 0 ? errors.join(', ') : '없음'}`);
});
