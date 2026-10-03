// ════════════════════════════════
// 📖 심층 사주풀이 — 상담 탭의 세 번째 상담 방식
// 2026-10: 외부에서 받은 "사주/운세 완벽 분석기 마스터 프롬프트"를 이 앱에 맞게 정리해 넣은 것.
// 원본 프롬프트는 십성·지장간·십이운성·합충·신살을 AI가 직접 뽑게 되어 있어 환각 위험이 컸다.
// 그래서 그 자료는 모두 여기서 코드로 계산해 "확정 자료"로 넘기고, AI는 해석(강약·용신·서술)만 하게 한다.
// 계산 함수는 브라우저/노드 공용(tests/deep-saju.test.js).
// ════════════════════════════════
(function (root) {
  'use strict';

  const S = ['갑','을','병','정','무','기','경','신','임','계'];
  const B = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
  const S_EL = ['목','목','화','화','토','토','금','금','수','수'];
  const B_EL = ['수','토','목','목','토','화','화','토','금','금','토','수'];
  const EL = ['목','화','토','금','수'];
  // 지장간(여기·중기·정기 순, 마지막이 정기). 지지 십성은 정기 기준.
  const JIJANGGAN = {
    자:['임','계'], 축:['계','신','기'], 인:['무','병','갑'], 묘:['갑','을'],
    진:['을','계','무'], 사:['무','경','병'], 오:['병','기','정'], 미:['정','을','기'],
    신:['무','임','경'], 유:['경','신'], 술:['신','정','무'], 해:['무','갑','임']
  };
  const TWELVE = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
  const JANGSAENG = { 갑:'해', 병:'인', 무:'인', 경:'사', 임:'신', 을:'오', 정:'유', 기:'유', 신:'자', 계:'묘' };

  const STEM_HAP = { 갑기:'토', 을경:'금', 병신:'수', 정임:'목', 무계:'화' };
  const STEM_CHUNG = ['갑경','을신','병임','정계'];
  const YUKHAP = { 자축:'토', 인해:'목', 묘술:'화', 진유:'금', 사신:'수', 오미:'화' };
  const CHUNG = ['자오','축미','인신','묘유','진술','사해'];
  const HYEONG = ['인사','사신','인신','축술','술미','축미','자묘'];
  const PA = ['자유','축진','인해','묘오','사신','술미'];
  const HAE = ['자미','축오','인사','묘진','신해','유술'];
  const SAMHAP = [['신','자','진','수'], ['해','묘','미','목'], ['인','오','술','화'], ['사','유','축','금']];
  const SEASON = { 인:'봄',묘:'봄',진:'늦봄', 사:'여름',오:'여름',미:'늦여름', 신:'가을',유:'가을',술:'늦가을', 해:'겨울',자:'겨울',축:'늦겨울' };

  const stemEl = s => S_EL[S.indexOf(s)];
  const branchEl = b => B_EL[B.indexOf(b)];
  const yang = s => S.indexOf(s) % 2 === 0;
  const has = (list, a, b) => list.includes(a + b) || list.includes(b + a);
  const keyOf = (map, a, b) => map[a + b] || map[b + a];

  function tenGod(dayStem, stem) {
    const me = EL.indexOf(stemEl(dayStem)), it = EL.indexOf(stemEl(stem));
    const same = yang(dayStem) === yang(stem);
    const rel = (it - me + 5) % 5; // 0 같음, 1 내가 생, 2 내가 극, 3 나를 극, 4 나를 생
    return [['비견','겁재'], ['식신','상관'], ['편재','정재'], ['편관','정관'], ['편인','정인']][rel][same ? 0 : 1];
  }

  function twelveStage(dayStem, branch) {
    const start = B.indexOf(JANGSAENG[dayStem]);
    const dir = yang(dayStem) ? 1 : -1;
    const steps = ((B.indexOf(branch) - start) * dir + 24) % 12;
    return TWELVE[steps];
  }

  function gongmang(dayPillar) {
    let idx = 0;
    for (let i = 0; i < 60; i++) if (S[i % 10] + B[i % 12] === dayPillar) { idx = i; break; }
    const start = (idx - idx % 10) % 12;
    return [B[(start + 10) % 12], B[(start + 11) % 12]];
  }

  // 두 글자 묶음 사이의 합·충·형·파·해(천간/지지)
  function relations(a, b) {
    const out = [];
    if (a.stem && b.stem) {
      const hap = keyOf(STEM_HAP, a.stem, b.stem);
      if (hap) out.push(`${a.label} 천간 ${a.stem}과 ${b.label} 천간 ${b.stem}이 합(${hap})`);
      if (has(STEM_CHUNG, a.stem, b.stem)) out.push(`${a.label} 천간 ${a.stem}과 ${b.label} 천간 ${b.stem}이 충`);
    }
    if (a.branch && b.branch) {
      const x = a.branch, y = b.branch, pair = `${a.label} 지지 ${x}와 ${b.label} 지지 ${y}`;
      const hap = keyOf(YUKHAP, x, y);
      if (hap) out.push(`${pair}가 육합(${hap})`);
      if (has(CHUNG, x, y)) out.push(`${pair}가 충`);
      if (has(HYEONG, x, y)) out.push(`${pair}가 형`);
      if (x === y && ['진','오','유','해'].includes(x)) out.push(`${pair}가 자형`);
      if (has(PA, x, y)) out.push(`${pair}가 파`);
      if (has(HAE, x, y)) out.push(`${pair}가 해`);
    }
    return out;
  }

  function samhap(branches, label) {
    const out = [];
    for (const [p, c, d, el] of SAMHAP) {
      const got = [p, c, d].filter(x => branches.includes(x));
      if (got.length === 3) out.push(`${label}: ${p}${c}${d} 삼합(${el})이 완성`);
      else if (got.length === 2 && got.includes(c)) out.push(`${label}: ${got.join('')} 반합(${el} 기운)`);
    }
    return out;
  }

  function sinsal(baseBranch, baseLabel, targets) {
    const group = SAMHAP.find(g => g.slice(0, 3).includes(baseBranch));
    const table = {
      도화: { 수:'유', 목:'자', 화:'묘', 금:'오' },
      역마: { 수:'인', 목:'사', 화:'신', 금:'해' },
      화개: { 수:'진', 목:'미', 화:'술', 금:'축' },
    };
    const out = [];
    for (const [name, map] of Object.entries(table)) {
      const b = map[group[3]];
      const hits = targets.filter(t => t.branch === b).map(t => t.label);
      if (hits.length) out.push(`${baseLabel}(${baseBranch}) 기준 ${name}살(${b}): ${hits.join('·')}에 있음`);
    }
    return out;
  }

  function analyze(saju) {
    const hasHour = saju.hp && saju.hp !== '미상';
    const day = saju.dp[0];
    const pillars = [
      { label:'년주', stem:saju.yp[0], branch:saju.yp[1] },
      { label:'월주', stem:saju.mp[0], branch:saju.mp[1] },
      { label:'일주', stem:saju.dp[0], branch:saju.dp[1] },
    ];
    if (hasHour) pillars.push({ label:'시주', stem:saju.hp[0], branch:saju.hp[1] });

    const pillarLines = pillars.map(p => {
      const stemGod = p.label === '일주' ? '일간(본인)' : tenGod(day, p.stem);
      const jj = JIJANGGAN[p.branch];
      return `${p.label} ${p.stem}${p.branch}: 천간 ${p.stem}(${stemEl(p.stem)}, ${stemGod}) / 지지 ${p.branch}(${branchEl(p.branch)}, ${tenGod(day, jj[jj.length - 1])}, 십이운성 ${twelveStage(day, p.branch)}) / 지장간 ${jj.map(s => s + '(' + tenGod(day, s) + ')').join('·')}`;
    });

    const count = { 목:0, 화:0, 토:0, 금:0, 수:0 };
    pillars.forEach(p => { count[stemEl(p.stem)]++; count[branchEl(p.branch)]++; });

    // 신강/신약 판단 재료: 나를 돕는 글자(비겁·인성) 수와 득령·득지
    const helps = el => { const r = (EL.indexOf(el) - EL.indexOf(stemEl(day)) + 5) % 5; return r === 0 || r === 4; };
    let helpCnt = 0, total = 0;
    pillars.forEach(p => {
      if (p.label !== '일주') { total++; if (helps(stemEl(p.stem))) helpCnt++; }
      total++; if (helps(branchEl(p.branch))) helpCnt++;
    });

    const inner = [];
    for (let i = 0; i < pillars.length; i++)
      for (let j = i + 1; j < pillars.length; j++) inner.push(...relations(pillars[i], pillars[j]));
    inner.push(...samhap(pillars.map(p => p.branch), '원국'));

    const luck = (label, gz) => ({ label, stem: gz[0], branch: gz[1] });
    const dae = luck('현재 대운', saju.curDaeun);
    const se1 = luck(`${saju.thisYear}년 세운`, saju.seun2026);
    const se2 = luck(`${saju.nextYear}년 세운`, saju.seun2027);
    const luckLines = [];
    for (const l of [dae, se1, se2]) {
      luckLines.push(`${l.label} ${l.stem}${l.branch}: 천간 ${tenGod(day, l.stem)} / 지지 ${tenGod(day, JIJANGGAN[l.branch].slice(-1)[0])}, 십이운성 ${twelveStage(day, l.branch)}`);
      pillars.forEach(p => luckLines.push(...relations(l, p)));
      luckLines.push(...samhap([...pillars.map(p => p.branch), l.branch], `${l.label} 포함`).filter(t => !inner.includes(t.replace(`${l.label} 포함`, '원국'))));
    }
    luckLines.push(...relations(dae, se1), ...relations(dae, se2));

    const targets = [...pillars, dae, se1, se2];
    const sal = [
      ...sinsal(saju.yp[1], '년지', targets.filter(t => t.label !== '년주')),
      ...sinsal(saju.dp[1], '일지', targets.filter(t => t.label !== '일주')),
    ];
    const GWIIN = { 갑:'축미', 무:'축미', 경:'축미', 을:'자신', 기:'자신', 병:'해유', 정:'해유', 임:'사묘', 계:'사묘', 신:'인오' };
    const gwiin = targets.filter(t => t.label !== '일주' && GWIIN[day].includes(t.branch)).map(t => t.label);
    if (gwiin.length) sal.push(`천을귀인(일간 ${day} 기준 ${GWIIN[day].split('').join('·')}): ${gwiin.join('·')}에 있음`);
    const gm = gongmang(saju.dp);
    const gmHits = targets.filter(t => t.label !== '일주' && gm.includes(t.branch)).map(t => t.label);
    sal.push(`공망(일주 기준 ${gm.join('·')}): ${gmHits.length ? gmHits.join('·') + '에 해당' : '해당 글자 없음'}`);

    const monthB = saju.mp[1];
    const daeunFlow = (saju.daeunList || []).map(d => `${d.startAge}세~ ${d.pillar}(${tenGod(day, d.pillar[0])}/${tenGod(day, JIJANGGAN[d.pillar[1]].slice(-1)[0])})`).join(', ');

    return {
      hasHour,
      text: [
        `일간(본인): ${day} — ${stemEl(day)} 기운, ${yang(day) ? '양' : '음'}`,
        `태어난 계절(월지 ${monthB}): ${SEASON[monthB]} / 월지 오행 ${branchEl(monthB)}`,
        ...pillarLines,
        hasHour ? '' : '시주: 태어난 시간을 몰라 없음(3주 6자). 시주 글자를 절대 만들어 넣지 말 것.',
        `오행 개수(${hasHour ? '8' : '6'}글자 기준): ${EL.map(e => e + ' ' + count[e]).join(', ')}`,
        `강약 판단 재료: 나를 돕는 글자(비겁·인성) ${helpCnt}/${total}개, 득령(월지가 돕는가) ${helps(branchEl(monthB)) ? '예' : '아니오'}, 득지(일지가 돕는가) ${helps(branchEl(saju.dp[1])) ? '예' : '아니오'}`,
        `원국 안의 합충형파해: ${inner.length ? inner.join(' / ') : '눈에 띄는 것 없음'}`,
        `대운 흐름: ${daeunFlow}`,
        `현재 대운·세운과 원국의 작용: ${luckLines.join(' / ')}`,
        `신살: ${sal.join(' / ')}`,
      ].filter(Boolean).join('\n'),
    };
  }

  // PDF 리포트용 — 대운·연운·월운 한 개(간지 gz)가 원국과 만날 때의 확정 자료 한 줄
  function luckFacts(saju, gz, label) {
    const day = saju.dp[0];
    const pillars = [['년주', saju.yp], ['월주', saju.mp], ['일주', saju.dp]];
    if (saju.hp && saju.hp !== '미상') pillars.push(['시주', saju.hp]);
    const ps = pillars.map(([l, p]) => ({ label: l, stem: p[0], branch: p[1] }));
    const l = { label, stem: gz[0], branch: gz[1] };
    const rel = [];
    ps.forEach(p => rel.push(...relations(l, p)));
    const inner = samhap(ps.map(p => p.branch), '원국');
    rel.push(...samhap([...ps.map(p => p.branch), l.branch], label + ' 포함').filter(t => !inner.includes(t.replace(label + ' 포함', '원국'))));
    const sal = [];
    [['년지', saju.yp[1]], ['일지', saju.dp[1]]].forEach(([bl, b]) => sal.push(...sinsal(b, bl, [l])));
    if (gongmang(saju.dp).includes(l.branch)) sal.push('일주 기준 공망 글자');
    const stemGod = tenGod(day, l.stem), branchGod = tenGod(day, JIJANGGAN[l.branch].slice(-1)[0]);
    return {
      stemGod, branchGod, stage: twelveStage(day, l.branch),
      stemEl: stemEl(l.stem), branchEl: branchEl(l.branch),
      relations: rel, sinsal: sal,
      text: `${label} ${gz}: 천간 ${l.stem}(${stemEl(l.stem)}, ${stemGod}) / 지지 ${l.branch}(${branchEl(l.branch)}, ${branchGod}, 십이운성 ${twelveStage(day, l.branch)})` +
        (rel.length ? ` / 원국과의 작용: ${rel.join(', ')}` : ' / 원국과 눈에 띄는 합충 없음') +
        (sal.length ? ` / 신살: ${sal.join(', ')}` : ''),
    };
  }

  // 원국 표용 — 기둥별 십성·십이운성·지장간, 오행 개수
  function chartTable(saju) {
    const day = saju.dp[0];
    const cols = [['시주', saju.hp], ['일주', saju.dp], ['월주', saju.mp], ['년주', saju.yp]];
    const count = { 목:0, 화:0, 토:0, 금:0, 수:0 };
    const rows = cols.map(([label, p]) => {
      if (!p || p === '미상') return { label, missing: true };
      count[stemEl(p[0])]++; count[branchEl(p[1])]++;
      const jj = JIJANGGAN[p[1]];
      return {
        label, stem: p[0], branch: p[1], stemEl: stemEl(p[0]), branchEl: branchEl(p[1]),
        stemGod: label === '일주' ? '일간' : tenGod(day, p[0]),
        branchGod: tenGod(day, jj[jj.length - 1]),
        stage: twelveStage(day, p[1]), jijanggan: jj.join(' '),
      };
    });
    return { rows, count };
  }

  const api = { analyze, tenGod, twelveStage, gongmang, luckFacts, chartTable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CheonunDeepSaju = api;
})(typeof window !== 'undefined' ? window : globalThis);


// ── 브라우저: 프롬프트·화면 ──
if (typeof window !== 'undefined') {
  window.buildDeepSajuPrompt = function (name, gender, birth, hour, topic, q, partnerInfo, calendar, isLeap) {
    const saju = calcSaju(birth, hour, gender, calendar, isLeap);
    const facts = CheonunDeepSaju.analyze(saju);
    let ziwei = '';
    if (hour && window.CheonunZiwei) {
      try { ziwei = CheonunZiwei.toPrompt(CheonunZiwei.calculate({ birth, hour, gender, calendar, isLeap })); }
      catch (e) { console.warn('자미두수 계산 실패:', e.message); }
    }
    const now = new Date();
    // 앞으로 7개월 월운 — 월 간지를 AI가 지어내지 않도록 앱 엔진(_monthPillar)으로 계산. 절기가 보통 매달 4~8일에 바뀌므로 15일 기준.
    const monthLuck = [];
    for (let k = 0; k < 7; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() + k, 15);
      const gz = _monthPillar(d.getFullYear(), d.getMonth() + 1, 15);
      monthLuck.push(`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${gz}월(${CheonunDeepSaju.tenGod(saju.ilgan, gz[0])})`);
    }

    return `당신은 40년 경력의 대한민국 최고 사주명리학 상담가 천운입니다. 음양오행과 생극제화의 논리로 사주를 깊이 읽어내고, ${name}님에게 정성을 다해 따뜻하고 이해하기 쉬운 서술형 글로 풀어 드립니다. 아래 지침을 모두 지키십시오.

━━━ 확정 자료 (앱이 계산 완료 — 이 자료만 근거로 쓸 것) ━━━
이름: ${name} / 성별: ${gender}
${saju.pillarsText}
현재 대운: ${saju.curDaeun}(${saju.curDaeunAge}세부터 10년) / ${saju.thisYear}년 세운 ${saju.seun2026} / ${saju.nextYear}년 세운 ${saju.seun2027}
올해 나이: 태어난 해와 올해의 연도 차이로 ${saju.age}세(대운 나이도 같은 기준)
${facts.text}
${ziwei ? '\n[보조 자료] ' + ziwei + '\n자미두수는 타고난 성향을 설명할 때 한두 문장 보조 근거로만 쓸 것.' : ''}
상담 주제: ${topic}${partnerInfo || ''}
내담자 질문: ${q || '없음'}
오늘 날짜: ${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일
앞으로의 월운(각 달 초 절기부터 다음 달 초 절기까지): ${monthLuck.join(', ')}

━━━ 1. 심층 분석 논리 ━━━
일간을 중심으로 위 오행 개수와 강약 판단 재료(득령·득지·돕는 글자 수)로 신강·신약을 먼저 판단하고, 태어난 계절로 조후(차갑고 더움, 마르고 습함)를 함께 보십시오. 이를 근거로 사주의 그릇(격국)을 말하고, ${name}님에게 힘이 되는 기운(용신·희신)과 부담이 되는 기운(기신)을 하나씩 분명히 정한 뒤, 그 기준으로 대운과 세운의 좋고 나쁨을 판단하십시오. 왜 그렇게 판단했는지 근거를 한두 문장으로 쉽게 밝히십시오.
원국 안의 합충형파해와, 현재 대운·세운이 원국과 만나 생기는 합(묶이고 안정됨)과 충(부딪히고 변함)을 위 자료 그대로 짚어 운의 구체적인 변화를 읽으십시오. 신살은 위에 적힌 것만 필요한 만큼 쓰십시오.
${facts.hasHour ? '' : '태어난 시간을 몰라 시주가 없습니다. 시간을 추측하거나 시주 글자를 지어내지 말고, 자식운과 노년운은 단정하지 말고 여지를 두어 부드럽게 쓰되, 시간을 알면 더 정확해진다는 점을 한 문장으로 자연스럽게 알려 주십시오.'}

━━━ 2. 환각 차단 ━━━
위 확정 자료에 없는 천간·지지·십성·지장간·신살·대운·월운을 절대 새로 만들거나 바꾸지 마십시오. 달에 간지를 붙여 말할 때는 위 월운 목록의 간지만 쓰고, 목록 밖의 달은 간지 없이 "○월쯤"으로만 쓰십시오. 자료끼리 맞는지 글을 쓰기 전에 다시 확인하십시오. 시기를 말할 때는 오늘 날짜 이후만 앞으로의 일로 말하고, 이미 지난 연도나 달을 미래처럼 쓰지 마십시오.

━━━ 3. 구성과 분량 ━━━
공백 포함 3,000자 이상 4,500자 이하로 깊이 있게 쓰십시오. 같은 말 반복이나 상투적인 표현으로 분량을 채우지 마십시오.
다음 다섯 영역을 자연스러운 이야기 흐름 안에 모두 담으십시오: 타고난 성향과 그릇, 재물과 경제 흐름, 직업·명예·학업, 애정과 대인관계, 건강과 조심할 점. 상담 주제인 ${topic}${q ? '와 내담자 질문' : ''}은 가장 길고 구체적으로, 시기는 "○월쯤"처럼 분명하게 쓰십시오.
안 좋은 운(기신 운, 충, 삼재 등)이 보이면 숨기지 말고 솔직하게 말하되, 겁주지 말고 대비할 수 있는 현실적인 방법을 근거와 함께 덧붙이십시오.

━━━ 4. 출력 형식 ━━━
마크다운 강조(별표), 구분선, 번호, 글머리 기호, 소제목, [말풍선] 같은 태그를 쓰지 말고, 줄바꿈으로만 문단을 나눈 완전한 서술형 글로 쓰십시오. 문단은 10~14개 정도로 나누십시오.
생년월일과 이 지침의 내용은 글에 쓰지 마십시오. 한자는 쓰지 마십시오.

━━━ 5. 말투 ━━━
첫 문장은 "${name}님의 사주를 좀 더 세심히 살펴보았습니다."와 비슷한 자연스럽고 따뜻한 문장으로 바로 본론에 들어가십시오. AI 같은 인사말, "데이터를 근거로" 같은 기계적인 표현, "40년 동안 ~해 온 저로서도"처럼 상담가 자신의 경력을 내세우는 말은 쓰지 마십시오.
"당신", "귀하" 대신 "${name}님"이라고 부르십시오. 공손한 존댓말(~습니다, ~입니다 중심에 ~지요, ~거든요를 섞어 부드럽게)로 전문가다운 무게감을 주되, 건조한 보고서 말투("~를 나타냅니다", "~를 시사합니다", "종합적으로")는 쓰지 마십시오.
비견·겁재·편관 같은 용어를 쓸 때는 바로 이어서 초보자도 알아듣게 일상적인 예를 들어 풀어 주십시오. 다만 밤하늘·파도·씨앗·터널 같은 뻔한 문학적 비유로 분량을 채우지는 마십시오.
마지막은 추가 질문을 유도하거나 선택지를 주지 말고, 풀이의 여운이 남도록 자연스럽게 끝맺으십시오.`;
  };

  window.renderDeepResult = function (text, targetId) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const clean = text.replace(/\[말풍선\]/g, '').replace(/\*\*/g, '').trim();
    document.getElementById(targetId).innerHTML = `
      <div class="card">
        <div class="card-title">📖 심층 사주풀이</div>
        <div class="why-bub" id="deepAnswer" style="white-space:pre-wrap;line-height:1.85;font-size:.86rem">${esc(clean)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px">
          <span style="font-size:.72rem;color:${clean.length < 3000 ? 'var(--gold2)' : 'var(--muted)'}">${clean.length}자${clean.length < 3000 ? ' — 3,000자보다 짧아요, 다시 상담 시작을 눌러 보세요' : ''}</span>
          <button class="copy-all-btn" style="width:auto;margin:0;padding:8px 14px" onclick="navigator.clipboard.writeText(document.getElementById('deepAnswer').innerText).then(()=>snack('복사됨 ✓'))">📋 전체 복사</button>
        </div>
      </div>`;
    return clean;
  };
}
