// 💾 내담자 자동 저장 (상담 시작 · 질문바로) 검증
const fs = require('fs');
const assert = require('assert');
const store = require('../public/client-store.js');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const publicIndexHtml = fs.readFileSync('public/index.html', 'utf8');
const quickJs = fs.readFileSync('public/quick.js', 'utf8');
const storeJs = fs.readFileSync('public/client-store.js', 'utf8');

// ── 1. 기록 만들기 ──
{
  const rec = store.buildRecord({ name: '', birth: '1995-03-12', gender: '여성', topic: '재회운 ⭐' }, { source: 'quick', defaultName: '질문바로 고객' });
  assert.strictEqual(rec.name, '질문바로 고객 (95.03.12)', '닉네임이 없으면 생년월일로 알아보기 쉬운 이름을 붙여야 함');
  assert.strictEqual(rec.birth, '1995-03-12');
  assert.strictEqual(rec.topic, '재회운 ⭐');
  assert.strictEqual(rec.source, 'quick');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(rec.savedAt), 'savedAt은 YYYY-MM-DD 형식');
  assert(!isNaN(Date.parse(rec.updatedAt)), 'updatedAt은 ISO 시각');
}
{
  const rec = store.buildRecord({ name: ' 김미나 ', birth: '1980-01-01', calendar: '음력', leap: true }, { source: 'consult' });
  assert.strictEqual(rec.name, '김미나');
  assert.strictEqual(rec.calendar, '음력');
  assert.strictEqual(rec.leap, true);
  const rec2 = store.buildRecord({ name: '미나' });   // 생년월일 없음
  assert.strictEqual(rec2.birth, '');
  assert.strictEqual(rec2.calendar, '양력');
}
{
  // 주제 → 고객관리 체크박스 값
  assert.strictEqual(store.mapTopic('재회운 ⭐'), '연애/결혼');
  assert.strictEqual(store.mapTopic('재물/돈버는시기'), '재물');
  assert.strictEqual(store.mapTopic('이직/취업'), '직업/사업');
  assert.strictEqual(store.mapTopic('이사시기'), '이동/변화');
  assert.strictEqual(store.mapTopic('모르는주제'), '종합운');
}

// ── 2. 상담 탭 내담자 목록: 같은 이름+생년월일은 갱신, 중복 생성 금지 ──
{
  let list = [];
  const first = store.buildRecord({ name: '김미나', birth: '1995-03-12', topic: '연애운', question: '재회될까요' }, { now: new Date('2026-11-24T01:00:00Z') });
  let r = store.upsertConsultList(list, first);
  list = r.list;
  assert.strictEqual(r.created, true);
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].q, '재회될까요');
  assert.strictEqual(list[0].autoSaved, true);

  // Supabase에서 받아온 행 id가 붙은 뒤 다시 저장
  list[0].id = 'uuid-1';
  const second = store.buildRecord({ name: '김미나', birth: '1995-03-12', topic: '연애운', question: '그 사람 속마음' }, { now: new Date('2026-11-24T02:00:00Z') });
  r = store.upsertConsultList(list, second);
  list = r.list;
  assert.strictEqual(r.created, false, '같은 이름+생년월일은 새로 만들지 않아야 함');
  assert.strictEqual(list.length, 1, '중복 내담자가 생기면 안 됨');
  assert.strictEqual(list[0].id, 'uuid-1', '기존 Supabase id를 유지해야 함(갱신)');
  assert.strictEqual(list[0].q, '그 사람 속마음');
  assert.strictEqual(list[0].updatedAt, second.updatedAt, 'updatedAt을 갱신해야 함');
}
{
  // 이름이 같아도 생년월일이 다르면 다른 사람
  let list = [];
  list = store.upsertConsultList(list, store.buildRecord({ name: '김미나', birth: '1995-03-12' })).list;
  list = store.upsertConsultList(list, store.buildRecord({ name: '김미나', birth: '1996-04-13' })).list;
  assert.strictEqual(list.length, 2, '생년월일이 다르면 별도 내담자');
  // 생년월일이 없던 기록과 있는 기록도 별도
  list = store.upsertConsultList(list, store.buildRecord({ name: '박선진' })).list;
  list = store.upsertConsultList(list, store.buildRecord({ name: '박선진', birth: '1969-08-01' })).list;
  assert.strictEqual(list.length, 4);
}
{
  // 빈 입력으로 기존 정보를 지우지 않는다
  let list = store.upsertConsultList([], store.buildRecord({ name: '이수진', birth: '1990-02-02', gender: '여성', question: '질문1' })).list;
  list = store.upsertConsultList(list, store.buildRecord({ name: '이수진', birth: '1990-02-02', gender: '', question: '' })).list;
  assert.strictEqual(list[0].gender, '여성');
  assert.strictEqual(list[0].q, '질문1');
}
{
  // 50개 제한 유지
  let list = [];
  for (let i = 0; i < 60; i++) list = store.upsertConsultList(list, store.buildRecord({ name: '고객' + i, birth: '1990-01-01' })).list;
  assert.strictEqual(list.length, 50, '상담 탭 목록은 50개까지만 유지');
}

// ── 3. 고객관리 화면 기록: 자동 저장 후에도 직접 적은 메모·연락처·동의는 보존 ──
{
  let managed = [];
  const rec = store.buildRecord({ name: '김미나', birth: '1995-03-12', hour: '오시', gender: '여성', topic: '재회운 ⭐', question: '재회될까요' }, { source: 'quick' });
  let r = store.upsertManagedList(managed, rec, { lastAnswer: '세 달 안에 연락이 옵니다' });
  managed = r.list;
  assert.strictEqual(managed.length, 1);
  const m = managed[0];
  assert.ok(m.id && m.createdAt, '고객관리 기록에는 id·createdAt이 있어야 함');
  assert.strictEqual(m.birthHour, '오시');
  assert.deepStrictEqual(m.topics, ['연애/결혼']);
  assert.strictEqual(m.status, '접수');
  assert.strictEqual(m.consent, false, '자동 저장은 동의 체크를 대신하면 안 됨');
  assert.strictEqual(m.autoSaved, true);
  assert.strictEqual(m.lastAnswer, '세 달 안에 연락이 옵니다');
  assert.strictEqual(m.reason, '재회될까요');

  // 사용자가 고객관리 화면에서 연락처·메모·주제를 직접 채운 뒤 다시 자동 저장
  managed[0].contact = '010-0000-0000';
  managed[0].memo = '전화 상담 예정';
  managed[0].topics = ['연애/결혼', '재물'];
  managed[0].consent = true;
  managed[0].reason = '직접 적은 상담 이유';
  const rec2 = store.buildRecord({ name: '김미나', birth: '1995-03-12', hour: '오시', gender: '여성', topic: '재물/돈버는시기', question: '돈이 들어올까요' }, { source: 'consult' });
  const r2 = store.upsertManagedList(managed, rec2);
  managed = r2.list;
  assert.strictEqual(managed.length, 1, '같은 고객은 중복 생성 금지');
  assert.strictEqual(managed[0].id, m.id);
  assert.strictEqual(managed[0].createdAt, m.createdAt);
  assert.strictEqual(managed[0].contact, '010-0000-0000');
  assert.strictEqual(managed[0].memo, '전화 상담 예정');
  assert.strictEqual(managed[0].consent, true);
  assert.strictEqual(managed[0].reason, '직접 적은 상담 이유');
  assert.deepStrictEqual(managed[0].topics, ['연애/결혼', '재물'], '주제는 새 항목만 추가하고 기존 체크는 유지');
  assert.strictEqual(managed[0].updatedAt, rec2.updatedAt);
}
{
  // 이름이 같아도 생년월일이 다르면 고객관리에서도 별도
  let managed = [];
  managed = store.upsertManagedList(managed, store.buildRecord({ name: '김미나', birth: '1995-03-12' })).list;
  managed = store.upsertManagedList(managed, store.buildRecord({ name: '김미나', birth: '1999-09-09' })).list;
  assert.strictEqual(managed.length, 2);
}
{
  // 이름을 고친 뒤 같은 사람을 다시 자동 저장해도 autoId로 같은 기록을 찾는다
  let managed = store.upsertManagedList([], store.buildRecord({ name: '미나', birth: '1995-03-12' })).list;
  managed[0].name = '김미나';
  const r = store.upsertManagedList(managed, store.buildRecord({ name: '김미나', birth: '1995-03-12' }));
  assert.strictEqual(r.list.length, 1);
}

// ── 4. 저장은 이 브라우저 안에서만 — 외부로 보내는 코드 없음 ──
assert(!/fetch\s*\(|XMLHttpRequest/.test(storeJs), '자동 저장 공용 모듈은 외부로 자료를 보내면 안 됨');

// ── 5. 화면 연결 ──
assert(publicIndexHtml.includes('<script src="/client-store.js"></script>'), '상담 탭이 자동 저장 모듈을 불러와야 함');
assert(publicIndexHtml.includes('async function autoSaveClient('), '상담 탭에 자동 저장 함수가 있어야 함');
assert(publicIndexHtml.includes('window.autoSaveQuickClient = function'), '질문바로용 자동 저장 진입점이 있어야 함');
assert.strictEqual(indexHtml, publicIndexHtml, 'index.html과 public/index.html은 동일해야 함');

// 상담 시작: 검증을 통과한 뒤 AI 호출 전에 자동 저장
const startIdx = publicIndexHtml.indexOf('async function startConsulting(){');
const startSeg = publicIndexHtml.slice(startIdx, startIdx + 3000);
const saveAt = startSeg.indexOf('autoSaveClient({name, gender, birth, hour, calendar, leap:isLeap, topic, question:q}');
const aiAt = startSeg.indexOf('await ai(prompt');
assert(saveAt > 0, '상담 시작 시 자동 저장을 호출해야 함');
assert(aiAt > saveAt, '자동 저장은 AI 호출 전에 먼저 끝나야 함(창을 닫아도 고객이 남도록)');

// 질문바로: 답변 시작 시 1차 저장 + 답변 완료 시 답변 요약 갱신
assert(quickJs.includes('_autoSaveQuickClient(info);'), '질문바로는 답변 생성 시작 시 자동 저장해야 함');
assert(quickJs.includes('_autoSaveQuickClient(info, { lastAnswer: answer, silent: true });'), '질문바로는 완료 시 답변 요약까지 저장해야 함');
const quickSaveAt = quickJs.indexOf('_autoSaveQuickClient(info);');
const quickAiAt = quickJs.indexOf('await ai(_buildQuickPrompt');
assert(quickSaveAt > 0 && quickAiAt > quickSaveAt, '질문바로 자동 저장은 답변 생성 전에 이뤄져야 함');

// 기존 질문바로 출력·프롬프트·무료키/⚡유료키 토글은 그대로
assert(quickJs.includes('당신은 30년 경력 명리학·자미두수·타로 통합 상담사 천운입니다.'), '질문바로 프롬프트는 그대로여야 함');
assert(quickJs.includes('전체 공백 포함 400~450자'), '질문바로 스레드 답변 길이 규칙은 그대로여야 함');
assert(publicIndexHtml.includes('<button type="button" id="keyModeBtn" class="keytoggle" onclick="toggleKeyMode()" title="무료키 / 유료키 전환">무료키</button>'), '무료키/⚡유료키 토글은 그대로여야 함');
assert(publicIndexHtml.includes('saveConsultDraft();'), '기존 상담 초안 자동 보존은 그대로여야 함');

console.log('auto save client tests passed');
