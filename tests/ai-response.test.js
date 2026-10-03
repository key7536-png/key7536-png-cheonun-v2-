// AI 답변이 여러 조각으로 와도 끝까지 이어 붙이는지, 빈 답이면 다음 키로 넘어가는지 확인
const assert = require('assert');
process.env.GEMINI_KEY_1 = 'k1';
process.env.GEMINI_KEY_2 = 'k2';
let n = 0;
global.fetch = async () => {
  n++;
  if (n === 1) return { json: async () => ({ candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }) };
  return { json: async () => ({ candidates: [{ content: { parts: [{ text: '생각', thought: true }, { text: '앞부분, ' }, { text: '뒷부분까지 끝.' }] } }] }) };
};
const handler = require('../api/ai.js');
const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(o) { this.body = o; }, end() {} };
handler({ method: 'POST', body: { prompt: 'x' } }, res).then(() => {
  assert.equal(res.code, 200);
  assert.equal(res.body.text, '앞부분, 뒷부분까지 끝.');
  assert.equal(n, 2, '빈 답이면 다음 키로 다시 시도해야 함');
  console.log('ai response tests passed');
});
