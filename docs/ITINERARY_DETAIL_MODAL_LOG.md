# 일정표 상세 모달 구현 로그

## 실행 일시
2026-02-18

## 작업 순서

### 1. 백업 (Phase 1)
- `backups/itinerary_detail_*` 디렉토리에 원본 파일 백업
- 대상: `itineraryGenerator.js`, `index.html`, `custom.css`

### 2. AI 프롬프트 상세화
- `backend/src/itineraryGenerator.js` 440-471행 프롬프트 수정
- food/activity/hotel 슬롯에 detail 필드 생성 요청 추가
- detail 구조: `{description, options[], tips[], duration, reservationNeeded, childFriendly}`
- 예시 JSON 포함하여 AI가 정확한 포맷으로 응답하도록 유도

### 3. Mock 데이터 detail 추가
- **오사카 arrival**: 이치란 라멘(3곳), 호텔 체크인(3곳), 도톤보리 산책(3곳), 타코야키(3곳)
- **오사카 culture**: 카페 모닝(2곳), 오사카성(2곳), 구로몬시장(3곳), 후시미이나리(2곳), 교토역 저녁(3곳)
- **오사카 usj**: USJ 입장(2개 패스 옵션)
- **도쿄 arrival**: 이자카야 저녁(3곳)
- **다낭 arrival**: 쌀국수 저녁(3곳)
- **터키 cappadocia**: 열기구 투어(3개 업체)

### 4. SlotDetailModal 컴포넌트 생성
- `index.html`에 새 React 컴포넌트 추가 (ItineraryTab 직전)
- 구현 내용:
  - 바텀시트 스타일 (모바일) / 센터 모달 (데스크톱)
  - 헤더: 아이콘 + 제목 + 시간 + 위치 + 비용
  - 배지: 소요시간, 예약필요여부, 아이동반 적합성
  - 추천 선택지 카드: 이름, 카테고리, 가격대, 별점, 하이라이트 태그, 추천사유, 지도 링크
  - 실용 팁 섹션
  - 하단 버튼: Google 검색 / 지도 보기
  - 클릭 외부 닫기, 모바일 핸들

### 5. 슬롯 카드 클릭 → 모달 연동
- `ItineraryTab`에 `selectedSlot` state 추가
- detail 필드가 있는 슬롯에 onClick 핸들러 추가
- 카드에 `cursor-pointer`, `hover:shadow-md`, `hover:ring-1` 스타일 적용
- "상세보기 >" 텍스트 표시 (detail 있는 슬롯만)
- 기존 링크의 `e.stopPropagation()` 처리

### 6. CSS 애니메이션
- `custom.css`에 `.slide-up-modal` 클래스 추가
- 모바일: `translateY(100px)` → `translateY(0)` 슬라이드업
- 데스크톱: `scale(0.95)` → `scale(1)` 줌인 효과

## 변경 파일 목록
| 파일 | 변경 유형 |
|------|-----------|
| `backend/src/itineraryGenerator.js` | AI 프롬프트 수정 + Mock 데이터 detail 추가 |
| `index.html` | SlotDetailModal 컴포넌트 + ItineraryTab 수정 |
| `assets/styles/custom.css` | 바텀시트 애니메이션 추가 |
