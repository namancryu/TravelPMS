/**
 * OCR Service
 * Tesseract.js를 사용한 영수증 텍스트 인식 및 금액 추출
 */

const Tesseract = require('tesseract.js');

/**
 * 영수증 이미지에서 텍스트 추출
 * @param {string} imagePath - 이미지 파일 경로
 * @returns {Promise<Object>} - { text, confidence }
 */
async function extractText(imagePath) {
  try {
    console.log(`📸 OCR 시작: ${imagePath}`);

    const result = await Tesseract.recognize(
      imagePath,
      'eng+kor', // 영어 + 한국어 인식
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`📊 OCR 진행률: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );

    console.log(`✅ OCR 완료: ${result.data.text.length}자 추출`);

    return {
      text: result.data.text,
      confidence: result.data.confidence
    };
  } catch (err) {
    console.error('❌ OCR 실패:', err);
    throw new Error(`OCR failed: ${err.message}`);
  }
}

/**
 * 텍스트에서 금액 추출 (정규식 패턴)
 * @param {string} text - OCR 추출 텍스트
 * @returns {Array<number>} - 추출된 금액 배열
 */
function extractAmounts(text) {
  const amounts = [];

  // 패턴 1: 1,000원, 10,000원 등
  const pattern1 = /(\d{1,3}(?:,\d{3})+)\s*원/g;
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    const amount = parseInt(match[1].replace(/,/g, ''));
    amounts.push(amount);
  }

  // 패턴 2: \1000, \10000 등
  const pattern2 = /[\\￦]\s*(\d{1,3}(?:,\d{3})+|\d+)/g;
  while ((match = pattern2.exec(text)) !== null) {
    const amount = parseInt(match[1].replace(/,/g, ''));
    amounts.push(amount);
  }

  // 패턴 3: 숫자만 (1000, 10000 등, 4자리 이상)
  const pattern3 = /\b(\d{4,})\b/g;
  while ((match = pattern3.exec(text)) !== null) {
    const amount = parseInt(match[1]);
    // 너무 큰 숫자는 제외 (예: 날짜, 전화번호)
    if (amount < 10000000) {
      amounts.push(amount);
    }
  }

  // 중복 제거 및 정렬 (내림차순)
  const uniqueAmounts = [...new Set(amounts)].sort((a, b) => b - a);

  console.log(`💰 추출된 금액: ${uniqueAmounts.join(', ')}`);

  return uniqueAmounts;
}

/**
 * 텍스트에서 날짜 추출
 * @param {string} text - OCR 추출 텍스트
 * @returns {string|null} - 추출된 날짜 (YYYY-MM-DD 형식) 또는 null
 */
function extractDate(text) {
  // 패턴 1: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD
  const pattern1 = /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/;
  let match = pattern1.exec(text);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 패턴 2: MM-DD-YYYY, MM/DD/YYYY
  const pattern2 = /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/;
  match = pattern2.exec(text);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // 패턴 3: YYYYMMDD (8자리 숫자)
  const pattern3 = /\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/;
  match = pattern3.exec(text);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return null;
}

/**
 * 영수증 이미지 분석 (텍스트, 금액, 날짜 통합)
 * @param {string} imagePath - 이미지 파일 경로
 * @returns {Promise<Object>} - { text, amounts, date, suggestedAmount }
 */
async function analyzeReceipt(imagePath) {
  try {
    const { text, confidence } = await extractText(imagePath);
    const amounts = extractAmounts(text);
    const date = extractDate(text);

    // 가장 큰 금액을 추천 금액으로 선택 (일반적으로 총액)
    const suggestedAmount = amounts.length > 0 ? amounts[0] : null;

    console.log(`📋 영수증 분석 완료:`);
    console.log(`   - 텍스트 길이: ${text.length}자`);
    console.log(`   - 신뢰도: ${confidence.toFixed(2)}%`);
    console.log(`   - 추출 금액: ${amounts.length}개`);
    console.log(`   - 추천 금액: ${suggestedAmount}원`);
    console.log(`   - 날짜: ${date || '없음'}`);

    return {
      rawText: text,
      confidence,
      amounts,
      suggestedAmount,
      date
    };
  } catch (err) {
    console.error('❌ 영수증 분석 실패:', err);
    throw err;
  }
}

module.exports = {
  extractText,
  extractAmounts,
  extractDate,
  analyzeReceipt
};
