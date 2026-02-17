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

test('인원수 설정 확인', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // 닉네임 미리 설정
  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.setItem('travelPMS_nickname', '테스터');
  });

  await loginWithPIN(page);
  await page.waitForTimeout(1000);

  // 부산 프로젝트 클릭
  await page.locator('text=부산').first().click();
  await page.waitForTimeout(2000);

  // 조견표 탭 (설정 카드가 있는 곳)
  const comparisonTab = page.locator('text="📊 조견표"').first();
  if (await comparisonTab.count() > 0) {
    await comparisonTab.click();
    await page.waitForTimeout(1500);
  }

  // 여행 설정 카드 확인
  const settingsCard = page.locator('text=여행 설정');
  const hasSettings = await settingsCard.count() > 0;
  console.log(`여행 설정 카드 존재: ${hasSettings}`);

  // 인원수 텍스트 확인
  const travelersLabel = page.locator('text=인원수');
  const hasTravelers = await travelersLabel.count() > 0;
  console.log(`인원수 라벨 존재: ${hasTravelers}`);

  // 인원수 input 확인
  const travelersInput = page.locator('input[type="number"][min="1"][max="99"]');
  const hasInput = await travelersInput.count() > 0;
  console.log(`인원수 input 존재: ${hasInput}`);

  if (hasInput) {
    const currentValue = await travelersInput.inputValue();
    console.log(`현재 인원수: ${currentValue}`);

    // + 버튼 클릭
    const plusBtn = page.locator('button:has-text("+")').first();
    await plusBtn.click();
    await page.waitForTimeout(500);

    const newValue = await travelersInput.inputValue();
    console.log(`+ 클릭 후 인원수: ${newValue}`);

    // - 버튼 클릭
    const minusBtn = page.locator('button:has-text("−")').first();
    await minusBtn.click();
    await page.waitForTimeout(500);

    const afterMinus = await travelersInput.inputValue();
    console.log(`− 클릭 후 인원수: ${afterMinus}`);
  }

  // 스크린샷
  await page.screenshot({ path: 'test-results/travelers-setting.png', fullPage: true });

  // 전체 설정 카드 HTML
  const settingsHTML = await page.locator('text=여행 설정').locator('..').innerHTML().catch(() => 'not found');
  console.log(`설정 카드 HTML (첫 500자): ${settingsHTML.substring(0, 500)}`);

  console.log(`\n에러: ${errors.length > 0 ? errors.join('\n') : '없음'}`);
  expect(errors.length).toBe(0);
});
