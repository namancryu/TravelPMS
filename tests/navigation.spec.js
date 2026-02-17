const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const PIN = '3512';

// PIN 로그인 헬퍼
async function loginWithPIN(page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');

  // PIN 입력
  for (const digit of PIN) {
    await page.locator(`button:has-text("${digit}")`).first().click();
    await page.waitForTimeout(200);
  }

  // 로그인 후 메인 화면 대기
  await page.waitForTimeout(1500);
}

test.describe('여행지 내비게이션 테스트', () => {

  test('1. PIN 로그인 후 메인 화면 표시', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginWithPIN(page);

    // PIN 화면이 사라졌는지 확인
    const pinScreen = page.locator('text=PIN을 입력하세요');
    const pinVisible = await pinScreen.isVisible().catch(() => false);

    console.log(`PIN 화면 남아있음: ${pinVisible}`);
    console.log(`페이지 에러: ${errors.length > 0 ? errors.join(', ') : '없음'}`);

    // 메인 화면 내용 확인
    const rootContent = await page.locator('#root').innerHTML();
    console.log(`=== #root 내용 (첫 500자) ===`);
    console.log(rootContent.substring(0, 500));

    expect(pinVisible).toBeFalsy();
    expect(errors.length).toBe(0);
  });

  test('2. 기존 여행 프로젝트 목록 확인', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loginWithPIN(page);

    // 프로젝트 목록이 표시되는지 확인
    await page.waitForTimeout(2000);

    const rootContent = await page.locator('#root').innerHTML();
    console.log(`=== 메인 화면 내용 (첫 800자) ===`);
    console.log(rootContent.substring(0, 800));

    // 프로젝트 관련 요소 찾기
    const projectElements = await page.locator('[class*="project"], [class*="card"], [class*="travel"]').count();
    console.log(`프로젝트 관련 요소 수: ${projectElements}`);

    // 모든 버튼/링크 텍스트 수집
    const allButtons = await page.locator('button, a').allTextContents();
    console.log(`버튼/링크 텍스트: ${allButtons.filter(t => t.trim()).join(' | ')}`);

    if (errors.length > 0) {
      console.log(`❌ 페이지 에러: ${errors.join('\n')}`);
    }
  });

  test('3. 기존 여행 프로젝트 클릭 후 상세 화면', async ({ page }) => {
    const errors = [];
    const consoleMessages = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleMessages.push(msg.text());
    });

    await loginWithPIN(page);
    await page.waitForTimeout(2000);

    // 프로젝트/여행 카드 찾기 - 다양한 셀렉터 시도
    const selectors = [
      'text=/도쿄|오사카|방콕|다낭|파리|발리|제주|하와이|싱가포르/i',
      '[class*="card"]',
      '[class*="project"]',
      '[class*="trip"]',
      '[class*="travel"]',
    ];

    let clicked = false;
    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      console.log(`셀렉터 "${selector}": ${count}개`);

      if (count > 0 && !clicked) {
        const text = await page.locator(selector).first().textContent();
        console.log(`클릭할 요소: "${text?.substring(0, 100)}"`);

        await page.locator(selector).first().click();
        clicked = true;
        await page.waitForTimeout(3000);

        // 클릭 후 화면 상태 확인
        const afterContent = await page.locator('#root').innerHTML();
        console.log(`=== 클릭 후 화면 (첫 800자) ===`);
        console.log(afterContent.substring(0, 800));

        // 빈 화면인지 확인
        const isEmpty = afterContent.trim().length < 50;
        console.log(`화면이 비어있음: ${isEmpty}`);
      }
    }

    if (errors.length > 0) {
      console.log(`❌ 페이지 에러들:`);
      errors.forEach(e => console.log(`  - ${e}`));
    }
    if (consoleMessages.length > 0) {
      console.log(`❌ 콘솔 에러들:`);
      consoleMessages.forEach(e => console.log(`  - ${e}`));
    }

    // 스크린샷 저장
    await page.screenshot({ path: 'test-results/after-click-destination.png', fullPage: true });
  });

  test('4. 여행 프로젝트 상세 화면 직접 탐색', async ({ page }) => {
    const errors = [];
    const consoleErrors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await loginWithPIN(page);
    await page.waitForTimeout(2000);

    // React 상태 확인
    const reactState = await page.evaluate(() => {
      // React fiber에서 상태 추출 시도
      const root = document.getElementById('root');
      if (!root || !root._reactRootContainer && !root.__reactFiber) {
        // React 18 방식
        const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber'));
        if (fiberKey) return 'React 18 detected';
      }
      return 'React state not directly accessible';
    });
    console.log(`React 상태: ${reactState}`);

    // 현재 화면의 모든 텍스트 내용
    const allText = await page.locator('body').innerText();
    console.log(`=== 전체 텍스트 (첫 1000자) ===`);
    console.log(allText.substring(0, 1000));

    // 클릭 가능한 모든 요소 확인
    const clickables = await page.locator('button, a, [onclick], [role="button"]').allTextContents();
    console.log(`=== 클릭 가능한 요소들 ===`);
    clickables.filter(t => t.trim()).forEach(t => console.log(`  - "${t.trim().substring(0, 80)}"`));

    if (errors.length > 0) {
      console.log(`❌ 에러: ${errors.join('\n')}`);
    }
  });

  test('5. 프로젝트 API로 기존 프로젝트 확인 후 이동', async ({ page, request }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    // API로 프로젝트 목록 조회
    const response = await request.get(`${BASE_URL}/api/projects`);
    const status = response.status();
    console.log(`프로젝트 API 상태: ${status}`);

    if (status === 200) {
      const data = await response.json();
      console.log(`프로젝트 데이터: ${JSON.stringify(data).substring(0, 500)}`);

      const projects = data.projects || data;
      if (Array.isArray(projects) && projects.length > 0) {
        console.log(`프로젝트 수: ${projects.length}`);
        console.log(`첫 프로젝트: ${JSON.stringify(projects[0]).substring(0, 300)}`);
      }
    } else {
      const text = await response.text();
      console.log(`API 응답: ${text.substring(0, 200)}`);
    }

    // PIN 로그인 후 프로젝트 클릭
    await loginWithPIN(page);
    await page.waitForTimeout(2000);

    // 스크린샷
    await page.screenshot({ path: 'test-results/after-login-main.png', fullPage: true });

    if (errors.length > 0) {
      console.log(`❌ 에러: ${errors.join('\n')}`);
    }
  });
});
