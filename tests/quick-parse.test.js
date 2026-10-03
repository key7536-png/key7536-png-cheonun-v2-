const assert = require('assert');
const { parseQuickText, clockToBranch } = require('../public/quick.js');

const now = new Date(2026, 9, 4);
const p = (t) => parseQuickText(t, now);

// 시 경계는 앱 드롭다운(자시 23:30~01:29 …)과 같아야 한다.
assert.equal(clockToBranch(23, 30), '자시');
assert.equal(clockToBranch(1, 29), '자시');
assert.equal(clockToBranch(1, 30), '축시');
assert.equal(clockToBranch(14, 0), '미시');

let r = p('95.3.12 여자 오후 2시쯤 태어났어요! 헤어진 남친이랑 다시 연락 올까요?');
assert.equal(r.birth, '1995-03-12');
assert.equal(r.gender, '여성');
assert.equal(r.hour, '미시');
assert.equal(r.topic, '재회운 ⭐');
assert.equal(r.calendar, '양력');

r = p('음력 1988년 11월 3일생 남자입니다 새벽 3시 반에 태어났고 이직해도 될까요');
assert.equal(r.birth, '1988-11-03');
assert.equal(r.calendar, '음력');
assert.equal(r.gender, '남성');
assert.equal(r.hour, '인시');
assert.equal(r.topic, '이직/취업');

r = p('920815 여 시간 모름 남자친구랑 결혼해도 될까요?');
assert.equal(r.birth, '1992-08-15');
assert.equal(r.gender, '여성');   // "남자친구"가 본인 성별로 잡히면 안 됨
assert.equal(r.hour, '');
assert.equal(r.topic, '결혼운/결혼시기');

r = p('20010204 술시 생이에요 올해 돈 들어올까요');
assert.equal(r.birth, '2001-02-04');
assert.equal(r.hour, '술시');
assert.equal(r.genderGuessed, true);
assert.equal(r.topic, '재물/돈버는시기');

r = p('저 96년생인데 연애 언제 해요?');
assert.equal(r.birth, '');       // 연·월·일이 다 없으면 생년월일 없음

r = p('저는 1994-07-21 여자, 그 사람은 1993-01-09 남자예요. 궁합 봐주세요');
assert.equal(r.birth, '1994-07-21');
assert.equal(r.partnerBirth, '1993-01-09');
assert.equal(r.topic, '궁합');

r = p('03년 5월 7일 밤 11시 40분 남 합격할까요');
assert.equal(r.birth, '2003-05-07');
assert.equal(r.hour, '자시');
assert.equal(r.gender, '남성');

console.log('quick parse tests passed');
