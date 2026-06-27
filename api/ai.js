const MODEL = 'gemini-2.5-flash';

const KEYS = [
  'AQ.Ab8RN6JFbQbrNzZVks0Xmeu7DWO9MmRjiI7Ck_encmhyXlvEOQ',
  'AQ.Ab8RN6JrDY6PgU2MmTDJ_GEaG0F1FuYIk8SxZW1ZTi2cEPJuVA',
  'AQ.Ab8RN6JOMz5VB8Iq4lvZKhUSqJHtuttEEI_KxEN4eSZc09q72A',
  'AQ.Ab8RN6KWgnaghB6GcIMeBnHIA5GX5Si1yUzJUEySH8odzULYxA',
  'AQ.Ab8RN6JQi4thfyUl-bbZiSDVM_wPZCdu0vwUT40yIf87e8WCug',
  'AQ.Ab8RN6Ki8T2GARCa7hbRRqT5Uj2bafuNutD_OAfuivi421uDoA',
  'AQ.Ab8RN6JBhlN5LwtSfGB71V2_jL6TCHsdGVWVik_steHm91i7Gw',
  'AQ.Ab8RN6JA_h85aXm09VUt1BWdx1imbqIf5RgEFvu9CX2nV9QXYQ',
  'AQ.Ab8RN6LjgY1xpr30g5paDZovk3SXX9QMr4aVUEftCemxfGSd0g',
  'AQ.Ab8RN6KkjEU42Rp3Bj9wxWfgxRBoFln9osnT6fc1k3QksfIq5g',
];
const PAID = 'AQ.Ab8RN6Kw2866ko85inR767lsLnEGHmuVIN_ARLlyQouisTKMuw';

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

    const start = keyIdx % KEYS.length;
    for (let i = 0; i < KEYS.length; i++) {
      const idx = (start + i) % KEYS.length;
      try {
        const text = await callGemini(KEYS[idx], prompt, maxTokens);
        keyIdx = idx + 1;
        return res.status(200).json({ text, source: 'free' });
      } catch (e) {
        if (e.code === 429 || e.code === 503) continue;
        throw e;
      }
    }

    const text = await callGemini(PAID, prompt, maxTokens);
    return res.status(200).json({ text, source: 'paid' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
