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

test('프로젝트 카드 클릭하여 상세 화면 이동', async ({ page }) => {
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await loginWithPIN(page);
  await page.waitForTimeout(2000);

  // 부산 또는 이스탄불 텍스트가 있는 요소 클릭
  const projectCard = page.locator('text=부산').first();
  const exists = await projectCard.count();
  console.log(`부산 프로젝트 존재: ${exists > 0}`);

  if (exists > 0) {
    // 부산 텍스트의 부모 요소 확인
    const parentHTML = await projectCard.evaluate(el => {
      let parent = el;
      for (let i = 0; i < 5; i++) {
        if (parent.parentElement) parent = parent.parentElement;
      }
      return parent.outerHTML.substring(0, 500);
    });
    console.log(`=== 부산 카드 부모 HTML ===`);
    console.log(parentHTML);

    // 클릭 이벤트가 있는지 확인
    const hasClickHandler = await projectCard.evaluate(el => {
      let node = el;
      while (node && node !== document.body) {
        if (node.onclick || node.getAttribute('onClick') || node.style.cursor === 'pointer') return true;
        // React event handler 확인
        const keys = Object.keys(node);
        const reactProps = keys.find(k => k.startsWith('__reactProps') || k.startsWith('__reactEvents'));
        if (reactProps) {
          const props = node[reactProps];
          if (props && (props.onClick || props.onTouchStart)) return `React handler found on ${node.tagName}`;
        }
        node = node.parentElement;
      }
      return false;
    });
    console.log(`클릭 핸들러 존재: ${hasClickHandler}`);

    // 클릭!
    await projectCard.click();
    await page.waitForTimeout(3000);

    // 클릭 후 화면 확인
    const afterText = await page.locator('body').innerText();
    console.log(`=== 클릭 후 전체 텍스트 (첫 1000자) ===`);
    console.log(afterText.substring(0, 1000));

    // 화면이 비었는지 확인
    const rootContent = await page.locator('#root').innerHTML();
    const isEmpty = rootContent.trim().length < 100;
    console.log(`화면이 비어있음: ${isEmpty}, 내용 길이: ${rootContent.trim().length}`);

    if (isEmpty) {
      console.log(`=== 빈 화면 전체 HTML ===`);
      console.log(rootContent);
    }

    // 스크린샷
    await page.screenshot({ path: 'test-results/after-click-busan.png', fullPage: true });
  }

  // 이스탄불도 시도
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
  // PIN 이미 해제된 상태 (sessionStorage)
  await page.waitForTimeout(2000);

  const istanbulCard = page.locator('text=이스탄불').first();
  if (await istanbulCard.count() > 0) {
    await istanbulCard.click();
    await page.waitForTimeout(3000);

    const afterText = await page.locator('body').innerText();
    console.log(`=== 이스탄불 클릭 후 텍스트 (첫 1000자) ===`);
    console.log(afterText.substring(0, 1000));

    const rootContent = await page.locator('#root').innerHTML();
    const isEmpty = rootContent.trim().length < 100;
    console.log(`이스탄불 화면 비어있음: ${isEmpty}, 길이: ${rootContent.trim().length}`);

    if (isEmpty) {
      console.log(`=== 빈 화면 HTML ===`);
      console.log(rootContent);
    }

    await page.screenshot({ path: 'test-results/after-click-istanbul.png', fullPage: true });
  }

  if (errors.length > 0) {
    console.log(`\n❌ 페이지 에러들:`);
    errors.forEach(e => console.log(`  - ${e}`));
  }
  if (consoleErrors.length > 0) {
    console.log(`\n❌ 콘솔 에러들:`);
    consoleErrors.forEach(e => console.log(`  - ${e}`));
  }
});
