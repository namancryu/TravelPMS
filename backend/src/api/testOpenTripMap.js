/**
 * OpenTripMap API 테스트 스크립트
 * 실행: node src/api/testOpenTripMap.js
 */

require('dotenv').config();
const { getCityCoordinates, getPointsOfInterest } = require('./externalAPIs');

async function testOpenTripMap() {
  console.log('🧪 OpenTripMap API 테스트 시작...\n');

  // API 키 확인
  if (!process.env.OPENTRIPMAP_API_KEY) {
    console.log('❌ OPENTRIPMAP_API_KEY가 설정되지 않았습니다.');
    console.log('\n📝 API 키 발급 방법:');
    console.log('1. https://dev.opentripmap.org/product 접속');
    console.log('2. 이메일 입력 → API 키 즉시 발급');
    console.log('3. backend/.env 파일에 추가:');
    console.log('   OPENTRIPMAP_API_KEY=your_api_key_here\n');
    return;
  }

  console.log('✅ API 키 확인 완료\n');

  // 테스트 1: 도쿄 좌표 검색
  console.log('📍 테스트 1: 도쿄 좌표 검색');
  const tokyoCoords = await getCityCoordinates('Tokyo', 'Japan');
  if (tokyoCoords) {
    console.log('✅ 성공:', JSON.stringify(tokyoCoords, null, 2));
  } else {
    console.log('❌ 실패');
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // 테스트 2: 도쿄 주변 관광지 검색
  if (tokyoCoords) {
    console.log('🗺️  테스트 2: 도쿄 주변 관광지 Top 10');
    const attractions = await getPointsOfInterest(
      tokyoCoords.latitude,
      tokyoCoords.longitude,
      10000, // 10km 반경
      10     // 상위 10개
    );

    if (attractions && attractions.length > 0) {
      console.log(`✅ ${attractions.length}개 발견:\n`);
      attractions.forEach((poi, idx) => {
        console.log(`${idx + 1}. ${poi.name || '이름 없음'}`);
        console.log(`   - 거리: ${poi.distance}m`);
        console.log(`   - 종류: ${poi.kinds || '미분류'}`);
        if (poi.description) {
          console.log(`   - 설명: ${poi.description.substring(0, 100)}...`);
        }
        console.log('');
      });
    } else {
      console.log('❌ 관광지를 찾을 수 없습니다.');
    }
  }

  console.log('\n🎉 테스트 완료!');
}

// 실행
testOpenTripMap().catch(err => {
  console.error('❌ 테스트 오류:', err);
  process.exit(1);
});
