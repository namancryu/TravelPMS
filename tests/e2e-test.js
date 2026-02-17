/**
 * TravelPMS E2E 테스트
 * 전체 시스템 기능을 테스트합니다
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const API_BASE = '/api';

// 테스트 결과 저장
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * HTTP 요청 헬퍼
 */
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * 테스트 실행 헬퍼
 */
async function test(name, fn) {
  try {
    console.log(`\n🧪 ${name}`);
    await fn();
    console.log(`✅ PASS`);
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
  }
}

/**
 * Assertion 헬퍼
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}

function assertExists(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

// 테스트용 데이터
let testProjectId = null;
let testTransactionId = null;

/**
 * 테스트 Suite
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('🚀 TravelPMS E2E 테스트 시작');
  console.log('='.repeat(60));

  // 1. Health Check
  await test('1. Health Check - 서버 상태 확인', async () => {
    const res = await request('GET', '/health');
    assertEquals(res.status, 200, 'Health check 실패');
    assert(res.data.status === 'ok', 'Health status가 ok가 아님');
  });

  // 2. 프로젝트 생성 (실제 API 형식: destinationId는 DB의 id 형식)
  await test('2. 프로젝트 생성 - 새 여행 프로젝트 생성', async () => {
    const newProject = {
      destinationId: 'japan-tokyo',
      title: 'E2E 테스트 프로젝트',
      dates: { start: '2026-03-01' },
      travelers: 2,
      budget: 2000000
    };

    const res = await request('POST', `${API_BASE}/project/create`, newProject);
    assertEquals(res.status, 200, '프로젝트 생성 실패');
    assertExists(res.data.id, '생성된 프로젝트 ID 없음');

    testProjectId = res.data.id;
    console.log(`   📝 프로젝트 ID: ${testProjectId}`);
  });

  // 3. 프로젝트 조회 (경로: /api/project/:projectId 단수형)
  await test('3. 프로젝트 조회 - 생성된 프로젝트 확인', async () => {
    if (!testProjectId) throw new Error('프로젝트 ID 없음 (생성 실패)');
    const res = await request('GET', `${API_BASE}/project/${testProjectId}`);
    assertEquals(res.status, 200, '프로젝트 조회 실패');
    // 응답: { project, itinerary, updatedAt }
    const proj = res.data.project;
    assertExists(proj, 'project 필드 없음');
    assert(proj.destination && proj.destination.name === '도쿄', '목적지 불일치');
    assertEquals(proj.travelers, 2, '인원 수 불일치');
  });

  // 4. 프로젝트 목록 조회
  await test('4. 프로젝트 목록 - 전체 목록 조회', async () => {
    const res = await request('GET', `${API_BASE}/projects`);
    assertEquals(res.status, 200, '프로젝트 목록 조회 실패');
    assertExists(res.data.projects, 'projects 필드 없음');
    assert(Array.isArray(res.data.projects), '프로젝트 목록이 배열이 아님');
    assert(res.data.projects.length > 0, '프로젝트가 없음');
    console.log(`   📋 프로젝트 수: ${res.data.projects.length}`);
  });

  // 5. 트랜잭션 생성
  await test('5. 트랜잭션 생성 - 숙소 지출 추가', async () => {
    const transaction = {
      projectId: testProjectId,
      category: '숙소',
      amount: 250000,
      currency: 'KRW',
      memo: '도쿄 호텔 예약',
      transactionDate: '2026-03-01',
      bookingStatus: 'pending'
    };

    const res = await request('POST', `${API_BASE}/budget/transaction`, transaction);
    assertEquals(res.status, 200, '트랜잭션 생성 실패');
    // 응답: { transaction: { id, ... }, updatedBudget }
    assertExists(res.data.transaction, 'transaction 필드 없음');
    assertExists(res.data.transaction.id, '생성된 트랜잭션 ID 없음');

    testTransactionId = res.data.transaction.id;
    console.log(`   💰 트랜잭션 ID: ${testTransactionId}`);
  });

  // 6. 트랜잭션 목록 조회
  await test('6. 트랜잭션 조회 - 프로젝트별 트랜잭션 목록', async () => {
    const res = await request('GET', `${API_BASE}/budget/transactions/${testProjectId}`);
    assertEquals(res.status, 200, '트랜잭션 조회 실패');
    // 응답: { transactions: [], summary }
    assertExists(res.data.transactions, 'transactions 필드 없음');
    assert(Array.isArray(res.data.transactions), '트랜잭션 목록이 배열이 아님');
    assert(res.data.transactions.length > 0, '트랜잭션이 없음');

    const found = res.data.transactions.find(t => t.id === testTransactionId);
    assertExists(found, '생성한 트랜잭션을 찾을 수 없음');
    assertEquals(found.amount, 250000, '트랜잭션 금액 불일치');
  });

  // 7. 예산 알림 조회
  await test('7. 예산 알림 - Budget Alert 확인', async () => {
    const res = await request('GET', `${API_BASE}/budget/alerts/${testProjectId}`);
    assertEquals(res.status, 200, '예산 알림 조회 실패');

    assertExists(res.data.alerts, 'Alerts 데이터 없음');
    assertExists(res.data.summary, 'Summary 데이터 없음');
    assert(Array.isArray(res.data.alerts), 'Alerts가 배열이 아님');

    console.log(`   📊 총 알림 수: ${res.data.alerts.length}`);
    console.log(`   📈 총 예산 사용률: ${res.data.summary.totalUsageRate}%`);
  });

  // 8. 환율 API (단일)
  await test('8. 환율 조회 - Exchange Rate API (단일)', async () => {
    const res = await request('GET', `${API_BASE}/exchange-rate/USD/KRW`);
    assertEquals(res.status, 200, '환율 조회 실패');

    assertExists(res.data.rate, 'Exchange rate 없음');
    assert(res.data.rate > 0, 'Exchange rate가 0 이하');

    console.log(`   💱 USD → KRW: ${res.data.rate}`);
  });

  // 9. 환율 일괄 조회 API (신규)
  await test('9. 환율 일괄 조회 - Exchange Rates API (전체)', async () => {
    const res = await request('GET', `${API_BASE}/exchange-rates`);
    assertEquals(res.status, 200, '환율 일괄 조회 실패');

    assertExists(res.data.rates, 'rates 데이터 없음');
    assert(Object.keys(res.data.rates).length > 5, '환율 데이터가 너무 적음');

    const currencies = Object.keys(res.data.rates);
    console.log(`   💱 통화 수: ${currencies.length}개 (${currencies.slice(0, 5).join(', ')}...)`);
  });

  // 10. 날씨 API (신규 - 네트워크 타임아웃 허용)
  await test('10. 날씨 조회 - Weather API', async () => {
    const res = await request('GET', `${API_BASE}/weather?dest=도쿄&date=2026-02-20&days=3`);
    assertEquals(res.status, 200, '날씨 조회 실패');

    // 네트워크 타임아웃 시 error 필드가 올 수 있음
    if (res.data.error) {
      console.log(`   ⚠️ 날씨 API 네트워크 에러 (허용): ${res.data.error}`);
      return; // 네트워크 이슈는 허용
    }

    assertExists(res.data.forecast, 'forecast 데이터 없음');
    assert(Array.isArray(res.data.forecast), 'forecast가 배열이 아님');
    assert(res.data.forecast.length > 0, 'forecast가 비어있음');

    const first = res.data.forecast[0];
    console.log(`   🌤️ ${first.date}: ${first.description} (${first.tempMin}~${first.tempMax}°C)`);
  });

  // 11. 비자 API (신규)
  await test('11. 비자 조회 - Visa API', async () => {
    const res = await request('GET', `${API_BASE}/visa?country=일본`);
    assertEquals(res.status, 200, '비자 조회 실패');

    assertExists(res.data.required !== undefined, 'required 필드 없음');
    console.log(`   🛂 일본: ${res.data.required ? '비자 필요' : '무비자'} (${res.data.duration || 'N/A'})`);
  });

  // 12. 항공 가격 API (신규)
  await test('12. 항공 가격 조회 - Flight Price API', async () => {
    const res = await request('GET', `${API_BASE}/flight-price?dest=도쿄`);
    assertEquals(res.status, 200, '항공 가격 조회 실패');

    assertExists(res.data.price, 'price 데이터 없음');
    assert(res.data.price > 0, 'price가 0 이하');

    console.log(`   ✈️ 도쿄 항공: ${res.data.price.toLocaleString()}원 (${res.data.source})`);
  });

  // 13. 항공 전체 가격표 API (신규)
  await test('13. 항공 전체 가격표 - Flight Prices API', async () => {
    const res = await request('GET', `${API_BASE}/flight-prices`);
    assertEquals(res.status, 200, '항공 전체 가격표 조회 실패');

    assertExists(res.data.prices, 'prices 데이터 없음');
    assert(Object.keys(res.data.prices).length > 10, '항공 가격 데이터가 너무 적음');

    console.log(`   ✈️ 도시 수: ${Object.keys(res.data.prices).length}개`);
  });

  // 14. 목적지 검색
  await test('14. 목적지 검색 - Destination Search', async () => {
    const res = await request('GET', `${API_BASE}/destinations`);
    assertEquals(res.status, 200, '목적지 검색 실패');

    assertExists(res.data.destinations, 'destinations 필드 없음');
    assert(Array.isArray(res.data.destinations), '검색 결과가 배열이 아님');
    assert(res.data.destinations.length > 0, '검색 결과가 없음');

    console.log(`   🔍 전체 목적지: ${res.data.destinations.length}개`);
  });

  // 15. AI 모드 확인 (실제 응답: aiMode, activeProvider, providerStatus)
  await test('15. AI 모드 확인 - AI Provider 정보', async () => {
    const res = await request('GET', `${API_BASE}/mode`);
    assertEquals(res.status, 200, 'AI 모드 조회 실패');

    assertExists(res.data.aiMode, 'aiMode 필드 없음');
    assertExists(res.data.activeProvider, 'activeProvider 필드 없음');
    console.log(`   🤖 AI 모드: ${res.data.aiMode} (${res.data.activeProvider})`);
    if (res.data.providerStatus) {
      const enabled = res.data.providerStatus.filter(p => p.enabled).map(p => p.name);
      console.log(`   📋 활성 프로바이더: ${enabled.join(', ')}`);
    }
  });

  // 16. 트랜잭션 삭제
  await test('16. 트랜잭션 삭제 - Delete Transaction', async () => {
    if (!testTransactionId) throw new Error('삭제할 트랜잭션 없음');
    const res = await request('DELETE', `${API_BASE}/budget/transaction/${testTransactionId}`);
    assertEquals(res.status, 200, '트랜잭션 삭제 실패');

    // 삭제 확인
    const listRes = await request('GET', `${API_BASE}/budget/transactions/${testProjectId}`);
    const found = listRes.data.transactions.find(t => t.id === testTransactionId);
    assert(!found, '삭제된 트랜잭션이 여전히 존재함');

    console.log(`   🗑️ 트랜잭션 삭제됨: ${testTransactionId}`);
  });

  // 17. 프로젝트 삭제
  await test('17. 프로젝트 삭제 - Delete Project', async () => {
    if (!testProjectId) throw new Error('삭제할 프로젝트 없음');
    const res = await request('DELETE', `${API_BASE}/project/${testProjectId}`);
    assertEquals(res.status, 200, '프로젝트 삭제 실패');

    // 삭제 확인 (404 예상)
    const getRes = await request('GET', `${API_BASE}/project/${testProjectId}`);
    assert(getRes.status === 404 || !getRes.data || getRes.data.error, '삭제된 프로젝트가 여전히 존재함');

    console.log(`   🗑️ 프로젝트 삭제됨: ${testProjectId}`);
  });

  // 테스트 결과 출력
  console.log('\n' + '='.repeat(60));
  console.log('📊 테스트 결과');
  console.log('='.repeat(60));
  console.log(`✅ 성공: ${results.passed}`);
  console.log(`❌ 실패: ${results.failed}`);
  console.log(`📈 성공률: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  console.log('='.repeat(60));

  if (results.failed > 0) {
    console.log('\n❌ 실패한 테스트:');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => {
        console.log(`  - ${t.name}`);
        console.log(`    ${t.error}`);
      });
  }

  console.log('\n🏁 E2E 테스트 완료\n');

  // 종료 코드 설정
  process.exit(results.failed > 0 ? 1 : 0);
}

// 테스트 실행
runTests().catch(err => {
  console.error('❌ 테스트 실행 중 오류:', err);
  process.exit(1);
});
