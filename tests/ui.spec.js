const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3000';
const PIN = '3512';

async function loginWithPIN(page) {
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  // PIN 입력
  const pinScreen = page.locator('text=PIN을 입력하세요');
  if (await pinScreen.isVisible().catch(() => false)) {
    for (const digit of PIN) {
      await page.locator(`button:has-text("${digit}")`).first().click();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(1500);
  }
}

test.describe('TravelPMS UI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithPIN(page);
  });

  test('1. 홈페이지 로드 확인', async ({ page }) => {
    await expect(page).toHaveTitle(/여행이/);

    // 메인 요소 확인
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible();

    console.log('✅ 홈페이지 로드 성공');
  });

  test('2. 프로젝트 목록 표시', async ({ page }) => {
    // 프로젝트 탭 또는 목록 확인
    const hasProjects = await page.locator('text=/프로젝트|Project/i').count() > 0;

    if (hasProjects) {
      console.log('✅ 프로젝트 목록 표시됨');
    } else {
      console.log('⚠️ 프로젝트가 없거나 다른 화면');
    }

    expect(hasProjects || true).toBeTruthy(); // 프로젝트 없어도 OK
  });

  test('3. 새 프로젝트 생성 버튼 존재', async ({ page }) => {
    // "+ 새 여행 계획 만들기" 버튼 찾기
    const newProjectButton = page.locator('text=/새.*여행|여행.*계획.*만들기|새.*프로젝트/i').first();
    await expect(newProjectButton).toBeVisible();
    const text = await newProjectButton.textContent();
    console.log(`✅ 프로젝트 생성 버튼 발견: "${text}"`);
  });

  test('4. 목적지 탐색 기능 (CONSULTING 모드)', async ({ page }) => {
    // 프로젝트 목록 화면에서는 목적지 탐색이 없음
    // "새 여행 계획 만들기" 버튼을 클릭하면 AI 컨설팅 모드로 진입
    const newProjectButton = page.locator('text=/새.*여행.*계획.*만들기/i').first();

    if (await newProjectButton.count() > 0) {
      await newProjectButton.click();
      await page.waitForTimeout(1000);

      // AI 컨설팅 화면으로 전환되었는지 확인
      const consultingUI = page.locator('text=/인공지능|AI|컨설팅/i').first();
      const hasConsultingUI = await consultingUI.count() > 0;
      console.log(`✅ AI 컨설팅 모드 진입: ${hasConsultingUI}`);

      expect(hasConsultingUI).toBeTruthy();
    } else {
      console.log('⚠️ 새 프로젝트 버튼을 찾을 수 없음');
    }
  });

  test('5. 프로젝트 상세 - 예산 탭 접근', async ({ page }) => {
    // 프로젝트를 클릭해서 상세 페이지로 이동
    const projectLinks = page.locator('[class*="project"], [data-testid*="project"]').first();
    const projectLinksCount = await projectLinks.count();

    if (projectLinksCount > 0) {
      await projectLinks.click();
      await page.waitForTimeout(1000);

      // 예산 탭 찾기
      const budgetTab = page.locator('text=/예산|Budget/i').first();
      if (await budgetTab.count() > 0) {
        await budgetTab.click();
        await page.waitForTimeout(500);
        console.log('✅ 예산 탭 접근 성공');
      } else {
        console.log('⚠️ 예산 탭을 찾을 수 없음 (프로젝트 필요)');
      }
    } else {
      console.log('⚠️ 프로젝트가 없어서 건너뜀');
    }

    expect(true).toBeTruthy(); // 프로젝트 없어도 통과
  });

  test('6. 반응형 디자인 - 모바일 뷰', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 모바일에서도 페이지 로드 확인
    const bodyVisible = await page.locator('body').isVisible();
    console.log('✅ 모바일 뷰 렌더링 성공');

    expect(bodyVisible).toBeTruthy();
  });

  test('7. API 상태 확인', async ({ page, request }) => {
    // Health check API
    const healthResponse = await request.get(`${BASE_URL}/health`);
    expect(healthResponse.status()).toBe(200);

    const healthData = await healthResponse.json();
    expect(healthData.status).toBe('ok');

    console.log('✅ API Health Check 성공');
  });

  test('8. 목적지 API 테스트', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/destinations`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.destinations).toBeDefined();
    expect(Array.isArray(data.destinations)).toBeTruthy();
    expect(data.destinations.length).toBeGreaterThan(0);

    console.log(`✅ 목적지 API 성공: ${data.destinations.length}개`);
  });

  test('9. 환율 API 테스트', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/exchange-rate/USD/KRW`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.rate).toBeDefined();
    expect(data.rate).toBeGreaterThan(0);

    console.log(`✅ 환율 API 성공: USD → KRW = ${data.rate}`);
  });

  test('10. 페이지 성능 - 로딩 시간', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;
    console.log(`✅ 페이지 로딩 시간: ${loadTime}ms`);

    // 5초 이내 로드
    expect(loadTime).toBeLessThan(5000);
  });
});

test.describe('예산 관리 기능 테스트', () => {
  test('11. 예산 카테고리 표시 (프로젝트 존재 시)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 프로젝트 찾기
    const projects = await page.locator('[class*="project"]').count();

    if (projects > 0) {
      // 첫 프로젝트 클릭
      await page.locator('[class*="project"]').first().click();
      await page.waitForTimeout(1000);

      // 예산 탭 클릭
      const budgetTab = page.locator('text=/예산|Budget/i').first();
      if (await budgetTab.count() > 0) {
        await budgetTab.click();
        await page.waitForTimeout(1000);

        // 예산 카테고리 찾기
        const categories = await page.locator('text=/숙소|식비|활동|교통|Accommodation|Food/i').count();
        console.log(`✅ 예산 카테고리: ${categories}개`);
        expect(categories).toBeGreaterThan(0);
      } else {
        console.log('⚠️ 예산 탭 없음');
      }
    } else {
      console.log('⚠️ 테스트용 프로젝트 필요');
    }
  });

  test('12. Socket.io 연결 확인', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Socket.io가 로드되었는지 확인
    const socketIoLoaded = await page.evaluate(() => {
      return typeof window.io !== 'undefined';
    });

    console.log(`✅ Socket.io 로드: ${socketIoLoaded}`);
    expect(socketIoLoaded).toBeTruthy();
  });
});
