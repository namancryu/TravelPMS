#!/bin/bash
# serveo 터널 자동 재연결 스크립트
# 사용법: bash tunnel.sh &

while true; do
  echo "$(date) - serveo 터널 시작..."
  ssh -o StrictHostKeyChecking=no \
      -o ServerAliveInterval=60 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -R 80:localhost:3000 serveo.net 2>&1
  echo "$(date) - 터널 끊김. 5초 후 재연결..."
  sleep 5
done
