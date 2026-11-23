// 천운 상담도구 — 상담/왜요? 답변용 Gemini 프록시.
// 키는 절대 이 파일에 직접 적지 않는다 — Vercel 프로젝트 환경변수에
// GEMINI_KEY_1 ~ GEMINI_KEY_30, (선택) GEMINI_PAID_KEY 이름으로 등록해서 process.env로 읽는다.
// 무료 키 한도(429)나 일시 장애(503)를 만나면 다음 키로 자동 전환하고,
// 등록된 일반 키가 모두 실패하면 마지막으로 예비 키(있으면)를 시도한다.
//
// 2026-11: 급할 때 무료 키 대기 없이 바로 유료 키로 보낼 수 있게 preferPaid를 받는다.
//     preferPaid === true → 무료 키를 한 번도 돌지 않고 GEMINI_PAID_KEY로 직행.
//     429/503으로 막힌 무료 키는 60초 쿨다운에 넣어, 몰릴 때 매 요청마다 막힌 키를
//     다시 찔러 느려지는 현상을 막는다(모든 키가 쿨다운일 때만 재시도/유료 폴백).

const MODEL = 'gemini-3.6-flash';
const MAX_KEYS = 30;
const COOLDOWN_MS = 60 * 1000;

function loadKeys() {
  const keys = [];
  for (let i = 1; i <= MAX_KEYS; i++) {
    const k = process.env['GEMINI_KEY_' + i];
    if (k && k.trim()) keys.push(k.trim());
  }
  return [...new Set(keys)];
}

let keyIdx = 0;

// 한도 초과(429)·일시 장애(503)로 막힌 키는 60초 동안 건너뛴다.
// (서버 함수 인스턴스가 살아 있는 동안 메모리에 남는다 — 인스턴스가 새로 뜨면 비어 있는 상태로 시작)
const cooldownUntil = new Map();

function isCooling(key, now) {
  const until = cooldownUntil.get(key);
  if (!until) return false;
  if (until <= now) { cooldownUntil.delete(key); return false; }
  return true;
}

function markCooldown(key) {
  cooldownUntil.set(key, Date.now() + COOLDOWN_MS);
}

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
  // Gemini는 답변을 여러 조각(parts)으로 나눠 보낼 때가 있다.
  // 첫 조각만 쓰면 답변이 중간에 끊기므로, 생각(thought) 조각을 뺀 모든 글 조각을 이어 붙인다.
  const cand = data.candidates?.[0];
  const parts = cand?.content?.parts || [];
  const text = parts.filter(p => p && p.text && !p.thought).map(p => p.text).join('');
  if (!text.trim()) {
    // 안전필터 차단·일시 오류 등으로 빈 답이 오면 다음 키로 다시 시도하도록 일시 장애(503)로 취급
    const err = new Error('AI가 빈 답변을 보냈습니다' + (cand?.finishReason ? ' (' + cand.finishReason + ')' : '') + '. 다시 시도해 주세요.');
    err.code = 503;
    throw err;
  }
  return text;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { prompt, maxTokens } = body;
    const preferPaid = body.preferPaid === true || body.preferPaid === 'true';
    if (!prompt) return res.status(400).json({ error: '프롬프트가 없습니다.' });

    const KEYS = loadKeys();
    const PAID = (process.env.GEMINI_PAID_KEY || '').trim();

    // ── 급할 때: 무료 키를 한 번도 돌지 않고 유료 키로 바로 간다 ──
    if (preferPaid) {
      if (!PAID) {
        return res.status(500).json({
          error: 'Vercel 환경변수에 GEMINI_PAID_KEY가 등록되어 있지 않습니다. Vercel 프로젝트 → Settings → Environment Variables에 유료 키를 등록한 뒤 Redeploy 해주세요.'
        });
      }
      try {
        const text = await callGemini(PAID, prompt, maxTokens);
        return res.status(200).json({ text, source: 'paid' });
      } catch (e) {
        return res.status(500).json({
          error: '유료 키(GEMINI_PAID_KEY) 호출에 실패했습니다(' + (e.message || '알 수 없는 오류') + '). Vercel의 유료 키와 Google AI Studio 할당량을 확인해 주세요.'
        });
      }
    }

    if (KEYS.length === 0 && !PAID) {
      return res.status(500).json({
        error: '서버에 Gemini API 키가 설정되어 있지 않습니다. Vercel 프로젝트 → Settings → Environment Variables에 GEMINI_KEY_1 ~ GEMINI_KEY_30을 등록한 뒤 Redeploy 해주세요.'
      });
    }

    // 쿨다운 중인 키는 이번 요청에서 건너뛴다. 전부 쿨다운이면 마지막 수단으로 다시 돌린다.
    const now = Date.now();
    const start = KEYS.length ? keyIdx % KEYS.length : 0;
    let order = [];
    for (let i = 0; i < KEYS.length; i++) {
      const idx = (start + i) % KEYS.length;
      if (!isCooling(KEYS[idx], now)) order.push(idx);
    }
    if (KEYS.length > 0 && order.length === 0) {
      // 모든 무료 키가 60초 쿨다운 중 — 유료 키가 있으면 기다리지 말고 바로 유료로 보낸다.
      if (PAID) {
        try {
          const text = await callGemini(PAID, prompt, maxTokens);
          return res.status(200).json({ text, source: 'paid' });
        } catch (e) { /* 유료도 실패하면 아래에서 쿨다운 무료 키를 다시 시도한다 */ }
      }
      order = KEYS.map((_, i) => (start + i) % KEYS.length);
    }

    let lastErr = null;
    let authFailures = 0;
    let quotaFailures = 0;
    for (const idx of order) {
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
        if (e.code === 429 || e.code === 503 || e.code === 403) {
          quotaFailures++;
          markCooldown(KEYS[idx]); // 막힌 키는 60초 쉬게 한다
          keyIdx = idx + 1;
          continue;
        }
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

    if (authFailures === order.length) {
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
