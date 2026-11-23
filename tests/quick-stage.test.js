// ⚡ 질문바로 3단계 순차 출력 — 프롬프트 조립 테스트
const assert = require('assert');
const { buildQuickStagePrompts, QUICK_STAGES, QUICK_STAGE_FIRST_CLOSING, QUICK_STAGE_LAST_CLOSING } = require('../public/quick.js');

const today = new Date(2026, 10, 23); // 2026-11-23
const ctx = {
  question: '95.3.12 여자 오후 2시쯤 태어났어요! 헤어진 남친이랑 다시 연락 올까요?',
  gender: '여성',
  topic: '재회운 ⭐',
  age: 31,
  thisYear: 2026,
  nextYear: 2027,
  pillarsText: '을해·기묘·정유·정미',
  ilgan: '정화',
  curDaeun: '계미',
  curDaeunAge: 30,
  seunThis: '병오',
  seunNext: '정미',
  zPrompt: '자미두수 명궁: 자미궁 천상 / 부처궁: 사궁 태양',
  partnerBirth: '1993-01-09',
  nick: '미나',
  cards: [
    { pos: '현재 상황', label: '연인(역방향)', meaning: '관계의 흔들림과 선택' },
    { pos: '숨은 흐름', label: '달(역방향)', meaning: '불안과 헷갈림' },
    { pos: '3개월 안 결과', label: '별', meaning: '회복과 희망' },
  ],
  honestRules: '[HONEST_STYLE_RULES]',
  today,
};

const stages = buildQuickStagePrompts(ctx);

// ── 3개 카드 = 3개 프롬프트, 순서·토큰 한도 ──
assert.equal(stages.length, 3, '3단계가 순서대로 나와야 함');
assert.deepEqual(stages.map(s => s.n), [1, 2, 3]);
assert.deepEqual(stages.map(s => s.maxTokens), QUICK_STAGES.map(s => s.maxTokens));
assert.ok(stages[0].maxTokens < stages[1].maxTokens && stages[1].maxTokens < stages[2].maxTokens, '1단계가 가장 짧고 빨라야 함');
assert.ok(stages[0].title.includes('1단계'));

const [s1, s2, s3] = stages.map(s => s.prompt);

// ── 공통: 원문·계산 자료·공통 규칙·호칭이 모든 단계에 실린다 ──
for (const p of [s1, s2, s3]) {
  assert.ok(p.includes(ctx.question), '질문 원문이 들어가야 함');
  assert.ok(p.includes(ctx.pillarsText) && p.includes(ctx.ilgan) && p.includes(ctx.curDaeun), '사주 계산 자료가 들어가야 함');
  assert.ok(p.includes('연인(역방향)') && p.includes('달(역방향)') && p.includes('별'), '뽑힌 타로 카드가 들어가야 함');
  assert.ok(p.includes('12월·1월·2월'), '가까운 3개월 표기가 오늘 기준으로 계산돼야 함: ' + p.slice(0, 80));
  assert.ok(p.includes('2026년 11월 23일'), '오늘 날짜가 들어가야 함');
  assert.ok(p.includes('미나님'), '닉네임 호칭이 반영돼야 함');
  assert.ok(p.includes('[HONEST_STYLE_RULES]'), '공통 상담 태도 규칙이 붙어야 함');
  assert.ok(p.includes('한자 절대 금지') && p.includes('개인정보를 답변에 다시 적지 말 것'));
  assert.ok(p.includes('이번에 쓸 것은 그중') , '한 단계만 쓰는 지시가 있어야 함');
}

// ── 1단계: 사주 일간·대운 + 타로 3개월 정체/주의 + 후기 유도 마무리, 시기·배우자 결론 금지 ──
assert.ok(s1.includes(ctx.ilgan), '1단계는 일간을 짚어야 함');
assert.ok(s1.includes('대운'), '1단계는 대운 흐름을 짚어야 함');
assert.ok(s1.includes('정체') && s1.includes('주의'), '1단계는 3개월 정체·주의점까지만');
assert.ok(s1.includes(QUICK_STAGE_FIRST_CLOSING), '1단계 마지막 멘트가 선진님 실제 문구여야 함');
assert.ok(s1.includes('후기를 남겨주시면'));
assert.ok(/구체적인 시기\(몇 월/.test(s1), '1단계는 구체적 시기 금지');
assert.ok(/배우자·인연의 결론/.test(s1), '1단계는 배우자 결론 금지');
assert.ok(/자미두수·명궁·부처궁 이야기 금지/.test(s1), '1단계는 자미두수 금지');
assert.ok(!s1.includes(QUICK_STAGE_LAST_CLOSING), '1단계에 3단계 마무리 인사가 섞이면 안 됨');

// ── 2단계: 타로 카드별 흐름 + 마음가짐/조언, 시기·자미두수 금지 ──
assert.ok(s2.includes('카드 3장을 하나씩'), '2단계는 카드별 해석');
assert.ok(s2.includes('마음가짐'), '2단계는 마음가짐·조언 보충');
assert.ok(/구체적인 시기\(몇 월\)와 배우자 결론은 아직 금지/.test(s2));
assert.ok(s2.includes('자미두수 해석 금지'));
assert.ok(!s2.includes(QUICK_STAGE_LAST_CLOSING) && !s2.includes(QUICK_STAGE_FIRST_CLOSING), '2단계는 마무리 멘트를 반복하지 않음');

// ── 3단계: 자미두수 명궁/부처궁 + 구체적 시기 + 배우자상 + 마무리 인사 ──
assert.ok(s3.includes('명궁') && s3.includes('부처궁'), '3단계는 자미두수 명궁·부처궁');
assert.ok(s3.includes('○월쯤'), '3단계는 구체적 시기');
assert.ok(s3.includes('배우자상'), '3단계는 배우자상');
assert.ok(s3.includes(QUICK_STAGE_LAST_CLOSING), '3단계는 선진님 실제 마무리 인사');
assert.ok(s3.includes(ctx.zPrompt), '자미두수 자료가 3단계에 들어가야 함');
assert.ok(!s3.includes(QUICK_STAGE_FIRST_CLOSING), '3단계에 1단계 후기 유도 멘트가 섞이면 안 됨');

// ── 태어난 시간을 모르면 자미두수 생략 안내 ──
const noHour = buildQuickStagePrompts(Object.assign({}, ctx, { zPrompt: '' }));
assert.ok(noHour[2].prompt.includes('자미두수: 태어난 시간을 몰라 생략'), '시간 모름이면 자미두수 생략이 명시돼야 함');

// ── 닉네임이 없으면 "님" 한 글자 단독 호칭을 만들지 않는다 ──
const noNick = buildQuickStagePrompts(Object.assign({}, ctx, { nick: '' }));
assert.ok(noNick[0].prompt.includes('닉네임이 없으니 이름 호칭 없이'), '닉네임 없을 때 호칭 규칙');

console.log('quick stage tests passed');
