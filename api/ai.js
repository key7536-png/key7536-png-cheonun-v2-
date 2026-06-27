// /api/ai.js — 천운 상담도구 Vercel Serverless Function

const MODEL = 'gemini-2.5-flash';

function getKeys() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_KEY_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }
  const paid = process.env.GEMINI_PAID_KEY;
  return { keys, paid: paid || '' };
}

async function callGemini(key, prompt, maxTokens) {
  const isAuth = key.startsWith('AQ.');
  const url = isAuth
    ? `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
    : `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  const headers = { 'Content-Type': 'application/json' };
  if (isAuth) headers['x-goog-api-key'] = key;

  const res = await fetch(url, {
    method: 'POST',
    headers,
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

    const { keys, paid } = getKeys();

    if (keys.length === 0 && !paid) {
      return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
    }

    // 무료 키 순환
    for (const key of keys) {
      try {
        const text = await callGemini(key, prompt, maxTokens);
        return res.status(200).json({ text, source: 'free' });
      } catch (e) {
        if (e.code === 429 || e.code === 503) continue;
        throw e;
      }
    }

    // 유료 키 폴백
    if (paid) {
      const text = await callGemini(paid, prompt, maxTokens);
      return res.status(200).json({ text, source: 'paid' });
    }

    return res.status(429).json({ error: '모든 키 한도 초과. 자정 후 재시도하세요.' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
