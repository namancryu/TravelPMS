# 일정표 상세 모달 - 교훈

## 주요 교훈

### 1. AI 프롬프트에 예시 JSON 포함하면 응답 품질 크게 향상
- 단순히 "detail 포함하세요"보다 구체적인 JSON 예시를 제공하는 것이 훨씬 정확한 포맷을 얻음
- 필드명, 타입, 값 예시까지 명시하면 파싱 오류 최소화

### 2. 모바일 바텀시트 = items-end + translateY 애니메이션
- `flex items-end` (모바일) vs `items-center` (데스크톱) 사용
- `sm:` 미디어 쿼리로 분기하여 한 컴포넌트로 양쪽 대응
- 모바일 핸들 바(회색 막대)가 바텀시트임을 시각적으로 알려줌

### 3. detail 필드는 Optional로 설계
- 모든 슬롯에 detail을 강제하지 않음 (flight/transport 등 불필요한 슬롯 제외)
- `hasDetail` 체크로 클릭 가능/불가능 자연스럽게 분기
- 기존 슬롯 카드 동작에 영향 없이 점진적 확장 가능

### 4. 기존 링크와 모달 클릭 충돌 방지
- detail이 있는 슬롯의 내부 링크에 `e.stopPropagation()` 필수
- detail이 있으면 카드 전체가 클릭 → 모달, 내부 링크는 별도 동작

## 시행착오
- Mock 데이터에 detail을 추가할 때, 주요 슬롯만 선택적으로 추가하는 것이 효율적 (전체 추가는 데이터량만 비대해짐)

## 성공 요인
- 기존 모달 패턴(SettingsModal, RecommendationsModal) 참고하여 일관된 UX 유지
- 바텀시트 + 센터 모달 하이브리드로 모바일/데스크톱 모두 대응

## 재사용 가능한 체크리스트
- [ ] 모달 컴포넌트: `isOpen` + `onClose` + 배경 클릭 닫기 + stopPropagation
- [ ] 바텀시트: `items-end` (모바일) + `rounded-t-2xl` + 핸들 바
- [ ] AI 프롬프트: 원하는 JSON 구조의 구체적 예시 포함
- [ ] 기존 인터랙션 보존: 새 클릭 핸들러는 optional 적용
