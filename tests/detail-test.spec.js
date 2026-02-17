const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const PIN = '3512';

async function loginWithPIN(page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  for (const digit of PIN) {
    await page.locator(`button:has-text("${digit}")`).first().click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1500);
}

test('프로젝트 상세 - 닉네임 입력 후 전체 화면 확인', async ({ page }) => {
  const errors = [];
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning' && !msg.text().includes('tailwindcss') && !msg.text().includes('Babel')) {
      consoleWarnings.push(msg.text());
    }
  });

  await loginWithPIN(page);
  await page.waitForTimeout(1000);

  // 부산 프로젝트 클릭
  await page.locator('text=부산').first().click();
  await page.waitForTimeout(2000);

  // 닉네임 모달 확인
  const nicknameModal = page.locator('text=함께 여행 계획해요');
  const hasModal = await nicknameModal.isVisible().catch(() => false);
  console.log(`닉네임 모달 표시: ${hasModal}`);

  if (hasModal) {
    // 닉네임 입력
    const input = page.locator('input[placeholder*="엄마"]');
    await input.fill('테스터');
    await page.locator('button:has-text("시작하기")').click();
    await page.waitForTimeout(2000);
    console.log('닉네임 입력 완료');
  }

  // 상세 화면 확인
  const bodyText = await page.locator('body').innerText();
  console.log(`=== 상세 화면 텍스트 (첫 1500자) ===`);
  console.log(bodyText.substring(0, 1500));

  // 탭들 확인
  const tabs = ['조견표', '일정표', '시뮬', '지도', '할일', '예산', '비상', '공유'];
  for (const tab of tabs) {
    const exists = await page.locator(`text=${tab}`).count() > 0;
    console.log(`탭 "${tab}": ${exists ? '✅' : '❌'}`);
  }

  await page.screenshot({ path: 'test-results/detail-after-nickname.png', fullPage: true });

  // 각 탭 클릭해서 에러 확인
  const tabsToTest = ['📊 조견표', '📅 일정표', '🧮 시뮬', '🗺️ 지도', '✅ 할일', '💰 예산', '🆘 비상', '👨‍👩‍👧‍👦 공유'];
  for (const tabText of tabsToTest) {
    const tabBtn = page.locator(`text="${tabText}"`).first();
    if (await tabBtn.count() > 0) {
      await tabBtn.click();
      await page.waitForTimeout(1500);

      const content = await page.locator('#root').innerHTML();
      const isEmpty = content.trim().length < 100;
      console.log(`\n탭 "${tabText}" 클릭 후: ${isEmpty ? '❌ 빈 화면!' : '✅ 내용 있음'} (${content.length}자)`);

      if (isEmpty) {
        console.log(`빈 화면 HTML: ${content}`);
      }

      if (errors.length > 0) {
        console.log(`  에러 발생: ${errors[errors.length - 1]}`);
      }

      await page.screenshot({ path: `test-results/tab-${tabText.replace(/[^\w]/g, '')}.png`, fullPage: true });
    }
  }

  console.log(`\n=== 최종 결과 ===`);
  console.log(`페이지 에러: ${errors.length > 0 ? errors.join('\n  ') : '없음'}`);
  console.log(`콘솔 에러: ${consoleErrors.length > 0 ? consoleErrors.join('\n  ') : '없음'}`);
  console.log(`콘솔 경고: ${consoleWarnings.length > 0 ? consoleWarnings.join('\n  ') : '없음'}`);

  expect(errors.length).toBe(0);
});

test('뒤로가기 후 다시 프로젝트 진입', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // 닉네임 미리 설정
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.setItem('travelPMS_nickname', '테스터');
  });

  await loginWithPIN(page);
  await page.waitForTimeout(1000);

  // 이스탄불 클릭
  await page.locator('text=이스탄불').first().click();
  await page.waitForTimeout(3000);

  const bodyText1 = await page.locator('body').innerText();
  console.log(`=== 이스탄불 진입 후 (첫 500자) ===`);
  console.log(bodyText1.substring(0, 500));

  const isEmpty1 = bodyText1.trim().length < 50;
  console.log(`이스탄불 화면 비어있음: ${isEmpty1}`);

  await page.screenshot({ path: 'test-results/istanbul-detail.png', fullPage: true });

  // 뒤로가기 시뮬레이션 - 브라우저 뒤로가기
  await page.goBack();
  await page.waitForTimeout(2000);

  const bodyText2 = await page.locator('body').innerText();
  console.log(`=== 뒤로가기 후 (첫 500자) ===`);
  console.log(bodyText2.substring(0, 500));

  await page.screenshot({ path: 'test-results/after-goback.png', fullPage: true });

  // 다시 부산 클릭
  const busanExists = await page.locator('text=부산').count() > 0;
  console.log(`부산 프로젝트 표시: ${busanExists}`);

  if (busanExists) {
    await page.locator('text=부산').first().click();
    await page.waitForTimeout(3000);

    const bodyText3 = await page.locator('body').innerText();
    console.log(`=== 부산 재진입 후 (첫 500자) ===`);
    console.log(bodyText3.substring(0, 500));

    const isEmpty3 = bodyText3.trim().length < 50;
    console.log(`부산 화면 비어있음: ${isEmpty3}`);

    await page.screenshot({ path: 'test-results/busan-reentry.png', fullPage: true });
  }

  if (errors.length > 0) {
    console.log(`\n❌ 에러들:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
});
