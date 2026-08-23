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

// 2026년 6월부터 구글이 신규 발급하는 "AQ." 형식 키가, 일부 계정에서
// x-goog-api-key 헤더 방식으로는 "ACCESS_TOKEN_TYPE_UNSUPPORTED"(401)로
// 거부되는 문제가 보고됨. 쿼리스트링(?key=) 방식으로 보내면 통과되는
// 경우가 많다고 확인되어 이 방식으로 전환.
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
        thinkingConfig: { thinkingBudget: 0 }
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
      try {
        const text = await callGemini(PAID, prompt, maxTokens);
        return res.status(200).json({ text, source: 'paid' });
      } catch (e) {
        // 유료키도 실패 — 원인이 뭐든 사용자에게는 명확한 메시지로.
        return res.status(500).json({ error: '무료 키가 전부 한도 초과이고, 예비 유료 키도 실패했습니다(' + e.message + '). 잠시 후 다시 시도하거나 GEMINI_PAID_KEY를 확인해주세요.' });
      }
    }

    return res.status(500).json({ error: '지금 등록된 무료 키가 전부 한도 초과 상태예요. 몇 분 후 다시 시도해주세요 (매일/매분 한도가 있어서 시간 지나면 다시 됩니다).' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
