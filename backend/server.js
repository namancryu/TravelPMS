/**
 * Travel PMS v2 - Express Backend Server
 * AI 기반 여행 계획 관리 시스템
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();

const { getAllDestinations, getDestinationById, getEnrichedDestination } = require('./src/destinationDB');
const { processMessage, selectDestination, getSessionState, STATES } = require('./src/conversationEngine');
const { generateMockItinerary, generateWithAI } = require('./src/itineraryGenerator');
const priceOptimizer = require('./src/priceOptimizer');
const { seedDatabase } = require('./src/database/seed');
const projectDAO = require('./src/database/projectDAO');
const transactionDAO = require('./src/database/transactionDAO');
const receiptDAO = require('./src/database/receiptDAO');
const recommendationDAO = require('./src/database/recommendationDAO');
const exchangeRateService = require('./src/services/exchangeRateService');
const ocrService = require('./src/services/ocrService');
const budgetRecommendationService = require('./src/services/budgetRecommendationService');
const budgetAlertService = require('./src/services/budgetAlertService');
const multer = require('multer');
const Database = require('better-sqlite3');
const { DB_PATH } = require('./src/database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── 가격 검증 유틸리티 함수 ─────────────────────────────────────────
/**
 * AI가 반환한 예상 비용을 검증하고 수정합니다.
 * 단위 오류 감지: 10,000원 미만이면 만원 단위로 해석하여 *100 처리
 * @param {number} cost - 원본 비용
 * @param {string} country - 국가명 (국내/해외 구분용)
 * @returns {number} - 검증된 비용 (원 단위)
 */
function validateEstimatedCost(cost, country = '') {
  if (!cost || typeof cost !== 'number') return 1000000; // 기본값: 100만원

  const isDomestic = country === '한국' || country === '대한민국' || country === 'Korea';
  const minCost = isDomestic ? 200000 : 400000; // 국내 최소 20만원, 해외 최소 40만원
  const maxCost = isDomestic ? 3000000 : 10000000; // 국내 최대 300만원, 해외 최대 1000만원

  let validatedCost = cost;

  // 단위 오류 감지: 100,000원 미만이면 만원 단위로 해석
  if (cost < 100000) {
    console.warn(`⚠️ 가격 단위 오류 감지: ${cost}원 → ${cost * 100}원으로 변환`);
    validatedCost = cost * 100;
  }

  // 여전히 너무 작으면 * 10 추가
  if (validatedCost < minCost) {
    console.warn(`⚠️ 가격이 여전히 너무 작음: ${validatedCost}원 → ${minCost}원으로 조정`);
    validatedCost = minCost;
  }

  // 너무 크면 상한선 적용
  if (validatedCost > maxCost) {
    console.warn(`⚠️ 가격이 너무 큼: ${validatedCost}원 → ${maxCost}원으로 조정`);
    validatedCost = maxCost;
  }

  return Math.round(validatedCost);
}

// ========================================
// 하이브리드 DB 초기화
// ========================================
console.log('🔧 Initializing Hybrid Database...');
try {
  seedDatabase();
  console.log('✅ Hybrid Database ready (105 destinations)');
} catch (err) {
  console.warn('⚠️ Database initialization failed, using fallback mode:', err.message);
}

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/,
      /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:3000$/,
      /\.onrender\.com$/,
      /\.serveousercontent\.com$/
    ];

    if (!origin || allowedOrigins.some(pattern =>
      pattern instanceof RegExp ? pattern.test(origin) : pattern === origin
    )) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 정책 위반: ${origin}`));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Multer 설정 (파일 업로드)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'data/uploads/receipts'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다 (JPEG, PNG, WEBP)'));
    }
  }
});

// AI Provider 초기화 (Multi-provider 지원)
const { getProviderStatus, getActiveProvider } = require('./src/ai/aiProvider');
let geminiModel = null;
let aiMode = 'mock';

// 활성화된 provider 확인
const providerStatus = getProviderStatus();
const enabledProviders = providerStatus.filter(p => p.enabled);

if (enabledProviders.length > 0) {
  const primaryProvider = enabledProviders.sort((a, b) => a.priority - b.priority)[0];
  aiMode = primaryProvider.name;

  const providerLabels = {
    'groq': '⚡ Groq AI (Llama 3.3 70B)',
    'gemini': '🤖 Gemini AI (Pro)',
    'together': '🌐 Together AI (Llama 3.1 70B)'
  };

  console.log(`✅ ${providerLabels[aiMode] || aiMode} 모드로 실행`);

  // Gemini 모델 초기화 (일정 생성용으로 여전히 사용)
  if (process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    } catch (err) {
      console.warn('⚠️ Gemini model initialization failed:', err.message);
    }
  }
} else {
  console.log('ℹ️ AI Provider 미설정 → Mock 모드로 실행');
  console.log('   API 키 설정: backend/.env 에 GROQ_API_KEY 또는 GEMINI_API_KEY 추가');
}

// 프로젝트 저장소 (in-memory)
const projects = new Map();

// ─── Health Check ───────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    aiMode,
    version: '2.0.0',
    message: 'Travel PMS v2 API is running!'
  });
});

// ─── AI Mode Info ───────────────────────────────────────
app.get('/api/mode', (req, res) => {
  const { getActiveProvider, getProviderStatus } = require('./src/ai/aiProvider');
  const quotaStatus = global.geminiQuotaExceeded || { exceeded: false };

  // Quota가 초과되었지만 리셋 시간이 지났으면 상태 초기화
  if (quotaStatus.exceeded && quotaStatus.resetDate) {
    const now = new Date();
    if (now >= quotaStatus.resetDate) {
      global.geminiQuotaExceeded = { exceeded: false };
      quotaStatus.exceeded = false;
    }
  }

  const activeProvider = getActiveProvider();
  const providerStatus = getProviderStatus();

  res.json({
    aiMode: quotaStatus.exceeded ? 'mock' : (activeProvider === 'mock' ? 'mock' : 'ai'),
    activeProvider,
    providerStatus,
    quotaExceeded: quotaStatus.exceeded,
    resetTime: quotaStatus.resetTime || null
  });
});

// ─── 목적지 목록 ───────────────────────────────────────
app.get('/api/destinations', (req, res) => {
  const destinations = getAllDestinations();
  res.json({
    destinations,
    count: destinations.length,
    mode: 'hybrid'
  });
});

// ─── 목적지 상세 (외부 API 보강) ───────────────────────
app.get('/api/destinations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includePlaces } = req.query;

    // 외부 API 보강 여부
    const options = {
      includePlaces: includePlaces === 'true'
    };

    const destination = await getEnrichedDestination(id, options);

    if (!destination) {
      return res.status(404).json({ error: '목적지를 찾을 수 없습니다.' });
    }

    res.json({ destination });
  } catch (err) {
    console.error('/api/destinations/:id error:', err);
    res.status(500).json({ error: '목적지 조회 중 오류가 발생했습니다.' });
  }
});

// ─── 대화형 컨설팅 ─────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, userSettings } = req.body;
    if (!message || !sessionId) {
      return res.status(400).json({ error: 'message와 sessionId가 필요합니다.' });
    }

    const result = await processMessage(sessionId, message, userSettings);
    res.json(result);
  } catch (err) {
    console.error('/api/chat error:', err);
    res.status(500).json({ error: '채팅 처리 중 오류가 발생했습니다.' });
  }
});

// ─── 목적지 추천 ───────────────────────────────────────
app.post('/api/recommend', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = getSessionState(sessionId);
    if (!session) {
      return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    }
    res.json({
      recommendations: session.recommendations,
      context: session.context
    });
  } catch (err) {
    console.error('/api/recommend error:', err);
    res.status(500).json({ error: '추천 생성 중 오류가 발생했습니다.' });
  }
});

// ─── 일정 생성 ─────────────────────────────────────────
app.post('/api/itinerary/generate', async (req, res) => {
  try {
    const { destinationId, duration, travelers, budget, context, startDate } = req.body;
    if (!destinationId) {
      return res.status(400).json({ error: 'destinationId가 필요합니다.' });
    }

    let itinerary;
    if (geminiModel) {
      itinerary = await generateWithAI(geminiModel, destinationId, duration, travelers, budget, context, startDate);
    } else {
      itinerary = generateMockItinerary(destinationId, duration, travelers, budget, startDate);
    }

    if (!itinerary) {
      return res.status(404).json({ error: '해당 목적지를 찾을 수 없습니다.' });
    }

    res.json(itinerary);
  } catch (err) {
    console.error('/api/itinerary/generate error:', err);
    res.status(500).json({ error: '일정 생성 중 오류가 발생했습니다.' });
  }
});

// ─── 프로젝트 생성 ─────────────────────────────────────
app.post('/api/project/create', (req, res) => {
  try {
    const { destinationId, sessionId, title, dates, travelers, budget, destinationData } = req.body;
    // DB에서 먼저 찾고, 없으면 AI가 생성한 데이터 사용
    const dest = getDestinationById(destinationId) || (destinationData ? {
      id: destinationData.id,
      name: destinationData.name || destinationId,
      country: destinationData.country || '',
      flag: destinationData.flag || '🌍',
      styles: [],
      budgetRange: [],
      bestFor: [],
      avgCost: validateEstimatedCost(destinationData.estimatedCost, destinationData.country),
      highlights: destinationData.highlights || [],
      bestSeason: destinationData.bestSeason || '',
      description: destinationData.reason || '',
      sampleItinerary: { days: 5, perDayCost: Math.round(validateEstimatedCost(destinationData.estimatedCost, destinationData.country) / 5) }
    } : null);
    if (!dest) {
      return res.status(404).json({ error: '목적지를 찾을 수 없습니다.' });
    }

    const session = sessionId ? getSessionState(sessionId) : null;
    const travelType = session?.context?.travelType || 'free';
    const projectId = `project-${Date.now()}`;
    const dDayDate = new Date();
    dDayDate.setDate(dDayDate.getDate() + 45);
    const totalBudget = budget || dest.avgCost * 3;

    // 국내 여행 여부 확인
    const isDomestic = dest.country === '한국' || dest.country === '대한민국' || dest.country === 'Korea';

    // 패키지 vs 자유여행 예산 카테고리
    const budgetCategories = travelType === 'package' ? {
      패키지비: { budget: Math.round(totalBudget * 0.75), spent: 0 },
      보험: { budget: isDomestic ? 0 : Math.round(totalBudget * 0.02), spent: 0 },
      유심: { budget: isDomestic ? 0 : Math.round(totalBudget * 0.01), spent: 0 },
      용돈: { budget: Math.round(totalBudget * (isDomestic ? 0.18 : 0.15)), spent: 0 },
      기타: { budget: Math.round(totalBudget * 0.07), spent: 0 }
    } : (isDomestic ? {
      숙소: { budget: Math.round(totalBudget * 0.4), spent: 0 },
      식비: { budget: Math.round(totalBudget * 0.3), spent: 0 },
      활동: { budget: Math.round(totalBudget * 0.15), spent: 0 },
      교통: { budget: Math.round(totalBudget * 0.1), spent: 0 },
      기타: { budget: Math.round(totalBudget * 0.05), spent: 0 }
    } : {
      항공: { budget: Math.round(totalBudget * 0.3), spent: 0 },
      숙소: { budget: Math.round(totalBudget * 0.25), spent: 0 },
      식비: { budget: Math.round(totalBudget * 0.2), spent: 0 },
      활동: { budget: Math.round(totalBudget * 0.1), spent: 0 },
      교통: { budget: Math.round(totalBudget * 0.1), spent: 0 },
      기타: { budget: Math.round(totalBudget * 0.05), spent: 0 }
    });

    // 📊 예산 생성 로깅 (가격 검증용)
    console.log('📊 예산 카테고리 생성:');
    console.log(`  - 목적지: ${dest.name} (${dest.country})`);
    console.log(`  - 총 예산: ${totalBudget.toLocaleString()}원`);
    console.log(`  - 여행 유형: ${travelType}`);
    Object.entries(budgetCategories).forEach(([cat, data]) => {
      console.log(`  - ${cat}: ${data.budget.toLocaleString()}원`);
      // 검증: 너무 작은 값 경고
      if (data.budget > 0 && data.budget < 10000) {
        console.warn(`  ⚠️ ${cat} 예산이 10,000원 미만 - 단위 오류 가능성`);
      }
    });

    const project = {
      id: projectId,
      title: title || `${dest.flag} ${dest.name} ${travelType === 'package' ? '패키지' : '자유여행'}`,
      travelType,
      destination: dest,
      dates: dates || { start: dDayDate.toISOString().split('T')[0] },
      travelers: travelers || (session?.context?.travelers === 'family' ? 4 : 2),
      budget: {
        total: totalBudget,
        spent: 0,
        categories: budgetCategories
      },
      milestones: travelType === 'package' ? (isDomestic ? [
        { id: 'd-45', label: '여행 계획 시작', date: new Date().toISOString().split('T')[0], status: 'completed' },
        { id: 'd-30', label: '패키지 예약', date: getMilestoneDate(30), status: 'pending' },
        { id: 'd-7', label: '짐싸기 및 준비', date: getMilestoneDate(7), status: 'pending' },
        { id: 'd-1', label: '최종 확인', date: getMilestoneDate(1), status: 'pending' }
      ] : [
        { id: 'd-45', label: '여행 계획 시작', date: new Date().toISOString().split('T')[0], status: 'completed' },
        { id: 'd-30', label: '패키지 예약', date: getMilestoneDate(30), status: 'pending' },
        { id: 'd-14', label: '보험/유심 준비', date: getMilestoneDate(14), status: 'pending' },
        { id: 'd-7', label: '환전/짐싸기', date: getMilestoneDate(7), status: 'pending' },
        { id: 'd-1', label: '최종 확인', date: getMilestoneDate(1), status: 'pending' }
      ]) : (isDomestic ? [
        { id: 'd-45', label: '여행 계획 시작', date: new Date().toISOString().split('T')[0], status: 'completed' },
        { id: 'd-30', label: '숙소 예약', date: getMilestoneDate(30), status: 'pending' },
        { id: 'd-7', label: '짐싸기 및 준비', date: getMilestoneDate(7), status: 'pending' },
        { id: 'd-1', label: '최종 확인', date: getMilestoneDate(1), status: 'pending' }
      ] : [
        { id: 'd-45', label: '여행 계획 시작', date: new Date().toISOString().split('T')[0], status: 'completed' },
        { id: 'd-30', label: '항공/숙소 예약', date: getMilestoneDate(30), status: 'pending' },
        { id: 'd-14', label: '보험/유심 준비', date: getMilestoneDate(14), status: 'pending' },
        { id: 'd-7', label: '환전/짐싸기', date: getMilestoneDate(7), status: 'pending' },
        { id: 'd-1', label: '최종 확인', date: getMilestoneDate(1), status: 'pending' }
      ]),
      tasks: generateDefaultTasks(dest, travelType),
      createdAt: new Date().toISOString(),
      consultingContext: session?.context || null
    };

    if (sessionId) selectDestination(sessionId, destinationId);

    // DB에 저장
    projectDAO.createProject(project);

    res.json(project);
  } catch (err) {
    console.error('/api/project/create error:', err);
    res.status(500).json({ error: '프로젝트 생성 중 오류가 발생했습니다.' });
  }
});

// ─── 가격 최적화 ───────────────────────────────────────
app.post('/api/price/flights', async (req, res) => {
  try {
    const result = await priceOptimizer.findCheapestFlights(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '항공 가격 조회 실패' });
  }
});

app.post('/api/price/hotels', async (req, res) => {
  try {
    const result = await priceOptimizer.findCheapestHotels(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '숙박 가격 조회 실패' });
  }
});

app.post('/api/price/optimize', async (req, res) => {
  try {
    const result = await priceOptimizer.optimizeTotalCost(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '비용 최적화 실패' });
  }
});

app.post('/api/price/exchange', async (req, res) => {
  try {
    const { currency, targetAmount } = req.body;
    const result = await priceOptimizer.recommendExchangeTiming(currency, targetAmount);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '환전 정보 조회 실패' });
  }
});

// ─── 공유 기능 ─────────────────────────────────────────
const sharedProjects = new Map();

app.post('/api/share/create', (req, res) => {
  try {
    const { project, itinerary } = req.body;
    if (!project) return res.status(400).json({ error: '프로젝트 데이터가 필요합니다.' });

    const shareId = generateShareId();
    sharedProjects.set(shareId, {
      project,
      itinerary,
      createdAt: new Date().toISOString(),
      viewCount: 0
    });

    res.json({ shareId, shareUrl: `/shared/${shareId}` });
  } catch (err) {
    console.error('/api/share/create error:', err);
    res.status(500).json({ error: '공유 링크 생성 실패' });
  }
});

app.get('/api/share/:shareId', (req, res) => {
  const data = sharedProjects.get(req.params.shareId);
  if (!data) return res.status(404).json({ error: '공유 데이터를 찾을 수 없습니다.' });
  data.viewCount++;
  res.json(data);
});

function generateShareId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ─── 헬퍼 함수 ─────────────────────────────────────────
function getMilestoneDate(daysBeforeTrip) {
  const d = new Date();
  d.setDate(d.getDate() + 45 - daysBeforeTrip);
  return d.toISOString().split('T')[0];
}

function generateDefaultTasks(dest, travelType) {
  const currencyMap = {
    '일본': 'JPY', '태국': 'THB', '베트남': 'VND',
    '프랑스': 'EUR', '인도네시아': 'IDR', '한국': 'KRW',
    '싱가포르': 'SGD', '미국': 'USD', '튀르키예': 'TRY',
    '그리스': 'EUR', '스페인': 'EUR', '이탈리아': 'EUR',
    '영국': 'GBP', '호주': 'AUD', '중국': 'CNY'
  };
  const currency = currencyMap[dest.country] || 'USD';

  // 국내 여행 여부 확인
  const isDomestic = dest.country === '한국' || dest.country === '대한민국' || dest.country === 'Korea';

  // 패키지 여행 할일
  if (travelType === 'package') {
    const tasks = [
      {
        id: 't-1', title: '패키지 상품 비교 및 예약', category: 'package',
        priority: 'high', status: 'pending', milestone: 'd-30',
        estimatedCost: Math.round(dest.avgCost * 0.85),
        links: [
          { label: '하나투어', url: 'https://www.hanatour.com' },
          { label: '모두투어', url: 'https://www.modetour.com' },
          { label: '여행박사', url: 'https://www.tripdr.com' }
        ]
      }
    ];

    // 해외 여행일 때만 여행자보험, 유심, 환전 추가
    if (!isDomestic) {
      tasks.push({
        id: 't-2', title: '여행자보험 가입', category: 'insurance',
        priority: 'medium', status: 'pending', milestone: 'd-14',
        estimatedCost: 15000,
        links: [{ label: '삼성화재 다이렉트', url: 'https://direct.samsungfire.com' }]
      });
      tasks.push({
        id: 't-3', title: '유심/eSIM 준비', category: 'communication',
        priority: 'medium', status: 'pending', milestone: 'd-7',
        estimatedCost: 10000,
        links: [{ label: '말톡', url: 'https://www.maltalk.co.kr' }]
      });
      if (currency !== 'KRW') {
        tasks.push({
          id: 't-4', title: `${currency} 환전 (용돈)`, category: 'finance',
          priority: 'medium', status: 'pending', milestone: 'd-7',
          estimatedCost: 0,
          notes: '패키지에 식사 포함이지만 간식/쇼핑용 현금 준비',
          links: [{ label: '하나은행 환전', url: 'https://www.kebhana.com' }]
        });
      }
    }

    tasks.push({
      id: 't-5', title: '여행 짐 싸기', category: 'preparation',
      priority: 'low', status: 'pending', milestone: 'd-1',
      estimatedCost: 0,
      links: []
    });

    return tasks;
  }

  // 자유여행 할일
  const tasks = [];
  let taskId = 1;

  // 해외 여행일 때만 항공권 추가
  if (!isDomestic) {
    tasks.push({
      id: `t-${taskId++}`, title: '항공권 검색 및 예약', category: 'transportation',
      priority: 'high', status: 'pending', milestone: 'd-30',
      estimatedCost: Math.round(dest.avgCost * 0.4),
      links: [
        { label: '스카이스캐너', url: 'https://www.skyscanner.co.kr' },
        { label: '네이버 항공권', url: 'https://flight.naver.com' }
      ]
    });
  }

  // 숙소 예약 (국내/해외 공통)
  tasks.push({
    id: `t-${taskId++}`, title: '숙소 예약', category: 'accommodation',
    priority: 'high', status: 'pending', milestone: 'd-30',
    estimatedCost: Math.round(dest.avgCost * 0.3),
    links: [
      { label: '부킹닷컴', url: 'https://www.booking.com' },
      { label: '아고다', url: 'https://www.agoda.com' },
      { label: '에어비앤비', url: 'https://www.airbnb.co.kr' }
    ]
  });

  // 해외 여행일 때만 여행자보험, 유심, 환전 추가
  if (!isDomestic) {
    tasks.push({
      id: `t-${taskId++}`, title: '여행자보험 가입', category: 'insurance',
      priority: 'medium', status: 'pending', milestone: 'd-14',
      estimatedCost: 15000,
      links: [{ label: '삼성화재 다이렉트', url: 'https://direct.samsungfire.com' }]
    });
    tasks.push({
      id: `t-${taskId++}`, title: '유심/eSIM 준비', category: 'communication',
      priority: 'medium', status: 'pending', milestone: 'd-7',
      estimatedCost: 10000,
      links: [{ label: '말톡', url: 'https://www.maltalk.co.kr' }]
    });
    if (currency !== 'KRW') {
      tasks.push({
        id: `t-${taskId++}`, title: `${currency} 환전`, category: 'finance',
        priority: 'medium', status: 'pending', milestone: 'd-7',
        estimatedCost: 0,
        links: [{ label: '하나은행 환전', url: 'https://www.kebhana.com' }]
      });
    }
  }

  tasks.push({
    id: `t-${taskId++}`, title: '여행 짐 싸기', category: 'preparation',
    priority: 'low', status: 'pending', milestone: 'd-1',
    estimatedCost: 0,
    links: []
  });

  return tasks;
}

// ─── 프로젝트 동기화 API ──────────────────────────────
// 프로젝트 저장 (서버에 영구 저장)
app.post('/api/project/save', (req, res) => {
  try {
    const { projectId, project, itinerary } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId 필요' });

    // DB 업데이트
    const updates = { ...project, itinerary };
    projectDAO.updateProject(projectId, updates);

    // Socket.io로 같은 프로젝트의 다른 유저에게 알림
    io.to(`project:${projectId}`).emit('project:updated', { project, itinerary, updatedAt: new Date().toISOString() });
    res.json({ ok: true });
  } catch (err) {
    console.error('/api/project/save error:', err);
    res.status(500).json({ error: '저장 실패' });
  }
});

// 프로젝트 불러오기
app.get('/api/project/:projectId', (req, res) => {
  const project = projectDAO.getProjectById(req.params.projectId);
  if (!project) return res.status(404).json({ error: '프로젝트 없음' });

  // 기존 API 형식 유지 (project와 itinerary 분리)
  const response = {
    project: {
      id: project.id,
      title: project.title,
      travelType: project.travelType,
      destination: project.destination,
      dates: project.dates,
      travelers: project.travelers,
      budget: project.budget,
      milestones: project.milestones,
      tasks: project.tasks,
      consultingContext: project.consultingContext,
      createdAt: project.createdAt
    },
    itinerary: project.itinerary,
    updatedAt: project.updatedAt
  };

  res.json(response);
});

// 프로젝트 삭제
app.delete('/api/project/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const exists = projectDAO.getProjectById(projectId);

    if (!exists) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    projectDAO.deleteProject(projectId);
    console.log(`🗑️ 프로젝트 삭제: ${projectId}`);

    res.json({ success: true, message: '프로젝트가 삭제되었습니다' });
  } catch (err) {
    console.error('❌ 프로젝트 삭제 실패:', err);
    res.status(500).json({ error: '프로젝트 삭제 실패' });
  }
});

// 프로젝트 목록 (프로젝트 카드에 필요한 모든 정보 포함)
app.get('/api/projects', (req, res) => {
  const allProjects = projectDAO.getAllProjects();
  const list = allProjects.map(p => ({
    id: p.id,
    title: p.title,
    status: p.status,
    travelType: p.travelType,
    destination: p.destination,
    dates: p.dates,
    travelers: p.travelers,
    budget: p.budget,
    tasks: p.tasks,
    itinerary: p.itinerary,
    consultingContext: p.consultingContext, // 컨설팅 경유 식별용
    recommendations: p.recommendations, // 추천 이력
    createdAt: p.createdAt,
    updatedAt: p.updatedAt
  }));
  res.json({ projects: list });
});

// 프로젝트 활성화 (일정 생성 완료 후 draft → active)
app.post('/api/project/:projectId/activate', (req, res) => {
  try {
    const { projectId } = req.params;
    const result = projectDAO.updateProject(projectId, { status: 'active' });

    if (result.success) {
      console.log(`✅ 프로젝트 활성화: ${projectId}`);
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: result.message || '프로젝트를 찾을 수 없습니다' });
    }
  } catch (err) {
    console.error('❌ 프로젝트 활성화 오류:', err);
    res.status(500).json({ error: '활성화 실패' });
  }
});

// ─── 예산 거래 관리 API ─────────────────────────────────

// POST /api/budget/transaction - 거래 추가
app.post('/api/budget/transaction', (req, res) => {
  try {
    const db = new Database(DB_PATH);
    const transaction = transactionDAO.createTransaction(db, req.body);

    // 프로젝트의 예산 업데이트 (spent 합산)
    const spending = transactionDAO.getProjectSpending(db, req.body.projectId);
    const project = projectDAO.getProjectById(req.body.projectId);

    if (project && project.budget) {
      const budgetData = project.budget;
      spending.forEach(s => {
        if (budgetData.categories[s.category]) {
          budgetData.categories[s.category].spent = s.total_spent;
        }
      });
      budgetData.spent = spending.reduce((sum, s) => sum + s.total_spent, 0);
      projectDAO.updateProject(req.body.projectId, { budget: budgetData });
    }

    db.close();

    // Socket.io: 예산 업데이트 브로드캐스트
    io.to(`project:${req.body.projectId}`).emit('budget:updated', {
      projectId: req.body.projectId,
      category: req.body.category,
      transaction,
      updatedBy: 'system'
    });

    console.log(`💳 거래 추가: ${req.body.category} ${req.body.amount}${req.body.currency}`);
    res.json({
      transaction,
      updatedBudget: project ? project.budget : null
    });
  } catch (err) {
    console.error('❌ 거래 추가 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budget/transactions/:projectId/:category? - 거래 조회
app.get('/api/budget/transactions/:projectId/:category?', (req, res) => {
  try {
    const { projectId, category } = req.params;
    const db = new Database(DB_PATH);

    const transactions = transactionDAO.getTransactions(db, projectId, category);
    const summary = transactionDAO.getTransactionSummary(db, projectId, category);

    db.close();

    res.json({ transactions, summary });
  } catch (err) {
    console.error('❌ 거래 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/budget/transaction/:id - 거래 수정
app.patch('/api/budget/transaction/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database(DB_PATH);

    const updated = transactionDAO.updateTransaction(db, id, req.body);

    // 프로젝트 예산 재계산
    const transaction = transactionDAO.getTransaction(db, id);
    if (transaction) {
      const spending = transactionDAO.getProjectSpending(db, transaction.project_id);
      const project = projectDAO.getProjectById(transaction.project_id);

      if (project && project.budget) {
        const budgetData = project.budget;
        spending.forEach(s => {
          if (budgetData.categories[s.category]) {
            budgetData.categories[s.category].spent = s.total_spent;
          }
        });
        budgetData.spent = spending.reduce((sum, s) => sum + s.total_spent, 0);
        projectDAO.updateProject(transaction.project_id, { budget: budgetData });
      }
    }

    db.close();

    // Socket.io: 예산 업데이트 브로드캐스트
    if (transaction) {
      io.to(`project:${transaction.project_id}`).emit('budget:updated', {
        projectId: transaction.project_id,
        category: transaction.category,
        transaction: updated,
        updatedBy: 'system'
      });
    }

    console.log(`✏️ 거래 수정: ${id}`);
    res.json({ transaction: updated });
  } catch (err) {
    console.error('❌ 거래 수정 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budget/transaction/:id - 거래 삭제
app.delete('/api/budget/transaction/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database(DB_PATH);

    const transaction = transactionDAO.getTransaction(db, id);
    if (!transaction) {
      db.close();
      return res.status(404).json({ error: '거래를 찾을 수 없습니다' });
    }

    const success = transactionDAO.deleteTransaction(db, id);

    // 프로젝트 예산 재계산
    if (success) {
      const spending = transactionDAO.getProjectSpending(db, transaction.project_id);
      const project = projectDAO.getProjectById(transaction.project_id);

      if (project && project.budget) {
        const budgetData = project.budget;
        spending.forEach(s => {
          if (budgetData.categories[s.category]) {
            budgetData.categories[s.category].spent = s.total_spent;
          }
        });
        budgetData.spent = spending.reduce((sum, s) => sum + s.total_spent, 0);
        projectDAO.updateProject(transaction.project_id, { budget: budgetData });
      }
    }

    db.close();

    // Socket.io: 예산 업데이트 브로드캐스트
    if (success && transaction) {
      io.to(`project:${transaction.project_id}`).emit('budget:updated', {
        projectId: transaction.project_id,
        category: transaction.category,
        transactionId: id,
        deleted: true,
        updatedBy: 'system'
      });
    }

    console.log(`🗑️ 거래 삭제: ${id}`);
    res.json({ success: true, message: '거래가 삭제되었습니다' });
  } catch (err) {
    console.error('❌ 거래 삭제 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 환율 API ──────────────────────────────────────────

// GET /api/exchange-rate/:from/:to - 환율 조회
app.get('/api/exchange-rate/:from/:to', async (req, res) => {
  try {
    const { from, to } = req.params;
    const result = await exchangeRateService.getExchangeRate(from, to);
    console.log(`💱 환율 조회: ${from} → ${to} = ${result.rate} (${result.provider})`);
    res.json(result);
  } catch (err) {
    console.error('❌ 환율 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exchange-rate/convert - 통화 변환
app.post('/api/exchange-rate/convert', async (req, res) => {
  try {
    const { amount, from, to } = req.body;

    if (!amount || !from || !to) {
      return res.status(400).json({ error: 'amount, from, to 필드가 필요합니다' });
    }

    const convertedAmount = await exchangeRateService.convertCurrency(amount, from, to);
    const rateInfo = await exchangeRateService.getExchangeRate(from, to);

    console.log(`💱 통화 변환: ${amount} ${from} → ${convertedAmount} ${to}`);
    res.json({
      originalAmount: amount,
      originalCurrency: from,
      convertedAmount,
      targetCurrency: to,
      exchangeRate: rateInfo.rate,
      timestamp: rateInfo.timestamp,
      provider: rateInfo.provider
    });
  } catch (err) {
    console.error('❌ 통화 변환 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exchange-rate/multiple - 여러 통화 일괄 조회
app.post('/api/exchange-rate/multiple', async (req, res) => {
  try {
    const { base, targets } = req.body;

    if (!base || !Array.isArray(targets)) {
      return res.status(400).json({ error: 'base와 targets 배열이 필요합니다' });
    }

    const result = await exchangeRateService.getMultipleRates(base, targets);
    console.log(`💱 일괄 환율 조회: ${base} → [${targets.join(', ')}]`);
    res.json(result);
  } catch (err) {
    console.error('❌ 일괄 환율 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exchange-rate/cache/stats - 캐시 통계
app.get('/api/exchange-rate/cache/stats', (req, res) => {
  try {
    const stats = exchangeRateService.getCacheStats();
    res.json(stats);
  } catch (err) {
    console.error('❌ 캐시 통계 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 영수증 업로드 & OCR API ───────────────────────────

// POST /api/upload/receipt - 영수증 파일 업로드
app.post('/api/upload/receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다' });
    }

    const { projectId, transactionId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId가 필요합니다' });
    }

    const db = new Database(DB_PATH);

    const receipt = receiptDAO.createReceipt(db, {
      transactionId: transactionId || null,
      projectId,
      filename: req.file.originalname,
      filepath: req.file.path,
      filesize: req.file.size,
      mimetype: req.file.mimetype
    });

    db.close();

    console.log(`📎 영수증 업로드: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
    res.json({
      receipt,
      message: '영수증이 업로드되었습니다. OCR을 실행하려면 /api/ocr/receipt/:id를 호출하세요.'
    });
  } catch (err) {
    console.error('❌ 영수증 업로드 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ocr/receipt/:id - 영수증 OCR 금액 추출
app.post('/api/ocr/receipt/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database(DB_PATH);

    const receipt = receiptDAO.getReceipt(db, id);
    if (!receipt) {
      db.close();
      return res.status(404).json({ error: '영수증을 찾을 수 없습니다' });
    }

    // OCR 실행
    const ocrResult = await ocrService.analyzeReceipt(receipt.filepath);

    // OCR 결과를 DB에 저장
    const updatedReceipt = receiptDAO.updateOcrResult(db, id, {
      amount: ocrResult.suggestedAmount,
      date: ocrResult.date,
      rawText: ocrResult.rawText,
      status: 'completed'
    });

    db.close();

    console.log(`🔍 OCR 완료: ${receipt.filename} → 금액: ${ocrResult.suggestedAmount}원`);
    res.json({
      receipt: updatedReceipt,
      ocrResult: {
        suggestedAmount: ocrResult.suggestedAmount,
        allAmounts: ocrResult.amounts,
        date: ocrResult.date,
        confidence: ocrResult.confidence
      }
    });
  } catch (err) {
    console.error('❌ OCR 실패:', err);

    // OCR 실패 시 상태 업데이트
    const db = new Database(DB_PATH);
    receiptDAO.updateOcrResult(db, req.params.id, {
      status: 'failed',
      rawText: `OCR 실패: ${err.message}`
    });
    db.close();

    res.status(500).json({ error: err.message });
  }
});

// GET /api/receipt/:id - 영수증 조회
app.get('/api/receipt/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database(DB_PATH);

    const receipt = receiptDAO.getReceipt(db, id);
    db.close();

    if (!receipt) {
      return res.status(404).json({ error: '영수증을 찾을 수 없습니다' });
    }

    res.json(receipt);
  } catch (err) {
    console.error('❌ 영수증 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/receipts/:projectId - 프로젝트별 영수증 목록
app.get('/api/receipts/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const db = new Database(DB_PATH);

    const receipts = receiptDAO.getReceipts(db, projectId);
    db.close();

    res.json({ receipts, count: receipts.length });
  } catch (err) {
    console.error('❌ 영수증 목록 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/receipt/:id - 영수증 삭제
app.delete('/api/receipt/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database(DB_PATH);

    const receipt = receiptDAO.getReceipt(db, id);
    if (!receipt) {
      db.close();
      return res.status(404).json({ error: '영수증을 찾을 수 없습니다' });
    }

    const success = receiptDAO.deleteReceipt(db, id);
    db.close();

    if (success) {
      // 파일 시스템에서도 삭제
      const fs = require('fs');
      if (fs.existsSync(receipt.filepath)) {
        fs.unlinkSync(receipt.filepath);
        console.log(`🗑️ 영수증 파일 삭제: ${receipt.filename}`);
      }

      res.json({ success: true, message: '영수증이 삭제되었습니다' });
    } else {
      res.status(500).json({ error: '영수증 삭제에 실패했습니다' });
    }
  } catch (err) {
    console.error('❌ 영수증 삭제 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── AI 예산 추천 API ────────────────────────────────────

// POST /api/recommend/:category - 카테고리별 AI 추천 (통합 엔드포인트)
app.post('/api/recommend/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { projectId, forceRefresh = false } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId가 필요합니다' });
    }

    const db = new Database(DB_PATH);

    // 프로젝트 정보 조회
    const project = projectDAO.getProjectById(projectId);
    if (!project) {
      db.close();
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    // 캐시 키 생성
    const cacheKey = recommendationDAO.generateCacheKey(projectId, category, {
      destination: project.destination_data?.name,
      budget: project.budget
    });

    // 캐시 확인 (forceRefresh가 false인 경우)
    if (!forceRefresh) {
      const cached = recommendationDAO.getRecommendationByCache(db, cacheKey);
      if (cached) {
        db.close();
        console.log(`🎯 AI 추천 캐시 히트: ${category} (프로젝트: ${projectId})`);
        return res.json({
          ...cached,
          fromCache: true
        });
      }
    }

    // AI 추천 생성
    console.log(`🤖 AI 추천 생성 시작: ${category} (프로젝트: ${projectId})`);

    const projectData = {
      destination: project.destination_data || project.title,
      budget: project.budget,
      travelers: project.travelers || 2,
      dates: project.dates
    };

    const recommendations = await budgetRecommendationService.generateRecommendations(
      category,
      projectData
    );

    // 추천 결과 저장 (캐싱)
    const savedRecommendation = recommendationDAO.saveRecommendation(db, {
      projectId,
      category,
      recommendations: recommendations.recommendations,
      cacheKey,
      aiProvider: 'gemini',
      ttlHours: 24
    });

    db.close();

    console.log(`✅ AI 추천 생성 완료: ${category} (${recommendations.recommendations.length}개)`);
    res.json({
      ...savedRecommendation,
      ...recommendations,
      fromCache: false
    });
  } catch (err) {
    const cat = req.params.category;
    const pid = req.body?.projectId;
    console.error('❌ AI 추천 실패, fallback 사용:', err.message);

    const destName = (() => {
      try {
        const p = projectDAO.getProjectById(pid);
        return p?.destination?.name || p?.destination_data?.name || '현지';
      } catch { return '현지'; }
    })();

    const fallbackMap = {
      '숙소': [
        { name: `${destName} 중심가 호텔`, type: '호텔', priceRange: '10~25만원/박', rating: 4.2, tip: '예약 사이트 비교 후 최저가 예약 추천', bookingUrl: `https://www.booking.com/searchresults.ko.html?ss=${encodeURIComponent(destName)}` },
        { name: `${destName} 에어비앤비`, type: '에어비앤비', priceRange: '7~15만원/박', rating: 4.0, tip: '장기 숙박 시 할인 가능, 주방 이용 가능', bookingUrl: `https://www.airbnb.co.kr/s/${encodeURIComponent(destName)}/homes` },
        { name: `${destName} 게스트하우스/호스텔`, type: '게스트하우스', priceRange: '3~8만원/박', rating: 3.8, tip: '배낭여행 스타일, 현지인 교류 가능', bookingUrl: `https://www.agoda.com/ko-kr/search?city=${encodeURIComponent(destName)}` }
      ],
      '식비': [
        { name: `${destName} 현지 맛집`, type: '현지식', priceRange: '1~3만원/끼', rating: 4.5, tip: '구글맵 리뷰 4.0 이상 맛집 검색' },
        { name: `${destName} 길거리 음식`, type: '스트릿푸드', priceRange: '3천~1만원', rating: 4.3, tip: '현지인이 줄 서는 곳이 맛집' },
        { name: '편의점/마트 활용', type: '절약형', priceRange: '5천~1만원/끼', rating: 3.5, tip: '간단한 아침/간식으로 식비 절약' }
      ],
      '활동': [
        { name: `${destName} 대표 관광지`, type: '관광', priceRange: '무료~3만원', rating: 4.5, tip: '오전 일찍 방문하면 대기 시간 단축' },
        { name: '현지 투어 프로그램', type: '투어', priceRange: '5~15만원', rating: 4.2, tip: 'Klook/GetYourGuide에서 할인 예약' },
        { name: '문화 체험 프로그램', type: '체험', priceRange: '3~10만원', rating: 4.0, tip: '현지 문화를 깊이 체험할 수 있는 프로그램' }
      ],
      '교통': [
        { name: '공항 ↔ 시내 교통', type: '공항셔틀', priceRange: '1~5만원', rating: 4.0, tip: '공항 리무진/철도 미리 예약 시 할인' },
        { name: '현지 교통카드/패스', type: '교통패스', priceRange: '2~5만원', rating: 4.3, tip: '일일/주간 패스 구매 시 개별 요금보다 저렴' },
        { name: '택시/그랩/우버', type: '택시', priceRange: '1~3만원/회', rating: 3.8, tip: '앱 호출이 바가지 방지에 효과적' }
      ]
    };

    const fallback = fallbackMap[cat] || fallbackMap['활동'];
    res.json({
      category: cat,
      recommendations: fallback,
      fromCache: false,
      isFallback: true,
      generatedAt: new Date().toISOString()
    });
  }
});

// GET /api/recommendations/:projectId - 프로젝트별 모든 추천 조회
app.get('/api/recommendations/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;
    const { category } = req.query;

    const db = new Database(DB_PATH);

    const recommendations = recommendationDAO.getRecommendationsByProject(
      db,
      projectId,
      category
    );

    db.close();

    res.json({
      projectId,
      category: category || 'all',
      recommendations,
      count: recommendations.length
    });
  } catch (err) {
    console.error('❌ 추천 목록 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/recommendation/:id - 추천 삭제
app.delete('/api/recommendation/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = new Database(DB_PATH);

    const success = recommendationDAO.deleteRecommendation(db, id);
    db.close();

    if (success) {
      console.log(`🗑️ 추천 삭제: ${id}`);
      res.json({ success: true, message: '추천이 삭제되었습니다' });
    } else {
      res.status(404).json({ error: '추천을 찾을 수 없습니다' });
    }
  } catch (err) {
    console.error('❌ 추천 삭제 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/cleanup - 만료된 추천 캐시 정리
app.post('/api/recommendations/cleanup', (req, res) => {
  try {
    const db = new Database(DB_PATH);

    const deletedCount = recommendationDAO.deleteExpiredRecommendations(db);
    db.close();

    console.log(`🧹 만료된 추천 캐시 정리: ${deletedCount}개 삭제`);
    res.json({
      success: true,
      deletedCount,
      message: `${deletedCount}개의 만료된 추천이 삭제되었습니다`
    });
  } catch (err) {
    console.error('❌ 캐시 정리 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 예산 알림 API ───────────────────────────────────────
// GET /api/budget/alerts/:projectId - 프로젝트 예산 알림 조회
app.get('/api/budget/alerts/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;

    // 프로젝트 조회
    const project = projectDAO.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    // 알림 생성
    const alertsData = budgetAlertService.generateBudgetAlerts(project);

    console.log(`📊 예산 알림 조회: ${project.title} (알림 ${alertsData.alerts.length}개)`);
    res.json(alertsData);
  } catch (err) {
    console.error('❌ 예산 알림 조회 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budget/health/:projectId - 프로젝트 예산 건강도 평가
app.get('/api/budget/health/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;

    // 프로젝트 조회
    const project = projectDAO.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    // 건강도 평가
    const health = budgetAlertService.evaluateBudgetHealth(project);
    const alertsData = budgetAlertService.generateBudgetAlerts(project);

    console.log(`💚 예산 건강도 평가: ${project.title} (${health})`);
    res.json({
      projectId: project.id,
      projectTitle: project.title,
      health,
      summary: alertsData.summary,
      hasAlerts: alertsData.hasAlerts,
      hasCriticalAlerts: alertsData.hasCriticalAlerts,
      evaluatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ 예산 건강도 평가 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/budget/recommendations/:projectId - 예산 관리 추천사항
app.get('/api/budget/recommendations/:projectId', (req, res) => {
  try {
    const { projectId } = req.params;

    // 프로젝트 조회
    const project = projectDAO.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다' });
    }

    // 알림 생성 및 추천사항 생성
    const alertsData = budgetAlertService.generateBudgetAlerts(project);
    const recommendations = budgetAlertService.generateRecommendations(alertsData);

    console.log(`💡 예산 추천사항 생성: ${project.title} (${recommendations.length}개)`);
    res.json({
      projectId: project.id,
      projectTitle: project.title,
      recommendations,
      alerts: alertsData.alerts,
      summary: alertsData.summary,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ 예산 추천사항 생성 실패:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 서버 시작 (Socket.io) ────────────────────────────
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });

// 접속 유저 관리
const connectedUsers = new Map(); // socketId → { projectId, nickname }

io.on('connection', (socket) => {
  console.log(`👤 유저 접속: ${socket.id}`);

  // 프로젝트 방 참여
  socket.on('project:join', ({ projectId, nickname }) => {
    socket.join(`project:${projectId}`);
    connectedUsers.set(socket.id, { projectId, nickname: nickname || '동행자' });

    // 현재 방의 유저 목록 브로드캐스트
    const roomUsers = [];
    connectedUsers.forEach((user, sid) => {
      if (user.projectId === projectId) roomUsers.push({ id: sid, nickname: user.nickname });
    });
    io.to(`project:${projectId}`).emit('project:users', roomUsers);
    console.log(`   → [${projectId}] ${nickname || '동행자'} 참여 (${roomUsers.length}명)`);
  });

  // 할일 상태 변경 동기화
  socket.on('task:update', ({ projectId, taskId, status, updatedBy }) => {
    socket.to(`project:${projectId}`).emit('task:updated', { taskId, status, updatedBy });
  });

  // 예산 변경 동기화
  socket.on('budget:update', ({ projectId, category, spent, updatedBy }) => {
    socket.to(`project:${projectId}`).emit('budget:updated', { category, spent, updatedBy });
  });

  // 일정 변경 동기화
  socket.on('itinerary:update', ({ projectId, itinerary, updatedBy }) => {
    socket.to(`project:${projectId}`).emit('itinerary:updated', { itinerary, updatedBy });
  });

  // 채팅 메시지 (동행자 간 대화)
  socket.on('collab:message', ({ projectId, message, nickname }) => {
    io.to(`project:${projectId}`).emit('collab:message', { message, nickname, timestamp: new Date().toISOString() });
  });

  // 프로젝트 방 퇴장
  socket.on('project:leave', ({ projectId }) => {
    socket.leave(`project:${projectId}`);
    const user = connectedUsers.get(socket.id);
    if (user) {
      console.log(`   ← [${projectId}] ${user.nickname || '동행자'} 퇴장`);
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      connectedUsers.delete(socket.id);
      const roomUsers = [];
      connectedUsers.forEach((u, sid) => {
        if (u.projectId === user.projectId) roomUsers.push({ id: sid, nickname: u.nickname });
      });
      io.to(`project:${user.projectId}`).emit('project:users', roomUsers);
      console.log(`👋 유저 퇴장: ${user.nickname}`);
    }
  });
});

// 로컬 IP 주소 가져오기
const os = require('os');
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  const aiModeLabels = {
    'groq': '⚡ Groq AI',
    'gemini': '🤖 Gemini AI',
    'together': '🌐 Together AI',
    'mock': '📋 Demo Mode'
  };

  console.log(`\n🧳 Travel PMS v2 서버 실행 중!`);
  console.log(`   로컬: http://localhost:${PORT}`);
  console.log(`   모바일: http://${localIP}:${PORT}`);
  console.log(`   AI 모드: ${aiModeLabels[aiMode] || aiMode}`);
  console.log(`   실시간 동기화: ✅ Socket.io`);
  console.log(`   헬스체크: http://localhost:${PORT}/health`);
  console.log(`\n📱 핸드폰에서 접속하려면:`);
  console.log(`   1. 핸드폰과 PC를 같은 Wi-Fi에 연결`);
  console.log(`   2. 핸드폰 브라우저에서 http://${localIP}:${PORT} 접속\n`);
});
