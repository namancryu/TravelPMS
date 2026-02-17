# 트러블슈팅: 백지 화면 문제 (변수 중복 선언 + 예산 탭 크래시)

**날짜:** 2026-02-17
**문제:** 앱 전체 백지 + 예산 탭 진입 시 빈 화면
**상태:** ✅ 해결 완료

---

## 1. 문제 증상

### 사용자 보고
- "핸드폰은 핀번호 넣으라고 나오지 않아"
- "기존 여행지로 이동하려고 하니까 다시 백지야"
- Safari/모바일 모두 동일 증상

### 관찰된 현상
1. 앱 전체가 렌더링 안 됨 (PIN 화면조차 안 나옴)
2. PIN 입력 후 프로젝트 진입 → 예산 탭 클릭 시 빈 화면

---

## 2. 원인 분석

### 2.1 버그 #1: 변수 중복 선언 (앱 전체 백지)

**에러 메시지:**
```
Identifier 'destName' has already been declared. (2399:12)
Identifier 'country' has already been declared.
```

**원인:**
SimulatorTab 컴포넌트에서 전역 설정 코드를 추가할 때, 이미 선언된 변수를 `const`로 다시 선언

```javascript
// Line 2381 - 첫 번째 선언
const destName = dest?.name || '';
const country = dest?.country || '';

// ...코드 중간...

// Line 2437 - 중복 선언 (❌ Babel 트랜스파일 에러 발생)
const destName = dest?.name || '';
const country = dest?.country || '';
```

**영향 범위:**
- Babel 인브라우저 트랜스파일러가 전체 `<script type="text/babel">` 블록을 파싱 실패
- React 앱 자체가 마운트되지 않음
- PIN 화면, 프로젝트 목록 등 모든 UI 렌더링 불가

---

### 2.2 버그 #2: 예산 탭 크래시 (API 스키마 불일치)

**에러 메시지:**
```
TypeError: Cannot read properties of undefined (reading 'toLocaleString')
    at formatCurrency (<anonymous>:274:22)
    at BudgetCategoryCard (<anonymous>:2448:41)
```

**원인:**
API 응답의 예산 카테고리 키와 프론트엔드 코드의 참조 키가 불일치

```javascript
// API 응답 (서버 → 클라이언트)
"숙소": { "budget": 1800000, "spent": 0 }
//         ^^^^^^ "budget" 키 사용

// 프론트엔드 코드 (BudgetCategoryCard)
const pct = data.allocated > 0 ? ...
//               ^^^^^^^^^ "allocated" 키 참조 → undefined!

// formatCurrency 호출
formatCurrency(data.allocated)
// → formatCurrency(undefined)
// → undefined.toLocaleString() → TypeError!
```

**영향 범위:**
- 예산 탭(💰) 클릭 시 React 렌더링 에러 → 해당 탭 빈 화면
- Error Boundary 없어서 조용히 실패

---

## 3. 수정 내용

### 3.1 버그 #1 수정: 중복 변수 선언 제거

**파일:** `index.html`

```diff
  const usdRate = 1300;
  const totalUSD = Math.round(totalCost / usdRate);

- // 목적지 기반 구매 링크 생성
- const destName = dest?.name || '';
- const country = dest?.country || '';
+ // 목적지 기반 구매 링크 생성 (destName, country는 위에서 이미 선언됨)
  const cityMap = { '도쿄': 'tokyo', ... };
```

| 변수 | 첫 선언 위치 | 중복 선언 위치 | 조치 |
|------|-------------|--------------|------|
| `destName` | Line 2381 | Line 2437 | 중복 제거 |
| `country` | Line 2382 | Line 2437 | 중복 제거 |

---

### 3.2 버그 #2 수정: API 키 불일치 해결

**파일:** `index.html`

**수정 1: `formatCurrency` null 방어 추가**
```diff
  function formatCurrency(n) {
+   if (n == null || isNaN(n)) return '0원';
    if (n >= 10000) return `${Math.round(n / 10000)}만원`;
    return `${n.toLocaleString()}원`;
  }
```

**수정 2: `BudgetCategoryCard` 키 호환 처리**
```diff
  function BudgetCategoryCard({ category, data, icon, color, ... }) {
-   const pct = data.allocated > 0 ? Math.round((data.spent / data.allocated) * 100) : 0;
+   const allocated = data.allocated || data.budget || 0;
+   const spent = data.spent || 0;
+   const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;

    // ...

-   {formatCurrency(data.spent)} / {formatCurrency(data.allocated)}
+   {formatCurrency(spent)} / {formatCurrency(allocated)}
  }
```

**수정 3: fallback 데이터 보강**
```diff
- const data = budget.categories[cat] || { allocated: 0, spent: 0 };
+ const data = budget.categories[cat] || { budget: 0, allocated: 0, spent: 0 };
```

---

## 4. 디버깅 방법: Playwright 테스트

이번 디버깅은 Playwright E2E 테스트로 수행함.

### 4.1 테스트 파일 구성

| 파일 | 목적 |
|------|------|
| `tests/debug.spec.js` | 페이지 로드 + 콘솔 에러 캡처 |
| `tests/navigation.spec.js` | PIN 로그인 + 프로젝트 목록 확인 |
| `tests/click-project.spec.js` | 프로젝트 카드 클릭 + 상세 화면 확인 |
| `tests/detail-test.spec.js` | 닉네임 입력 + 모든 탭 렌더링 확인 |

### 4.2 핵심 테스트: 탭별 렌더링 검증

```javascript
// tests/detail-test.spec.js
const tabsToTest = ['📊 조견표', '📅 일정표', '🧮 시뮬', '🗺️ 지도',
                    '✅ 할일', '💰 예산', '🆘 비상', '👨‍👩‍👧‍👦 공유'];

for (const tabText of tabsToTest) {
  await page.locator(`text="${tabText}"`).first().click();
  await page.waitForTimeout(1500);

  const content = await page.locator('#root').innerHTML();
  const isEmpty = content.trim().length < 100;
  // 💰 예산 탭에서 빈 화면(0자) + TypeError 발견
}
```

### 4.3 테스트 결과

**수정 전:**
```
📊 조견표  → ✅ 내용 있음 (7317자)
📅 일정표  → ✅ 내용 있음 (2314자)
🧮 시뮬    → ✅ 내용 있음 (9384자)
🗺️ 지도   → ✅ 내용 있음 (2223자)
✅ 할일    → ✅ 내용 있음 (4191자)
💰 예산    → ❌ 빈 화면! (0자) ← TypeError
🆘 비상    → (테스트 중단)
👨‍👩‍👧‍👦 공유  → (테스트 중단)
```

**수정 후:**
```
📊 조견표  → ✅ 내용 있음 (7317자)
📅 일정표  → ✅ 내용 있음 (2314자)
🧮 시뮬    → ✅ 내용 있음 (9384자)
🗺️ 지도   → ✅ 내용 있음 (2223자)
✅ 할일    → ✅ 내용 있음 (4191자)
💰 예산    → ✅ 내용 있음 (6160자)
🆘 비상    → ✅ 내용 있음 (10153자)
👨‍👩‍👧‍👦 공유  → ✅ 내용 있음 (4993자)
페이지 에러: 없음
```

---

## 5. 적용된 수정사항 요약

### 파일: `index.html`

| 위치 | 변경 내용 | 목적 |
|------|----------|------|
| Line 204-207 | `formatCurrency` null/NaN 체크 추가 | undefined 값 안전 처리 |
| Line 2067-2070 | `BudgetCategoryCard` 키 호환 | `allocated` / `budget` 키 모두 지원 |
| Line 2107 | `spent`/`allocated` 지역변수 사용 | 안전한 값 참조 |
| Line 2184 | fallback 데이터에 `budget: 0` 추가 | 키 누락 방지 |
| Line 2436-2437 | 중복 `const destName`, `const country` 제거 | Babel 파싱 에러 해결 |

---

## 6. Lessons Learned

### 6.1 Babel 인브라우저 트랜스파일러의 특성

- `const` 중복 선언은 일반 브라우저 환경에서는 에러지만, Babel이 먼저 파싱하면서 **전체 스크립트 블록이 실패**
- 에러 메시지가 브라우저 콘솔에만 나타나고, 화면에는 아무것도 안 보임
- 하나의 `const` 중복 → 앱 전체 죽음 (Error Boundary로도 잡히지 않음)

### 6.2 API 스키마와 프론트엔드 키 일치 확인

**문제 패턴:**
```
서버: { "budget": 1800000 }
클라이언트: data.allocated  ← 키 이름 불일치
```

**예방 방법:**
- API 응답 타입을 문서화하거나 TypeScript 인터페이스로 정의
- 프론트엔드에서 API 데이터 접근 시 방어적 코딩 필수
- `formatCurrency` 같은 유틸 함수는 반드시 null 체크

### 6.3 Playwright E2E 테스트의 효과

- **`pageerror` 이벤트**로 JavaScript 에러를 자동 캡처
- **탭별 렌더링 검증**으로 어느 탭에서 문제가 생기는지 정확히 파악
- **콘솔 에러 캡처**로 스택 트레이스 확인 가능
- Safari 수동 테스트보다 훨씬 빠르고 정확

---

## 7. 체크리스트: 유사 이슈 재발 방지

### 코드 추가/수정 시
- [ ] `const` 변수 선언 전 같은 스코프에 동일 이름 있는지 확인
- [ ] API 응답의 실제 키 이름과 프론트엔드 참조 키 일치 확인
- [ ] 유틸 함수(`formatCurrency` 등)에 null/undefined 방어 코드 존재 확인
- [ ] 수정 후 `npx playwright test` 실행하여 전체 탭 렌더링 검증

### Playwright 테스트 실행 방법
```bash
# 서버 먼저 실행
cd backend && node server.js &

# 전체 테스트
cd /Users/Python_Mac_Local/TravelPMS
npx playwright test --reporter=list

# 특정 테스트만
npx playwright test tests/detail-test.spec.js --reporter=list
```

---

## 8. 관련 파일

- `index.html` - Line 204 (formatCurrency), Line 2067 (BudgetCategoryCard), Line 2436 (중복 변수)
- `tests/detail-test.spec.js` - 탭별 렌더링 + 에러 검증 테스트
- `tests/navigation.spec.js` - PIN 로그인 + 내비게이션 테스트
- `tests/click-project.spec.js` - 프로젝트 클릭 테스트
- `backend/docs/troubleshooting-blank-screen-2026-02-16.md` - 이전 백지 이슈 문서

---

**작성자:** Claude
**검증자:** 덕화
**최종 수정:** 2026-02-17
