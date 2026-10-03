// ════════════════════════════════
// 📕 PDF 리포트 탭 — 판매용 사주 리포트 (기본 약 30쪽 / 프리미엄 약 100쪽, A4)
// 흐름: ① 명식 계산 + AI 핵심 판단(강약·용신 — 상담사가 확인·수정) → ② 장별로 나눠 AI 집필 → ③ 화면에서 고친 뒤 PDF 저장(브라우저 인쇄)
// 정확도 원칙: 간지·십성·십이운성·합충·신살·대운·연운·월운은 전부 코드 계산(index.html 엔진 + deep-saju.js).
// AI는 확정 자료와 ①에서 고정한 용신 판단을 근거로 글만 쓴다. 자료 밖 간지를 쓰면 화면에 ⚠️로 표시한다.
// ════════════════════════════════
(function () {
  'use strict';

  const STORE_KEY = 'cheonun_report_last';
  const EL_LIST = ['목', '화', '토', '금', '수'];
  const EL_NAME = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };
  const POOL = 2; // 동시에 쓰는 장 수(무료 키 분당 한도 때문에 2개)

  let R = null; // 현재 리포트 상태

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(R)); } catch (e) { console.warn('리포트 저장 실패', e); }
  }

  // ── 확정 자료 만들기 ──
  function koreaToday() {
    const n = new Date(Date.now() + 9 * 3600000);
    return { y: n.getUTCFullYear(), m: n.getUTCMonth() + 1, d: n.getUTCDate() };
  }

  function buildData(info) {
    const saju = calcSaju(info.birth, info.hour, info.gender, info.calendar, info.isLeap);
    if (!saju) throw new Error('생년월일을 계산할 수 없어요. 날짜를 확인해 주세요.');
    const D = CheonunDeepSaju;
    const today = koreaToday();
    const daeunOf = age => { let cur = saju.daeunList[0]; saju.daeunList.forEach(d => { if (age >= d.startAge) cur = d; }); return age < saju.daeunList[0].startAge ? null : cur; };

    const daeun = saju.daeunList.map(d => Object.assign({ endAge: d.startAge + 9, fromYear: saju.year + d.startAge, current: d.pillar === saju.curDaeun },
      d, D.luckFacts(saju, d.pillar, `${d.startAge}~${d.startAge + 9}세 대운`)));

    const years = [];
    for (let k = 0; k < 10; k++) {
      const Y = saju.thisYear + k, gz = _gz(Y - 1984), age = Y - saju.year, du = daeunOf(age);
      years.push(Object.assign({ year: Y, gz, age, daeun: du ? du.pillar : '대운 전' }, D.luckFacts(saju, gz, `${Y}년 세운`)));
    }

    const months = [];
    for (let k = 0; k < 12; k++) {
      const dt = new Date(today.y, today.m - 1 + k, 15);
      const y = dt.getFullYear(), m = dt.getMonth() + 1, gz = _monthPillar(y, m, 15, '');
      months.push(Object.assign({ y, m, gz }, D.luckFacts(saju, gz, `${y}년 ${m}월 월운`)));
    }

    let ziwei = null, ziweiPrompt = '';
    if (info.hour && window.CheonunZiwei) {
      try { ziwei = CheonunZiwei.calculate(info); ziweiPrompt = CheonunZiwei.toPrompt(ziwei); }
      catch (e) { console.warn('자미두수 계산 실패:', e.message); }
    }

    // 글에 나와도 되는 간지(자료에 있는 것만)
    const allowed = new Set([saju.yp, saju.mp, saju.dp, saju.hp, ...daeun.map(d => d.pillar), ...years.map(y => y.gz), ...months.map(m => m.gz), saju.seun2026, saju.seun2027]);

    return {
      saju, today, daeun, years, months, ziweiPrompt,
      ziweiPalaces: ziwei ? ziwei.palaces.map(p => ({ name: p.name, sb: p.stemBranch, body: p.isBodyPalace, stars: p.majorStars.map(s => s.name + (s.mutagen ? '(' + s.mutagen + ')' : '')).join(' ') || '주성 없음', minor: p.minorStars.join(' '), range: p.decadalRange })) : null,
      ziweiSummary: ziwei ? { soul: ziwei.soulPalace, body: ziwei.bodyPalace, five: ziwei.fiveElementsClass } : null,
      chart: D.chartTable(saju),
      factsText: D.analyze(saju).text,
      allowed: [...allowed].filter(x => x && x !== '미상'),
    };
  }

  // ── 장(章) 구성 ──
  function chapters(info, data) {
    const P = info.tier === 'premium';
    const t = n => Math.round(n * (P ? 1.6 : 1.1) / 100) * 100;
    const cur = data.daeun.find(d => d.current) || data.daeun[0];
    const next = data.daeun[data.daeun.indexOf(cur) + 1];
    const list = [
      { key: 'intro', title: '들어가며', sub: '나의 사주 한눈에', len: t(1500), ask: '사주 전체를 처음 보는 사람에게 소개하듯, 일간과 태어난 계절, 오행의 큰 그림, 핵심 판단(강약·용신)을 쉽게 풀어 앞으로 읽을 내용의 길잡이가 되게 쓰십시오.' },
      { key: 'nature', title: '타고난 성향과 그릇', sub: '일간·격국으로 본 나', len: t(2500), ask: '일간의 성질, 격국, 십성 배치(특히 많은 것과 없는 것)를 근거로 성격의 장점과 약점, 사람들이 보는 나와 실제 속마음의 차이, 그릇의 크기를 구체적으로 쓰십시오.' },
      { key: 'balance', title: '오행의 균형과 나에게 맞는 기운', sub: '용신 활용법', len: t(2200), ask: '오행 개수와 용신·희신·기신 판단을 근거로, 부족하거나 넘치는 기운이 삶에서 어떻게 나타나는지, 그리고 용신을 생활에서 쓰는 법(색, 방향, 계절, 음식, 습관, 어울리는 사람)을 구체적으로 쓰십시오.' },
      { key: 'money', title: '재물운', sub: '돈이 들어오고 나가는 길', len: t(2500), ask: '재성의 유무와 위치, 식상과의 관계, 대운·세운의 재성 흐름을 근거로 돈 버는 방식, 모으는 힘, 조심할 지출과 투자 성향, 재물이 들어오는 시기를 구체적으로 쓰십시오.' },
      { key: 'career', title: '직업과 적성', sub: '일과 명예의 길', len: t(2500), ask: '관성·식상·인성의 배치와 격국을 근거로 맞는 일의 형태(조직/전문직/사업 등), 어울리는 분야 예시, 직장에서의 강점과 갈등 요인, 명예·승진·학업운의 흐름을 쓰십시오.' },
      { key: 'love', title: '애정운과 결혼운', sub: '인연의 모양', len: t(2500), ask: `배우자 자리(일지)와 ${info.gender === '여성' ? '관성' : '재성'}의 상태, 도화·합충을 근거로 연애 방식, 잘 맞는 상대의 기질, 결혼 생활에서 조심할 점, 인연이 강해지는 시기를 쓰십시오.` },
      { key: 'people', title: '대인관계와 가족', sub: '곁에 있는 사람들', len: t(2000), ask: '비겁·인성·식상 배치와 년주·월주(부모·형제 자리)를 근거로 친구·동료·가족과의 관계 패턴, 귀인과 조심할 사람의 특징을 쓰십시오.' },
      { key: 'health', title: '건강운', sub: '몸이 보내는 신호', len: t(2000), ask: '오행의 과다·부족과 조후를 근거로 약해지기 쉬운 장기와 증상, 건강을 지키는 생활 습관, 특히 조심할 해와 계절을 쓰십시오. 의학적 진단처럼 단정하지 말고 생활 관리 관점으로 쓰십시오.' },
      { key: 'daeun', title: '지금 지나고 있는 대운', sub: `${cur.startAge}세부터 ${cur.endAge}세까지`, len: t(2200),
        facts: [cur.text, next ? '다음 대운 — ' + next.text : ''].join('\n'),
        ask: '현재 대운이 원국·용신과 맞는지 어긋나는지 판단하고, 이 10년 동안 달라지는 것(일, 돈, 관계, 마음)과 대운 후반·다음 대운으로 넘어갈 때의 변화를 쓰십시오.' },
      { key: 'twoyears', title: '올해와 내년의 운세', sub: `${data.years[0].year}년 · ${data.years[1].year}년`, len: t(2500),
        facts: data.years.slice(0, 2).map(y => y.text).join('\n'),
        ask: '두 해 각각에 대해 세운이 원국·현재 대운과 만나 생기는 작용을 근거로 흐름, 좋은 점, 조심할 점, 특히 중요한 시기를 나누어 쓰십시오. 올해는 오늘 이후 남은 기간 중심으로 쓰십시오.' },
    ];

    if (P) {
      if (data.ziweiPrompt) {
        list.push({ key: 'ziwei', title: '자미두수로 본 타고난 기질', sub: '명궁과 신궁', len: 3600, facts: data.ziweiPrompt,
          ask: '자미두수 명반의 명궁·신궁·주성과 오행국을 근거로 타고난 기질과 인생의 큰 테마를 사주 풀이와 겹치지 않게, 사주와 서로 보완하는 시각으로 쓰십시오.' });
        list.push({ key: 'ziwei12a', title: '자미두수 12궁 풀이 (1)', sub: '명궁부터 재백궁까지', len: 3600, facts: data.ziweiPrompt,
          ask: '명궁, 형제궁, 부처궁, 자녀궁, 재백궁, 질액궁 여섯 궁을 순서대로, 궁마다 한 문단씩 그 궁에 있는 별을 근거로 쓰십시오. 문단 첫머리에 궁 이름을 자연스럽게 넣으십시오.' });
        list.push({ key: 'ziwei12b', title: '자미두수 12궁 풀이 (2)', sub: '천이궁부터 부모궁까지', len: 3600, facts: data.ziweiPrompt,
          ask: '천이궁, 노복궁(교우궁), 관록궁, 전택궁, 복덕궁, 부모궁 여섯 궁을 순서대로, 궁마다 한 문단씩 그 궁에 있는 별을 근거로 쓰십시오. 문단 첫머리에 궁 이름을 자연스럽게 넣으십시오.' });
      }
      for (let k = 0; k < 10; k += 2) {
        const ys = data.years.slice(k, k + 2);
        list.push({ key: 'years' + k, title: `${ys[0].year}년 · ${ys[1].year}년 운세`, sub: '10년 연운', len: 4000,
          facts: ys.map(y => `${y.text} / 그해 나이 ${y.age}세, 그해 대운 ${y.daeun}`).join('\n'),
          ask: '두 해를 각각 나누어, 해마다 전체 흐름·재물·일·애정·건강·조심할 점을 그해 세운 자료를 근거로 쓰십시오. 각 해의 첫 문단은 그해 연도로 시작하십시오.' });
      }
      for (let k = 0; k < 12; k += 4) {
        const ms = data.months.slice(k, k + 4);
        list.push({ key: 'months' + k, title: `${ms[0].m}월 ~ ${ms[3].m}월 운세`, sub: '12개월 월운', len: 3600,
          facts: ms.map(m => m.text).join('\n'),
          ask: '네 달을 순서대로, 달마다 한두 문단씩 그 달 월운 자료를 근거로 흐름과 할 일, 조심할 점을 쓰십시오. 각 문단은 "○월은"처럼 그 달로 시작하십시오.' });
      }
      list.push({ key: 'stages', title: '인생 시기별 흐름', sub: '초년 · 청년 · 중년 · 말년', len: 3600,
        facts: data.daeun.map(d => d.text).join('\n'),
        ask: '대운표 전체를 근거로 초년(0~19세), 청년(20~39세), 중년(40~59세), 말년(60세 이후)으로 나누어 시기마다 운의 성격과 주요 과제를 쓰십시오. 지나간 시기는 짧게 돌아보고, 지금과 앞으로의 시기를 더 자세히 쓰십시오.' });
      list.push({ key: 'match', title: '나와 잘 맞는 사람', sub: '인연과 협력의 궁합', len: 3000,
        ask: '일간·용신·희신과 일지(배우자 자리), 합충을 근거로 연인·배우자·친구·동업자로 잘 맞는 사람의 기질(일간 오행과 성향 위주)과 부딪히기 쉬운 사람의 특징, 관계를 오래 가게 하는 방법을 쓰십시오. 띠만으로 단정하지 마십시오.' });
      list.push({ key: 'moneyplan', title: '재물 관리와 투자 성향', sub: '모으고 지키는 법', len: 3000,
        facts: data.years.map(y => `${y.year}년 ${y.gz}(${y.stemGod}/${y.branchGod})`).join(', '),
        ask: '재성·식상·비겁의 구조와 10년 연운의 재성 흐름을 근거로 돈을 모으는 습관, 맞는 재테크 방식(안정형/공격형), 큰돈이 움직이기 좋은 해와 피해야 할 해, 보증·동업·충동 지출 같은 위험 요인을 구체적으로 쓰십시오. 특정 종목 추천은 하지 마십시오.' });
      list.push({ key: 'gaewoon', title: '개운법', sub: '운을 여는 생활 습관', len: 3000, ask: '용신·희신을 근거로 운을 좋게 하는 실천법(색, 방향, 장소, 시간대, 음식, 취미, 인간관계, 마음가짐)을 구체적이고 현실적으로 쓰십시오. 미신처럼 들리는 물건 구매 권유는 하지 마십시오.' });
      list.push({ key: 'topic', title: info.q ? '상담 질문 집중 풀이' : '앞으로의 큰 흐름', sub: info.q ? info.topic : '10년을 내다보며', len: 3600,
        facts: data.years.map(y => `${y.year}년 ${y.gz}(${y.stemGod}/${y.branchGod})`).join(', '),
        ask: info.q ? `내담자의 질문 "${info.q}"에 대해 원국·대운·연운을 근거로 결론과 시기, 구체적인 행동 방향을 깊이 있게 쓰십시오.` : '앞으로 10년 연운 흐름 전체를 이어서 보며 언제 오르고 언제 쉬어 가는지, 인생 계획을 어떻게 세우면 좋은지 쓰십시오.' });
    }
    list.push({ key: 'outro', title: '천운의 조언', sub: '마치며', len: t(1500), ask: '리포트 전체를 정리하며 가장 중요한 세 가지(타고난 강점, 조심할 흐름, 지금 할 일)를 따뜻하고 단단한 어조로 마무리하십시오. 추가 상담을 권하거나 질문을 유도하지 마십시오.' });
    return list;
  }

  // ── 프롬프트 ──
  function planPrompt(info, data) {
    return `당신은 40년 경력의 사주명리학 전문가입니다. 아래 확정 자료만 근거로 이 사주의 핵심 판단을 내리십시오. 자료에 없는 글자를 만들지 마십시오.

${data.saju.pillarsText}
${data.factsText}

판단 순서: 득령·득지·돕는 글자 수로 신강/신약/중화를 정하고, 태어난 계절로 조후를 본 뒤, 격국을 정하고, 억부와 조후를 함께 고려해 용신(가장 필요한 오행), 희신(용신을 돕는 오행), 기신(가장 부담되는 오행)을 정하십시오.
JSON 한 줄로만 답하십시오. 설명·코드블록 금지.
{"strength":"신강|신약|중화","johu":"조후 한 문장","gyeokguk":"격국 이름","yongsin":"목|화|토|금|수","huisin":"목|화|토|금|수","gisin":"목|화|토|금|수","reason":"판단 근거 3~4문장, 초보자도 이해할 쉬운 말"}`;
  }

  function sectionPrompt(info, data, ch) {
    const p = R.plan, s = data.saju, today = data.today;
    return `당신은 40년 경력의 사주명리학 상담가 천운입니다. 판매용 사주 리포트의 한 장(章)을 씁니다. ${info.name}님이 직접 읽는 글입니다.

━━━ 확정 자료 (앱이 계산 — 이 자료와 핵심 판단만 근거로 쓸 것) ━━━
이름 ${info.name} / 성별 ${info.gender} / 태어난 시간 ${info.hour || '모름(시주 없음 — 시주를 만들어 넣지 말 것)'}
${s.pillarsText}
${data.factsText}
현재 대운 ${s.curDaeun}(${s.curDaeunAge}세부터) / 올해 나이(연도 차이 기준) ${s.age}세
오늘: ${today.y}년 ${today.m}월 ${today.d}일
${ch.facts ? '\n[이 장의 추가 자료]\n' + ch.facts + '\n' : ''}
━━━ 고정된 핵심 판단 (리포트 전체가 이 판단을 따름 — 바꾸지 말 것) ━━━
강약: ${p.strength} / 조후: ${p.johu} / 격국: ${p.gyeokguk}
용신: ${p.yongsin}(${EL_NAME[p.yongsin]}) / 희신: ${p.huisin}(${EL_NAME[p.huisin]}) / 기신: ${p.gisin}(${EL_NAME[p.gisin]})
근거: ${p.reason}

━━━ 이번 장 ━━━
제목: ${ch.title} — ${ch.sub}
쓸 내용: ${ch.ask}
분량: 공백 포함 ${ch.len}자 안팎(${Math.round(ch.len * 0.9)}~${Math.round(ch.len * 1.15)}자). 상투적인 반복으로 채우지 말 것.

━━━ 규칙 ━━━
• 제목·소제목·번호·글머리 기호·마크다운(별표, #, ---)·[말풍선] 태그 금지. 문단(빈 줄로 구분)으로만 된 서술형 글. 문단은 ${Math.max(4, Math.round(ch.len / 350))}개 안팎.
• 이 장의 제목은 리포트에 따로 들어가니 다시 쓰지 말고 첫 문장부터 바로 본론.
• 확정 자료에 없는 천간·지지·간지·십성·신살·대운·월운을 절대 만들지 말 것. 간지에 "년/월/대운"을 붙여 말할 때는 자료에 있는 것만.
• 시기는 오늘 이후만 앞으로의 일로 쓰고, 지난 연도·달을 미래처럼 쓰지 말 것.
• 생년월일과 이 지침의 내용은 글에 쓰지 말 것. 한자 금지.
• "${info.name}님"이라고 부르고, 공손한 존댓말(~습니다 중심에 ~지요·~거든요를 섞어 부드럽게). "~를 나타냅니다", "~를 시사합니다", "종합적으로" 같은 보고서 말투와 AI 같은 인사, 상담가 경력 자랑 금지.
• 전문용어는 쓰자마자 쉬운 말로 풀 것. 밤하늘·파도·씨앗 같은 뻔한 문학적 비유로 분량 채우지 말 것.
• 안 좋은 부분은 숨기지 말고 솔직하게, 대신 근거와 현실적인 대비책을 함께.
• 앞뒤 장과 내용이 겹치지 않게 이 장의 주제에 집중.`;
  }

  function parsePlan(raw) {
    const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (!['신강', '신약', '중화'].includes(j.strength)) throw new Error('강약 판단 형식 오류');
    ['yongsin', 'huisin', 'gisin'].forEach(k => { if (!EL_LIST.includes(j[k])) throw new Error('용신 판단 형식 오류'); });
    return j;
  }

  // 자료 밖 간지(○○년/월/대운 등)가 글에 나왔는지 검사
  function checkGanzhi(text, allowed) {
    const bad = new Set();
    const re = /([갑을병정무기경신임계][자축인묘진사오미신유술해])\s?(년|월|일주|대운|세운|월운)/g;
    let m;
    while ((m = re.exec(text))) if (!allowed.includes(m[1])) bad.add(m[1] + m[2]);
    return [...bad];
  }

  // ── 화면 ──
  function readForm() {
    return {
      name: $('rName').value.trim() || '고객',
      gender: $('rGender').value,
      calendar: $('rLunar').value,
      isLeap: $('rLeap').checked,
      birth: $('rBirth').value,
      hour: $('rHour').value,
      topic: $('rTopic').value,
      q: $('rQ').value.trim(),
      tier: document.querySelector('#rTier .sp-btn.on').dataset.v,
      theme: $('rTheme').value === 'auto' ? ($('rGender').value === '남성' ? 'male' : 'female') : $('rTheme').value,
    };
  }

  function setBusy(on, label) {
    ['rPlanBtn', 'rWriteBtn'].forEach(id => { if ($(id)) $(id).disabled = on; });
    $('rStatus').innerHTML = on ? `<div class="loading"><div class="dot-spin"><span></span><span></span><span></span></div>${esc(label)}</div>` : '';
  }

  window.setReportTier = function (el) {
    document.querySelectorAll('#rTier .sp-btn').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
  };
  window.toggleReportLeap = function () { $('rLeapWrap').style.display = $('rLunar').value === '음력' ? 'flex' : 'none'; };

  // ① 명식 계산 + 핵심 판단
  window.reportPlan = async function () {
    const info = readForm();
    if (!info.birth) { snack('생년월일을 입력해주세요.'); return; }
    let data;
    try { data = buildData(info); } catch (e) { snack(e.message); return; }
    R = { info, data, plan: null, chapters: chapters(info, data), texts: {}, warn: {}, createdAt: new Date().toISOString() };
    setBusy(true, '명식을 계산하고 핵심 판단을 내리는 중...');
    let plan = null, err = '';
    for (let i = 0; i < 2 && !plan; i++) {
      try { plan = parsePlan(await ai(planPrompt(info, data), 1024)); } catch (e) { err = e.message; }
    }
    setBusy(false);
    if (!plan) { $('rStatus').innerHTML = `<p style="color:var(--red);font-size:.8rem">핵심 판단을 받지 못했어요(${esc(err)}). 다시 눌러 주세요.</p>`; return; }
    R.plan = plan;
    saveState();
    renderPlanCard();
    renderDoc();
  };

  function elSelect(id, v) {
    return `<select id="${id}">${EL_LIST.map(e => `<option value="${e}"${e === v ? ' selected' : ''}>${e}(${EL_NAME[e]})</option>`).join('')}</select>`;
  }

  function renderPlanCard() {
    const p = R.plan;
    const n = R.chapters.length;
    $('rPlan').innerHTML = `
      <div class="card">
        <div class="card-title">🧭 핵심 판단 확인 — 리포트 전체가 이 판단을 따릅니다</div>
        <p style="font-size:.75rem;color:var(--muted);line-height:1.7;margin-bottom:10px">AI가 확정 자료로 내린 판단이에요. 상담사님 판단과 다르면 고친 뒤 리포트 쓰기를 누르세요.</p>
        <div class="row2">
          <div class="field"><label>강약</label><select id="pStrength">${['신강', '신약', '중화'].map(x => `<option${x === p.strength ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
          <div class="field"><label>격국</label><input id="pGyeok" value="${esc(p.gyeokguk)}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>용신</label>${elSelect('pYong', p.yongsin)}</div>
          <div class="field"><label>희신</label>${elSelect('pHui', p.huisin)}</div>
        </div>
        <div class="row2">
          <div class="field"><label>기신</label>${elSelect('pGi', p.gisin)}</div>
          <div class="field"><label>조후</label><input id="pJohu" value="${esc(p.johu)}"></div>
        </div>
        <div class="field"><label>판단 근거</label><textarea id="pReason">${esc(p.reason)}</textarea></div>
        <button class="btn btn-gold" id="rWriteBtn" onclick="reportWriteAll()">✍️ 리포트 쓰기 시작 (${n}개 장${R.info.tier === 'premium' ? ', 3~6분' : ', 1~3분'})</button>
      </div>`;
  }

  function readPlan() {
    R.plan = {
      strength: $('pStrength').value, gyeokguk: $('pGyeok').value.trim(), yongsin: $('pYong').value,
      huisin: $('pHui').value, gisin: $('pGi').value, johu: $('pJohu').value.trim(), reason: $('pReason').value.trim(),
    };
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 무료 키 분당 한도(429)에 걸리면 기다렸다가 다시 시도한다(최대 5번, 20·40·60·80초).
  async function aiRetry(prompt) {
    for (let i = 0; ; i++) {
      try {
        const t = await ai(prompt, 12000);
        if (t && t.trim()) return t.replace(/\[말풍선\]/g, '').replace(/\*\*|^#+\s*/gm, '').trim();
        throw new Error('빈 응답');
      } catch (e) {
        if (i >= 4) throw e;
        await sleep(/할당량|429|일시 장애|빈 응답/.test(e.message) ? 20000 * (i + 1) : 3000);
      }
    }
  }

  async function writeChapter(ch) {
    const prompt = sectionPrompt(R.info, R.data, ch);
    let txt = await aiRetry(prompt);
    let bad = checkGanzhi(txt, R.data.allowed);
    // 자료 밖 간지가 나오면 한 번 다시 쓰고, 더 나은 쪽을 남긴다
    if (bad.length) {
      try {
        const again = await aiRetry(prompt + `\n• 주의: 이전 원고에 자료에 없는 "${bad.join(', ')}"를 썼습니다. 확정 자료에 있는 간지만 쓰십시오.`);
        const bad2 = checkGanzhi(again, R.data.allowed);
        if (bad2.length < bad.length) { txt = again; bad = bad2; }
      } catch (e) { /* 첫 원고 유지 */ }
    }
    R.texts[ch.key] = txt;
    R.warn[ch.key] = bad;
    saveState();
    renderChapterBody(ch);
  }

  // ② 장별 집필 (동시에 POOL개씩)
  window.reportWriteAll = async function () {
    if (!R || !R.plan) return;
    readPlan();
    saveState();
    renderDoc();
    const todo = R.chapters.filter(c => !R.texts[c.key]);
    let done = R.chapters.length - todo.length, failed = 0;
    const total = R.chapters.length;
    setBusy(true, `리포트 쓰는 중... ${done}/${total}`);
    const queue = [...todo];
    async function worker() {
      while (queue.length) {
        const ch = queue.shift();
        try { await writeChapter(ch); } catch (e) { failed++; R.texts[ch.key] = ''; renderChapterBody(ch, e.message); }
        done++;
        $('rStatus').innerHTML = `<div class="loading"><div class="dot-spin"><span></span><span></span><span></span></div>리포트 쓰는 중... ${done}/${total}</div>`;
      }
    }
    await Promise.all(Array.from({ length: POOL }, worker));
    setBusy(false);
    updateSummary(R.chapters.filter(c => !R.texts[c.key]).length);
  };

  window.reportRewrite = async function (key) {
    const ch = R.chapters.find(c => c.key === key);
    const body = $('rb_' + key);
    body.innerHTML = '<p class="rp-wait">다시 쓰는 중...</p>';
    try { await writeChapter(ch); } catch (e) { renderChapterBody(ch, e.message); }
    updateSummary(R.chapters.filter(c => !R.texts[c.key]).length);
  };

  // 화면에서 고친 글을 상태에 반영
  window.reportEdited = function (key) {
    const body = $('rb_' + key);
    R.texts[key] = [...body.querySelectorAll('p')].map(p => p.innerText.trim()).filter(Boolean).join('\n\n');
    R.warn[key] = checkGanzhi(R.texts[key], R.data.allowed);
    saveState();
  };

  function updateSummary(failed) {
    const chars = Object.values(R.texts).reduce((a, t) => a + (t ? t.length : 0), 0);
    const warns = R.chapters.filter(c => (R.warn[c.key] || []).length);
    const pages = estimatePages();
    $('rStatus').innerHTML = `
      <div class="card">
        <div class="card-title">📊 리포트 상태</div>
        <p style="font-size:.8rem;line-height:1.8">본문 ${chars.toLocaleString()}자 · 예상 약 <b style="color:var(--gold2)">${pages}쪽</b> (A4)</p>
        ${failed ? `<p style="font-size:.8rem;color:var(--red);margin-bottom:8px">아직 못 쓴 장 ${failed}개 (AI 사용량 한도) — 1~2분 뒤 아래 버튼을 눌러 주세요.</p><button class="btn btn-ghost" onclick="reportWriteAll()" style="margin-bottom:8px">✍️ 못 쓴 장만 이어 쓰기</button>` : ''}
        ${warns.length ? `<p style="font-size:.78rem;color:var(--red);line-height:1.7">⚠️ 자료에 없는 간지가 나온 장: ${warns.map(c => esc(c.title) + '(' + R.warn[c.key].join(', ') + ')').join(' / ')} — 고치거나 다시 쓰기 하세요.</p>` : '<p style="font-size:.76rem;color:var(--muted)">✓ 자료 밖 간지 없음</p>'}
        <button class="btn btn-gold" onclick="reportPrint()" style="margin-top:8px">📕 PDF로 저장</button>
        <p style="font-size:.72rem;color:var(--muted);margin-top:8px;line-height:1.7">인쇄 창에서 대상 "PDF로 저장", 용지 A4, 여백 "기본값", <b>배경 그래픽 체크</b>를 확인하세요.</p>
      </div>`;
  }

  // A4 본문 높이 기준으로 장마다 쪽수를 어림한다(각 장은 새 쪽에서 시작).
  function estimatePages() {
    const doc = $('reportDoc');
    const pageH = (297 - 36) * 3.7795; // 위아래 여백 18mm
    let pages = 1; // 표지
    doc.querySelectorAll('.rp-sheet').forEach(s => {
      const first = s.firstElementChild, last = s.lastElementChild;
      const h = last.offsetTop + last.offsetHeight - first.offsetTop;
      pages += Math.max(1, Math.ceil(h / pageH));
    });
    return pages;
  }

  // ── 리포트 문서 ──
  const EL_COLOR = { 목: '#3f7d4e', 화: '#c0443b', 토: '#b0812f', 금: '#7d8590', 수: '#2d4a7a' };

  function chartHtml() {
    const c = R.data.chart;
    const cell = (ch, el) => `<div class="rp-gz" style="background:${EL_COLOR[el]}">${ch}<small>${el}</small></div>`;
    return `<table class="rp-table rp-chart">
      <tr><th></th>${c.rows.map(r => `<th>${r.label}</th>`).join('')}</tr>
      <tr><td class="rp-rowh">십성</td>${c.rows.map(r => `<td>${r.missing ? '' : r.stemGod}</td>`).join('')}</tr>
      <tr><td class="rp-rowh">천간</td>${c.rows.map(r => `<td>${r.missing ? '<div class="rp-gz rp-none">?</div>' : cell(r.stem, r.stemEl)}</td>`).join('')}</tr>
      <tr><td class="rp-rowh">지지</td>${c.rows.map(r => `<td>${r.missing ? '<div class="rp-gz rp-none">?</div>' : cell(r.branch, r.branchEl)}</td>`).join('')}</tr>
      <tr><td class="rp-rowh">십성</td>${c.rows.map(r => `<td>${r.missing ? '' : r.branchGod}</td>`).join('')}</tr>
      <tr><td class="rp-rowh">십이운성</td>${c.rows.map(r => `<td>${r.missing ? '' : r.stage}</td>`).join('')}</tr>
      <tr><td class="rp-rowh">지장간</td>${c.rows.map(r => `<td>${r.missing ? '시간 모름' : r.jijanggan}</td>`).join('')}</tr>
    </table>`;
  }

  function elementBars() {
    const c = R.data.chart.count, max = Math.max(...Object.values(c), 1), p = R.plan;
    const tag = e => e === p.yongsin ? '<em>용신</em>' : e === p.huisin ? '<em>희신</em>' : e === p.gisin ? '<em class="g">기신</em>' : '';
    return `<div class="rp-bars">${EL_LIST.map(e => `
      <div class="rp-bar"><span class="rp-bar-l">${e}(${EL_NAME[e]})</span>
        <span class="rp-bar-t"><span style="width:${c[e] / max * 100}%;background:${EL_COLOR[e]}"></span></span>
        <span class="rp-bar-n">${c[e]}</span>${tag(e)}</div>`).join('')}</div>`;
  }

  function factLines() {
    return R.data.factsText.split('\n').filter(l => /^(원국 안의|신살|강약 판단|태어난 계절)/.test(l)).map(l => `<li>${esc(l)}</li>`).join('');
  }

  function renderDoc() {
    const { info, data } = R, p = R.plan, s = data.saju, P = info.tier === 'premium';
    const doc = $('reportDoc');
    doc.className = 'rp-doc rp-' + info.theme + (P ? ' rp-premium' : '');
    const dateStr = `${data.today.y}. ${data.today.m}. ${data.today.d}.`;
    const birthStr = `${info.calendar} ${info.birth.replace(/-/g, '. ')}.${info.isLeap ? ' (윤달)' : ''}${info.calendar === '음력' ? ` → 양력 ${s.solarBirth.replace(/-/g, '. ')}.` : ''}`;

    let html = `
      <section class="rp-cover">
        <div class="rp-cover-in">
          <div class="rp-cover-mark">${info.theme === 'female' ? '✿' : '☯'}</div>
          <div class="rp-cover-kicker">${P ? 'PREMIUM SAJU REPORT' : 'SAJU REPORT'}</div>
          <h1>${esc(info.name)}님의<br>${P ? '평생 사주 리포트' : '사주 리포트'}</h1>
          <div class="rp-cover-line"></div>
          <div class="rp-cover-pillars">${[s.hp, s.dp, s.mp, s.yp].map(x => `<span>${x === '미상' ? '··' : x}</span>`).join('')}</div>
          <div class="rp-cover-foot">천운 사주연구소 · ${dateStr}</div>
        </div>
      </section>

      <section class="rp-sheet">
        <h2 class="rp-h2">차례</h2>
        <ol class="rp-toc">
          <li>사주 명식과 핵심 판단</li>
          ${R.chapters.map(c => `<li>${esc(c.title)} <span>${esc(c.sub)}</span></li>`).join('')}
          ${P ? '<li>부록 — 대운표 · 10년 연운표 · 12개월 월운표</li>' : '<li>부록 — 대운표</li>'}
        </ol>
        <div class="rp-note">이 리포트의 간지·십성·대운·연운·월운은 만세력 계산 엔진으로 산출했고, 풀이는 그 자료를 근거로 작성했습니다.${info.hour ? '' : ' 태어난 시간을 알 수 없어 시주를 제외한 여섯 글자로 풀이했습니다.'}</div>
      </section>

      <section class="rp-sheet">
        <div class="rp-chap">사주 명식과 핵심 판단</div>
        <h2 class="rp-h2">${esc(info.name)}님의 사주 명식</h2>
        <table class="rp-table rp-info">
          <tr><th>이름</th><td>${esc(info.name)}</td><th>성별</th><td>${info.gender}</td></tr>
          <tr><th>생년월일</th><td colspan="3">${esc(birthStr)}</td></tr>
          <tr><th>태어난 시</th><td>${info.hour || '모름'}</td><th>일간</th><td>${s.ilgan} (${EL_NAME[CheonunDeepSaju.chartTable(s).rows[1].stemEl]})</td></tr>
          <tr><th>현재 대운</th><td>${s.curDaeun} (${s.curDaeunAge}세~)</td><th>올해 세운</th><td>${s.seun2026}</td></tr>
        </table>
        ${chartHtml()}
        <h3 class="rp-h3">오행 분포</h3>
        ${p ? elementBars() : ''}
        ${p ? `<h3 class="rp-h3">핵심 판단</h3>
        <table class="rp-table rp-info">
          <tr><th>강약</th><td>${esc(p.strength)}</td><th>격국</th><td>${esc(p.gyeokguk)}</td></tr>
          <tr><th>용신</th><td>${p.yongsin}(${EL_NAME[p.yongsin]})</td><th>희신</th><td>${p.huisin}(${EL_NAME[p.huisin]})</td></tr>
          <tr><th>기신</th><td>${p.gisin}(${EL_NAME[p.gisin]})</td><th>조후</th><td>${esc(p.johu)}</td></tr>
        </table>
        <p class="rp-reason">${esc(p.reason)}</p>` : ''}
        <h3 class="rp-h3">합충과 신살</h3>
        <ul class="rp-facts">${factLines()}</ul>
      </section>`;

    R.chapters.forEach((c, i) => {
      html += `<section class="rp-sheet" id="rs_${c.key}">
        <div class="rp-chap">CHAPTER ${String(i + 1).padStart(2, '0')}</div>
        <h2 class="rp-h2">${esc(c.title)}</h2>
        <div class="rp-sub">${esc(c.sub)}</div>
        <div class="rp-tools rp-noprint"><button onclick="reportRewrite('${c.key}')">🔄 이 장 다시 쓰기</button><span id="rw_${c.key}"></span></div>
        <div class="rp-body" id="rb_${c.key}" contenteditable="true" spellcheck="false" oninput="reportEdited('${c.key}')"></div>
      </section>`;
    });

    html += `<section class="rp-sheet">
        <div class="rp-chap">APPENDIX</div>
        <h2 class="rp-h2">대운표</h2>
        <table class="rp-table rp-luck"><tr><th>나이</th><th>대운</th><th>천간</th><th>지지</th><th>십이운성</th></tr>
          ${data.daeun.map(d => `<tr${d.current ? ' class="on"' : ''}><td>${d.startAge}~${d.endAge}세</td><td><b>${d.pillar}</b></td><td>${d.stemGod}</td><td>${d.branchGod}</td><td>${d.stage}</td></tr>`).join('')}
        </table>
        ${P ? `<h3 class="rp-h3">10년 연운표</h3>
        <table class="rp-table rp-luck"><tr><th>연도</th><th>나이</th><th>세운</th><th>천간</th><th>지지</th><th>대운</th></tr>
          ${data.years.map(y => `<tr><td>${y.year}</td><td>${y.age}세</td><td><b>${y.gz}</b></td><td>${y.stemGod}</td><td>${y.branchGod}</td><td>${y.daeun}</td></tr>`).join('')}
        </table>
        <h3 class="rp-h3">12개월 월운표</h3>
        <table class="rp-table rp-luck"><tr><th>월</th><th>월운</th><th>천간</th><th>지지</th><th>십이운성</th></tr>
          ${data.months.map(m => `<tr><td>${m.y}. ${m.m}월</td><td><b>${m.gz}</b></td><td>${m.stemGod}</td><td>${m.branchGod}</td><td>${m.stage}</td></tr>`).join('')}
        </table>
        <p class="rp-note">월운은 매달 초 절기(절입일)부터 다음 달 절기 전까지 적용됩니다.</p>` : ''}
        ${P && data.ziweiPalaces ? `<h3 class="rp-h3">자미두수 명반 (명궁 ${data.ziweiSummary.soul} · 신궁 ${data.ziweiSummary.body} · ${data.ziweiSummary.five})</h3>
        <table class="rp-table rp-luck"><tr><th>궁</th><th>간지</th><th>주성</th><th>보조성</th><th>대한</th></tr>
          ${data.ziweiPalaces.map(z => `<tr><td>${z.name}${z.body ? ' (신궁)' : ''}</td><td>${z.sb}</td><td>${esc(z.stars)}</td><td>${esc(z.minor)}</td><td>${z.range}</td></tr>`).join('')}
        </table>` : ''}
        <div class="rp-end">${info.theme === 'female' ? '✿' : '☯'} 천운 사주연구소</div>
      </section>`;

    doc.innerHTML = html;
    R.chapters.forEach(c => renderChapterBody(c));
    $('rDocWrap').style.display = 'block';
  }

  function renderChapterBody(ch, err) {
    const body = $('rb_' + ch.key);
    if (!body) return;
    const t = R.texts[ch.key];
    if (err) body.innerHTML = `<p class="rp-wait" style="color:#c0443b">쓰기 실패: ${esc(err)} — 다시 쓰기를 눌러 주세요.</p>`;
    else if (!t) body.innerHTML = '<p class="rp-wait">아직 쓰지 않은 장입니다.</p>';
    else body.innerHTML = t.split(/\n\s*\n/).map(x => `<p>${esc(x.trim()).replace(/\n/g, '<br>')}</p>`).join('');
    const w = $('rw_' + ch.key);
    if (w) {
      const bad = R.warn[ch.key] || [];
      w.innerHTML = t ? `${t.length.toLocaleString()}자 / 목표 ${ch.len.toLocaleString()}자${bad.length ? ` <b style="color:#c0443b">⚠️ 자료 밖 간지: ${esc(bad.join(', '))}</b>` : ''}` : '';
    }
  }

  window.reportPrint = function () {
    document.body.classList.add('report-printing');
    const done = () => { document.body.classList.remove('report-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    const prevTitle = document.title;
    document.title = `${R.info.name}님_${R.info.tier === 'premium' ? '프리미엄' : '기본'}_사주리포트`;
    window.print();
    document.title = prevTitle;
  };

  window.reportRestore = function () {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { /* 무시 */ }
    if (!saved || !saved.plan) { snack('저장된 리포트가 없어요.'); return; }
    R = saved;
    const i = R.info;
    $('rName').value = i.name; $('rGender').value = i.gender; $('rLunar').value = i.calendar; $('rLeap').checked = i.isLeap;
    toggleReportLeap(); $('rBirth').value = i.birth; $('rHour').value = i.hour; $('rTopic').value = i.topic; $('rQ').value = i.q;
    document.querySelectorAll('#rTier .sp-btn').forEach(b => b.classList.toggle('on', b.dataset.v === i.tier));
    renderPlanCard();
    renderDoc();
    updateSummary(R.chapters.filter(c => !R.texts[c.key]).length);
    snack(`${i.name}님 리포트를 불러왔어요 ✓`);
  };

  // 상담 탭에 입력한 내담자를 그대로 가져오기
  window.reportFromConsulting = function () {
    $('rName').value = $('cName').value; $('rGender').value = $('cGender').value; $('rLunar').value = $('cLunar').value;
    $('rLeap').checked = $('cLeap').checked; toggleReportLeap(); $('rBirth').value = $('cBirth').value;
    $('rHour').value = $('cHour').value; $('rTopic').value = $('cTopic').value; $('rQ').value = $('cQ').value;
    snack('상담 탭 정보를 가져왔어요 ✓');
  };

  window.CheonunReport = { checkGanzhi, parsePlan };
})();
