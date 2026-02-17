/**
 * TravelPMS E2E 테스트
 * 전체 시스템 기능을 테스트합니다
 */

const http = require('http');
const { createSocket } = require('dgram');

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

  // 2. 프로젝트 생성
  await test('2. 프로젝트 생성 - 새 여행 프로젝트 생성', async () => {
    const newProject = {
      title: 'E2E 테스트 프로젝트',
      destination: { name: '도쿄', country: '일본' },
      dates: { start: '2026-03-01', end: '2026-03-05' },
      travelers: 2,
      budget: {
        total: 2000000,
        categories: {
          accommodation: { allocated: 600000, spent: 0 },
          food: { allocated: 400000, spent: 0 },
          activities: { allocated: 500000, spent: 0 },
          transportation: { allocated: 300000, spent: 0 },
          shopping: { allocated: 150000, spent: 0 },
          other: { allocated: 50000, spent: 0 }
        }
      }
    };

    const res = await request('POST', `${API_BASE}/project/save`, newProject);
    assertEquals(res.status, 200, '프로젝트 생성 실패');
    assertExists(res.data.id, '생성된 프로젝트 ID 없음');

    testProjectId = res.data.id;
    console.log(`   📝 프로젝트 ID: ${testProjectId}`);
  });

  // 3. 프로젝트 조회
  await test('3. 프로젝트 조회 - 생성된 프로젝트 확인', async () => {
    const res = await request('GET', `${API_BASE}/projects/${testProjectId}`);
    assertEquals(res.status, 200, '프로젝트 조회 실패');
    assertEquals(res.data.title, 'E2E 테스트 프로젝트', '프로젝트 제목 불일치');
    assertEquals(res.data.travelers, 2, '인원 수 불일치');
  });

  // 4. 트랜잭션 생성 (숙소 카테고리)
  await test('4. 트랜잭션 생성 - 숙소 지출 추가', async () => {
    const transaction = {
      projectId: testProjectId,
      category: 'accommodation',
      amount: 250000,
      currency: 'KRW',
      description: '도쿄 호텔 예약',
      date: '2026-03-01',
      type: 'expense'
    };

    const res = await request('POST', `${API_BASE}/budget/transaction`, transaction);
    assertEquals(res.status, 200, '트랜잭션 생성 실패');
    assertExists(res.data.id, '생성된 트랜잭션 ID 없음');

    testTransactionId = res.data.id;
    console.log(`   💰 트랜잭션 ID: ${testTransactionId}`);
  });

  // 5. 트랜잭션 목록 조회
  await test('5. 트랜잭션 조회 - 프로젝트별 트랜잭션 목록', async () => {
    const res = await request('GET', `${API_BASE}/budget/transactions/${testProjectId}`);
    assertEquals(res.status, 200, '트랜잭션 조회 실패');
    assert(Array.isArray(res.data), '트랜잭션 목록이 배열이 아님');
    assert(res.data.length > 0, '트랜잭션이 없음');

    const found = res.data.find(t => t.id === testTransactionId);
    assertExists(found, '생성한 트랜잭션을 찾을 수 없음');
    assertEquals(found.amount, 250000, '트랜잭션 금액 불일치');
  });

  // 6. 예산 업데이트 확인
  await test('6. 예산 업데이트 - 지출 반영 확인', async () => {
    const res = await request('GET', `${API_BASE}/projects/${testProjectId}`);
    assertEquals(res.status, 200, '프로젝트 조회 실패');

    const accommodationSpent = res.data.budget.categories.accommodation.spent;
    assertEquals(accommodationSpent, 250000, '숙소 지출 금액이 반영되지 않음');

    console.log(`   💵 숙소 지출: ${accommodationSpent.toLocaleString()}원`);
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

  // 8. 예산 건강도 평가
  await test('8. 예산 건강도 - Budget Health 평가', async () => {
    const res = await request('GET', `${API_BASE}/budget/health/${testProjectId}`);
    assertEquals(res.status, 200, '예산 건강도 조회 실패');

    assertExists(res.data.health, 'Health 데이터 없음');
    assert(['healthy', 'caution', 'critical', 'over'].includes(res.data.health),
      '유효하지 않은 health 상태');

    console.log(`   🏥 예산 건강도: ${res.data.health}`);
  });

  // 9. 추가 지출로 경고 단계 테스트
  await test('9. 경고 단계 테스트 - 60% 초과 지출', async () => {
    // 숙소 예산: 600,000원, 이미 250,000원 지출
    // 60% = 360,000원이므로, 추가로 200,000원 지출하여 450,000원(75%)로 만듦
    const transaction = {
      projectId: testProjectId,
      category: 'accommodation',
      amount: 200000,
      currency: 'KRW',
      description: '추가 숙소 예약',
      date: '2026-03-03',
      type: 'expense'
    };

    const res = await request('POST', `${API_BASE}/budget/transaction`, transaction);
    assertEquals(res.status, 200, '트랜잭션 생성 실패');

    // 알림 확인
    const alertRes = await request('GET', `${API_BASE}/budget/alerts/${testProjectId}`);
    const accommodationAlert = alertRes.data.alerts.find(a => a.category === 'accommodation');

    assertExists(accommodationAlert, '숙소 카테고리 알림이 없음');
    assert(accommodationAlert.level === 'danger' || accommodationAlert.level === 'warning',
      `예상 레벨: danger/warning, 실제: ${accommodationAlert.level}`);

    console.log(`   ⚠️  알림 레벨: ${accommodationAlert.level}`);
    console.log(`   📝 메시지: ${accommodationAlert.message}`);
  });

  // 10. 환율 조회
  await test('10. 환율 조회 - Exchange Rate API', async () => {
    const res = await request('GET', `${API_BASE}/exchange-rate/USD/KRW`);
    assertEquals(res.status, 200, '환율 조회 실패');

    assertExists(res.data.rate, 'Exchange rate 없음');
    assert(res.data.rate > 0, 'Exchange rate가 0 이하');

    console.log(`   💱 USD → KRW: ${res.data.rate}`);
  });

  // 11. 목적지 검색
  await test('11. 목적지 검색 - Destination Search', async () => {
    const res = await request('GET', `${API_BASE}/destinations`);
    assertEquals(res.status, 200, '목적지 검색 실패');

    assert(Array.isArray(res.data), '검색 결과가 배열이 아님');
    assert(res.data.length > 0, '검색 결과가 없음');

    console.log(`   🔍 전체 목적지: ${res.data.length}개`);
  });

  // 12. 트랜잭션 삭제
  await test('12. 트랜잭션 삭제 - Delete Transaction', async () => {
    const res = await request('DELETE', `${API_BASE}/budget/transaction/${testTransactionId}`);
    assertEquals(res.status, 200, '트랜잭션 삭제 실패');

    // 삭제 확인
    const listRes = await request('GET', `${API_BASE}/budget/transactions/${testProjectId}`);
    const found = listRes.data.find(t => t.id === testTransactionId);
    assert(!found, '삭제된 트랜잭션이 여전히 존재함');

    console.log(`   🗑️  트랜잭션 삭제됨: ${testTransactionId}`);
  });

  // 13. 프로젝트 삭제
  await test('13. 프로젝트 삭제 - Delete Project', async () => {
    const res = await request('DELETE', `${API_BASE}/project/${testProjectId}`);
    assertEquals(res.status, 200, '프로젝트 삭제 실패');

    // 삭제 확인 (404 예상)
    const getRes = await request('GET', `${API_BASE}/projects/${testProjectId}`);
    assert(getRes.status === 404 || !getRes.data, '삭제된 프로젝트가 여전히 존재함');

    console.log(`   🗑️  프로젝트 삭제됨: ${testProjectId}`);
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
