// /api/ai.js — 천운 상담도구 Vercel Serverless Function
// Gemini API 키를 서버사이드에서 안전하게 관리

export const config = { runtime: 'edge' };

const MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;

// 환경변수에서 키 로드 (GEMINI_KEY_1 ~ GEMINI_KEY_10)
function getKeys() {
  const keys = [];
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_KEY_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }
  // 유료 키
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

export default async function handler(req) {
  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const { prompt, maxTokens } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: '프롬프트가 없습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { keys, paid } = getKeys();
    
    if (keys.length === 0 && !paid) {
      return new Response(JSON.stringify({ error: 'API 키가 설정되지 않았습니다. Vercel 환경변수를 확인하세요.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 무료 키 순환 시도
    let lastError = null;
    for (const key of keys) {
      try {
        const text = await callGemini(key, prompt, maxTokens);
        return new Response(JSON.stringify({ text, source: 'free' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        if (e.code === 429 || e.code === 503) {
          lastError = e; continue; // 다음 키 시도
        }
        throw e;
      }
    }

    // 유료 키 폴백
    if (paid) {
      try {
        const text = await callGemini(paid, prompt, maxTokens);
        return new Response(JSON.stringify({ text, source: 'paid' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: `유료 키 오류: ${e.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: '모든 키 한도 초과. 자정 후 재시도하세요.' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
