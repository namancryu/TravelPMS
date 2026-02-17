/**
 * Multi AI Provider Abstraction Layer
 * Gemini, Grok(xAI), Groq, Together.ai 통합
 */

require('dotenv').config();

// AI Provider 설정 (우선순위: Gemini > Grok > Groq > Together)
const AI_PROVIDERS = [
  {
    name: 'gemini',
    model: 'gemini-2.0-flash',
    priority: 1,
    enabled: () => !!process.env.GEMINI_API_KEY
  },
  {
    name: 'grok',
    model: 'grok-3-mini',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    priority: 2,
    enabled: () => !!process.env.XAI_API_KEY
  },
  {
    name: 'groq',
    model: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    priority: 3,
    enabled: () => !!process.env.GROQ_API_KEY
  },
  {
    name: 'together',
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    priority: 4,
    enabled: () => !!process.env.TOGETHER_API_KEY
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
 * Grok (xAI) API 호출 (OpenAI 호환 형식)
 */
async function callGrok(prompt) {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [
        { role: 'system', content: '당신은 여행 전문가입니다. 반드시 100% 순수 한글로만 답변하세요. 중국어(漢字), 일본어, 영어는 절대 사용하지 마세요. 친근하게 답변하세요.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Groq API 호출 (OpenAI 호환 형식)
 */
async function callGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: '당신은 여행 전문가입니다. 반드시 100% 순수 한글로만 답변하세요. 중국어(漢字), 일본어, 영어는 절대 사용하지 마세요. 친근하게 답변하세요.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Together.ai API 호출 (OpenAI 호환 형식)
 */
async function callTogether(prompt) {
  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      messages: [
        { role: 'system', content: '당신은 여행 전문가입니다. 반드시 100% 순수 한글로만 답변하세요. 중국어(漢字), 일본어, 영어는 절대 사용하지 마세요. 친근하게 답변하세요.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Together API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 통합 AI 호출 함수 (우선순위 기반 폴백)
 * Gemini → Grok → Groq → Together → Mock
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
      switch (provider.name) {
        case 'gemini':
          response = await callGemini(prompt);
          break;
        case 'grok':
          response = await callGrok(prompt);
          break;
        case 'groq':
          response = await callGroq(prompt);
          break;
        case 'together':
          response = await callTogether(prompt);
          break;
        default:
          continue;
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
