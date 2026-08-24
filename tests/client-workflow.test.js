const fs = require('fs');
const assert = require('assert');

const clients = fs.readFileSync('public/clients.js', 'utf8');
const analysis = fs.readFileSync('public/saju-analysis.js', 'utf8');
const analysisHtml = fs.readFileSync('public/saju-analysis.html', 'utf8');
const clientsHtml = fs.readFileSync('public/clients.html', 'utf8');

assert(clients.includes("var KEY='cheonun.clients.v1'"), '고객 저장 키가 유지되어야 함');
assert(analysis.includes("var KEY='cheonun.clients.v1'"), '분석 양식이 같은 고객 저장소를 사용해야 함');
assert(clients.includes('Object.assign({},existing||{}'), '고객 수정 시 확장 기록을 보존해야 함');
assert(clients.includes("location.href='/saju-analysis.html?client='"), '선택 고객 연결 링크가 있어야 함');
assert(analysis.includes('r.sajuAnalysis=a'), '사주 분석이 고객 기록 아래 저장되어야 함');
assert(!/fetch\s*\(|XMLHttpRequest|\/api\//.test(clients + analysis), '고객·분석 기록이 외부 API로 전송되면 안 됨');
assert(clientsHtml.includes('id="duration" type="number"'), '상담시간은 분 단위 직접입력이어야 함');
['yearPillar','dayMaster','elementsNote','tenGods','relations','usefulGod','decade','yearFlow','evidence','tarotDecision','keyPoints'].forEach((id) => {
  assert(analysisHtml.includes(`id="${id}"`), `${id} 입력란이 필요함`);
});

console.log('client workflow tests passed');
