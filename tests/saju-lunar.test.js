const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const iztro = require('iztro');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('const _S =');
const end = html.indexOf('// ════════════════════════════════\n// 상담 태도 공통 규칙');
assert(start >= 0 && end > start, '사주 계산 엔진을 찾을 수 없음');

const context = { Date, iztro };
vm.createContext(context);
vm.runInContext(html.slice(start, end) + '\nthis.calcSajuForTest=calcSaju;', context);

// 기존 양력 결과는 절대 변경하지 않는다.
const solar = context.calcSajuForTest('1969-09-16', '묘시', '남성', '양력', false);
assert.equal(solar.pillarsText, '년주 기유 / 월주 계유 / 일주 갑오 / 시주 정묘');

// 음력 1969-09-16(평달)은 양력 1969-10-26으로 변환한 뒤 계산한다.
const lunar = context.calcSajuForTest('1969-09-16', '묘시', '남성', '음력', false);
assert.equal(lunar.solarBirth, '1969-10-26');
assert.equal(lunar.pillarsText, '년주 기유 / 월주 갑술 / 일주 갑술 / 시주 정묘');
assert.equal(lunar.daeunStart, 6);
assert.equal(lunar.curDaeun, '무진');
assert.equal(lunar.curDaeunAge, 56);

console.log('saju lunar conversion tests passed');
