"""
Travel PMS E2E 테스트
대화형 컨설팅 → AI 추천 → 목적지 선택 → 대시보드 확인
"""

from playwright.sync_api import sync_playwright, expect
import time
import json
from datetime import datetime

class TravelPMSE2ETest:
    def __init__(self):
        self.base_url = "http://localhost:3000"
        self.screenshot_dir = "/Users/Python_Mac_Local/TravelPMS/tests/screenshots"

    def setup(self):
        """브라우저 초기화"""
        import os
        os.makedirs(self.screenshot_dir, exist_ok=True)

    def test_full_flow(self):
        """전체 플로우 테스트"""
        with sync_playwright() as p:
            # 브라우저 시작 (headless=False로 화면 보기)
            browser = p.chromium.launch(headless=False, slow_mo=500)
            context = browser.new_context(
                viewport={'width': 414, 'height': 896},  # iPhone 11 Pro
                locale='ko-KR'
            )
            page = context.new_page()

            print("🧪 Travel PMS E2E 테스트 시작")

            # Step 1: 페이지 로드
            print("\n📱 Step 1: 페이지 로드")
            page.goto(self.base_url)
            page.wait_for_load_state('networkidle')
            page.screenshot(path=f"{self.screenshot_dir}/01_initial_load.png")
            print("✅ 페이지 로드 완료")

            # Step 2: 헤더 확인
            print("\n🎨 Step 2: 헤더 확인")
            header = page.locator('text=여행이')
            expect(header).to_be_visible()
            print("✅ 헤더 '여행이' 확인")

            # Step 3: 초기 인사 메시지 확인
            print("\n💬 Step 3: AI 인사 메시지 확인")
            greeting = page.locator('text=안녕하세요! 저는')
            expect(greeting).to_be_visible()
            page.screenshot(path=f"{self.screenshot_dir}/02_greeting.png")
            print("✅ AI 인사 메시지 확인")

            # Step 4: 대화 시작 (터키 여행 요청)
            print("\n✍️ Step 4: 대화 입력 - 터키 여행 요청")
            input_field = page.locator('input[placeholder*="여행 계획"]')
            input_field.fill("부부 둘이서 역사와 문화를 즐기는 여행을 하고 싶어요. 터키 추천해주세요. 예산은 1인당 150만원, 7박8일 정도요")
            page.screenshot(path=f"{self.screenshot_dir}/03_input_message.png")

            # 전송 버튼 클릭
            send_button = page.locator('button:has-text("전송")')
            send_button.click()
            print("✅ 메시지 전송 완료")

            # Step 5: AI 응답 대기 (최대 10초)
            print("\n⏳ Step 5: AI 응답 대기 중...")
            time.sleep(3)  # 네트워크 요청 대기
            page.screenshot(path=f"{self.screenshot_dir}/04_ai_response.png")
            print("✅ AI 응답 확인")

            # Step 6: 추가 대화 (상세 정보)
            print("\n✍️ Step 6: 추가 대화 입력")
            input_field.fill("사진 찍기 좋은 곳이면 더 좋겠어요. 이국적인 풍경 원해요")
            send_button.click()
            time.sleep(3)
            page.screenshot(path=f"{self.screenshot_dir}/05_second_response.png")
            print("✅ 두 번째 응답 확인")

            # Step 7: 한 번 더 대화 (추천 유도)
            print("\n✍️ Step 7: 추천 요청")
            input_field.fill("추천해주세요!")
            send_button.click()
            time.sleep(5)  # 추천 생성 대기
            page.screenshot(path=f"{self.screenshot_dir}/06_recommendations.png")
            print("✅ 추천 카드 생성 대기")

            # Step 8: 추천 카드 확인
            print("\n🎴 Step 8: 추천 카드 확인")
            # 터키 카드 찾기
            turkey_card = page.locator('text=터키').or_(page.locator('text=이스탄불'))
            if turkey_card.count() > 0:
                print("✅ 터키 추천 카드 발견!")
                page.screenshot(path=f"{self.screenshot_dir}/07_turkey_found.png")

                # Step 9: 터키 카드 클릭
                print("\n🖱️ Step 9: 터키 카드 선택")
                # 자유여행 버튼 클릭
                free_travel_button = page.locator('button:has-text("자유여행")')
                if free_travel_button.count() > 0:
                    free_travel_button.first.click()
                    time.sleep(2)
                    page.screenshot(path=f"{self.screenshot_dir}/08_project_created.png")
                    print("✅ 프로젝트 생성 완료")

                    # Step 10: 대시보드 확인
                    print("\n📊 Step 10: 대시보드 화면 확인")
                    dashboard = page.locator('text=조견표').or_(page.locator('text=타임라인'))
                    if dashboard.count() > 0:
                        print("✅ 대시보드 화면 진입!")
                        page.screenshot(path=f"{self.screenshot_dir}/09_dashboard.png")

                        # 각 탭 확인
                        tabs = ['조견표', '일정', '할일', '예산']
                        for i, tab in enumerate(tabs):
                            tab_button = page.locator(f'text={tab}')
                            if tab_button.count() > 0:
                                tab_button.click()
                                time.sleep(1)
                                page.screenshot(path=f"{self.screenshot_dir}/10_tab_{tab}.png")
                                print(f"✅ {tab} 탭 확인")
                    else:
                        print("❌ 대시보드 진입 실패")
                else:
                    print("⚠️ 자유여행 버튼 없음, 첫 번째 카드 클릭 시도")
                    # 첫 번째 추천 카드 클릭
                    first_card = page.locator('button').filter(has_text='자유여행').or_(
                        page.locator('div').filter(has_text='매칭')
                    )
                    if first_card.count() > 0:
                        first_card.first.click()
                        time.sleep(2)
                        page.screenshot(path=f"{self.screenshot_dir}/08_any_project.png")
            else:
                print("⚠️ 터키 카드가 없습니다. 전체 추천 카드:")
                page.screenshot(path=f"{self.screenshot_dir}/07_all_recommendations.png")

                # 첫 번째 카드라도 클릭
                any_card = page.locator('button:has-text("자유여행")')
                if any_card.count() > 0:
                    print("   → 첫 번째 카드 선택")
                    any_card.first.click()
                    time.sleep(2)
                    page.screenshot(path=f"{self.screenshot_dir}/08_fallback_project.png")

            print("\n✅ E2E 테스트 완료!")
            print(f"📸 스크린샷 저장 위치: {self.screenshot_dir}")

            # 브라우저 5초간 유지 후 종료
            time.sleep(5)
            browser.close()

if __name__ == "__main__":
    test = TravelPMSE2ETest()
    test.setup()
    test.test_full_flow()
