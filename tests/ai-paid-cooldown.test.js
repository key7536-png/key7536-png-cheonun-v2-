// 유료키 직행(preferPaid) + 429/503 쿨다운 테스트
const assert = require('assert');

process.env.GEMINI_KEY_1 = 'free-key-1';
process.env.GEMINI_KEY_2 = 'free-key-2';
for (let i = 3; i <= 30; i++) delete process.env['GEMINI_KEY_' + i];

const calls = [];
global.fetch = async (url, options) => {
  const key = new URL(url).searchParams.get('key');
  calls.push({ key, body: JSON.parse(options.body) });
  if (key === 'quota-key') {
    return { json: async () => ({ error: { code: 429, message: 'Quota exceeded' } }) };
  }
  return { json: async () => ({ candidates: [{ content: { parts: [{ text: '정상 응답' }] } }] }) };
};

function response() {
  return { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(v) { this.body = v; return this; }, end() { return this; } };
}
function freshHandler() {
  delete require.cache[require.resolve('../api/ai.js')];
  return require('../api/ai.js');
}

(async () => {
  // ── 1) preferPaid === true → 무료 키는 건너뛰고 유료 키만 한 번 호출 ──
  process.env.GEMINI_PAID_KEY = 'paid-key';
  let handler = freshHandler();
  calls.length = 0;
  let res = response();
  await handler({ method: 'POST', body: { prompt: '급한 질문', maxTokens: 1024, preferPaid: true } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.text, '정상 응답');
  assert.equal(res.body.source, 'paid', '유료키로 답했으면 source는 paid');
  assert.equal(calls.length, 1, '무료 키를 돌지 않고 유료 키만 호출해야 함');
  assert.equal(calls[0].key, 'paid-key');

  // ── 2) preferPaid 인데 GEMINI_PAID_KEY 미등록 → 명확한 500 에러, 무료 키 대체 호출 없음 ──
  delete process.env.GEMINI_PAID_KEY;
  handler = freshHandler();
  calls.length = 0;
  res = response();
  await handler({ method: 'POST', body: { prompt: '급한 질문', preferPaid: true } }, res);
  assert.equal(res.statusCode, 500);
  assert.ok(/GEMINI_PAID_KEY/.test(res.body.error), 'GEMINI_PAID_KEY 미등록을 알려야 함: ' + res.body.error);
  assert.equal(calls.length, 0, '유료 모드에서는 무료 키를 찔러보면 안 됨');

  // ── 3) 같은 실패를 반복하지 않도록 429 키는 60초 쿨다운에 들어간다 ──
  process.env.GEMINI_KEY_1 = 'quota-key';
  process.env.GEMINI_KEY_2 = 'free-key-2';
  delete process.env.GEMINI_PAID_KEY;
  handler = freshHandler();
  calls.length = 0;
  res = response();
  await handler({ method: 'POST', body: { prompt: '첫 질문' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2, '한도 초과 키 다음의 정상 키로 넘어가야 함');
  assert.equal(calls[0].key, 'quota-key');
  assert.equal(calls[1].key, 'free-key-2');

  calls.length = 0;
  res = response();
  await handler({ method: 'POST', body: { prompt: '둘째 질문' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1, '쿨다운 중인 429 키는 다시 찌르지 않아야 함');
  assert.equal(calls[0].key, 'free-key-2');

  // ── 4) 모든 무료 키가 쿨다운 중이고 유료 키가 있으면 기다리지 않고 유료로 폴백 ──
  process.env.GEMINI_KEY_1 = 'quota-key';
  delete process.env['GEMINI_KEY_2'];
  process.env.GEMINI_PAID_KEY = 'paid-key';
  handler = freshHandler();
  calls.length = 0;
  res = response();
  await handler({ method: 'POST', body: { prompt: '첫 질문' } }, res);   // quota-key → 429 → 쿨다운, 유료 폴백
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, 'paid');
  calls.length = 0;
  res = response();
  await handler({ method: 'POST', body: { prompt: '둘째 질문' } }, res); // 키가 전부 쿨다운 → 바로 유료
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, 'paid');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].key, 'paid-key');

  console.log('ai paid/cooldown tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
