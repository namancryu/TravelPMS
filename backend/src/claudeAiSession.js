/**
 * Claude.ai 세션 연결 - Playwright로 Claude.ai에 로그인해서 대화 처리
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ClaudeAiSession {
  constructor() {
    this.pythonScript = `
import asyncio
from playwright.async_api import async_playwright
import json
import sys

async def chat_with_claude(message):
    """Claude.ai 세션에 메시지 전송하고 응답 받기"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        # Claude.ai 로그인 (기존 세션 사용)
        await page.goto('https://claude.ai/new')
        await page.wait_for_load_state('networkidle')

        # 메시지 입력
        input_box = await page.wait_for_selector('div[contenteditable="true"]')
        await input_box.fill(message)

        # 전송
        send_button = await page.wait_for_selector('button[aria-label="Send Message"]')
        await send_button.click()

        # 응답 대기 (최대 30초)
        await page.wait_for_timeout(3000)

        # 응답 추출
        response_selector = 'div[data-testid="user-message"] + div'
        response_elem = await page.wait_for_selector(response_selector, timeout=30000)
        response_text = await response_elem.inner_text()

        await browser.close()

        return response_text

if __name__ == '__main__':
    message = sys.argv[1] if len(sys.argv) > 1 else "안녕하세요"
    result = asyncio.run(chat_with_claude(message))
    print(json.dumps({"response": result}, ensure_ascii=False))
`;
  }

  async sendMessage(message) {
    try {
      // Python 스크립트를 임시 파일로 저장
      const fs = require('fs');
      const tmpFile = '/tmp/claude_session.py';
      fs.writeFileSync(tmpFile, this.pythonScript);

      // Python 실행
      const { stdout } = await execAsync(`python3 ${tmpFile} "${message.replace(/"/g, '\\"')}"`);
      const result = JSON.parse(stdout);

      return result.response;
    } catch (err) {
      console.error('Claude.ai 세션 에러:', err);
      throw err;
    }
  }
}

module.exports = { ClaudeAiSession };
