// 2026-11-08 재검증: 사주랩 만세력(사용자 기준 만세력) 화면에서 직접 확인한 값과 앱 엔진(public/saju-engine.js)을 대조한다.
// 시간은 출생 시계 시각(HH:MM)을 그대로 넣는다. 서머타임·UTC+8:30 시기, 절입 직전 출생, 밤 11시 이후 출생을 포함.
// 또 양력으로 넣은 자미두수 명반과 같은 날의 한국 음력으로 넣은 명반이 같은지 확인한다(한국·중국 음력이 다른 날 포함).
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const pub = p => fs.readFileSync(path.join(__dirname, '..', 'public', p), 'utf8');
const ctx = { console };
ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['vendor/lunar-javascript-1.7.7.js', 'vendor/iztro-v2.6.0.min.js', 'korean-lunar.js', 'saju-engine.js', 'ziwei.js']) {
  vm.runInContext(pub(f), ctx, { filename: f });
}

// 날짜|시각|성별|년주 월주 일주 시주|대운수 첫대운   (사주랩 만세력 2026-11-08 조회값)
const CASES = [
  '1989-03-06|11:45|여성|기사 정묘 을축 임오|10 무진',
  '1978-05-10|12:00|여성|무오 정사 임신 병오|1 병진',
  '1958-08-20|06:10|여성|무술 경신 기사 정묘|4 기미',   // 서머타임 + UTC+8:30 시기
  '1990-02-04|10:30|남성|기사 정축 경자 신사|10 병자',  // 입춘(한국시간 11:14) 직전
  '2000-01-01|00:20|남성|기묘 병자 무오 임자|8 을해',
  '1973-11-02|18:00|여성|계축 임술 임인 기유|2 계해',
  '2012-05-25|16:00|여성|임진 을사 병술 병신|7 갑진',
  '1984-02-04|23:50|남성|계해 을축 기사 갑자|10 갑자',  // 밤 11시 이후 → 다음 날 일주
  '1949-07-01|09:00|남성|기축 경오 임진 갑진|8 기사',   // 서머타임
  '2005-10-08|03:00|여성|을유 을유 을축 정축|',
  '1970-03-21|01:20|여성|경술 기묘 경자 병자|5 무인',
];
const fail = [];
for (const row of CASES) {
  const [date, time, gender, pillars, dae] = row.split('|');
  const s = ctx.calcSaju(date, time, gender, '양력', false);
  const got = [s.yp, s.mp, s.dp, s.hp].join(' ');
  if (got !== pillars) fail.push(`${date} ${time}: ${got} (사주랩 ${pillars})`);
  if (dae) {
    const [su, p] = dae.split(' ');
    if (s.daeunList[0].startAge !== +su || s.daeunList[0].pillar !== p) fail.push(`${date} 대운: ${s.daeunList[0].startAge} ${s.daeunList[0].pillar} (사주랩 ${dae})`);
  }
}
// 시진만 고른 경우도 같은 결과여야 한다
assert.equal(ctx.calcSaju('1984-02-04', '야자시', '남성').pillarsText, '년주 계해 / 월주 을축 / 일주 기사 / 시주 갑자');
assert.equal(ctx.calcSaju('1990-02-04', '사시', '남성').pillarsText, '년주 기사 / 월주 정축 / 일주 경자 / 시주 신사');
assert.deepEqual(fail, [], '사주랩 기준값과 다름:\n' + fail.join('\n'));

// 자미두수: 한국·중국 음력이 다른 날도 양력 입력 = 한국 음력 입력
const Z = ctx.CheonunZiwei, K = ctx.KoreanLunar;
const sig = c => c.palaces.map(p => p.name + p.branch + p.majorStars.map(s => s.name + s.brightness + s.mutagen).join()).join('|') + c.fiveElementsClass;
for (const sol of ['1955-02-22', '1958-02-18', '1958-02-28', '1966-01-21', '1995-08-24', '2012-05-25', '1989-03-06']) {
  const [y, m, d] = sol.split('-').map(Number);
  const k = K.solarToLunar(y, m, d);
  const a = Z.calculate({ birth: sol, hour: '오시', gender: '여성', calendar: '양력', targetDate: '2026-11-08' });
  const b = Z.calculate({ birth: `${k.year}-${k.month}-${k.day}`, hour: '오시', gender: '여성', calendar: '음력', isLeap: k.isLeap, targetDate: '2026-11-08' });
  assert.equal(sig(a), sig(b), `${sol} 양력·음력 입력 명반이 다름`);
  assert.ok(!a.warning, `${sol} 경고: ${a.warning}`);
}
// 밝기는 한글 등급으로 나와야 한다
const c = Z.calculate({ birth: '1989-03-06', hour: '오시', gender: '여성', calendar: '양력', targetDate: '2026-11-08' });
assert.equal(c.palaces.find(p => p.name === '명궁').majorStars[0].brightness, '득');
assert.match(Z.toPrompt(c), /사주 대운\(대운수 기준\)과 나이 구간이 다르다/);
console.log(`sajulab reference tests passed (${CASES.length}건 + 자미두수 7건)`);
