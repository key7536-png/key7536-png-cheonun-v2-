// 천운 상담도구 — 상담/왜요? 답변용 Gemini 프록시.
// 키는 절대 이 파일에 직접 적지 않는다 — Vercel 프로젝트 환경변수에
// GEMINI_KEY_1 ~ GEMINI_KEY_10, (선택) GEMINI_PAID_KEY 이름으로 등록해서 process.env로 읽는다.
// 무료 키 한도(429)나 일시 장애(503)를 만나면 다음 키로 자동 전환하고,
// 10개 다 실패하면 마지막으로 유료 키(있으면)를 시도한다.

const MODEL = 'gemini-2.5-flash';
const MAX_KEYS = 10;

function loadKeys() {
  const keys = [];
  for (let i = 1; i <= MAX_KEYS; i++) {
    const k = process.env['GEMINI_KEY_' + i];
    if (k) keys.push(k);
  }
  return keys;
}

let keyIdx = 0;

async function callGemini(key, prompt, maxTokens) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens || 8192, temperature: 0.85 }
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
        error: '서버에 Gemini API 키가 설정되어 있지 않습니다. Vercel 프로젝트 → Settings → Environment Variables에 GEMINI_KEY_1 ~ GEMINI_KEY_10을 등록한 뒤 Redeploy 해주세요.'
      });
    }

    const start = keyIdx % (KEYS.length || 1);
    for (let i = 0; i < KEYS.length; i++) {
      const idx = (start + i) % KEYS.length;
      try {
        const text = await callGemini(KEYS[idx], prompt, maxTokens);
        keyIdx = idx + 1;
        return res.status(200).json({ text, source: 'free' });
      } catch (e) {
        if (e.code === 429 || e.code === 503 || e.code === 403) continue;
        throw e;
      }
    }

    if (PAID) {
      const text = await callGemini(PAID, prompt, maxTokens);
      return res.status(200).json({ text, source: 'paid' });
    }

    return res.status(500).json({ error: '무료 키 10개가 모두 한도 초과이거나 오류입니다. 잠시 후 다시 시도해주세요.' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
