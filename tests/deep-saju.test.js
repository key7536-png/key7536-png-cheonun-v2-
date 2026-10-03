const assert = require('assert');
const { analyze, tenGod, twelveStage, gongmang } = require('../public/deep-saju.js');

// 십성 — 일간 갑 기준
assert.equal(tenGod('갑', '기'), '정재');
assert.equal(tenGod('갑', '계'), '정인');
assert.equal(tenGod('갑', '정'), '상관');
assert.equal(tenGod('갑', '경'), '편관');
assert.equal(tenGod('갑', '을'), '겁재');
assert.equal(tenGod('임', '병'), '편재');

// 십이운성 — 양간은 순행, 음간은 역행
assert.equal(twelveStage('갑', '해'), '장생');
assert.equal(twelveStage('갑', '묘'), '제왕');
assert.equal(twelveStage('갑', '오'), '사');
assert.equal(twelveStage('을', '오'), '장생');
assert.equal(twelveStage('을', '인'), '제왕');
assert.equal(twelveStage('경', '유'), '제왕');

// 공망
assert.deepEqual(gongmang('갑자'), ['술', '해']);
assert.deepEqual(gongmang('갑오'), ['진', '사']);
assert.deepEqual(gongmang('계해'), ['자', '축']);

// 1969-09-16 묘시 남: 기유 / 계유 / 갑오 / 정묘
const base = { yp:'기유', mp:'계유', dp:'갑오', hp:'정묘', curDaeun:'무진', curDaeunAge:56,
  seun2026:'병오', seun2027:'정미', thisYear:2026, nextYear:2027, daeunList:[{pillar:'갑술', startAge:6}] };
const a = analyze(base);
assert(a.hasHour);
assert(a.text.includes('월주 계유: 천간 계(수, 정인) / 지지 유(금, 정관, 십이운성 태)'));
assert(a.text.includes('오행 개수(8글자 기준): 목 2, 화 2, 토 1, 금 2, 수 1'));
assert(a.text.includes('일주 지지 오와 시주 지지 묘가 파'));
assert(a.text.includes('2026년 세운 지지 오와 일주 지지 오가 자형'));

// 시간 모름이면 시주를 쓰지 않는다
const noHour = analyze(Object.assign({}, base, { hp:'미상' }));
assert(!noHour.hasHour);
assert(!noHour.text.includes('시주 정묘'));
assert(noHour.text.includes('3주 6자'));
assert(noHour.text.includes('6글자 기준'));

console.log('deep saju tests passed');
