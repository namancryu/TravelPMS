# 트러블슈팅: 기존 프로젝트 클릭 시 빈 화면 문제

**날짜:** 2026-02-16
**문제:** 프로젝트 목록에서 기존 프로젝트(이스탄불) 클릭 시 빈 화면 표시
**상태:** ✅ 해결 완료

---

## 1. 문제 증상

### 사용자 보고
- "이스탄불 누르면 벅통이 돼"
- "기존 프로젝트 왜 로딩이 안되지?"
- 프로젝트 목록 화면은 정상 표시
- 기존 프로젝트 카드 클릭 시 완전 빈 화면

### 관찰된 현상
1. 프로젝트 목록 화면: ✅ 정상 렌더링
2. 프로젝트 카드 클릭: ❌ 빈 화면 (로딩 UI도 없음)
3. 새 여행 계획 → 컨설팅: ✅ 정상 작동
4. 서버 로그: ✅ 프로젝트 데이터 정상 응답

---

## 2. 디버깅 과정

### 2.1 초기 가설: 브라우저 캐시 문제
**시도한 조치:**
- Safari 강제 새로고침 (Cmd+Shift+R)
- Safari 완전 종료 후 재시작
- Chrome 캐시 비활성화 모드 실행

**결과:** ❌ 문제 지속

---

### 2.2 서버 중복 인스턴스 확인
**발견:**
```bash
$ ps aux | grep "node.*server.js" | wc -l
15
```
- **15개의 중복 서버 인스턴스** 실행 중

**원인:**
- 반복적인 `pkill -9 node && npm start` 실행
- 백그라운드 프로세스가 완전히 종료되기 전 새 서버 시작

**조치:**
```bash
pkill -9 node
sleep 2
npm start
```

**결과:** ⚠️ 서버 정리 완료했으나 빈 화면 문제는 지속

---

### 2.3 디버깅 로그 추가

**추가한 로그:**
```javascript
// selectProject 함수
console.log('🔍 selectProject 호출:', project);
console.log('🔍 itinerary 있음?', !!project.itinerary);

// SET_PROJECT_WITH_ITINERARY reducer
console.log('🔄 SET_PROJECT_WITH_ITINERARY 실행:', action.payload);
console.log('🔄 새로운 state:', next);

// DashboardScreen
console.log('📊 DashboardScreen 렌더링:', {
  hasProject: !!state.project,
  hasItinerary: !!state.itinerary,
  stage: state.stage,
  projectId: state.project?.id
});
```

**Chrome DevTools 콘솔 결과:**
```
✅ 프로젝트 있음 - 대시보드 렌더링
🔄 SET_PROJECT_WITH_ITINERARY 실행: {...}
🔄 새로운 state: {stage: 'PLANNING', project: {...}, ...}
📊 DashboardScreen 렌더링: {hasProject: true, hasItinerary: true, stage: 'PLANNING'}

❌ TypeError: Cannot read properties of undefined (reading 'map')
   at OverviewTab (index.html:985)
   at DashboardScreen (index.html:958)
```

---

### 2.4 근본 원인 발견

**에러 위치:** `index.html:896, 985`
```javascript
// Line 896
const completedTasks = project.tasks.filter(t => t.status === 'completed').length;
// ❌ project.tasks가 undefined

// Line 985
const completedTasks = project.tasks.filter(t => t.status === 'completed').length;
// ❌ 같은 문제
```

**서버 데이터 확인:**
```bash
$ curl -s http://localhost:3000/api/projects | jq '.projects[0] | {tasks: .tasks, budget: .budget}'
```
```json
{
  "tasks": [...],  // ✅ 존재함
  "budget": {...}  // ✅ 존재함
}
```

**localStorage 데이터 확인:**
```javascript
// 브라우저 콘솔
JSON.parse(localStorage.getItem('travelPMS_state'))
// {project: {id: "...", title: "...", destination: {...}}}
// ❌ tasks, budget 필드 없음
```

---

## 3. 근본 원인 분석

### 3.1 왜 localStorage에 tasks/budget이 없는가?

**타임라인:**
1. **과거:** 프로젝트 생성 시 간단한 스키마 사용
   ```javascript
   {
     id: "project-...",
     title: "이스탄불 여행",
     destination: {...},
     dates: {...}
     // tasks, budget 없음
   }
   ```

2. **현재:** 서버 스키마 업데이트
   ```javascript
   {
     id: "project-...",
     title: "이스탄불 여행",
     destination: {...},
     dates: {...},
     tasks: [...],      // ✅ 추가됨
     budget: {...}      // ✅ 추가됨
   }
   ```

3. **충돌:** localStorage에 저장된 **오래된 프로젝트 데이터** 사용
   - 서버는 최신 데이터 제공
   - 클라이언트는 localStorage 우선 사용
   - localStorage 데이터에 tasks/budget 없음

### 3.2 왜 에러 발생?

**컴포넌트 렌더링 순서:**
```
1. ProjectListScreen에서 프로젝트 선택
2. dispatch({ type: 'SET_PROJECT_WITH_ITINERARY', payload: {...} })
3. state.stage = 'PLANNING'으로 변경
4. DashboardScreen 렌더링 시작
5. project.tasks.filter() 호출
   ❌ tasks가 undefined → TypeError
```

**React의 동작:**
- `project.tasks.filter()`에서 에러 발생
- Error Boundary 없음
- 빈 화면 표시 (완전한 렌더링 실패)

---

## 4. 해결 방법

### 4.1 즉시 적용: 방어적 프로그래밍

**DashboardScreen 수정:**
```javascript
// 이전 (❌ 에러 발생)
const completedTasks = project.tasks.filter(t => t.status === 'completed').length;
const progress = Math.round((completedTasks / project.tasks.length) * 100);
const totalSpent = Object.values(project.budget.categories).reduce((s, c) => s + c.spent, 0);

// 수정 후 (✅ 안전)
const tasks = project.tasks || [];
const budget = project.budget || { total: 0, spent: 0, categories: {} };

const completedTasks = tasks.filter(t => t.status === 'completed').length;
const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
const totalSpent = Object.values(budget.categories).reduce((s, c) => s + (c.spent || 0), 0);

// safeProject 생성하여 모든 탭에 전달
const safeProject = {
  ...project,
  tasks,
  budget
};
```

**OverviewTab 수정:**
```javascript
// 이전 (❌)
const completedTasks = project.tasks.filter(t => t.status === 'completed').length;

// 수정 후 (✅)
const tasks = project.tasks || [];
const completedTasks = tasks.filter(t => t.status === 'completed').length;
```

**헤더 옵셔널 체이닝 추가:**
```javascript
// 이전 (❌)
<span className="text-xl">{project.destination.flag}</span>
<p className="text-xs">{project.destination.name} {getDDay(project.dates.start)}</p>

// 수정 후 (✅)
<span className="text-xl">{project.destination?.flag || '🌍'}</span>
<p className="text-xs">
  {project.destination?.name || '여행지'}
  {project.dates ? getDDay(project.dates.start) : ''}
</p>
```

---

### 4.2 장기 해결: localStorage 버전 관리

**문제:**
- 스키마 변경 시 오래된 localStorage 데이터 충돌

**해결:**
```javascript
// loadState 함수 수정
function loadState() {
  try {
    const saved = localStorage.getItem('travelPMS_state');
    if (saved) {
      const parsed = JSON.parse(saved);

      // 데이터 버전 체크
      const DATA_VERSION = 2;
      if (!parsed._version || parsed._version < DATA_VERSION) {
        console.log('⚠️ 오래된 localStorage 데이터 감지, 클리어합니다.');
        localStorage.removeItem('travelPMS_state');
        return { ...initialState, stage: STAGES.PROJECTS, _version: DATA_VERSION };
      }

      // 항상 프로젝트 목록 화면부터 시작
      if (parsed.project) return { ...parsed, stage: STAGES.PROJECTS };
    }
  } catch (_) {}
  return { ...initialState, stage: STAGES.PROJECTS, _version: 2 };
}
```

**효과:**
- 오래된 localStorage 데이터 자동 삭제
- 페이지 로드 시 "⚠️ 오래된 localStorage 데이터 감지, 클리어합니다" 로그 출력
- 서버에서 최신 데이터 받아옴

---

### 4.3 추가 개선: 프로젝트 선택 시 서버에서 최신 데이터 로드

**문제:**
- 프로젝트 목록에서 선택한 데이터가 오래됨
- localStorage 우선 사용으로 서버 최신 데이터 무시

**해결:**
```javascript
// 이전 (❌ localStorage 데이터 사용)
const selectProject = (project) => {
  dispatch({
    type: 'SET_PROJECT_WITH_ITINERARY',
    payload: {
      project,
      itinerary: project.itinerary || null
    }
  });
};

// 수정 후 (✅ 서버에서 최신 데이터 로드)
const selectProject = async (project) => {
  console.log('🔍 selectProject 호출:', project);

  // 서버에서 최신 프로젝트 데이터 다시 불러오기
  const freshData = await api(`/api/project/${project.id}`);
  if (freshData && freshData.project) {
    console.log('✅ 서버에서 최신 데이터 로드:', freshData.project);
    dispatch({
      type: 'SET_PROJECT_WITH_ITINERARY',
      payload: {
        project: freshData.project,
        itinerary: freshData.itinerary || null
      }
    });
  } else {
    // 서버 실패 시 기존 데이터 사용
    console.log('⚠️ 서버 로드 실패, 기존 데이터 사용');
    dispatch({
      type: 'SET_PROJECT_WITH_ITINERARY',
      payload: {
        project,
        itinerary: project.itinerary || null
      }
    });
  }
};
```

**효과:**
- 항상 최신 서버 데이터 사용
- 네트워크 실패 시에도 로컬 데이터로 폴백
- 로딩 상태 자연스럽게 표시

---

## 5. 적용된 수정사항 요약

### 파일: `/Users/Python_Mac_Local/TravelPMS/index.html`

| 라인 | 변경 내용 | 목적 |
|------|----------|------|
| 87-104 | `loadState()` 버전 체크 추가 | 오래된 localStorage 자동 클리어 |
| 454-477 | `selectProject()` async로 변경 | 서버에서 최신 데이터 로드 |
| 894-904 | `DashboardScreen` 방어 코드 | tasks/budget undefined 방지 |
| 905-913 | 헤더 옵셔널 체이닝 | destination/dates undefined 방지 |
| 964-972 | `safeProject` 생성 | 모든 탭에 안전한 데이터 전달 |
| 984-988 | `OverviewTab` 방어 코드 | tasks undefined 방지 |

---

## 6. 테스트 결과

### 6.1 수정 전
```
✅ 프로젝트 목록 화면 렌더링
❌ 이스탄불 프로젝트 클릭 → 빈 화면
❌ TypeError: Cannot read properties of undefined (reading 'map')
```

### 6.2 수정 후
```
✅ 프로젝트 목록 화면 렌더링
✅ 이스탄불 프로젝트 클릭 → 서버에서 최신 데이터 로드
✅ 대시보드 화면 정상 표시 (할일, 예산, 일정 등)
✅ 모든 탭 정상 작동
```

**서버 로그:**
```
👤 유저 접속: ZQNNuxjTnQbS7cF5AAAF
→ [project-1771214776679] 덕화 참여 (1명)
✅ Project updated: project-1771214776679 (1 rows)
```

**브라우저 콘솔:**
```
⚠️ 오래된 localStorage 데이터 감지, 클리어합니다.
🔍 selectProject 호출: {id: "project-1771214776679", ...}
✅ 서버에서 최신 데이터 로드: {id: "project-1771214776679", tasks: [...], budget: {...}}
📊 DashboardScreen 렌더링: {hasProject: true, hasItinerary: true, stage: 'PLANNING'}
✅ 프로젝트 있음 - 대시보드 렌더링
```

---

## 7. Lessons Learned

### 7.1 방어적 프로그래밍의 중요성

**교훈:**
> "외부 데이터는 항상 예측 불가능하다고 가정하라"

**적용:**
```javascript
// ❌ 나쁜 예
const tasks = project.tasks;
const count = tasks.length;

// ✅ 좋은 예
const tasks = project.tasks || [];
const count = tasks.length;

// ✅ 더 좋은 예 (타입스크립트 환경에서)
interface Project {
  tasks?: Task[];
  budget?: Budget;
}
```

---

### 7.2 localStorage 버전 관리

**문제:**
- 스키마 변경 시 오래된 데이터 충돌
- 사용자가 직접 localStorage 클리어해야 함

**해결:**
```javascript
// 1. 데이터 버전 필드 추가
const state = {
  _version: 2,  // 스키마 버전
  project: {...}
};

// 2. 로드 시 버전 체크
if (!saved._version || saved._version < CURRENT_VERSION) {
  localStorage.clear();
  return defaultState;
}

// 3. 스키마 변경 시 버전 증가
const DATA_VERSION = 3;  // 새 필드 추가 시
```

**효과:**
- 오래된 데이터 자동 정리
- 사용자 개입 불필요
- 점진적 마이그레이션 가능

---

### 7.3 서버 데이터 우선 원칙

**문제:**
- localStorage 데이터가 서버보다 우선
- 서버 업데이트가 클라이언트에 반영 안 됨

**해결:**
```javascript
// ❌ 나쁜 예 (localStorage 우선)
const selectProject = (project) => {
  // localStorage에서 가져온 데이터 그대로 사용
  dispatch({ type: 'SET_PROJECT', payload: project });
};

// ✅ 좋은 예 (서버 최신 데이터 우선)
const selectProject = async (project) => {
  const freshData = await api(`/api/project/${project.id}`);
  if (freshData) {
    dispatch({ type: 'SET_PROJECT', payload: freshData.project });
  } else {
    // 폴백: localStorage 데이터 사용
    dispatch({ type: 'SET_PROJECT', payload: project });
  }
};
```

**원칙:**
1. **서버 = Single Source of Truth**
2. **localStorage = 캐시 + 오프라인 지원**
3. **항상 서버에서 최신 데이터 확인**

---

### 7.4 디버깅 로그의 전략적 배치

**효과적이었던 로그:**
```javascript
// ✅ 상태 전환 확인
console.log('🔍 selectProject 호출:', project);

// ✅ 데이터 존재 여부 확인
console.log('📊 DashboardScreen 렌더링:', {
  hasProject: !!state.project,
  hasItinerary: !!state.itinerary
});

// ✅ 액션 처리 확인
console.log('🔄 SET_PROJECT_WITH_ITINERARY 실행:', action.payload);
```

**원칙:**
- 🔍 = 사용자 액션
- 🔄 = 상태 변경
- 📊 = 컴포넌트 렌더링
- ✅ = 성공
- ⚠️ = 경고
- ❌ = 에러

---

### 7.5 에러 처리 레이어

**현재 문제:**
- Error Boundary 없음
- 에러 발생 시 빈 화면 표시
- 사용자에게 어떤 문제인지 알 수 없음

**향후 개선:**
```javascript
// 1. Error Boundary 추가
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <h1>문제가 발생했습니다</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 2. 컴포넌트 래핑
<ErrorBoundary>
  <DashboardScreen {...props} />
</ErrorBoundary>

// 3. API 에러 처리 강화
async function api(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`API ${endpoint}:`, err);
    // 사용자에게 알림
    showToast(`API 오류: ${err.message}`, 'error');
    return null;
  }
}
```

---

### 7.6 중복 서버 인스턴스 방지

**문제:**
- 15개의 중복 node 프로세스 실행
- `pkill -9 node && npm start` 반복으로 발생

**해결:**
```bash
# ❌ 나쁜 방법
pkill -9 node && npm start

# ✅ 좋은 방법
pkill -9 node
sleep 2  # 프로세스 완전 종료 대기
npm start

# ✅ 더 좋은 방법 (package.json)
{
  "scripts": {
    "start": "node server.js",
    "restart": "pkill -9 node && sleep 1 && node server.js",
    "status": "ps aux | grep 'node.*server.js' | grep -v grep"
  }
}
```

**향후 개선:**
```javascript
// server.js에 PID 파일 생성
const fs = require('fs');
const PID_FILE = '/tmp/travelpms-server.pid';

// 서버 시작 시
fs.writeFileSync(PID_FILE, process.pid.toString());

// 종료 시
process.on('SIGINT', () => {
  fs.unlinkSync(PID_FILE);
  process.exit(0);
});

// 시작 전 기존 프로세스 확인
if (fs.existsSync(PID_FILE)) {
  const oldPid = fs.readFileSync(PID_FILE, 'utf8');
  console.log(`⚠️ 기존 서버 (PID ${oldPid}) 감지. 종료합니다.`);
  process.kill(parseInt(oldPid));
}
```

---

### 7.7 타입 안전성의 필요성

**현재:**
- JavaScript (타입 체크 없음)
- 런타임 에러로만 발견

**향후 개선 (TypeScript 도입 시):**
```typescript
interface Project {
  id: string;
  title: string;
  destination: Destination;
  dates: DateRange;
  tasks: Task[];        // ✅ 필수 필드
  budget: Budget;       // ✅ 필수 필드
  itinerary?: Itinerary;
}

// 컴파일 타임에 에러 발견
const project: Project = {
  id: "...",
  title: "...",
  destination: {...},
  dates: {...}
  // ❌ Error: Property 'tasks' is missing
};
```

---

## 8. 향후 개선 사항

### 8.1 단기 (1주일 이내)
- [ ] Error Boundary 구현
- [ ] API 에러 처리 강화 (사용자 알림)
- [ ] PID 파일로 중복 서버 방지
- [ ] 로딩 상태 UI 통일

### 8.2 중기 (1개월 이내)
- [ ] localStorage 마이그레이션 로직 체계화
- [ ] 서버 상태 동기화 개선 (서버 우선)
- [ ] 오프라인 모드 지원
- [ ] 디버그 모드 토글 기능

### 8.3 장기 (3개월 이내)
- [ ] TypeScript 마이그레이션 검토
- [ ] 상태 관리 라이브러리 도입 (Redux Toolkit, Zustand 등)
- [ ] 프론트엔드 빌드 시스템 (Vite, Webpack)
- [ ] 자동화 테스트 (E2E, Unit)

---

## 9. 체크리스트: 앞으로 프로젝트 변경 시

### 스키마 변경 시
- [ ] `DATA_VERSION` 증가
- [ ] 기본값 설정 (|| [] || {})
- [ ] 옵셔널 체이닝 사용 (?.)
- [ ] 타입 검증 추가
- [ ] 마이그레이션 로직 작성 (필요 시)

### 새 컴포넌트 추가 시
- [ ] Error Boundary 래핑
- [ ] null/undefined 체크
- [ ] 로딩 상태 처리
- [ ] 에러 상태 처리
- [ ] 디버그 로그 추가

### API 변경 시
- [ ] 서버-클라이언트 스키마 일치 확인
- [ ] 에러 처리 추가
- [ ] 타임아웃 설정
- [ ] 재시도 로직 (필요 시)
- [ ] 사용자 피드백 제공

---

## 10. 참고 자료

### 관련 파일
- `/Users/Python_Mac_Local/TravelPMS/index.html` (Line 87-104, 454-477, 894-988)
- `/Users/Python_Mac_Local/TravelPMS/backend/server.js`
- `/Users/Python_Mac_Local/TravelPMS/backend/.env`

### 관련 이슈
- 프로젝트 클릭 시 빈 화면 (2026-02-16)
- localStorage 버전 관리 필요성
- 서버 중복 인스턴스 문제

### 학습 자료
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [LocalStorage Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Defensive Programming](https://en.wikipedia.org/wiki/Defensive_programming)

---

**작성자:** Claude
**검증자:** 덕화
**최종 수정:** 2026-02-16
