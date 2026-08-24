const assert = require('assert');

process.env.GEMINI_KEY_1 = 'invalid-key';
process.env.GEMINI_KEY_2 = 'valid-key';
for (let i = 3; i <= 30; i++) delete process.env['GEMINI_KEY_' + i];
delete process.env.GEMINI_PAID_KEY;

const calls = [];
global.fetch = async (url, options) => {
  const key = new URL(url).searchParams.get('key');
  calls.push({url, key, body:JSON.parse(options.body)});
  if (key === 'invalid-key') {
    return { json: async () => ({ error: { code: 401, message: 'Request had invalid authentication credentials' } }) };
  }
  return { json: async () => ({ candidates: [{ content: { parts: [{ text: '정상 응답' }] } }] }) };
};

const handler = require('../api/ai.js');
function response(){
  return { statusCode: 200, body: null, headers: {}, setHeader(k,v){this.headers[k]=v;}, status(code){this.statusCode=code;return this;}, json(value){this.body=value;return this;}, end(){return this;} };
}

(async () => {
  const first=response();
  await handler({method:'POST',body:{prompt:'첫 질문',maxTokens:1024}},first);
  assert.equal(first.statusCode,200);
  assert.equal(first.body.text,'정상 응답');
  assert.equal(calls.length,2,'인증 실패 키 다음의 정상 키를 시도해야 함');
  assert.equal(calls[1].key,'valid-key');
  assert(calls[1].url.includes('/models/gemini-3.6-flash:generateContent'),'현재 안정 모델을 사용해야 함');
  assert.equal(calls[1].body.generationConfig.thinkingConfig.thinkingLevel,'minimal','Gemini 3용 최소 사고 수준을 사용해야 함');
  assert.equal(calls[1].body.generationConfig.thinkingConfig.thinkingBudget,undefined,'Gemini 2.5용 thinkingBudget을 보내면 안 됨');
  assert.equal(new URL(calls[1].url).searchParams.get('key'),'valid-key','검증된 query key 방식으로 전달해야 함');

  const second=response();
  await handler({method:'POST',body:{prompt:'둘째 질문',maxTokens:1024}},second);
  assert.equal(second.statusCode,200);
  assert.equal(calls.length,3,'둘째 질문은 마지막으로 성공한 키부터 사용해야 함');
  assert.equal(calls[2].key,'valid-key');
  console.log('api key rotation tests passed');
})().catch((error)=>{console.error(error);process.exit(1);});
