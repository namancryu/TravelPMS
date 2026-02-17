/**
 * Multi AI Provider Abstraction Layer
 * Gemini, Groq, Mistral, OpenRouter 통합
 * 폴백 순서: Gemini → Groq → Mistral → OpenRouter → Mock
 */

require('dotenv').config();

const SYSTEM_PROMPT = '당신은 여행 전문가입니다. 반드시 100% 순수 한글로만 답변하세요. 중국어(漢字), 일본어, 영어는 절대 사용하지 마세요. 친근하게 답변하세요.';

// AI Provider 설정 (우선순위: Gemini > Groq > Mistral > OpenRouter)
const AI_PROVIDERS = [
  {
    name: 'gemini',
    model: 'gemini-2.0-flash',
    priority: 1,
    enabled: () => !!process.env.GEMINI_API_KEY
  },
  {
    name: 'groq',
    model: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    priority: 2,
    enabled: () => !!process.env.GROQ_API_KEY
  },
  {
    name: 'mistral',
    model: 'mistral-small-latest',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    priority: 3,
    enabled: () => !!process.env.MISTRAL_API_KEY
  },
  {
    name: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    priority: 4,
    enabled: () => !!process.env.OPENROUTER_API_KEY
  }
];

// Gemini 초기화 (lazy loading)
let geminiModel = null;

function getGeminiModel() {
  if (!geminiModel && process.env.GEMINI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      console.log('✅ Gemini model initialized (gemini-2.0-flash)');
    } catch (err) {
      console.error('❌ Gemini initialization failed:', err.message);
    }
  }
  return geminiModel;
}

/**
 * Gemini API 호출 (분당 쿼터 초과 시 자동 재시도)
 */
async function callGemini(prompt, retries = 2) {
  const model = getGeminiModel();
  if (!model) {
    throw new Error('Gemini model not initialized');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (err) {
      const is429 = err.message && (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED'));
      if (is429 && attempt < retries) {
        const waitSec = 10 * (attempt + 1);
        console.log(`⏳ Gemini 분당 쿼터 초과, ${waitSec}초 후 재시도 (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * OpenAI 호환 API 호출 (Groq, Mistral, OpenRouter 공통)
 */
async function callOpenAICompatible(provider, prompt) {
  const config = AI_PROVIDERS.find(p => p.name === provider);
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const apiKeyMap = {
    'groq': process.env.GROQ_API_KEY,
    'mistral': process.env.MISTRAL_API_KEY,
    'openrouter': process.env.OPENROUTER_API_KEY
  };

  const headers = {
    'Authorization': `Bearer ${apiKeyMap[provider]}`,
    'Content-Type': 'application/json'
  };

  // OpenRouter는 추가 헤더 필요
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://travel-pms.onrender.com';
    headers['X-Title'] = 'TravelPMS';
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${provider} API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 통합 AI 호출 함수 (우선순위 기반 폴백)
 * Gemini → Groq → Mistral → OpenRouter → Mock
 */
async function generateAIResponse(prompt) {
  const enabledProviders = AI_PROVIDERS
    .filter(p => p.enabled())
    .sort((a, b) => a.priority - b.priority);

  if (enabledProviders.length === 0) {
    console.warn('⚠️ No AI providers enabled, use Mock mode');
    return { response: null, provider: 'mock' };
  }

  for (const provider of enabledProviders) {
    try {
      console.log(`🤖 Trying ${provider.name} (${provider.model})...`);

      let response;
      if (provider.name === 'gemini') {
        response = await callGemini(prompt);
      } else {
        response = await callOpenAICompatible(provider.name, prompt);
      }

      console.log(`✅ ${provider.name} response received`);
      return { response, provider: provider.name };

    } catch (err) {
      console.warn(`⚠️ ${provider.name} failed: ${err.message}`);

      const isQuotaError = err.message && (
        err.message.includes('quota') ||
        err.message.includes('429') ||
        err.message.includes('Too Many Requests') ||
        err.message.includes('rate limit')
      );

      if (isQuotaError) {
        console.error(`❌ ${provider.name} quota exceeded, trying next provider...`);
      }

      continue;
    }
  }

  console.error('❌ All AI providers failed, fallback to Mock mode');
  return { response: null, provider: 'mock' };
}

/**
 * 현재 활성화된 Provider 정보
 */
function getProviderStatus() {
  return AI_PROVIDERS.map(p => ({
    name: p.name,
    model: p.model,
    enabled: p.enabled(),
    priority: p.priority
  }));
}

/**
 * 현재 사용 가능한 Provider 이름
 */
function getActiveProvider() {
  const enabled = AI_PROVIDERS.filter(p => p.enabled());
  if (enabled.length === 0) return 'mock';
  return enabled.sort((a, b) => a.priority - b.priority)[0].name;
}

module.exports = {
  generateAIResponse,
  getProviderStatus,
  getActiveProvider,
  AI_PROVIDERS
};
