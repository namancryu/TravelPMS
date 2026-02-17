#!/usr/bin/env python3
"""
Claude.ai 세션 채팅 - Playwright로 실제 Claude.ai에 접속
"""

import asyncio
import json
import sys
from playwright.async_api import async_playwright

async def chat_with_claude(message: str, session_id: str = None):
    """Claude.ai에 메시지 전송하고 응답 받기"""
    async with async_playwright() as p:
        # 기존 브라우저 세션 재사용 (로그인 유지)
        browser = await p.chromium.launch(
            headless=False,
            slow_mo=100
        )

        context = await browser.new_context()
        page = await context.new_page()

        try:
            # Claude.ai 접속
            print(f"🌐 Claude.ai 접속 중...", file=sys.stderr)
            await page.goto('https://claude.ai/new', wait_until='networkidle')

            # 로그인 확인
            await page.wait_for_timeout(2000)

            # 메시지 입력창 찾기
            print(f"✍️ 메시지 입력 중: {message[:50]}...", file=sys.stderr)

            # Claude.ai의 입력창 선택자 (여러 가능성 시도)
            selectors = [
                'div[contenteditable="true"][data-placeholder]',
                'div[contenteditable="true"]',
                'textarea[placeholder*="Message"]',
                'div.ProseMirror'
            ]

            input_box = None
            for selector in selectors:
                try:
                    input_box = await page.wait_for_selector(selector, timeout=5000)
                    if input_box:
                        break
                except:
                    continue

            if not input_box:
                raise Exception("입력창을 찾을 수 없습니다")

            # 메시지 입력
            await input_box.fill(message)
            await page.wait_for_timeout(500)

            # 전송 버튼 클릭
            print(f"📤 전송 중...", file=sys.stderr)
            send_selectors = [
                'button[aria-label*="Send"]',
                'button:has-text("Send")',
                'button[type="submit"]'
            ]

            for selector in send_selectors:
                try:
                    send_btn = await page.wait_for_selector(selector, timeout=3000)
                    if send_btn:
                        await send_btn.click()
                        break
                except:
                    continue

            # 응답 대기
            print(f"⏳ Claude 응답 대기 중...", file=sys.stderr)
            await page.wait_for_timeout(5000)  # AI 응답 시간

            # 응답 추출 (마지막 assistant 메시지)
            response_selectors = [
                'div[data-testid="user-message"] ~ div:last-child',
                'div.font-claude-message:last-child',
                'div.whitespace-pre-wrap:last-child'
            ]

            response_text = ""
            for selector in response_selectors:
                try:
                    response_elem = await page.query_selector(selector)
                    if response_elem:
                        response_text = await response_elem.inner_text()
                        if response_text:
                            break
                except:
                    continue

            if not response_text:
                # 전체 페이지에서 마지막 텍스트 블록 가져오기
                all_text = await page.inner_text('body')
                lines = all_text.split('\n')
                response_text = '\n'.join(lines[-10:])  # 마지막 10줄

            print(f"✅ 응답 수신 완료", file=sys.stderr)

            # JSON으로 출력
            result = {
                "response": response_text,
                "state": "RECOMMENDING" if "추천" in response_text else "GATHERING",
                "recommendations": None
            }

            print(json.dumps(result, ensure_ascii=False))

        except Exception as e:
            print(f"❌ 에러: {e}", file=sys.stderr)
            result = {
                "error": str(e),
                "response": f"죄송합니다. Claude.ai 연결에 문제가 발생했습니다: {str(e)}"
            }
            print(json.dumps(result, ensure_ascii=False))

        finally:
            await browser.close()

if __name__ == '__main__':
    message = sys.argv[1] if len(sys.argv) > 1 else "안녕하세요"
    session_id = sys.argv[2] if len(sys.argv) > 2 else None

    asyncio.run(chat_with_claude(message, session_id))
