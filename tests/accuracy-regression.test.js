// 2026-10 전체 점검에서 고친 오류들이 다시 생기지 않도록 확인하는 테스트
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const iztro = require('iztro');
const KoreanLunar = require('../public/korean-lunar.js');

// ── 1. 한국 음력(한국천문연구원 기준) ──
assert.equal(KoreanLunar.lunarToSolar(2017, 5, 1, true), '2017-06-24');   // 한국은 윤5월 (중국은 윤6월)
assert.throws(() => KoreanLunar.lunarToSolar(2017, 6, 1, true), /윤6월이 없습니다/);
assert.equal(KoreanLunar.lunarToSolar(2026, 3, 30, false), '2026-05-16'); // 중국 달력엔 없는 30일
assert.equal(KoreanLunar.lunarToSolar(1969, 9, 16, false), '1969-10-26');
assert.equal(KoreanLunar.lunarToSolar(1969, 8, 1, false), '1969-09-12');

// ── 2. 사주 엔진을 index.html에서 그대로 불러오기 ──
const html = fs.readFileSync('public/index.html', 'utf8');
const start = html.indexOf('const _S =');
const end = html.indexOf('// ════════════════════════════════\n// 상담 태도 공통 규칙');
const ctx = { Date, iztro, KoreanLunar };
vm.createContext(ctx);
vm.runInContext(html.slice(start, end) + '\nthis.calcSaju=calcSaju;', ctx);

// 음력이 한국 음력표로 변환되는지
assert.equal(ctx.calcSaju('2017-05-01', '진시', '여성', '음력', true).solarBirth, '2017-06-24');
assert.throws(() => ctx.calcSaju('2017-06-01', '진시', '여성', '음력', true), /윤6월이 없습니다/);

// 절입일: 1985-02-04 입춘(한국시간 11시경) — 같은 날이라도 입춘 전/후가 달라야 함
const before = ctx.calcSaju('1985-02-04', '축시', '여성');   // 02:30 → 입춘 전
const after = ctx.calcSaju('1985-02-04', '미시', '여성');    // 14:30 → 입춘 후
assert.equal(before.yp + before.mp, '갑자정축');
assert.equal(after.yp + after.mp, '을축무인');

// 기존 검증값(사용자 실제 상담 화면과 동일)
const sj = ctx.calcSaju('1969-08-01', '묘시', '여성', '음력', false);
assert.equal(sj.pillarsText, '년주 기유 / 월주 계유 / 일주 경인 / 시주 기묘');

// ── 3. 타로: 78장, 중복 없음, 공정한 섞기 사용 ──
const deck = vm.runInNewContext(html.slice(html.indexOf('const TAROT_78 = ') + 17, html.indexOf('];', html.indexOf('const TAROT_78')) + 1));
assert.equal(deck.length, 78);
assert.equal(new Set(deck).size, 78);
assert(!/sort\(\(\)=>Math\.random\(\)/.test(html), '치우친 sort 셔플이 남아 있으면 안 됨');
assert(html.includes('function shuffleDeck('), '공정한 셔플 함수가 필요함');

// ── 4. 말풍선 복사 버튼은 마지막 줄이 아니라 전체 원문을 복사해야 함 ──
assert(!html.includes('this.previousSibling.textContent'), '마지막 줄만 복사되는 방식이 남아 있으면 안 됨');

console.log('accuracy regression tests passed');
