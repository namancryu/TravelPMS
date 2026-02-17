const { test, expect } = require('@playwright/test');

test('디버그: 페이지 로드 및 콘솔 에러 확인', async ({ page }) => {
  const consoleMessages = [];
  const errors = [];

  // 콘솔 메시지 수집
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  // 페이지 에러 수집
  page.on('pageerror', error => {
    errors.push(error.message);
  });

  // 페이지 이동
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);  // 3초 대기

  // HTML 확인
  const html = await page.content();
  console.log('\n=== HTML 샘플 (첫 500자) ===');
  console.log(html.substring(0, 500));

  // 콘솔 메시지 출력
  console.log('\n=== 브라우저 콘솔 메시지 ===');
  consoleMessages.forEach(msg => console.log(msg));

  // 에러 출력
  console.log('\n=== 페이지 에러 ===');
  if (errors.length > 0) {
    errors.forEach(err => console.log(err));
  } else {
    console.log('에러 없음');
  }

  // #root 요소 확인
  const rootElement = await page.$('#root');
  const rootHTML = await rootElement?.innerHTML();
  console.log('\n=== #root 내용 ===');
  console.log(rootHTML || '(비어있음)');

  // 스크린샷
  await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });
  console.log('\n스크린샷 저장: test-results/debug-screenshot.png');
});
