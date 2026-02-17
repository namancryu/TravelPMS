# OpenTripMap API 설정 가이드 (1분 완료)

완전 무료 여행지 데이터 API 설정 방법

---

## 🚀 빠른 시작 (3단계)

### 1️⃣ API 키 발급 (1분)

1. **웹사이트 접속**: https://dev.opentripmap.org/product

2. **이메일 입력 후 Submit**
   ```
   Email: your-email@example.com
   [Submit] 클릭
   ```

3. **API 키 즉시 발급** (이메일 확인)
   ```
   Your API Key: 5621473abc123...
   ```

### 2️⃣ .env 파일에 추가

`backend/.env` 파일 열기:
```bash
cd /Users/Python_Mac_Local/TravelPMS/backend
nano .env
```

마지막 줄에 추가:
```bash
OPENTRIPMAP_API_KEY=5621473abc123...  # 발급받은 키
```

저장: `Ctrl + X` → `Y` → `Enter`

### 3️⃣ 테스트 실행

```bash
node src/api/testOpenTripMap.js
```

**예상 결과**:
```
🧪 OpenTripMap API 테스트 시작...

✅ API 키 확인 완료

📍 테스트 1: 도쿄 좌표 검색
✅ 성공: {
  "latitude": 35.6897,
  "longitude": 139.6922,
  "name": "Tokyo",
  "country": "JP"
}

🗺️  테스트 2: 도쿄 주변 관광지 Top 10
✅ 10개 발견:

1. Tokyo Tower
   - 거리: 1245m
   - 종류: architecture,towers
   - 설명: Tokyo Tower is a communications and observation tower...

2. Senso-ji Temple
   - 거리: 2103m
   - 종류: religion,buddhist_temples

...

🎉 테스트 완료!
```

---

## 📊 OpenTripMap 기능

### ✅ 제공되는 데이터
- 1000만+ 관광 명소 (전 세계)
- 박물관, 사찰, 공원, 랜드마크, 건축물
- GPS 좌표, 설명, 위키피디아 링크, 사진

### ✅ 무료 사용 범위
- **무제한 요청** (합리적 사용 범위)
- **신용카드 불필요**
- **상업적 이용 가능** (ODbL 라이선스)

### 📝 API 엔드포인트
```javascript
// 1. 도시 좌표 검색
GET /places/geoname?name=Tokyo&apikey=YOUR_KEY

// 2. 주변 관광지 검색
GET /places/radius?lat=35.6897&lon=139.6922&radius=5000&apikey=YOUR_KEY

// 3. 관광지 상세 정보
GET /places/xid/YOUR_XID?apikey=YOUR_KEY
```

---

## 🔧 Travel PMS 통합

### API 사용 예시

```javascript
// 1. 기본 조회 (OpenTripMap 자동 적용)
GET /api/destinations/tokyo

// 2. 외부 데이터 포함
GET /api/destinations/tokyo?includePOI=true

// 응답 예시:
{
  "destination": {
    "id": "tokyo",
    "name": "도쿄",
    "rating": 4.8,
    "externalData": {
      "attractions": [
        {
          "name": "Tokyo Tower",
          "distance": 1245,
          "kinds": "architecture,towers",
          "image": "https://...",
          "wikipedia": "https://en.wikipedia.org/wiki/Tokyo_Tower"
        },
        // ... 20개
      ]
    },
    "attractionsCount": 20
  }
}
```

---

## ❓ 문제 해결

### ❌ "API 키가 설정되지 않았습니다"
**원인**: `.env` 파일에 키가 없음
**해결**: 위 2️⃣ 단계 다시 확인

### ❌ "401 Unauthorized"
**원인**: API 키가 잘못됨
**해결**: https://dev.opentripmap.org/product 에서 재발급

### ❌ "No data found"
**원인**: 검색 결과 없음 (정상)
**해결**: 다른 도시로 테스트 (예: Paris, London)

---

## 📚 추가 리소스

- 공식 문서: https://opentripmap.io/docs
- API 테스트: https://opentripmap.io/api
- 라이선스: ODbL (https://opendatacommons.org/licenses/odbl/)

---

**완료 시간**: 약 1분
**비용**: $0 (완전 무료!)
