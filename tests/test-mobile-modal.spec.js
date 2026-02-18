const { test, expect, devices } = require('@playwright/test');
const BASE_URL = 'http://localhost:3000';
const PIN = '3512';

// 모바일 뷰포트 테스트
test('모바일 뷰포트에서 모달 테스트', async ({ browser }) => {
  const iPhone = devices['iPhone 13'];
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();

  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // PIN 로그인
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  for (const digit of PIN) {
    await page.locator(`button:has-text("${digit}")`).first().click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(2000);

  // localStorage에 일정 주입 (detail 필드 있는 것 + 없는 것 혼합)
  await page.evaluate(() => {
    const project = {
      id: 'test-mobile-' + Date.now(),
      title: '🇯🇵 오사카 테스트',
      status: 'draft',
      travelType: 'free',
      destination: { id: 'osaka', name: '오사카', country: '일본', flag: '🇯🇵' },
      dates: { start: '2026-04-01', end: '2026-04-04' },
      travelers: 2,
      budget: { total: 2000000, categories: {} },
      milestones: [],
      tasks: [],
      departure: 'ICN'
    };

    const itinerary = {
      destination: { id: 'osaka', name: '오사카', flag: '🇯🇵', country: '일본' },
      duration: '3박4일',
      days: [{
        dayNumber: 1, date: '4/1', title: '도착일', totalCost: 100000,
        slots: [
          // detail 있는 슬롯
          { time: '13:00', type: 'food', icon: '🍜', title: '이치란 라멘', location: '도톤보리', cost: 12000, notes: '맛집',
            detail: {
              description: '테스트 설명',
              options: [{ name: '이치란', category: '라멘', priceRange: '1000엔', rating: 4.5, highlights: ['맛있음'], reason: '추천', mapQuery: '이치란 도톤보리' }],
              tips: ['팁1'], duration: '40분', reservationNeeded: false, childFriendly: true
            }
          },
          // detail 없는 food 슬롯 (enrichSlotDetail이 보강해야 함)
          { time: '19:00', type: 'food', icon: '🍣', title: '스시 오마카세', location: '신사이바시', cost: 30000, notes: '예약 추천' },
          // detail 없는 activity 슬롯
          { time: '15:00', type: 'activity', icon: '🏯', title: '오사카성 관광', location: '오사카성', cost: 5000, notes: '입장권 필요' },
          // flight 슬롯 (detail 없어야 정상)
          { time: '09:00', type: 'flight', icon: '✈️', title: '인천공항 출발', location: '인천공항', cost: 0, notes: '' },
          // generic 슬롯 (enrichSlotDetail이 건너뛰어야 함)
          { time: '07:00', type: 'food', icon: '🍳', title: '조식', location: '호텔', cost: 0, notes: '' }
        ]
      }],
      totalCost: 100000,
      perPersonCost: 50000
    };

    const state = {
      _version: 3, stage: 'PLANNING', aiMode: 'gemini',
      quotaExceeded: false, resetTime: null,
      userSettings: { homeCity: '서울', homeCountry: '대한민국', defaultTravelers: 2, defaultBudget: 2000000, defaultDeparture: 'ICN' },
      consulting: { messages: [], sessionId: 'test', recommendations: [], state: 'GREETING', context: {} },
      project, itinerary
    };
    localStorage.setItem('travelPMS_state', JSON.stringify(state));
    localStorage.setItem('travelPMS_nickname', '테스터');
    localStorage.setItem('travelPMS_lastProjectId', project.id);
  });

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // PIN이 다시 뜨면 입력
  const pinBtn = page.locator('button:has-text("3")').first();
  if (await pinBtn.isVisible().catch(() => false)) {
    for (const digit of PIN) {
      await page.locator(`button:has-text("${digit}")`).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(2000);
  }

  // 오사카 보이면 클릭
  const osakaBtn = page.locator('text=오사카').first();
  if (await osakaBtn.isVisible().catch(() => false)) {
    await osakaBtn.click();
    await page.waitForTimeout(2000);
  }

  // 닉네임 모달
  const nicknameModal = page.locator('text=함께 여행 계획해요');
  if (await nicknameModal.isVisible().catch(() => false)) {
    await page.locator('input[placeholder*="엄마"]').fill('테스터');
    await page.locator('button:has-text("시작하기")').click();
    await page.waitForTimeout(2000);
  }

  // 일정표 탭
  const itineraryTab = page.locator('text=📅 일정표');
  await expect(itineraryTab).toBeVisible({ timeout: 10000 });
  await itineraryTab.click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'test-results/mobile-itinerary.png', fullPage: true });

  // 슬롯 분석
  const allSlots = page.locator('[class*="rounded-lg border p-2.5"]');
  const totalSlots = await allSlots.count();
  console.log(`[모바일] 전체 슬롯: ${totalSlots}`);

  const clickableSlots = page.locator('[class*="cursor-pointer"][class*="rounded-lg"]');
  const clickableCount = await clickableSlots.count();
  console.log(`[모바일] 클릭 가능 슬롯: ${clickableCount}`);

  // 각 슬롯 상세
  for (let i = 0; i < totalSlots; i++) {
    const card = allSlots.nth(i);
    const text = (await card.innerText()).substring(0, 60).replace(/\n/g, ' ');
    const cls = await card.getAttribute('class');
    const hasCursor = cls?.includes('cursor-pointer') || false;
    console.log(`  슬롯${i}: ${hasCursor ? '✅' : '❌'} "${text}"`);
  }

  // 상세보기 텍스트 확인
  const detailTexts = await page.locator('text=상세보기').count();
  console.log(`[모바일] 상세보기 텍스트: ${detailTexts}개`);

  expect(clickableCount).toBeGreaterThan(0);

  // 첫 번째 클릭 가능한 슬롯 클릭 (tap)
  console.log('\n=== 모바일 탭(터치) 테스트 ===');
  const firstClickable = clickableSlots.first();
  await firstClickable.tap();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'test-results/mobile-after-tap.png', fullPage: true });

  // 모달 확인
  const modal = page.locator('.slide-up-modal');
  const modalVisible = await modal.isVisible().catch(() => false);
  console.log(`[모바일] 모달 표시: ${modalVisible}`);

  if (!modalVisible) {
    // click으로도 시도
    console.log('tap 실패, click으로 재시도...');
    await firstClickable.click();
    await page.waitForTimeout(1500);
    const modalVisible2 = await modal.isVisible().catch(() => false);
    console.log(`[모바일] click 후 모달: ${modalVisible2}`);
    await page.screenshot({ path: 'test-results/mobile-after-click.png', fullPage: true });

    if (!modalVisible2) {
      // fixed z-50 확인
      const fixedElements = await page.locator('.fixed.inset-0.z-50').count();
      console.log(`fixed inset-0 z-50 요소: ${fixedElements}`);
      const html = await page.locator('#root').innerHTML();
      console.log('HTML에 slide-up-modal:', html.includes('slide-up-modal'));
      console.log('HTML에 SlotDetailModal:', html.includes('SlotDetailModal'));
      
      // selectedSlot 상태 확인
      const hasSelectedSlot = await page.evaluate(() => {
        // React 내부 상태는 직접 접근 불가, DOM으로 확인
        return document.querySelector('.slide-up-modal') !== null;
      });
      console.log(`DOM에 slide-up-modal: ${hasSelectedSlot}`);
    }
  }

  if (modalVisible || await modal.isVisible().catch(() => false)) {
    const modalText = await modal.innerText();
    console.log(`모달 내용: ${modalText.substring(0, 300)}`);
    await page.screenshot({ path: 'test-results/mobile-modal-success.png', fullPage: true });
    
    // 모달 닫기
    await page.locator('button:has-text("✕")').click();
    await page.waitForTimeout(500);
  }

  expect(modalVisible || await page.locator('.slide-up-modal').isVisible().catch(() => false)).toBeTruthy();

  await context.close();
});
