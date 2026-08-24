// 천운 상담도구 — 상담/왜요? 답변용 Gemini 프록시.
// 키는 절대 이 파일에 직접 적지 않는다 — Vercel 프로젝트 환경변수에
// GEMINI_KEY_1 ~ GEMINI_KEY_30, (선택) GEMINI_PAID_KEY 이름으로 등록해서 process.env로 읽는다.
// 무료 키 한도(429)나 일시 장애(503)를 만나면 다음 키로 자동 전환하고,
// 등록된 일반 키가 모두 실패하면 마지막으로 예비 키(있으면)를 시도한다.

const MODEL = 'gemini-3.6-flash';
const MAX_KEYS = 30;

function loadKeys() {
  const keys = [];
  for (let i = 1; i <= MAX_KEYS; i++) {
    const k = process.env['GEMINI_KEY_' + i];
    if (k && k.trim()) keys.push(k.trim());
  }
  return [...new Set(keys)];
}

let keyIdx = 0;

// 이 앱의 generateContent 엔드포인트와 현재 발급 키 조합에서 검증된 query key 방식을 사용한다.
// 키는 브라우저가 아닌 Vercel 서버 함수에서만 붙으므로 클라이언트 화면에는 노출되지 않는다.
// 2026-08: Gemini 2.5는 답변 전 "생각(thinking)" 단계에서 토큰을 소모하는데,
// 이게 답변엔 안 보이면서 무료 할당량만 훨씬 빨리 갉아먹는다(체감상 몇 배).
// thinkingBudget:0으로 꺼서 응답 속도도 빠르게, 할당량 소모도 줄인다.
async function callGemini(key, prompt, maxTokens) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent?key=' + encodeURIComponent(key.trim());
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens || 8192,
        temperature: 0.85,
        thinkingConfig: { thinkingLevel: 'minimal' }
      }
    })
  });
  const data = await res.json();
  if (data.error) {
    const err = new Error(data.error.message);
    err.code = data.error.code;
    throw err;
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, maxTokens } = req.body;
    if (!prompt) return res.status(400).json({ error: '프롬프트가 없습니다.' });

    const KEYS = loadKeys();
    const PAID = process.env.GEMINI_PAID_KEY;

    if (KEYS.length === 0 && !PAID) {
      return res.status(500).json({
        error: '서버에 Gemini API 키가 설정되어 있지 않습니다. Vercel 프로젝트 → Settings → Environment Variables에 GEMINI_KEY_1 ~ GEMINI_KEY_30을 등록한 뒤 Redeploy 해주세요.'
      });
    }

    const start = keyIdx % (KEYS.length || 1);
    let lastErr = null;
    let authFailures = 0;
    let quotaFailures = 0;
    for (let i = 0; i < KEYS.length; i++) {
      const idx = (start + i) % KEYS.length;
      try {
        const text = await callGemini(KEYS[idx], prompt, maxTokens);
        // 성공한 키를 계속 사용하고, 실제 한도/장애가 발생할 때만 다음 키로 이동한다.
        keyIdx = idx;
        return res.status(200).json({ text, source: 'free' });
      } catch (e) {
        lastErr = e;
        const authError = e.code === 401 ||
          ((e.code === 400 || e.code === 403) && /api key not valid|invalid authentication|access token|credential/i.test(e.message || ''));
        if (authError) { authFailures++; keyIdx = idx + 1; continue; }
        if (e.code === 429 || e.code === 503 || e.code === 403) { quotaFailures++; keyIdx = idx + 1; continue; }
        throw e;
      }
    }

    if (PAID) {
      try {
        const text = await callGemini(PAID, prompt, maxTokens);
        return res.status(200).json({ text, source: 'paid' });
      } catch (e) {
        return res.status(500).json({ error: '등록된 일반 키를 사용할 수 없고 예비 키도 실패했습니다(' + e.message + '). Vercel의 Gemini 키 설정을 확인해 주세요.' });
      }
    }

    if (authFailures === KEYS.length) {
      return res.status(401).json({ error: '등록된 Gemini 키가 모두 인증에 실패했습니다. Vercel 환경변수에는 OAuth 토큰이 아니라 Google AI Studio에서 발급한 Gemini API 키를 넣어주세요.' });
    }
    if (quotaFailures > 0) {
      return res.status(429).json({ error: '사용 가능한 Gemini 키가 현재 할당량 초과 또는 일시 장애 상태입니다. 잠시 후 다시 시도해 주세요.' });
    }
    return res.status(500).json({ error: 'Gemini 요청에 실패했습니다: ' + (lastErr?.message || '알 수 없는 오류') });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
