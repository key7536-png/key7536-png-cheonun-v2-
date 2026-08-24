const fs = require('fs');
const assert = require('assert');

const clients = fs.readFileSync('public/clients.js', 'utf8');
const analysis = fs.readFileSync('public/saju-analysis.js', 'utf8');
const analysisHtml = fs.readFileSync('public/saju-analysis.html', 'utf8');
const clientsHtml = fs.readFileSync('public/clients.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const publicIndexHtml = fs.readFileSync('public/index.html', 'utf8');
const ziweiHtml = fs.readFileSync('public/ziwei.html', 'utf8');

assert(clients.includes("var KEY='cheonun.clients.v1'"), '고객 저장 키가 유지되어야 함');
assert(analysis.includes("var KEY='cheonun.clients.v1'"), '분석 양식이 같은 고객 저장소를 사용해야 함');
assert(clients.includes('Object.assign({},existing||{}'), '고객 수정 시 확장 기록을 보존해야 함');
assert(clients.includes("location.href='/saju-analysis.html?client='"), '선택 고객 연결 링크가 있어야 함');
assert(analysis.includes('r.sajuAnalysis=a'), '사주 분석이 고객 기록 아래 저장되어야 함');
assert(!/fetch\s*\(|XMLHttpRequest|\/api\//.test(clients + analysis), '고객·분석 기록이 외부 API로 전송되면 안 됨');
assert(clientsHtml.includes('id="duration" type="number"'), '상담시간은 분 단위 직접입력이어야 함');
assert(indexHtml.includes("const MANAGED_CLIENT_KEY = 'cheonun.clients.v1'"), '상담 탭이 고객관리 저장소를 연결해야 함');
assert(indexHtml.includes('mergeManagedClients()'), '상담·전화상담 고객 병합 기능이 필요함');
assert.strictEqual(indexHtml, publicIndexHtml, 'index.html과 public/index.html은 동일해야 함');
assert(ziweiHtml.includes('loadZiweiManagedClient()'), '자미두수 고객 불러오기 기능이 필요함');
assert(ziweiHtml.includes('id="zManagedClient" onchange="loadZiweiManagedClient()"'), '자미두수는 고객 선택 즉시 정보를 불러와야 함');
assert(!ziweiHtml.includes('>불러오기</button>'), '자미두수에 별도 고객 불러오기 버튼이 남으면 안 됨');
assert(!ziweiHtml.includes("bubble-num\">말풍선"), '자미두수 결과에 말풍선 번호 문구가 노출되면 안 됨');
assert(ziweiHtml.includes("const Z_MANAGED_CLIENT_KEY = 'cheonun.clients.v1'"), '자미두수가 같은 고객 저장소를 사용해야 함');
assert(ziweiHtml.includes("getZiweiManagedClients()[Number(selected)]"), '자미두수는 중복 고객 ID가 있어도 선택한 행을 정확히 불러와야 함');
assert(ziweiHtml.includes('ziweiHistory.slice(-6)'), '후속 질문은 최근 대화만 보내 토큰 사용량을 제한해야 함');
assert(clients.includes('normalizeRecords'), '복원 시 중복 고객 식별값을 정리해야 함');
['yearPillar','dayMaster','elementsNote','tenGods','relations','usefulGod','decade','yearFlow','evidence','tarotDecision','keyPoints'].forEach((id) => {
  assert(analysisHtml.includes(`id="${id}"`), `${id} 입력란이 필요함`);
});

console.log('client workflow tests passed');
