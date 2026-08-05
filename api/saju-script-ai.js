// 사주 유튜브 대본 생성기 전용 Gemini 프록시.
// 키는 절대 이 파일에 직접 적지 않는다 — Vercel 프로젝트 환경변수에
// SAJU_SCRIPT_KEY_1 ~ SAJU_SCRIPT_KEY_5 이름으로 등록해서 process.env로 읽는다.
// 무료 키 한도(429)나 일시 장애(503), 키 거부(403)를 만나면 다음 키로 자동 전환한다.

const MODEL = 'gemini-2.5-flash';

function loadKeys() {
  const keys = [];
  for (let i = 1; i <= 5; i++) {
    const k = process.env['SAJU_SCRIPT_KEY_' + i];
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
    if (KEYS.length === 0) {
      return res.status(500).json({
        error: 'Gemini 키가 설정되지 않았습니다. Vercel 프로젝트 설정 → Environment Variables 에서 SAJU_SCRIPT_KEY_1 ~ SAJU_SCRIPT_KEY_5 를 등록하고 Redeploy 해주세요.'
      });
    }

    const start = keyIdx % KEYS.length;
    let lastErr = null;
    for (let i = 0; i < KEYS.length; i++) {
      const idx = (start + i) % KEYS.length;
      try {
        const text = await callGemini(KEYS[idx], prompt, maxTokens);
        keyIdx = idx + 1;
        return res.status(200).json({ text });
      } catch (e) {
        lastErr = e;
        // 한도 초과(429)·일시 장애(503)·키 거부(403, "denied access" 등) → 다음 키로 넘어가본다.
        // 그 외 오류(잘못된 요청 등)는 키를 바꿔도 소용없으므로 바로 실패 처리한다.
        if (e.code === 429 || e.code === 503 || e.code === 403) continue;
        throw e;
      }
    }

    // 모든 키가 다 안 되는 경우 — 마지막 오류를 그대로 보여준다.
    return res.status(lastErr?.code === 403 ? 403 : 429).json({
      error: '등록된 키 ' + KEYS.length + '개를 모두 시도했지만 전부 실패했습니다. 마지막 오류: ' + (lastErr?.message || '알 수 없는 오류') +
        ' — Vercel에 등록한 SAJU_SCRIPT_KEY 값들이 유효한지, Google AI Studio에서 새로 발급받은 키인지 확인해주세요.'
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
