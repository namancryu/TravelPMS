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

test('이스탄불 항공료 + 스카이스캐너 링크 확인', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.setItem('travelPMS_nickname', '테스터');
  });

  await loginWithPIN(page);
  await page.waitForTimeout(1000);

  // 이스탄불 프로젝트 클릭
  await page.locator('text=이스탄불').first().click();
  await page.waitForTimeout(2000);

  // 시뮬 탭 클릭
  await page.locator('text="🧮 시뮬"').first().click();
  await page.waitForTimeout(1500);

  // 항공 비용 텍스트 확인
  const bodyText = await page.locator('body').innerText();

  // 항공 관련 텍스트 찾기
  const flightMatch = bodyText.match(/항공.*?(\d+만원)/);
  console.log(`항공 비용 텍스트: ${flightMatch ? flightMatch[0] : '찾을 수 없음'}`);

  // 1인 금액 확인
  const perPersonMatch = bodyText.match(/1인\s*(\d+만원)/g);
  console.log(`1인당 금액들: ${perPersonMatch ? perPersonMatch.join(', ') : '없음'}`);

  // 스카이스캐너 링크 확인
  const skyscannerLink = await page.locator('a[href*="skyscanner"]').first().getAttribute('href').catch(() => null);
  console.log(`스카이스캐너 링크: ${skyscannerLink}`);

  // ist 공항코드가 포함되어 있는지 확인
  if (skyscannerLink) {
    const hasISTCode = skyscannerLink.includes('/ist/');
    console.log(`IST 공항코드 포함: ${hasISTCode}`);
    expect(hasISTCode).toBeTruthy();
  }

  await page.screenshot({ path: 'test-results/istanbul-sim-flight.png', fullPage: true });

  console.log(`\n에러: ${errors.length > 0 ? errors.join('\n') : '없음'}`);
  expect(errors.length).toBe(0);
});
