#!/bin/bash

# TravelPMS 시작 스크립트
# 기존 프로세스를 정리하고 서버를 새로 시작합니다

echo "🔄 TravelPMS 시작 중..."

# 1. 기존 node 프로세스 종료
echo "📋 기존 프로세스 확인 중..."
EXISTING_PIDS=$(lsof -ti:3000)

if [ ! -z "$EXISTING_PIDS" ]; then
  echo "⚠️  포트 3000에서 실행 중인 프로세스 발견: $EXISTING_PIDS"
  echo "🛑 프로세스 종료 중..."
  kill -9 $EXISTING_PIDS 2>/dev/null
  sleep 2
  echo "✅ 기존 프로세스 종료 완료"
else
  echo "✅ 실행 중인 프로세스 없음"
fi

# 2. 백엔드 디렉토리로 이동
cd /Users/Python_Mac_Local/TravelPMS/backend

# 3. 서버 시작 (백그라운드)
echo "🚀 서버 시작 중..."
npm start > /tmp/travelpms.log 2>&1 &
SERVER_PID=$!

# 4. 서버가 시작될 때까지 대기
echo "⏳ 서버 초기화 대기 중..."
sleep 3

# 5. 서버 상태 확인
if ps -p $SERVER_PID > /dev/null; then
  echo "✅ 서버가 성공적으로 시작되었습니다 (PID: $SERVER_PID)"
  echo "🌐 서버 주소: http://localhost:3000"

  # 6. 브라우저 열기
  echo "🌍 브라우저 열기 중..."
  sleep 2
  osascript -e 'tell application "Safari" to activate' -e 'tell application "Safari" to open location "http://localhost:3000"' 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "✅ Safari 브라우저가 열렸습니다"
  else
    echo "⚠️  브라우저를 자동으로 열 수 없습니다"
    echo "📌 수동으로 http://localhost:3000 을 방문해주세요"
  fi

  # 7. LTE/외부 접속용 터널 시작
  echo "🌍 LTE 터널 시작 중..."
  npx localtunnel --port 3000 --subdomain travelpms > /tmp/travelpms-tunnel.log 2>&1 &
  TUNNEL_PID=$!
  sleep 3

  TUNNEL_URL=$(grep -o "https://[a-z0-9.-]*" /tmp/travelpms-tunnel.log | head -1)
  if [ ! -z "$TUNNEL_URL" ]; then
    echo "✅ LTE 터널 시작됨 (PID: $TUNNEL_PID)"
  else
    TUNNEL_URL="https://travelpms.loca.lt"
  fi

  echo ""
  echo "======================================"
  echo "🎉 TravelPMS가 실행 중입니다!"
  echo "======================================"
  echo "📍 로컬: http://localhost:3000"
  echo "📱 LTE/외부: $TUNNEL_URL"
  echo "📝 로그: tail -f /tmp/travelpms.log"
  echo "🛑 종료: pkill -9 node"
  echo "======================================"
  echo ""
  echo "📲 핸드폰에서 LTE로 접속하려면:"
  echo "   $TUNNEL_URL"
  echo "   (첫 접속 시 'Click to Continue' 클릭)"
  echo "======================================"

else
  echo "❌ 서버 시작 실패"
  echo "📋 로그 확인:"
  cat /tmp/travelpms.log
  exit 1
fi
