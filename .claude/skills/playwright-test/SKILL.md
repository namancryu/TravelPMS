---
name: playwright-test
description: Open browser and demonstrate UI with Playwright. Shows live application in browser for manual testing
disable-model-invocation: false
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Glob
  - Write
---

# Browser Demo Skill

브라우저를 열어 실제 애플리케이션을 시연합니다.

## 1. 시연 전 준비
- 서버 실행 확인 (포트 3000)
- 서버가 실행되지 않으면 시작
- Playwright 설치 확인

## 2. 브라우저 열기
다음 명령어로 브라우저를 열어 실제 애플리케이션을 시연:

```bash
# macOS Safari로 열기
open -a Safari http://localhost:3000

# 또는 Playwright로 브라우저 열기 (천천히 시연)
npx playwright test --headed --project=chromium
```

## 3. 시연 프로세스
브라우저를 열면:
1. **메인 화면 확인** - 프로젝트 목록
2. **주요 기능 시연**:
   - 새 프로젝트 생성 버튼
   - AI 컨설팅 모드
   - 프로젝트 카드 UI
   - 반응형 디자인
3. **사용자에게 안내**:
   - 브라우저가 열렸음을 알림
   - 주요 기능 설명
   - 테스트 가능한 항목 안내

## 4. 시연 완료 후
- 브라우저가 열려있는 동안 사용자가 직접 조작 가능
- 주요 기능 설명 제공
- 문제 발견 시 즉시 보고

## 실행 절차
사용자가 `/playwright-test`를 입력하면:
1. 서버 상태 확인 (포트 3000)
2. Safari 또는 Chromium 브라우저 열기
3. http://localhost:3000 접속
4. 사용자에게 브라우저가 열렸음을 알림
5. 주요 기능 안내
