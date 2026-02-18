# 일정표(ItineraryTab) 상세화 + 모달 구현 계획

## 배경/목적
현재 ItineraryTab의 일정 슬롯이 "이치란 라멘 12,000원" 같은 단순 표시만 제공. 구체적인 식당 추천, 메뉴, 가격대, 추천사유 등 세부정보가 없음. 슬롯 클릭 시 상세정보를 확인할 방법도 없음.

## 현재 문제점
1. 슬롯 데이터에 `detail` 필드 없음 → 상세정보 표시 불가
2. AI 프롬프트가 간략 → 식당 이름/메뉴/가격대 미생성
3. Mock 데이터에 대안 추천 없음
4. 슬롯 클릭 인터랙션 없음

## 해결 방안
1. 슬롯 데이터 구조에 `detail` 필드 추가 (options, tips, duration 등)
2. AI 프롬프트 상세화 → 식사/관광/숙소/교통별 구체적 정보 요청
3. SlotDetailModal 컴포넌트 신규 생성 (바텀시트 스타일)
4. Mock 데이터 주요 슬롯에 detail 추가

## 구현 계획
| 순서 | 작업 | 파일 |
|------|------|------|
| 1 | AI 프롬프트 상세화 | `backend/src/itineraryGenerator.js` |
| 2 | Mock 데이터 detail 추가 | `backend/src/itineraryGenerator.js` |
| 3 | SlotDetailModal 컴포넌트 | `index.html` |
| 4 | 슬롯 카드 클릭 → 모달 연동 | `index.html` |
| 5 | CSS 애니메이션 | `assets/styles/custom.css` |

## 영향도 분석
- **변경 파일**: `itineraryGenerator.js`, `index.html`, `custom.css`
- **기존 기능 영향**: 기존 슬롯 렌더링에 클릭 핸들러 추가 (기존 링크 동작 유지)
- **DB 스키마 변경**: 없음

## 롤백 전략
- `backups/itinerary_detail_*` 디렉토리에 원본 파일 백업 완료
- 각 파일 개별 복원 가능

## 성공 기준
1. 슬롯 카드 클릭 → 모달에 추천 장소 2-3곳 표시
2. AI 생성 일정에 detail 필드 포함
3. Mock fallback에서도 detail 표시
4. 모바일 UX (바텀시트) 정상 동작
